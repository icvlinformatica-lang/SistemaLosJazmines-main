-- 016 — DNI del cliente en las cotizaciones (Paso 2 del cotizador por salón).
-- Aplicada el 3/10/2026. SOLO ADITIVA.
--
-- También en la papelera (cotizaciones_eliminadas) para no perder el DNI si
-- una cotización se borra y se restaura. Al aprobar, el DNI pasa a
-- evento.contrato.dni (no hace falta columna nueva en eventos).
alter table cotizaciones            add column if not exists cliente_dni text;
alter table cotizaciones_eliminadas add column if not exists cliente_dni text;
