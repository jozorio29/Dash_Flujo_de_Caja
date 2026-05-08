# Dashboard Flujo de Caja — Xtendo

Dashboard financiero hecho con **Next.js 14 + Tailwind CSS + Recharts**, que se conecta a un Google Sheet para mostrar en tiempo real:

- KPIs (Ingresos, Egresos, Net Flow, Saldo Inicial, Saldo Final)
- Evolución del saldo diario
- Flujos mensuales (ingresos vs egresos + net flow)
- Net Flow mensual (con barra Total)
- Tabla de Principales Categorías de Egresos con sparklines y variación
- Panel de Insights Clave (auto-generado)

## 1. Setup inicial

```bash
npm install
```

## 2. Configurar Google Sheets API

### A. Crear API Key (gratis, ~2 minutos)

1. Entra a [Google Cloud Console](https://console.cloud.google.com/).
2. Crea un proyecto (o selecciona uno existente).
3. Menú → **APIs & Services → Library** → busca **Google Sheets API** → **Enable**.
4. Menú → **APIs & Services → Credentials** → **Create Credentials → API Key**.
5. (Recomendado) Edita la API key recién creada y restringe su uso a **Google Sheets API**.

### B. Compartir el Google Sheet

Abre tu sheet → botón **Compartir** → cambia a **Cualquiera con el enlace** (Lector). Esto permite que la API key lea los datos.

### C. Crear `.env.local`

Copia `.env.example` a `.env.local` y rellena tus valores:

```bash
cp .env.example .env.local
```

```env
GOOGLE_SHEETS_API_KEY=AIzaSy...
GOOGLE_SHEETS_SPREADSHEET_ID=1OIvpXfnfbzwzaTyvvePKsXb5C6I2aD3swDhfYT-vkmQ
GOOGLE_SHEETS_RANGE=Hoja 1!A:O
```

> El `SPREADSHEET_ID` se saca de la URL del sheet:
> `https://docs.google.com/spreadsheets/d/{ESTO_ES_EL_ID}/edit`

## 3. Correr en desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## 4. Estructura de columnas esperada en el sheet

El parser lee el rango `A:N` y solo usa estas **10 columnas** (las posiciones B, E, G, H pueden existir en el sheet pero el dashboard las ignora):

| # | Columna | Uso en el dashboard |
|---|---|---|
| A | **Fecha** | Eje X de gráficos diarios y filtro de rango |
| B | ~Hora~ | Ignorada |
| C | **Mes** | Texto libre, no se usa para agrupar (se agrupa por fecha) |
| D | **Oficina** | Fuente del filtro "Cuenta" |
| E | ~Descripción~ | Ignorada |
| F | **Referencia** | Disponible, no se muestra en v1 |
| G | ~Cód. Trans.~ | Ignorada |
| H | ~ITF~ | Ignorada |
| I | **Tipo** | "INGRESO" o "EGRESO" (auto-detecta si está vacío) |
| J | **Concepto P&L** | Categoría principal en la tabla de egresos |
| K | **Desc P&L** | Fallback de categoría |
| L | **Débitos** | Egresos, numérico |
| M | **Créditos** | Ingresos, numérico |
| N | **Saldo** | Saldo post-movimiento (se usa para evolución diaria) |

La fila de headers se detecta automáticamente buscando "Fecha" en la columna A, así que el sheet puede tener una fila "TOTALES" arriba (o lo que quieras) sin romper el parser.

Si tu hoja tiene otro nombre (p.ej. `Datos` o `Sheet1`), cámbialo en `GOOGLE_SHEETS_RANGE`. El nombre del rango actual es `Consolidado Enero a Marzo!A:N`.

## 5. Estructura del proyecto

```
app/
├── api/dashboard/route.ts   ← endpoint que lee el sheet y agrega
├── layout.tsx               ← layout global con sidebar
├── page.tsx                 ← Resumen (dashboard principal)
└── (otras rutas)/page.tsx   ← Flujo, Ingresos, Egresos, etc.
components/
├── layout/sidebar.tsx
└── dashboard/
    ├── dashboard-view.tsx   ← orquestador
    ├── header.tsx
    ├── kpi-cards.tsx
    ├── daily-balance-chart.tsx
    ├── monthly-flows-chart.tsx
    ├── net-flow-chart.tsx
    ├── category-table.tsx
    └── insights-panel.tsx
lib/
├── sheets.ts                ← cliente Google Sheets API + parser
├── aggregations.ts          ← cálculos de KPIs, mensuales, categorías, insights
├── types.ts
└── utils.ts                 ← parseAmount, parseDate, formatCurrency, etc.
```

## 6. Despliegue

Recomendado: **Vercel** (`vercel deploy`). Define las mismas 3 variables de entorno (`GOOGLE_SHEETS_*`) en Project Settings → Environment Variables.

## 7. Cómo cambiar el rango/hoja

Edita `GOOGLE_SHEETS_RANGE` en `.env.local`. Ejemplos:
- `Hoja 1!A:O` — todo el rango A a O de la pestaña "Hoja 1"
- `Movimientos!A2:O` — desde la fila 2 (saltando una fila de TOTALES)
- `Datos!A:Z` — todas las columnas
