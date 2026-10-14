-- 024 — Anotaciones de cada perfil en cada evento.
--
-- SOLO ADITIVA: crea una tabla nueva. No toca ninguna tabla existente.
--
-- En la ventana de un evento del calendario (Próximos eventos del staff,
-- Guías de producción de Cocina y el Calendario de Administración) cada
-- perfil tiene un cuadro "Anotaciones" que se guarda solo mientras escribe.
-- Es una anotación por evento y por perfil: la de Barra no es la de DJ.
--
--   evento_id   el id del evento (eventos.id).
--   perfil      qué perfil la escribió ("barra", "dj", "cocina"...). Sale de
--               la sesión firmada, no de lo que mande la pantalla.
--   texto       lo escrito (hasta 5000 caracteres).
--   updated_at  última vez que se guardó.
--
-- Va en su propia tabla y no dentro de `eventos` a propósito: guardar un
-- evento manda un mail y pasa por los controles de cobro; una anotación no.
--
-- Acceso solo por el servidor (app/api/eventos/[id]/anotacion): RLS activado
-- y sin políticas, y sin permisos para anon ni authenticated. El código
-- funciona aunque la tabla todavía no exista (el cuadro avisa que no se
-- puede guardar), así que el orden con el deploy no importa.

begin;

create table if not exists anotaciones_evento (
  evento_id text not null,
  perfil text not null,
  texto text not null default '',
  updated_at timestamptz not null default now(),
  primary key (evento_id, perfil)
);

alter table anotaciones_evento enable row level security;
revoke all on anotaciones_evento from anon, authenticated;

commit;

-- Verificación (tiene que dar 0 filas):
--   select grantee, privilege_type from information_schema.role_table_grants
--   where table_name = 'anotaciones_evento' and grantee in ('anon', 'authenticated');
