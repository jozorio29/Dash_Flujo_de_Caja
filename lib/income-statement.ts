// Catálogo transcrito del plan de cuentas compartido. Sin importes ni conexión
// a movimientos: las celdas vacías representan datos todavía no disponibles.
export interface StatementGroup {
  id: string;
  label: string;
  accounts: string[];
}

export interface StatementSection {
  id: string;
  label: string;
  total: string;
  tone: "blue" | "green" | "rose" | "amber";
  groups: StatementGroup[];
}

export const statementSections: StatementSection[] = [
  { id: "socios", label: "Aporte de socios", total: "Total aportes de socios", tone: "blue", groups: [
    { id: "aportes", label: "Aportes de capital", accounts: ["APORTE MB — Martín Barbero", "APORTE DB — Diego Barbero"] },
    { id: "retiros", label: "Recupero de aportes", accounts: ["Retiro Aporte de Capital MB", "Retiro Aporte de Capital DB"] },
  ] },
  { id: "ingresos", label: "Ingresos operativos", total: "Total ingresos operativos", tone: "green", groups: [
    { id: "tigo", label: "INGRESO TIGO", accounts: ["e-sim", "call center", "televentas Bolivia", "Televentas Uruguay", "Otros servicios", "TIGO Uruguay Call center Capacitación", "TIGO Uruguay Televentas Capacitación", "TIGO Uruguay Portabilidad Capacitación"] },
    { id: "otros-ingresos", label: "Otros Ingresos TIGO", accounts: ["Alquiler de Posiciones de Trabajo — Tupperware", "Alquiler de Posiciones de Trabajo — Torres Zen"] },
  ] },
  { id: "egresos", label: "Egresos operativos", total: "Total egresos operativos", tone: "rose", groups: [
    { id: "nomina", label: "Salarios en Nómina", accounts: ["Nómina - Salarios al Personal", "Nómina - Bono Training", "Nómina - Anticipo", "Nómina - Finiquito", "Nómina - Días Trabajados", "Nómina - Ajustes de Horas"] },
    { id: "prestadores", label: "Honorarios Prestadores de Servicio BO", accounts: ["Honorarios Aida Riveros", "Honorarios Oscar Notto", "Honorarios Harold Gonzales", "Honorarios Antonio Garcia - IT", "Honorarios Luis Mendoza - Procesos", "Bono e Incentivos"] },
    { id: "profesionales", label: "Honorarios Profesionales Externos", accounts: ["Honorarios Sergio Leon", "Honorarios Contador", "Honorarios Abogado", "Honorarios Notaría", "Honorarios Harold Gonzales", "Honorarios Personal Técnico", "Consultoría Bolivia - Rodrigo Masjoan", "Consultoría Ambiental", "Consultoría Gestión Seguridad y Salud en el Trabajo", "Honorarios por Servicios Profesionales"] },
    { id: "oficina", label: "Gastos Generales de Oficina", accounts: ["Gastos de Entrenamiento y capacitación", "Bono Transporte Nocturno Agentes", "Gastos de Bidones de Agua", "Gastos de Limpieza", "Gastos de mantenimiento", "Gastos de Refrigerios / Cafetería / Supermercado", "Gastos de Salud (Botiquín y Consultas Med.)", "Útiles oficina e Impresiones", "Trámites y Gestiones Administrativas", "Tarjetas magnéticas", "Fondo Fijo", "Consumo agua - Tupperware", "Solicitudes Tigo", "Gastos de Logística", "Gastos Varios", "Higiene Seguridad y Salud Ocupacional"] },
    { id: "alquiler", label: "Alquiler de Oficina", accounts: ["Alquiler Oficina Sobode", "Expensas Alquiler Sobode", "Alquiler Oficina Tupperware", "Alquiler Oficina Tupperware sala capacitación", "Alquiler Oficina Torres Zen", "Alquiler Cowork Televentas", "Alquiler M40", "Alquiler CBBA", "Comisión Inmobiliaria CBBA", "Comisión Inmobiliaria Tupperware", "Alquiler Oficina Torre 42"] },
    { id: "energia", label: "Energía Eléctrica", accounts: ["Energía Eléctrica - Sobode", "Energía Eléctrica - Tupperware", "Energía Eléctrica - Torres Zen"] },
    { id: "personal", label: "Gastos del personal", accounts: ["Uniforme corporativo", "Incentivo al Personal"] },
    { id: "cargas", label: "Cargas Sociales", accounts: ["CNS", "Gestora Pública", "Depósito Subsidio de Lactancia", "Afiliación CNS Agentes", "Depósito Subsidio Pre-natal"] },
    { id: "infraestructura", label: "Gastos de Infraestructura", accounts: ["Internet", "Internet back up", "Ploteado Oficina", "Alquiler Generador", "Instalación Generador", "Mantenimiento Generador", "Mantenimiento Aire Acondicionado", "Gastos de Informática", "Licencia Claude", "Sistemas Control Asistencia", "Sistema Control Web Cloud", "Soporte Técnico", "Sistema de RRHH"] },
    { id: "impuestos", label: "Impuestos", accounts: ["IVA", "IT 3%", "RC-IVA Retenciones", "IT Retenciones", "RC-IVA Agente de Retención"] },
    { id: "comercializacion", label: "Gastos de Comercialización", accounts: ["Marketing y Publicidad", "Comisiones por ventas"] },
    { id: "financieros", label: "Gastos Financieros", accounts: ["Transferencias al Exterior", "Compra/Venta de Moneda USD", "Transferencias entre cuentas"] },
    { id: "reclutamiento", label: "Reclutamiento y Selección", accounts: [] },
    { id: "viajes", label: "Gastos de Viaje y Representación", accounts: ["Alojamiento", "Pasajes", "Cenas / Almuerzos"] },
  ] },
  { id: "inversion", label: "Inversión", total: "Total inversión en infraestructura", tone: "amber", groups: [
    { id: "inversion-infraestructura", label: "Inversión en Infraestructura", accounts: ["Muebles y Enseres", "Equipos de Computación", "Equipos e Instalación", "Obras civiles", "Licencias de Software"] },
  ] },
];
