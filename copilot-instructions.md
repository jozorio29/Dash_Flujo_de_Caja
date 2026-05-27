# Instrucciones para Copilot - Dash Flujo de Caja Xtendo

## Descripción del Proyecto
Este es un dashboard de flujo de caja desarrollado con **Next.js** y **TypeScript**. El proyecto gestiona proyecciones financieras, ingresos, egresos y análisis de movimientos.

## Tecnologías Principales
- **Framework**: Next.js 14+
- **Lenguaje**: TypeScript
- **Estilos**: Tailwind CSS
- **Autenticación**: NextAuth
- **Base de datos**: MongoDB (conexiones en lib/)
- **Gráficas**: Probablemente Recharts o similar

## Estructura del Proyecto
```
app/          → Rutas y páginas Next.js
components/   → Componentes React reutilizables
lib/          → Utilidades, tipos, autenticación y conexiones
public/       → Archivos estáticos
```

## Convenciones de Código
- Usar **TypeScript** para todo el código
- Componentes funcionales con hooks
- Componentes organizados por módulo (auth, dashboard, layout, etc.)
- Usar tipos definidos en `lib/types.ts`
- Rutas API en `app/api/`

## Páginas Principales
- `/` - Dashboard principal
- `/login` - Autenticación
- `/diario` - Movimientos diarios
- `/flujo` - Flujo de caja
- `/ingresos` - Gestión de ingresos
- `/egresos` - Gestión de egresos
- `/categorias` - Gestión de categorías
- `/proyectado` - Análisis proyectado
- `/movimientos` - Movimientos

## Al Sugerir Código
1. Mantener consistencia con la estructura existente
2. Usar TypeScript con tipado fuerte
3. Seguir patrones ya establecidos en el proyecto
4. Respetar la estructura de carpetas
5. Usar componentes existentes cuando sea posible
