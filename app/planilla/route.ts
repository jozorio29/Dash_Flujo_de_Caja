import { NextResponse } from "next/server";

export function GET() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!spreadsheetId) {
    return NextResponse.json(
      { error: "GOOGLE_SHEETS_SPREADSHEET_ID no está configurado." },
      { status: 503 }
    );
  }

  return NextResponse.redirect(
    `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/edit`
  );
}
