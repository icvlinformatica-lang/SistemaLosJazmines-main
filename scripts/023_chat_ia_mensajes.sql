-- 023 — Historial del chat con IA (Administración y Soporte).
--
-- SOLO ADITIVA: crea una tabla nueva. No toca ninguna tabla existente.
--
-- Guarda cada pregunta y cada respuesta del chat flotante de IA para que no
-- se borre nunca. Cada persona tiene su chat (Diego, Leila, Ricky y Soporte);
-- Soporte puede leer los de los demás. No hay borrado desde el sistema.
--
--   id        texto armado en el navegador: reintentar la misma pregunta no
--             la guarda dos veces (insert ... on conflict do nothing).
--   perfil    con qué perfil se preguntó ("administracion" o "soporte").
--   usuario   de quién es el chat: "Diego", "Leila", "Ricky" (el nombre que
--             se elige al entrar a Administración) o "Soporte".
--   rol       "user" (la pregunta) o "assistant" (la respuesta de la IA).
--   contenido el texto.
--   acciones  botones que puso la IA ([{etiqueta, href}]) o null.
--
-- Acceso solo por el servidor (app/api/chat): RLS activado y sin políticas,
-- y sin permisos para anon ni authenticated, como el resto de las tablas.
-- El código funciona aunque la tabla todavía no exista (el chat responde
-- pero avisa que no guardó), así que el orden con el deploy no importa.
--
-- Se puede correr de nuevo sin problema: si la tabla ya se había creado
-- con la versión anterior (sin "usuario"), le agrega la columna y anota los
-- mensajes viejos como "Soporte" o "Administración" según el perfil.

begin;

create table if not exists chat_ia_mensajes (
  id text primary key,
  perfil text not null,
  usuario text,
  rol text not null check (rol in ('user', 'assistant')),
  contenido text not null,
  acciones jsonb,
  created_at timestamptz not null default now()
);

alter table chat_ia_mensajes add column if not exists usuario text;
update chat_ia_mensajes
  set usuario = case when perfil = 'soporte' then 'Soporte' else 'Administración' end
  where usuario is null;

create index if not exists chat_ia_mensajes_created_at_idx on chat_ia_mensajes (created_at desc);
create index if not exists chat_ia_mensajes_usuario_idx on chat_ia_mensajes (usuario, created_at desc);

alter table chat_ia_mensajes enable row level security;
revoke all on chat_ia_mensajes from anon, authenticated;

commit;

-- Verificación (tiene que dar 0 filas):
--   select grantee, privilege_type from information_schema.role_table_grants
--   where table_name = 'chat_ia_mensajes' and grantee in ('anon', 'authenticated');
