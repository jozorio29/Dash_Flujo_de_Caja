# Estado de Resultados con Supabase

## Configuración del servidor

En `.env.local` y en las variables del entorno de despliegue:

```env
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
PL_EDITOR_EMAILS=editor@empresa.com,otro@empresa.com
```

Reiniciar Next.js tras cambiar variables. No usar NEXT_PUBLIC para la clave secreta.
Los usuarios con sesión NextAuth consultan el informe; solamente los correos de
PL_EDITOR_EMAILS pueden modificarlo. Sin esa variable, todos tienen solo lectura.
La clave de servidor omite RLS; la ruta valida sesión, editor, origen y contenido.

## Uso

Abrir `/estado-resultados`. Seleccionar año y moneda. Pulsar una celda, introducir
un importe sin separadores de miles (ejemplo: `38377,50`) y Guardar. Cero es un
importe explícito. Dejar el campo vacío y guardar elimina solamente ese mes.
El botón + del grupo crea una cuenta en ese grupo o subgrupo. Un clic sobre el nombre permite editar cuentas, grupos, subgrupos y secciones
directamente en la celda. Enter guarda y Escape cancela. La flecha del grupo
permite expandir o contraer su detalle. Conserva los
identificadores, los importes y las relaciones; el nombre cambia en todos los
años y monedas. Solo los editores autorizados pueden hacerlo.
Actualizar vuelve a consultar la base. Las celdas modificadas por otro usuario
no se sobrescriben si cambió su versión desde la lectura: cancelar y actualizar.

Los totales suman lo cargado y pueden ser parciales. El resultado operativo exige
un importe para cada cuenta de ingresos y egresos del mes. USD y BOB son cargas
independientes; no hay conversión automática ni edición de tipo de cambio.
No se incluyen todavía importación de Excel, referencias entre celdas ni historial
completo. updated_by y updated_at identifican la última modificación del importe.

## Fórmulas aritméticas

Ejecutar una vez `supabase/migrations/20260924_pl_formulas.sql` en el SQL Editor
de Supabase y actualizar el dashboard. Agrega la columna opcional `formula`;
los importes existentes permanecen intactos. Antes de aplicar el script, la
lectura y la carga de números siguen disponibles y las fórmulas quedan bloqueadas.

En una celda escribir `=10000-2500`, `=(1000+500)/3` o `=50000*15%`.
Admite +, -, *, /, %, paréntesis y signo negativo; decimales con coma o punto,
sin separadores de miles. Un porcentaje representa una división entre 100:
`=100+10%` da 100,1; para aumentar 100 en 10% usar `=100*(1+10%)`.
Los resultados se expresan en la moneda de la celda, sin formato de porcentaje.
La vista previa muestra el resultado; Guardar o Enter conserva fórmula y resultado.
La tabla muestra solo el resultado. Al reabrir la celda se recupera la fórmula.
Sustituirla por un número elimina la fórmula; vaciar la celda elimina ambos.

El servidor vuelve a calcular la expresión, no confía en el resultado enviado.
Usa fracciones exactas y redondea al final a seis decimales. Detecta división por
cero, sintaxis inválida y resultados fuera del rango. No ejecuta JavaScript.
Admite referencias como `=D2+E4`: B corresponde a enero y M a diciembre.
Los números junto a las cuentas identifican las filas; títulos y totales no son
celdas referenciables. Las referencias usan el año y moneda seleccionados.
Se guardan vinculadas al identificador de la cuenta: mover filas actualiza la
referencia visible sin cambiar la cuenta utilizada. Contraer grupos no cambia
la numeración. Las celdas sin importe se calculan como cero.

Los resultados dependientes se recalculan al leer el P&L y al guardar desde la
web. El campo amount almacenado de una fórmula es una instantánea; consultas
externas directas deben recalcular sus dependencias. Los ciclos se rechazan al
guardar y los errores de cálculo se muestran como #ERROR, sin mostrar resultados
anteriores. Las cuentas referenciadas se pueden archivar pero no eliminar.
No incluye rangos, SUMA ni referencias a otros años u hojas. No requiere otra
migración aparte de la columna formula indicada arriba.

## Catálogo inicial

`node scripts/seed-pl-catalog.mjs` muestra el alcance.
`node scripts/seed-pl-catalog.mjs --apply` agrega las cuentas del catálogo local,
conservando códigos existentes y sin modificar importes. Puede repetirse tras
una interrupción. No renombrar los códigos del catálogo inicial durante la carga.
Las ocho cuentas TIGO usan los mismos códigos del SQL inicial.

## Verificación

`node --test tests/pl.test.cjs`
`npx tsc --noEmit`

Las pruebas de API usan un almacén simulado; no crean importes en producción.

## Eliminar una fila

Al hacer clic en el nombre de una cuenta activa aparece «Eliminar fila».
El servidor comprueba si existen importes en cualquier año o moneda, incluyendo
ceros. Si no existen, permite eliminar con confirmación; la clave foránea impide
borrar importes agregados simultáneamente. Si existen, ofrece archivar la cuenta:
conserva sus importes y totales históricos, y bloquea nuevas cargas. Las cuentas
archivadas solo se muestran en ejercicios/monedas donde tienen importes, con la
etiqueta «archivada». Esta opción no elimina grupos ni secciones.

## Orden de filas

