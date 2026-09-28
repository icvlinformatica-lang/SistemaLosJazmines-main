-- Lo que el precio del salón ya incluye (flyer): mesas, sillas, vajilla y
-- mantelería; decoración; DJ, sonido, luces y humo; coordinación; suite;
-- limpieza; portero.
--
-- Se marca en tablas propias y NO por el nombre del servicio ni de la
-- persona: así Administración puede cambiar quién es el portero de los
-- sábados, o sumar algo al paquete, desde la pantalla del tarifario y sin
-- tocar código. Un renombre no rompe nada.
--
-- Migración aditiva: crea dos tablas y agrega filas nuevas a "personal" y
-- "servicios". No modifica ni desactiva ningún registro existente.
-- RLS activado sin políticas, igual que el resto del sistema.

-- ─── Qué servicios vienen con el salón ───────────────────────────────────
create table if not exists salon_incluye_servicio (
  servicio_id text primary key references servicios(id) on delete cascade
);

alter table salon_incluye_servicio enable row level security;

-- ─── Qué personal viene con el salón, por día ────────────────────────────
-- El sábado y el viernes tienen su propia gente. Domingo a jueves se cotizan
-- como viernes (mismo criterio que la grilla de precios, ver
-- lib/tarifario-cotizador.ts).
create table if not exists salon_incluye_personal (
  personal_id text primary key references personal(id) on delete cascade,
  dia         text not null check (dia in ('viernes','sabado'))
);

create index if not exists idx_salon_incluye_personal_dia on salon_incluye_personal (dia);

alter table salon_incluye_personal enable row level security;
