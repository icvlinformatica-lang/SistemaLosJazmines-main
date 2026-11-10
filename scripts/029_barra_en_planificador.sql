-- 029 — Barras armadas en el planificador ("Generar contrato").
--
-- SOLO ADITIVA: agrega una columna a barra_templates con default false. No
-- modifica ni borra ninguna fila; todas las barras arrancan apagadas, o sea
-- que el planificador sigue igual hasta que alguien prenda una.
-- Sin aplicar todavía (la corre el dueño en el SQL Editor de Supabase).
--
-- Pedido de Rodrigo (10/11/2026): en Cócteles se ven las barras armadas, cada
-- una con dos interruptores: "Cotizaciones" (cotizador del vendedor, que ya
-- se guarda por salón en cotizador_salon_barra, scripts/015) y "Generar
-- contrato" (esta columna): si está prendida, la barra se ofrece en el
-- planificador para tildar sus cócteles de una vez. No cambia ninguna cuenta:
-- la barra del evento sigue siendo su lista de cócteles (lib/barras-armadas.ts).
--
-- El código la lee con to_jsonb(barra_templates) ->> 'en_planificador', así
-- que publicar antes de aplicarla no rompe nada (vale false y el interruptor
-- avisa que falta la 029).

alter table barra_templates
  add column if not exists en_planificador boolean not null default false;

-- Verificación (tiene que dar 1 fila):
-- select column_name, data_type, column_default from information_schema.columns
-- where table_name = 'barra_templates' and column_name = 'en_planificador';
