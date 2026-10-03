-- Fecha de alta de un evento (fecha real de venta), para el candado de señas.
--
-- En dos pasos A PROPÓSITO: si el default fuera parte del ADD COLUMN, Postgres
-- llenaría todos los eventos existentes con la fecha de hoy. Así, los eventos
-- que ya existen quedan con fecha_alta NULL (se cargan aparte con el script
-- supabase/scripts/cargar_fecha_alta_eventos.sql) y solo los eventos NUEVOS
-- toman la fecha del día en que se crean.

alter table eventos add column if not exists fecha_alta date;
alter table eventos alter column fecha_alta set default current_date;
