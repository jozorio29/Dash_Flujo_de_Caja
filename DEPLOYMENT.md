# Guía de Deploy — Vercel + GitHub + Google OAuth

Esta guía te lleva paso a paso de "código local" a "URL pública con login restringido". Tiempo estimado: **20-25 minutos** la primera vez.

## Resumen del flujo

```
Tu compu → GitHub (privado) → Vercel (auto-deploy)
                                  ↓
                 https://tu-app.vercel.app  ←  login Google (solo emails de la allowlist)
                                  ↓
                          Google Sheets API
```

---

## Paso 1 — Sube el código a GitHub (5 min)

Asume que ya tienes cuenta de GitHub. Desde la terminal de VSCode (en la carpeta del proyecto):

```bash
# 1.1 Inicializa git si no lo está
git init
git add .
git commit -m "Initial commit: Dashboard Flujo de Caja"

# 1.2 Crea el repo en GitHub:
#     - Ve a https://github.com/new
#     - Name: dash-flujo-caja-xtendo (o como prefieras)
#     - IMPORTANTE: marca "Private" (datos financieros)
#     - NO marques "Add README" ni .gitignore (ya los tienes)
#     - Click "Create repository"

# 1.3 Conecta y push (reemplaza TU_USUARIO):
git remote add origin https://github.com/TU_USUARIO/dash-flujo-caja-xtendo.git
git branch -M main
git push -u origin main
```

**Verifica:** entra a `https://github.com/TU_USUARIO/dash-flujo-caja-xtendo` y deberías ver tus archivos. Importante: `.env.local` NO debe aparecer (está en `.gitignore`).

---

## Paso 2 — Configura Google OAuth (5 min)

Esto crea las credenciales que permiten el "Login con Google".

1. Ve a https://console.cloud.google.com/apis/credentials
2. Selecciona el mismo proyecto donde tienes la API Key del Sheets (o crea uno nuevo).
3. **OAuth consent screen** (panel izquierdo):
   - User Type: **External** → Create
   - App name: `Flujo de Caja Xtendo`
   - User support email: tu email
   - Developer contact: tu email
   - Save and Continue → Scopes: deja default → Continue
   - Test users: **agrega los emails que tendrán acceso** (puedes agregar más después)
   - Continue → Back to Dashboard
4. **Credentials** → **Create Credentials** → **OAuth client ID**:
   - Application type: **Web application**
   - Name: `Flujo de Caja Xtendo`
   - Authorized redirect URIs (click "Add URI" para cada uno):
     - `http://localhost:3000/api/auth/callback/google`
     - (la URL de producción la agregamos después del paso 3)
   - **Create**
5. Copia el **Client ID** y **Client Secret** que aparecen — los necesitas en el siguiente paso.

---

## Paso 3 — Deploy en Vercel (5 min)

1. Ve a https://vercel.com → **Sign Up** con tu cuenta de GitHub.
2. Una vez dentro, click **Add New** → **Project**.
3. Selecciona el repo `dash-flujo-caja-xtendo` → **Import**.
4. Framework Preset: Next.js (debería auto-detectarlo).
5. **Environment Variables** — agrega TODAS estas (copy-paste de tu `.env.local`):

   | Name | Value |
   |---|---|
   | `GOOGLE_SHEETS_API_KEY` | (tu API key del Sheets) |
   | `GOOGLE_SHEETS_SPREADSHEET_ID` | `1rXG5UJVRwwpVqbzYIkwfpQS9LMZjGTPdu6HLm72K1Yk` |
   | `GOOGLE_SHEETS_RANGE` | `Consolidado Enero a Marzo!A:N` |
   | `GOOGLE_CLIENT_ID` | (del paso 2) |
   | `GOOGLE_CLIENT_SECRET` | (del paso 2) |
   | `NEXTAUTH_SECRET` | corre `openssl rand -base64 32` y pega el resultado |
   | `ALLOWED_EMAILS` | `tu_email@gmail.com,otra_persona@gmail.com` |

   > **No agregues** `NEXTAUTH_URL` — Vercel la setea automáticamente.

6. **Deploy**. Vercel compila e instala (≈2 minutos). Cuando termine, te da una URL tipo `https://dash-flujo-caja-xtendo.vercel.app`.

---

## Paso 4 — Termina la config de OAuth (2 min)

Ya tienes la URL de producción, ahora autorízala en Google:

1. Vuelve a https://console.cloud.google.com/apis/credentials
2. Click en tu OAuth client ID → **Edit**
3. En **Authorized redirect URIs** agrega:
   - `https://dash-flujo-caja-xtendo.vercel.app/api/auth/callback/google`
   (reemplaza con TU URL real de Vercel)
4. **Save**

---

## Paso 5 — Probar todo (2 min)

1. Abre tu URL `https://dash-flujo-caja-xtendo.vercel.app`.
2. Te debe redirigir a `/login`.
3. Click "Continuar con Google" → elige tu cuenta autorizada.
4. ¡Deberías estar dentro del dashboard!

**Pruebas adicionales:**
- Intenta entrar con un email NO autorizado: te debe rechazar con mensaje claro.
- Click "Cerrar sesión" en el sidebar → vuelves a `/login`.

---

## Después: agregar/quitar usuarios

Para dar acceso a alguien nuevo:

1. Vercel → tu proyecto → **Settings** → **Environment Variables** → edita `ALLOWED_EMAILS`.
2. Agrega el email separado por coma: `tu@gmail.com,nuevo@gmail.com,otro@gmail.com`.
3. Save.
4. **Importante:** click en el último deploy → **Redeploy** (los env vars solo se recargan al redeployar, son ~30s).
5. (Opcional) Si tu OAuth consent screen está en modo "Testing", agrega también el email como Test User en Google Cloud Console.

Para retirar acceso, simplemente quita el email de `ALLOWED_EMAILS` y redeploy.

---

## Auto-deploy: cambios en el código

Vercel está conectado a GitHub. Cada vez que hagas:

```bash
git add .
git commit -m "mensaje del cambio"
git push
```

Vercel detecta el push y redeployea automáticamente (≈2 min). La URL siempre apunta al último deploy exitoso.

---

## Costos

- **Vercel Hobby plan:** gratis. Más que suficiente para este uso (límite: 100 GB-horas/mes y 100 GB de bandwidth).
- **Google Cloud:** la API de Sheets tiene 300 requests/minuto gratis y 100k al día. El dashboard cachea 60s, no te vas a acercar al límite.
- **Total: $0/mes** mientras seas tú y un grupo pequeño.

---

## Troubleshooting

**"Error 401" al cargar el dashboard**
→ El sheet no está compartido públicamente. Compártelo como "Cualquiera con el enlace" (Lector).

**"Access denied" al hacer login con un email que SÍ está en allowlist**
→ Revisa que el email en `ALLOWED_EMAILS` esté en minúsculas y sin espacios. Caso típico: `Tu_Email@Gmail.com` ≠ `tu_email@gmail.com`.

**"redirect_uri_mismatch" después del login**
→ Falta agregar la URL de Vercel en "Authorized redirect URIs" del OAuth client (paso 4). Recuerda incluir `/api/auth/callback/google` al final.

**El dashboard funciona en local pero falla en producción con error 500**
→ Falta alguna env var en Vercel. Settings → Environment Variables y verifica las 7 variables del paso 3.

**OAuth consent screen dice "App not verified"**
→ Normal mientras esté en modo "Testing". Solo afecta la pantalla amarilla de "advertencia". Los Test Users que agregaste pueden seguir entrando. Si quieres quitarla, hay que hacer el proceso de verificación de Google (no necesario para uso interno).
