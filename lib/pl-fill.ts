/** Shift only canonical month references. Account/section IDs and constants stay fixed. */
export function shiftPLFormula(formula:string, offset:number):string {
  if(!Number.isInteger(offset) || Math.abs(offset)>11)throw new Error('Desplazamiento inválido.');
  return formula.replace(/@\[([0-9a-f-]{36}):([1-9]|1[0-2])\]/gi,(_,id,month)=>{
    const next=Number(month)+offset;
    if(next<1 || next>12)throw new Error('Una referencia saldría de enero a diciembre. No se rellenó el rango.');
    return `@[${id}:${next}]`;
  });
}
export function fillMonths(source:number,target:number):number[] {
  if(!Number.isInteger(source)||!Number.isInteger(target)||source<1||source>12||target<1||target>12)throw new Error('Mes inválido.');
  const direction=target>=source?1:-1;
  return Array.from({length:Math.abs(target-source)},(_,i)=>source+(i+1)*direction);
}
