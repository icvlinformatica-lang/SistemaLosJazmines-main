-- 015 — Cotizador por salón (modelo costo + ganancia). Aplicada el 3/10/2026.
--
-- Cada salón funciona como una empresa aparte: toda la configuración del
-- cotizador pasa a ser por salón (clave = el texto de SALONES en
-- lib/store.ts, igual que tarifario_salon; no hay tabla de salones).
--
-- SOLO ADITIVA: no borra ni modifica nada que el sistema ya use.
-- Quedan SIN USAR (limpiar después del Paso 2): cotizador_config,
-- cotizador_servicio_oculto y barra_templates.en_cotizador. Siguen EN USO
-- por el cotizador del vendedor hasta el Paso 2: tarifario_personal_regla,
-- salon_incluye_servicio y salon_incluye_personal (no se tocan: el
-- "Guardar tarifario" viejo hace DELETE de toda tarifario_personal_regla,
-- por eso las reglas por salón van en una tabla nueva).
--
-- Ganancias en PORCENTAJE (50 = 50 %). Precio = costo × (1 + ganancia/100).

-- 1. Un registro por salón: costo fijo, capacidad y % de ganancia por rubro.
create table if not exists cotizador_salon (
  salon              text primary key,
  costo_salon        numeric not null default 0 check (costo_salon >= 0),
  capacidad_maxima   integer check (capacidad_maxima is null or capacidad_maxima > 0),
  ganancia_salon     numeric not null default 0 check (ganancia_salon >= 0),
  ganancia_cocina    numeric not null default 0 check (ganancia_cocina >= 0),
  ganancia_barra     numeric not null default 0 check (ganancia_barra >= 0),
  ganancia_servicios numeric not null default 0 check (ganancia_servicios >= 0),
  updated_at         timestamptz not null default now()
);
alter table cotizador_salon enable row level security;

-- 2. Qué platos aparecen como botón en cada salón, y en qué orden.
create table if not exists cotizador_salon_receta (
  salon     text not null,
  receta_id text not null references recetas(id) on delete cascade,
  orden     integer not null default 0,
  primary key (salon, receta_id)
);
alter table cotizador_salon_receta enable row level security;

-- 3. Qué barras armadas aparecen en cada salón (si hay fila, aparece).
create table if not exists cotizador_salon_barra (
  salon             text not null,
  barra_template_id text not null references barra_templates(id) on delete cascade,
  primary key (salon, barra_template_id)
);
alter table cotizador_salon_barra enable row level security;

-- 4. Servicios por salón. Sin fila = aparece y no viene incluido (así un
--    servicio nuevo del catálogo aparece solo, igual que hoy).
create table if not exists cotizador_salon_servicio (
  salon       text not null,
  servicio_id text not null references servicios(id) on delete cascade,
  oculto      boolean not null default false,
  incluido    boolean not null default false,
  primary key (salon, servicio_id)
);
alter table cotizador_salon_servicio enable row level security;

-- 5. Reglas de personal por salón. Cantidad = max(mínimo, ⌈invitados / N⌉);
--    N = 0 → personal fijo (siempre el mínimo). tarifa null = la tarifa_base
--    más alta del personal activo de esa función.
create table if not exists cotizador_personal_regla (
  id               text primary key default gen_random_uuid()::text,
  salon            text not null,
  funcion          text not null,
  cada_n_invitados integer not null default 0 check (cada_n_invitados >= 0),
  minimo           integer not null default 0 check (minimo >= 0),
  tarifa           numeric check (tarifa is null or tarifa >= 0),
  ganancia         numeric not null default 0 check (ganancia >= 0),
  aplica           text not null default 'siempre' check (aplica in ('siempre','con_menu','con_barra')),
  orden            integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (salon, funcion)
);
alter table cotizador_personal_regla enable row level security;

-- ── Valores iniciales: lo global de hoy, copiado a los 5 salones ──

-- Ganancia de cocina y barra = margen global (0.5 → 50 %). El resto en 0.
insert into cotizador_salon (salon, ganancia_cocina, ganancia_barra)
select s,
  coalesce((select (valor #>> '{}')::numeric * 100 from cotizador_config where clave = 'margen_menu'), 0),
  coalesce((select (valor #>> '{}')::numeric * 100 from cotizador_config where clave = 'margen_barra'), 0)
from unnest(array['Quinta','Casona','Salon','Salon 4','Salon 5']) s
on conflict (salon) do nothing;

-- Platos del menú, en el mismo orden.
insert into cotizador_salon_receta (salon, receta_id, orden)
select s, r.id, r.ord
from unnest(array['Quinta','Casona','Salon','Salon 4','Salon 5']) s
cross join jsonb_array_elements_text((select valor from cotizador_config where clave = 'recetas_menu'))
     with ordinality r(id, ord)
where exists (select 1 from recetas where recetas.id = r.id)
on conflict do nothing;

-- Barras que hoy aparecen en el cotizador.
insert into cotizador_salon_barra (salon, barra_template_id)
select s, b.id from unnest(array['Quinta','Casona','Salon','Salon 4','Salon 5']) s
cross join barra_templates b where b.en_cotizador
on conflict do nothing;

-- Servicios: ocultos + "incluidos en el salón".
insert into cotizador_salon_servicio (salon, servicio_id, oculto, incluido)
select s, x.servicio_id, bool_or(x.oculto), bool_or(x.incluido)
from unnest(array['Quinta','Casona','Salon','Salon 4','Salon 5']) s
cross join (
  select servicio_id, true as oculto, false as incluido from cotizador_servicio_oculto
  union all
  select servicio_id, false, true from salon_incluye_servicio
) x
group by s, x.servicio_id
on conflict do nothing;
