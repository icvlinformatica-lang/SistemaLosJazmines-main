-- Cotizador rápido, Parte 1: configuración (Eventos > Cotizaciones > Configuración).
--
-- Aditiva: no modifica ni borra datos existentes. Se puede correr más de una
-- vez (if not exists / on conflict do nothing).
--
--  1. cotizador_config: clave → valor (jsonb) para lo configurable del
--     cotizador: margen del menú, margen de barra y qué platos aparecen
--     como botón (y en qué orden).
--  2. cotizador_servicio_oculto: servicios APAGADOS en el cotizador. Vacía =
--     aparecen todos, así que la tabla "servicios" no se toca.
--  3. barra_templates.en_cotizador: si la barra aparece como opción para
--     cotizar. Arranca en false: hoy ninguna barra aparece en el cotizador,
--     así que no cambia nada de lo existente.

create table if not exists cotizador_config (
  clave       text primary key,
  valor       jsonb not null,
  updated_at  timestamptz not null default now()
);
alter table cotizador_config enable row level security;

insert into cotizador_config (clave, valor) values
  ('margen_menu', '0.5'::jsonb),
  ('margen_barra', '0.5'::jsonb),
  -- Milanesa de pollo (suprema), Bondiola a la parrilla, Pastas rellenas,
  -- Asado completo, Pizza party — en ese orden.
  ('recetas_menu', '["9a6d1ca8-5371-44f0-bf67-b4352434655f","P007","P006","P003","P009"]'::jsonb)
on conflict (clave) do nothing;

create table if not exists cotizador_servicio_oculto (
  servicio_id text primary key references servicios(id) on delete cascade
);
alter table cotizador_servicio_oculto enable row level security;

alter table barra_templates add column if not exists en_cotizador boolean not null default false;
