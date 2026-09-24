import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canEditPL, plRequest, PLStoreError, readPL } from '@/lib/pl-store';
import { normalizeAmount, type PLAccount, type PLGroup, type PLValue } from '@/lib/pl-model';

export const dynamic = 'force-dynamic';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function period(year: unknown, currency: unknown) { return Number.isInteger(year) && Number(year) >= 2000 && Number(year) <= 2100 && (currency === 'USD' || currency === 'BOB'); }
function error(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }
function failure(e: unknown) {
  if (e instanceof PLStoreError && e.status === 409) return error('El registro cambió o ya existe. Actualiza los datos e inténtalo nuevamente.', 409);
  return error('No se pudo completar la operación. Revisa la conexión con Supabase e inténtalo nuevamente.', 503);
}
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return error('No autorizado.', 401);
  const params = new URL(request.url).searchParams;
  const year = Number(params.get('year')), currency = params.get('currency');
  if (!period(year, currency)) return error('Ejercicio o moneda inválidos.');
  try { return NextResponse.json({ ...await readPL(year, currency!), canEdit: canEditPL(session.user.email) }); }
  catch (e) { return failure(e); }
}
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return error('No autorizado.', 401);
  if (!canEditPL(session.user.email)) return error('No tienes permiso para editar el P&L.', 403);
  if (request.headers.get('origin') !== new URL(request.url).origin) return error('Origen no autorizado.', 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return error('Se requiere JSON.');
  const raw = await request.text();
  if (raw.length > 10000) return error('Solicitud demasiado grande.', 413);
  let body;
  try { body = JSON.parse(raw); } catch { return error('JSON inválido.'); }
  if (!body || typeof body !== 'object') return error('Solicitud inválida.');
  try {
    if (body.action === 'reorder') {
      if (!['accounts', 'groups'].includes(body.kind) || typeof body.id !== 'string' || !uuid.test(body.id) || typeof body.targetId !== 'string' || !uuid.test(body.targetId) || !['before', 'after'].includes(body.position)) return error('Movimiento inválido.');
      const table = body.kind === 'accounts' ? 'pl_accounts' : 'pl_groups';
      const source = (await plRequest<Array<PLAccount & PLGroup>>(table, `select=*&id=eq.${body.id}`))[0];
      if (!source) return error('La fila ya no existe.', 404);
      const filter = body.kind === 'accounts' ? `group_id=eq.${source.group_id}` : `section_id=eq.${source.section_id}&parent_id=${source.parent_id ? 'eq.' + source.parent_id : 'is.null'}`;
      const peers = await plRequest<Array<{id:string;sort_order:number}>>(table, `select=id,sort_order&${filter}&order=sort_order,id&limit=1000`);
      if (peers.length >= 1000) return error('Demasiadas filas para reordenar.');
      if (!peers.some(row => row.id === body.targetId)) return error('Solo puedes mover filas dentro del mismo grupo o nivel.');
      const ordered = peers.filter(row => row.id !== body.id);
      if (body.id === body.targetId) return NextResponse.json({ order: peers });
      ordered.splice(ordered.findIndex(row => row.id === body.targetId) + (body.position === 'after' ? 1 : 0), 0, {id: source.id, sort_order: source.sort_order});
      // Only presentation order is updated; never overwrite names or amounts.
      for (const [index, row] of ordered.entries()) {
        const order = (index + 1) * 10;
        if (row.sort_order !== order) await plRequest(table, `id=eq.${row.id}&${filter}`, {method:'PATCH', body:JSON.stringify({sort_order:order})});
      }
      return NextResponse.json({ order: ordered.map((row,index) => ({id:row.id,sort_order:(index+1)*10})) });
    }
    if (['remove-group-check', 'delete-group'].includes(body.action)) {
      if (typeof body.id !== 'string' || !uuid.test(body.id)) return error('Grupo inválido.');
      const groups = await plRequest<PLGroup[]>('pl_groups', `select=*&id=eq.${body.id}`);
      if (!groups.length) return error('El grupo ya no existe.', 404);
      const children = await plRequest<Array<{ id: string }>>('pl_groups', `select=id&parent_id=eq.${body.id}`);
      const accounts = await plRequest<PLAccount[]>('pl_accounts', `select=*&group_id=eq.${body.id}`);
      const values = (await Promise.all(accounts.map(account => plRequest<Array<{ id: string }>>('pl_monthly_values', `select=id&account_id=eq.${account.id}&limit=1`)))).some(rows => rows.length > 0);
      const canDelete = !children.length && !values;
      if (body.action === 'remove-group-check') return NextResponse.json({ name: groups[0].name, accountCount: accounts.length, hasValues: values, hasChildren: children.length > 0, canDelete });
      if (!canDelete) return error('El grupo contiene subgrupos o importes históricos y no se puede eliminar.', 409);
      for (const account of accounts) await plRequest('pl_accounts', `id=eq.${account.id}`, { method: 'DELETE' });
      const deleted = await plRequest<PLGroup[]>('pl_groups', `id=eq.${body.id}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
      if (!deleted.length) return error('El grupo cambió. Actualiza los datos.', 409);
      return NextResponse.json({ group: deleted[0], accountIds: accounts.map(account => account.id) });
    }
    if (['remove-check', 'delete-account', 'archive-account'].includes(body.action)) {
      if (typeof body.id !== 'string' || !uuid.test(body.id)) return error('Cuenta inválida.');
      const accounts = await plRequest<PLAccount[]>('pl_accounts', `select=*&id=eq.${body.id}`);
      if (!accounts.length) return error('La cuenta ya no existe.', 404);
      // Check every year and currency, including explicit zero values.
      const values = await plRequest<Array<{ id: string }>>('pl_monthly_values', `select=id&account_id=eq.${body.id}&limit=1`);
      if (body.action === 'remove-check') return NextResponse.json({ hasValues: values.length > 0, name: accounts[0].name });
      if (body.action === 'delete-account' && values.length) return error('Esta cuenta tiene importes. Debes archivarla para conservarlos.', 409);
      const rows = await plRequest<PLAccount[]>('pl_accounts', `id=eq.${body.id}&select=*`, {
        method: body.action === 'delete-account' ? 'DELETE' : 'PATCH',
        headers: { Prefer: 'return=representation' },
        ...(body.action === 'archive-account' ? { body: JSON.stringify({ active: false }) } : {}),
      });
      // The database foreign key also prevents deleting concurrently added values.
      if (!rows.length) return error('La cuenta cambió. Actualiza los datos.', 409);
      return NextResponse.json({ archived: body.action === 'archive-account', account: rows[0] });
    }
    if (body.action === 'rename') {
      const tables: Record<string, string> = { accounts: 'pl_accounts', groups: 'pl_groups', sections: 'pl_sections' };
      if (typeof body.kind !== 'string' || !Object.prototype.hasOwnProperty.call(tables, body.kind) || typeof body.id !== 'string' || !uuid.test(body.id) || typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 200 || typeof body.previousName !== 'string' || body.previousName.length > 200) return error('Nombre o registro inválidos.');
      const query = new URLSearchParams({ id: `eq.${body.id}`, name: `eq.${body.previousName}`, select: '*' });
      const rows = await plRequest<Array<{ id: string; name: string }>>(tables[body.kind], query.toString(), { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ name: body.name.trim() }) });
      if (!rows.length) return error('El nombre cambió o el registro ya no existe. Actualiza antes de guardar.', 409);
      return NextResponse.json({ record: rows[0] });
    }
    if (body.action === 'group') {
      if (typeof body.sectionId !== 'string' || !uuid.test(body.sectionId) || typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 200) return error('Sección o nombre inválidos.');
      const sections = await plRequest<Array<{ id: string }>>('pl_sections', `select=id&id=eq.${body.sectionId}`);
      if (!sections.length) return error('La sección no existe.', 404);
      let parentId: string | null = null;
      if (body.parentId !== undefined) {
        if (typeof body.parentId !== 'string' || !uuid.test(body.parentId)) return error('Grupo padre inválido.');
        const parents = await plRequest<PLGroup[]>('pl_groups', `select=id,section_id&id=eq.${body.parentId}`);
        if (!parents.length || parents[0].section_id !== body.sectionId) return error('El grupo padre no pertenece a la sección.', 409);
        parentId = body.parentId;
      }
      const rows = await plRequest<PLGroup[]>('pl_groups', '', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ section_id: body.sectionId, parent_id: parentId, name: body.name.trim(), code: `WEB_${crypto.randomUUID()}`, sort_order: 10000 }) });
      return NextResponse.json({ group: rows[0] });
    }
    if (body.action === 'account') {
      if (typeof body.groupId !== 'string' || !uuid.test(body.groupId) || typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 200) return error('Grupo o nombre inválidos.');
      const rows = await plRequest<PLAccount[]>('pl_accounts', '', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ group_id: body.groupId, name: body.name.trim(), code: `WEB_${crypto.randomUUID()}`, sort_order: 10000 }) });
      return NextResponse.json({ account: rows[0] });
    }
    if (body.action !== 'value' || !period(body.year, body.currency) || !Number.isInteger(body.month) || body.month < 1 || body.month > 12 || typeof body.accountId !== 'string' || !uuid.test(body.accountId)) return error('Cuenta o período inválidos.');
    if (body.previous !== null && (typeof body.previous !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(body.previous))) return error('Versión del registro inválida.');
    let amount: string | null = null;
    if (body.amount !== null) {
      try { if (typeof body.amount !== 'string') throw new Error(); amount = normalizeAmount(body.amount); }
      catch { return error('Importe inválido: usa hasta 14 enteros y 6 decimales, sin separadores de miles.'); }
    }
    const accounts = await plRequest<PLAccount[]>('pl_accounts', `select=*&id=eq.${body.accountId}&active=eq.true`);
    if (!accounts.length) return error('La cuenta no existe o está inactiva.');
    const query = new URLSearchParams({ account_id: `eq.${body.accountId}`, year: `eq.${body.year}`, month: `eq.${body.month}`, currency: `eq.${body.currency}`, select: 'id,account_id,year,month,currency,amount::text,updated_at' });
    if (body.previous !== null) query.set('updated_at', `eq.${body.previous}`);
    const payload = { account_id: body.accountId, year: body.year, month: body.month, currency: body.currency, amount, updated_by: session.user.email, updated_at: new Date().toISOString() };
    if (body.previous === null && amount === null) return NextResponse.json({ value: null });
    const rows = await plRequest<PLValue[]>('pl_monthly_values', body.previous === null ? 'select=id,account_id,year,month,currency,amount::text,updated_at' : query.toString(), {
      method: body.previous === null ? 'POST' : amount === null ? 'DELETE' : 'PATCH',
      headers: { Prefer: 'return=representation' },
      ...(amount === null ? {} : { body: JSON.stringify(payload) }),
    });
    if (!rows.length) return error('Otra persona modificó esta celda. Actualiza antes de guardar.', 409);
    return NextResponse.json({ value: amount === null ? null : rows[0] });
  } catch (e) { return failure(e); }
}
