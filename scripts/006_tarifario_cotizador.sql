-- Tarifario del cotizador del vendedor.
--
-- PRINCIPIO: el cotizador toma los servicios DEL SISTEMA (tabla servicios)
-- como referencia de precio; todo lo que se cotiza como servicio se edita
-- desde Finanzas > Servicios. Acá viven SOLO las dos cosas que no son
-- servicios: la grilla de precio del salón y la regla de personal.
--
-- Migración puramente ADITIVA: crea tablas nuevas y agrega columnas con
-- default a cotizaciones y eventos. No corre ningún UPDATE sobre datos
-- existentes. Los eventos ya cargados quedan con precio_venta_fijo = false,
-- es decir, con el comportamiento de hoy sin ningún cambio.
--
-- Todas las tablas nuevas van con RLS activado y SIN políticas, igual que el
-- resto del sistema: se entra con el rol postgres (bypass RLS) desde el
-- servidor. El aviso "RLS Enabled No Policy" del linter es esperado.

-- ─── Grilla de precio del salón ──────────────────────────────────────────
-- Precio por salón × rango de invitados × día × modalidad.
-- "dia": sábado tiene su propio precio; domingo a jueves se cotizan como
-- viernes (lo resuelve lib/tarifario-cotizador.ts, acá solo hay dos filas).
create table if not exists tarifario_salon (
  id             text primary key default gen_random_uuid()::text,
  salon          text not null,
  invitados_min  integer not null,
  invitados_max  integer not null,
  dia            text not null check (dia in ('viernes','sabado')),
  modalidad      text not null check (modalidad in ('solo_salon','con_catering')),
  precio         numeric not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint tarifario_salon_rango_valido check (invitados_max >= invitados_min),
  constraint tarifario_salon_unico unique (salon, invitados_min, invitados_max, dia, modalidad)
);

create index if not exists idx_tarifario_salon_busqueda
  on tarifario_salon (salon, modalidad, dia, invitados_min, invitados_max);

alter table tarifario_salon enable row level security;

-- ─── Regla de personal por invitados ─────────────────────────────────────
-- "1 cada N invitados, con un mínimo de M". Solo aplica si hay menú elegido.
-- Arranca vacía a propósito: la carga Administración desde la pantalla.
create table if not exists tarifario_personal_regla (
  id                text primary key default gen_random_uuid()::text,
  funcion           text not null unique,   -- coincide con personal.funcion
  cada_n_invitados  integer not null default 0,
  minimo            integer not null default 0,
  activo            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint tarifario_personal_cada_n_valido check (cada_n_invitados >= 0),
  constraint tarifario_personal_minimo_valido check (minimo >= 0)
);

alter table tarifario_personal_regla enable row level security;

-- ─── Vínculos servicio → recetas / barra ─────────────────────────────────
-- Tablas aparte en vez de columnas en "servicios": los servicios existentes
-- no se tocan, y un servicio de Menú premarca varias recetas (relación N a N).
create table if not exists servicio_recetas (
  servicio_id text not null references servicios(id) on delete cascade,
  receta_id   text not null references recetas(id) on delete cascade,
  primary key (servicio_id, receta_id)
);

alter table servicio_recetas enable row level security;

-- Un servicio de Barra apunta a lo sumo a un template de barra (opcional).
create table if not exists servicio_barra_template (
  servicio_id        text primary key references servicios(id) on delete cascade,
  barra_template_id  text not null references barra_templates(id) on delete cascade
);

alter table servicio_barra_template enable row level security;

-- ─── Columnas nuevas en cotizaciones ─────────────────────────────────────
-- modalidad_salon: qué se está cotizando ("solo_salon" / "con_catering").
-- desglose_venta:  el desglose que produjo lib/tarifario-cotizador.ts, para
--                  que Administración vea exactamente de dónde salió el precio.
-- fuera_de_tarifario + avisos: la cotización usó un precio aproximado, un
--                  servicio en $0 o un salón sin grilla → Administración lo ve marcado.
alter table cotizaciones add column if not exists modalidad_salon    text not null default 'solo_salon';
alter table cotizaciones add column if not exists desglose_venta     jsonb;
alter table cotizaciones add column if not exists fuera_de_tarifario boolean not null default false;
alter table cotizaciones add column if not exists avisos             jsonb;

-- ─── Columnas nuevas en eventos ──────────────────────────────────────────
-- precio_venta_fijo: el precio vino de una cotización aprobada y NO se
-- recalcula al guardar el evento (ver app/evento/page.tsx). Los eventos que
-- ya existen quedan en false = comportamiento actual, sin cambio alguno.
alter table eventos add column if not exists precio_venta_fijo boolean not null default false;
alter table eventos add column if not exists cotizacion_id     text;
