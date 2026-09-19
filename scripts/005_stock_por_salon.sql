-- Stock de insumos por salón (conteo físico que cargan Cocina / Barra al
-- terminar un evento). Módulo aparte: NO toca insumos.stock_actual ni
-- insumos_barra.stock_actual (stock global que usan impresión, recuperar
-- stock, cierre de evento y la valorización de inventario de Caja Eventos).

-- Sesión de carga: una por cada vez que alguien actualiza un sector de un salón.
-- El id se comparte con el renglón de activity_log de esa sesión, para
-- poder abrir el detalle desde el historial de Administración.
create table if not exists stock_sesiones (
  id             text primary key default gen_random_uuid()::text,
  salon          text not null,
  sector         text not null check (sector in ('cocina','barra')),
  cargado_por    text not null,
  -- set null: si el evento se borra definitivamente, la sesión queda como historial.
  evento_id      text references eventos(id) on delete set null,
  iniciada_en    timestamptz not null default now(),
  cerrada_en     timestamptz,
  cantidad_items integer not null default 0
);

-- Detalle de la sesión: lo que se contó de cada insumo.
create table if not exists stock_sesion_items (
  id                text primary key default gen_random_uuid()::text,
  sesion_id         text not null references stock_sesiones(id) on delete cascade,
  insumo_tipo       text not null check (insumo_tipo in ('cocina','barra')),
  insumo_id         text not null,
  descripcion       text not null,   -- copia al momento de la carga
  unidad            text,            -- copia al momento de la carga
  cantidad_anterior numeric,
  cantidad_nueva    numeric not null
);

-- Saldo vigente por insumo y salón (alimenta la vista consolidada).
create table if not exists stock_salones (
  insumo_tipo      text not null check (insumo_tipo in ('cocina','barra')),
  insumo_id        text not null,
  salon            text not null,
  cantidad         numeric not null default 0,
  ultima_sesion_id text references stock_sesiones(id),
  actualizado_por  text,
  actualizado_en   timestamptz not null default now(),
  primary key (insumo_tipo, insumo_id, salon)
);

create index if not exists stock_sesiones_salon_sector_idx on stock_sesiones (salon, sector, cerrada_en desc);
create index if not exists stock_sesion_items_sesion_idx on stock_sesion_items (sesion_id);
create index if not exists stock_salones_salon_idx on stock_salones (salon);

-- Mismo criterio que el resto de las tablas (insumos, eventos, etc.): RLS
-- activado SIN políticas → cerrado para la clave pública; el sistema accede
-- desde el servidor con la conexión directa (lib/db.ts), que no pasa por RLS.
alter table stock_sesiones enable row level security;
alter table stock_sesion_items enable row level security;
alter table stock_salones enable row level security;
