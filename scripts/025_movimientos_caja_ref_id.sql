-- 025: pagar un gasto de Caja Jazmines descuenta del saldo (14/10/2026).
-- Cada pago deja un egreso en movimientos_caja con ref_id = qué gasto, mes y
-- salón se pagó (ver lib/pagos-caja-jazmines.ts). Al deshacer el pago se borra
-- el egreso con ese ref_id. Columna nueva y vacía: no cambia nada existente.
alter table public.movimientos_caja add column if not exists ref_id text;
create index if not exists movimientos_caja_ref_id_idx on public.movimientos_caja (ref_id) where ref_id is not null;
