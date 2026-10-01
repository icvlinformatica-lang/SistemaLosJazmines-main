-- Servicios que se pagan como sueldo.
--
-- Algunos servicios (hoy solo "DJ, SONIDO, LUCES Y HUMO") no se le pagan a un
-- proveedor con seña y saldo: se le pagan a una persona, de una sola vez, el
-- día del evento. Con esta marca, en Caja Eventos ese servicio aparece en
-- "Sueldos" como un pago único en vez de generar seña y saldo.
--
-- Solo cambia CÓMO se muestra y se paga el egreso: el costo del servicio, el
-- reparto entre cajas (costo + 5 % a Caja Eventos) y los costos en vivo son
-- los mismos.
--
-- Migración aditiva: todos los servicios quedan en false (nada cambia de
-- comportamiento) salvo el DJ, que se prende por su id fijo. Al momento de
-- crearla el DJ tiene costo 0 y no está en ningún evento, así que tampoco
-- cambia nada en los eventos existentes. Idempotente.
--
-- Hay que aplicarla ANTES de publicar el código que la usa: upsertServicio
-- manda la columna y, sin ella, cualquier edición de un servicio falla.

alter table servicios
  add column if not exists se_paga_como_sueldo boolean not null default false;

-- La papelera recibe la fila ENTERA al borrar un servicio (deleteServicio hace
-- upsert de "...existing"): sin esta columna, mover a la papelera falla y el
-- servicio borrado no se puede restaurar.
alter table servicios_eliminados
  add column if not exists se_paga_como_sueldo boolean not null default false;

update servicios
   set se_paga_como_sueldo = true
 where id = '1ee176b6-6c5b-49fb-a4bf-26aff0f48d0d' -- DJ, SONIDO, LUCES Y HUMO
   and se_paga_como_sueldo = false;
