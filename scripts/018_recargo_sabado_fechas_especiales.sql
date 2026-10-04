-- 018 — Recargo de sábado por salón + fechas especiales del cotizador.
--
-- SOLO ADITIVA: agrega columnas con valores por defecto que no cambian
-- ningún precio (valor 0) y tablas nuevas. No borra ni modifica datos.
-- NO toca el Calendario de Precios viejo (precios_venta), que sigue usando
-- el planificador.
--
-- Cuentas en lib/cotizador-salon.ts (resolverDia + armarCotizacion).

-- 1. Recargo de sábado en cada salón
alter table cotizador_salon
  add column if not exists recargo_sabado_tipo text not null default 'monto'
    check (recargo_sabado_tipo in ('monto', 'porcentaje')),
  add column if not exists recargo_sabado_valor numeric not null default 0
    check (recargo_sabado_valor >= 0),
  add column if not exists recargo_sabado_rubros text[] not null default '{salon}'
    check (recargo_sabado_rubros <@ array['salon','cocina','barra','servicios']::text[]);

-- 2. Fechas especiales (un día puntual, no se repite solo cada año)
create table if not exists cotizador_fecha_especial (
  id                text primary key default gen_random_uuid()::text,
  fecha             date not null,
  nombre            text not null check (length(btrim(nombre)) > 0),
  todos_los_salones boolean not null default true,
  modo              text not null check (modo in ('sabado', 'viernes', 'propio')),
  -- Solo para modo 'propio' (en los otros dos quedan vacíos):
  recargo_tipo      text check (recargo_tipo in ('monto', 'porcentaje')),
  recargo_valor     numeric check (recargo_valor >= 0),
  recargo_rubros    text[] check (recargo_rubros <@ array['salon','cocina','barra','servicios']::text[]),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check ((modo = 'propio') = (recargo_tipo is not null and recargo_valor is not null and recargo_rubros is not null))
);
alter table cotizador_fecha_especial enable row level security;
create index if not exists idx_cotizador_fecha_especial_fecha on cotizador_fecha_especial (fecha);

-- 3. A qué salones aplica cada fecha. La clave (fecha, salon) hace que la
--    BASE rechace dos fechas especiales el mismo día para el mismo salón.
--    "Todos" = una fila por cada uno de los 5 salones.
create table if not exists cotizador_fecha_especial_salon (
  fecha_especial_id text not null references cotizador_fecha_especial(id) on delete cascade,
  fecha             date not null,
  salon             text not null,
  primary key (fecha, salon)
);
alter table cotizador_fecha_especial_salon enable row level security;
