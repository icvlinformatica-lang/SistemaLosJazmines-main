-- IPC provisorio.
--
-- Criterio del negocio: "se aplica el último IPC publicado al día del cobro".
-- El IPC oficial sale a mediados de mes y las cuotas vencen desde el día 10:
-- si el mes del cobro no tiene IPC cargado, el cálculo (lib/ipc-cuotas.ts)
-- usa el último publicado y lo marca como provisorio en la foto calculoIPC.
--
-- Estas columnas permiten además CARGAR A MANO un IPC marcado como
-- provisorio (y reemplazarlo después por el oficial), con una nota.
--
-- Migración aditiva: solo agrega columnas con default. Todos los IPC ya
-- cargados quedan como oficiales (provisorio = false). No toca eventos ni
-- movimientos_caja. Idempotente.
--
-- El código está escrito para funcionar con o sin estas columnas (el servidor
-- las lee vía to_jsonb y el alta solo las manda si se usan), pero cargar un
-- IPC provisorio y "Reemplazar por el oficial" necesitan que estén.

alter table historial_ipc
  add column if not exists provisorio boolean not null default false;

alter table historial_ipc
  add column if not exists nota text;
