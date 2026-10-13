-- 023 — Historial del chat con IA (Administración y Soporte).
--
-- SOLO ADITIVA: crea una tabla nueva. No toca ninguna tabla existente.
--
-- Guarda cada pregunta y cada respuesta del chat flotante de IA para que no
-- se borre nunca y se vea igual desde Administración y desde Soporte (es una
-- sola conversación compartida). No hay borrado desde el sistema.
--
--   id        texto armado en el navegador: reintentar la misma pregunta no
--             la guarda dos veces (insert ... on conflict do nothing).
--   perfil    quién preguntó ("administracion" o "soporte").
--   rol       "user" (la pregunta) o "assistant" (la respuesta de la IA).
--   contenido el texto.
--   acciones  botones que puso la IA ([{etiqueta, href}]) o null.
--
-- Acceso solo por el servidor (app/api/chat): RLS activado y sin políticas,
-- y sin permisos para anon ni authenticated, como el resto de las tablas.
-- El código funciona aunque la tabla todavía no exista (el chat responde
-- pero avisa que no guardó), así que el orden con el deploy no importa.

begin;

create table if not exists chat_ia_mensajes (
  id text primary key,
  perfil text not null,
  rol text not null check (rol in ('user', 'assistant')),
  contenido text not null,
  acciones jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_ia_mensajes_created_at_idx on chat_ia_mensajes (created_at desc);

alter table chat_ia_mensajes enable row level security;
revoke all on chat_ia_mensajes from anon, authenticated;

commit;

-- Verificación (tiene que dar 0 filas):
--   select grantee, privilege_type from information_schema.role_table_grants
--   where table_name = 'chat_ia_mensajes' and grantee in ('anon', 'authenticated');
