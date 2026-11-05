import { createSign } from "crypto";

interface SheetsResponse {
  range: string;
  majorDimension: string;
  values?: string[][];
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

let cachedAccessToken: { value: string; expiresAt: number } | null = null;

function base64Url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function getServiceAccountCredentials() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n"
  );

  if (!clientEmail || !privateKey) return null;
  return { clientEmail, privateKey };
}

async function getServiceAccountAccessToken(): Promise<string | null> {
  const credentials = getServiceAccountCredentials();
  if (!credentials) return null;

  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60) {
    return cachedAccessToken.value;
  }

  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iss: credentials.clientEmail,
      scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const unsignedToken = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  const signature = base64Url(signer.sign(credentials.privateKey));
  const assertion = `${unsignedToken}.${signature}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });
  const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;

  if (!tokenResponse.ok || !tokenData.access_token) {
    const detail =
      tokenData.error_description || tokenData.error || tokenResponse.statusText;
    throw new Error(`No se pudo autenticar la cuenta de servicio: ${detail}`);
  }

  cachedAccessToken = {
    value: tokenData.access_token,
    expiresAt: now + (tokenData.expires_in || 3600),
  };
  return cachedAccessToken.value;
}

/**
 * Lee valores de Sheets. Para planillas restringidas usa una cuenta de servicio.
 * La API key se conserva como fallback para planillas públicas.
 */
export async function fetchSheetValues(
  spreadsheetId: string,
  range: string
): Promise<string[][]> {
  const accessToken = await getServiceAccountAccessToken();
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY?.trim();

  if (!accessToken && !apiKey) {
    throw new Error(
      "Configura GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"
    );
  }

  const query = new URLSearchParams({
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  if (!accessToken && apiKey) query.set("key", apiKey);

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(range)}?${query.toString()}`;
  const res = await fetch(url, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    const sharingHint = accessToken
      ? " Comparte la planilla como Lector con GOOGLE_SERVICE_ACCOUNT_EMAIL."
      : " La API key solo puede leer una planilla pública.";
    throw new Error(
      `Google Sheets API error ${res.status}: ${body}${sharingHint}`
    );
  }

  const data = (await res.json()) as SheetsResponse;
  return data.values || [];
}

/** Celda de la API de Sheets (solo los campos que se piden en fetchSheetGrid). */
export interface GridCell {
  formattedValue?: string;
  effectiveValue?: { numberValue?: number; stringValue?: string; boolValue?: boolean };
  userEnteredValue?: { formulaValue?: string; numberValue?: number; stringValue?: string };
  effectiveFormat?: {
    backgroundColor?: { red?: number; green?: number; blue?: number };
    textFormat?: { bold?: boolean };
  };
}

/**
 * Lee un rango con valor calculado, texto mostrado, fórmula y formato de cada
 * celda en una sola llamada. Requiere la cuenta de servicio (la API key no
 * alcanza para planillas privadas).
 */
export async function fetchSheetGrid(
  spreadsheetId: string,
  range: string,
  { withFormat = false }: { withFormat?: boolean } = {}
): Promise<GridCell[][]> {
  const accessToken = await getServiceAccountAccessToken();
  if (!accessToken) {
    throw new Error(
      "Configura GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"
    );
  }
  const query = new URLSearchParams({
    ranges: range,
    // El formato pesa mucho por celda: pedirlo solo donde hace falta.
    fields: withFormat
      ? "sheets.data.rowData.values(formattedValue,effectiveFormat(backgroundColor,textFormat.bold))"
      : "sheets.data.rowData.values(formattedValue,effectiveValue,userEnteredValue.formulaValue)",
  });
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}?${query.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Google Sheets API error ${res.status}: ${body} Comparte la planilla como Lector con GOOGLE_SERVICE_ACCOUNT_EMAIL.`
    );
  }
  const data = (await res.json()) as {
    sheets?: { data?: { rowData?: { values?: GridCell[] }[] }[] }[];
  };
  const rows = data.sheets?.[0]?.data?.[0]?.rowData || [];
  return rows.map((r) => r.values || []);
}