Los editores pueden arrastrar desde el margen izquierdo de una cuenta o grupo.
La línea azul indica si se insertará antes o después. El mismo control admite
flechas arriba/abajo con el teclado. Los grupos mantienen sus descendientes.
Solo se permite reordenar cuentas del mismo grupo o grupos del mismo padre y
sección. El orden es común a todos los años y monedas. Se guarda sort_order,
sin modificar nombres, relaciones ni importes. Si falla la conexión, actualizar
para consultar el orden persistido. La renumeración usa varias operaciones y
no es transaccional: evitar reordenar simultáneamente con otro editor.

## Costos de Servicios

La sección `COSTOS_SERVICIOS` (orden 25) se ubica entre ingresos y egresos.
Contiene tres grupos: Salarios Personal en Nómina, Costo Horario - Equipo Xtendo
Shared Services y Honorarios Prestadores de Servicio Bolivia. Los editores
pueden agregar cuentas con +; los totales se calculan con sus importes.
No se trasladan cuentas existentes ni se transcriben montos automáticamente.
El resultado operativo resta costos de servicios y egresos a los ingresos.

Para otra base, aplicar `supabase/migrations/20261028_pl_service_costs.sql` o
`node scripts/seed-pl-service-costs.mjs --apply`. La carga es repetible sin duplicados.

## Resumen de resultados editable

Ejecutar en el SQL Editor de Supabase, en este orden:
1. `supabase/migrations/20261028_pl_summary_rows.sql`.
2. `supabase/migrations/20261028_pl_summary_cells.sql`.

Después pulsar Actualizar resumen. La interfaz verifica la disponibilidad de la
columna mensual antes de permitir escritura. Las migraciones no cargan importes.

«Agregar fila» inserta una fila vacía en la misma tabla. Escribir el título y
pulsar Enter; después hacer clic en cada mes para cargar su valor. Enter guarda,
Escape cancela. No se guarda al salir de una celda sin confirmar.

- Número: `16751` o `16751,50`, sin separador de miles.
- Porcentaje: `21,5%` (se almacena como 0,215).
- Fórmula: `=B2+B3` o `=100/2`, con las mismas referencias B a M del P&L.
- Vacío: elimina únicamente el contenido del mes editado.

Los títulos y el orden son comunes a todos los años. Los valores se guardan por
año, moneda y mes. Las referencias de fórmula apuntan a UUID de cuentas, no a su
posición, y se recalculan al cambiar los datos de origen. No se permiten palabras
en celdas numéricas ni referencias a otras filas del resumen en las fórmulas nuevas.
Las fórmulas que comienzan con `=` se presentan como importes; el porcentaje se
reconoce cuando se carga un valor literal terminado en `%`.

El anual suma los importes disponibles. Si hay porcentajes en la fila, queda vacío:
no se suman porcentajes mensuales. Las filas de resumen no forman parte de los
totales de las secciones, evitando doble conteo.

Las filas anteriores con fórmula compartida se conservan. Editar un mes crea una
excepción únicamente para ese año/moneda/mes; los demás siguen calculándose con
la definición anterior. Borrar esa celda la deja explícitamente vacía.

Al editar el título se puede eliminar la fila, con confirmación para todos los
períodos. Se mantienen permisos de editor, validación de origen y control de
versión para no sobrescribir cambios simultáneos. La migración protege las cuentas
referenciadas de borrado; aún pueden archivarse.

### Ubicación dentro de la tabla

La tarjeta separada se eliminó. El resumen comparte las columnas de meses y total
anual de la tabla principal. Las filas nuevas se agregan al final del resumen. Cada título y celda se edita directamente.

Después de habilitar `20261028_pl_summary_rows.sql`, ejecutar también
`20261028_pl_results_layout.sql` en el SQL Editor de Supabase y actualizar el P&L.
Esta segunda migración crea Egresos en impuestos y Depreciación y amortización,
y mueve el grupo de catálogo `PL_IMPUESTOS` con sus subgrupos a la sección de
impuestos, conservando cuentas, importes y referencias. Revisar cualquier grupo
tributario personalizado que use otro código: no se reclasifica por coincidencia de nombre.

La secuencia queda: Total egresos operativos → Impuestos y total → Depreciación y
amortización y total → Resumen. Inversión se conserva después del resumen.
Mientras falta esta migración, el resumen aparece después de los egresos operativos.
Al separar impuestos, el total de Egresos operativos deja de incluirlos: revisar
las fórmulas de resumen que referencien esa sección e incluir Impuestos donde corresponda.
No se asignan automáticamente fórmulas contables ni se cargan importes.

### Seleccionar totales azules en una fórmula de resumen

Ejecutar `supabase/migrations/20261028_pl_summary_total_references.sql` si ya se
habían aplicado las migraciones anteriores. No modifica los importes existentes.
En una celda mensual del resumen escribir `=`, hacer clic en el importe mensual
de un total azul, escribir `+` (u otro operador) y seleccionar otro total.
Enter guarda y Escape cancela. Las referencias de totales aparecen numeradas
después de las cuentas, pero se guardan con el UUID de la sección y el mes.
Se recalculan al cambiar los valores o agregar cuentas a la sección. Un total
sin importes aporta cero cuando se referencia en una fórmula, sin cargar ceros
en las cuentas de origen. Un error en una cuenta se propaga al resumen.
La selección comprende los meses de los totales de sección; el total anual no
es una referencia seleccionable. Las secciones referenciadas quedan protegidas
contra borrado por la migración.

Las celdas de resumen sin contenido se muestran en blanco. Un cero calculado o
cargado se mantiene como raya; no se confunde un vacío con un cero guardado.
