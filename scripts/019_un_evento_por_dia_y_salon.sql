-- 019 — Un solo evento por día y por salón. Aplicada el 4/10/2026.
--
-- SOLO ADITIVA: un índice único parcial. No toca datos. Los eventos en la
-- papelera (deleted_at no nulo) no cuentan: los repetidos que había eran
-- todos de la papelera. Restaurar uno de la papelera a un día ocupado
-- también se rechaza. Error: 23505 con este nombre de índice (las rutas
-- de /api/eventos lo traducen con lib/salon-ocupado.ts).
create unique index if not exists eventos_un_evento_por_dia_y_salon
  on eventos (salon, fecha)
  where deleted_at is null;
