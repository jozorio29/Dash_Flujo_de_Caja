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
