export interface PLCellLink {
  id:string; account_id:string|null; summary_id:string|null;
  year:number; month:number; currency:string; url:string; updated_at:string;
}
export function normalizeInvoiceURL(input:unknown):string {
  if(typeof input!=='string' || input.length>2048)throw new Error('Pega un enlace HTTPS válido de hasta 2048 caracteres.');
  let url:URL;
  try {url=new URL(input.trim());}catch{throw new Error('Pega el enlace completo, comenzando con https://.');}
  if(url.protocol!=='https:' || url.username || url.password || !url.hostname.includes('.'))throw new Error('El enlace debe usar HTTPS y no incluir credenciales.');
  return url.href;
}
