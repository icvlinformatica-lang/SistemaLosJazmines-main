-- 027 — Recorridos del simulador "Armá tu fiesta" (vista de Clientes).
--
-- SOLO ADITIVA: crea una tabla nueva. No modifica ni borra nada existente.
-- Aplicada el 22/10/2026 por el dueño en el SQL Editor de Supabase (verificado:
-- 8 columnas, RLS activado, sin políticas y 0 permisos para anon/authenticated).
--
-- Pedido de Rodri (22/10/2026): "ver dónde se quedan estancados al navegar
-- por la web del cotizador". Cada visita de quien entra con el link del
-- simulador (perfil "clientes") anota hasta qué etapa llegó: abrió, cada paso
-- (festejo, salón, lugar, fecha, invitados, menú, barra, detalles), vio el
-- precio, abrió la hoja de datos y pidió el presupuesto por WhatsApp. Soporte
-- lo ve como un embudo arriba del simulador (lib/clientes-embudo.ts).
--
-- SIN DATOS PERSONALES: no se guarda el nombre, el WhatsApp ni el mail de la
-- hoja, ni la IP ni el navegador. Solo las etapas, el festejo y la clave del
-- salón. El id lo genera el navegador (uno por visita): un reintento no
-- duplica la visita (ON CONFLICT en /api/clientes/recorrido).
--
-- Hasta que se aplique, el simulador funciona igual: la ruta que anota
-- responde sin guardar y el embudo avisa que falta esta migración.

create table if not exists simulador_recorridos (
  id           text primary key,
  creado       timestamptz not null default now(),
  actualizado  timestamptz not null default now(),
  etapas       text[] not null default '{}',
  ultima_etapa text,
  tipo_evento  text,
  salon        text,
  whatsapp     boolean not null default false
);

create index if not exists simulador_recorridos_creado on simulador_recorridos (creado);

-- Como las demás tablas: RLS activado y sin políticas (se entra por la
-- service role del servidor), y sin permisos para anon ni authenticated.
alter table simulador_recorridos enable row level security;
revoke all on simulador_recorridos from anon, authenticated;

-- Para verificar después de correrla (tiene que dar 0 filas):
--   select grantee, privilege_type from information_schema.role_table_grants
--   where table_name = 'simulador_recorridos' and grantee in ('anon', 'authenticated');
