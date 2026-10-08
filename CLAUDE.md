# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

Sistema interno **en producción** de "Los Jazmines" (salones de eventos). Lo usan todos los días Administración, Cobrar cuota, Cocina, Barra, Vendedores y el staff externo. Maneja **plata real** (cuotas ajustadas por IPC, cajas, señas a proveedores, sueldos, comisiones) y **datos de clientes** (DNI). Stack: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4 + shadcn/Radix. Base Postgres en Supabase y deploy en Vercel (`vercel.json` define los crons). El dueño no es técnico: PRs, commits y explicaciones van en **español llano**.

## Comandos y línea base (medida el 6/10/2026)

- `pnpm install` al empezar (en la nube no viene `node_modules`).
- Tests: `node --test scripts/test-*.cjs` → 35 archivos y 333 tests, todos pasan (~8 s). Para correr uno: `node --test scripts/test-cobro-ipc-api.cjs`. Ojo: `node --test scripts/` **no funciona**.
- Tipos: `pnpm exec tsc --noEmit --incremental false`. Hoy da **153 errores preexistentes** (sale con código 2). La regla es **0 errores nuevos**, comparando la lista y no solo el número:
  `pnpm exec tsc --noEmit --incremental false | grep "error TS" | sed -E 's/\([0-9]+,[0-9]+\)//' | sort > <scratchpad>/tsc-antes.txt`. Antes de cambiar nada se guarda `tsc-antes.txt`; al final se repite a `tsc-despues.txt` y se hace `diff`. Sin `--incremental false`, tsc reescribe `tsconfig.tsbuildinfo`, que está versionado.
- `pnpm build` anda sin variables de entorno, pero **no valida tipos** (`ignoreBuildErrors: true`) y reescribe `next-env.d.ts`. Hay que restaurarlo después con `git checkout next-env.d.ts tsconfig.tsbuildinfo`.
- `pnpm lint` **no funciona**: eslint no está instalado ni configurado. No cuenta como chequeo.
- `pnpm dev`: sin `.env` la app levanta vacía. Con `.env` usa la **base real** (ver "Una sola base").

## Una sola base: la de producción

- No hay base de pruebas. `pnpm dev` con `.env` escribe en la base real. Hay que asumir que los deploys de preview de Vercel también (no está verificado). `main` es lo que está en producción.
- Crear, modificar o borrar un evento **manda un mail real** (Resend, `lib/event-notifications.ts`) y deja un registro en `activity_log`.
- Cómo se prueba con datos reales (es lo que se viene haciendo en los PRs):
  1. **Foto antes**: conteos o `md5` de las filas o tablas que se van a tocar.
  2. Datos de prueba que se reconozcan (por ejemplo "PRUEBA …"), en un salón y día libres. Hay un evento activo por salón y día como máximo.
  3. SQL exploratorio siempre dentro de `begin; … rollback;`.
  4. Al terminar, borrar todo lo de prueba (eventos, cotizaciones, movimientos, `activity_log`) y verificar contra la foto.
  5. No probar cobros, IPC ni caja sobre eventos reales de clientes.
- En las sesiones en la nube la app no puede conectarse a la base aunque haya `.env`. Lo verifiqué el 6/10/2026: la conexión directa a Postgres no pasa por el proxy y `supabase.com` está bloqueado por la política de red. La única vía a la base real es un conector de Supabase. Sin conector, hay que decirlo en el PR y dejarle la prueba en la app al dueño.
- **Base local de prueba, sin tocar la real.** El contenedor trae Postgres 16 (`/usr/lib/postgresql/16/bin`). Se usó el 7/10/2026 para probar el cotizador de punta a punta:
  - `initdb` como usuario `postgres` en una carpeta de `/var/lib/postgresql` (no corre como root ni en el scratchpad), solo por TCP (`-c unix_socket_directories=''`) y con SSL (`ssl=on` y un certificado propio), porque `lib/db.ts` exige `ssl: 'require'`.
  - Esquema: los `scripts/*.sql` que hagan falta, más las tablas que no tienen script (`servicios`, `personal`, `cotizaciones`…) con las columnas que usa el código. Solo datos inventados.
  - `pnpm build` y `pnpm start` con `POSTGRES_URL` local y `AUTH_SECRET` y `PIN_*` inventados. Sin variables de Supabase, el proxy `/api/db` no llega a ningún lado.
  - Se recorre con Playwright. Al terminar, apagar la base y borrar la carpeta.
- **Conectores de Supabase.** Se agregan en https://claude.ai/customize/connectors y se cargan cuando arranca la sesión.
  - El que corresponde es uno en **solo lectura y limitado a este proyecto**: un conector personalizado con la dirección `https://mcp.supabase.com/mcp?project_ref=<ID>&read_only=true`. El ID está en la dirección del panel de Supabase: `supabase.com/dashboard/project/<ID>`.
  - Al 6/10/2026 la cuenta tiene dos conectados: **Supabase** (el del catálogo) y **Supa** (personalizado). El del catálogo tiene **acceso total** a todos los proyectos de la cuenta: trae `apply_migration`, `execute_sql` con escritura, `create_project`, `pause_project`, `restore_project`, ramas y edge functions. Supa todavía no se verificó.
  - **Decisión del dueño (6/10/2026): el conector "Supabase" se usa solo para leer.** Se permiten `list_projects`, `list_tables`, `list_migrations`, `get_advisors` y `execute_sql` **solo con `SELECT`**. Nunca `apply_migration`, `execute_sql` con INSERT/UPDATE/DELETE/DDL, ni crear, pausar o restaurar proyectos, ramas o edge functions, salvo un OK explícito para esa operación puntual.
  - Ante cualquier otro conector, mirar primero sus herramientas. Si tiene herramientas de escritura, avisarle al dueño antes de usarlo.
  - Leer con cuidado: preferir totales y estructura antes que filas, sin traer datos personales (DNI, nombres, teléfonos) salvo que la tarea lo necesite. Consultas livianas, porque es la base de producción.
  - Nunca pedir claves, tokens ni contraseñas por el chat.

## La base real (leída el 6/10/2026, solo lectura)

- Es el proyecto Supabase **`supabase-indigo-house`**, creado por la integración de Vercel. Su ID sale de `list_projects`. La cuenta tiene otros proyectos: `supabase-canary-cable` es de otro sistema (una escuela) y hay dos pausados. **No tocarlos.**
- Todas las tablas que usa el código existen, y todas tienen RLS activado. Ni `anon` ni `authenticated` tienen permisos sobre ninguna tabla: es el blindaje de la migración `blindar_acceso_publico_rls`.
  - Quedan 3 políticas viejas "allow_all" (`paquetes_salones`, `precios_venta`, `temporadas`). Hoy no abren nada, pero lo harían si alguien le devolviera permisos a `anon`.
  - Las tablas creadas por el rol `postgres` (SQL editor, migraciones) no le dan permisos a `anon`; las creadas por `supabase_admin` sí. Después de crear una tabla, verificar que `information_schema.role_table_grants` no tenga filas de `anon` ni `authenticated` para ella.
- La base no tiene lógica propia. Solo hay triggers de `updated_at` (en insumos, insumos_barra, recetas, cocteles y barra_templates); no hay funciones RPC ni pg_cron. Toda la lógica está en el código y los crons están en Vercel.
- Qué está aplicado: `list_migrations` registra casi todo, incluidas migraciones que **no están en el repo** (por ejemplo `blindar_acceso_publico_rls` y `create_cotizaciones`). Algunas se aplicaron sin quedar registradas (011 y 017). Para saber si algo existe hay que consultar `information_schema`, no solo el historial.
- Respaldos: antes de tocar datos se copiaron tablas con fecha al esquema `backup`. Hay 5 del 2/10/2026, entre ellas `backup.eventos_20261002` y `backup.movimientos_caja_20261002`. Contienen datos reales de clientes.
- **Los JSON de `eventos` están guardados como texto dentro de jsonb.** Pasa en `pagos`, `plan_de_cuotas`, `servicios`, `contrato` y `asignaciones` de todos los eventos activos (`jsonb_typeof` da `'string'`); solo 4 eventos de la papelera tienen JSON real. En el código lo resuelve `parseJsonField`. En SQL hay que desenvolverlo con `case jsonb_typeof(col) when 'string' then (col #>> '{}')::jsonb else col end`; si no, `col->>'campo'` devuelve vacío **sin dar error**.
- **`eventos.fecha` es texto** `"YYYY-MM-DD"`, no una fecha. El índice de un evento por salón y día compara ese texto, así que el formato no se puede cambiar.
- Columnas viejas de `eventos` que el código no usa: `recetas_dietas`, `multipliers_dietas`, `barra_cocteles`, `barra_template_id` y `menu_notas`.
- Datos al 6/10/2026:
  - **Eventos**: 147 activos. Por salón: Casona 57, Salon 53 y Quinta 37; "Salon 4" y "Salon 5" no tienen eventos. 120 tienen plan de cuotas, **68 ajustan por IPC** y 66 tienen pagos registrados (111 pagos en total).
  - **Estados en uso**: pendiente, completado, en_preparacion y borrador. No hay "cancelado", y "confirmado" no existe aunque `DESIGN.md` lo nombre.
  - **Movimientos de caja**: 731. Hay 84 viejos sin `caja_destino` y 2 con el salón vacío. Al 7/10/2026 había 741 y 85 sin caja, todas señas duplicadas; se borraron ese día y quedaron **656, ninguno sin caja** (respaldo en `backup.movimientos_caja_senas_duplicadas_20261007`).
  - **Fecha de alta**: 48 eventos activos no la tienen, así que para ellos no aplica el candado de señas.
  - **Tablas vacías**: `precios_venta`, `temporadas`, `asignaciones` y `cotizaciones`. `pagos_personal` tiene 1 fila: el personal de cada evento vive en sus JSON `personal_evento` y `asignaciones`.

## Mapa: qué está conectado con qué

**Dos caminos a la base**
1. Las rutas `app/api/**` usan SQL directo con `sql` de `lib/db.ts`. Ahí pasan eventos, insumos, recetas, cócteles, plantillas de barra, cotizaciones y cotizador, stock por salón, novedades y `activity_log`.
2. El cliente usa `lib/supabase/data-service.ts`, que va por el proxy `/api/db/[...path]` a PostgREST con la service role. Ahí pasan servicios, personal, pagos_personal, asignaciones, costos_operativos, movimientos_caja, configuracion_cajas, precios_venta, historial_ipc, gastos_archivados, paquetes_salones, temporadas y vendedores.
- Algunas tablas se usan por los dos caminos: `eventos`, `movimientos_caja`, `servicios`, `personal`, `paquetes_salones` e `historial_ipc`. Un cambio de esquema en esas tablas hay que reflejarlo en los dos.
- Los eventos se escriben **solo** por `/api/eventos`, que valida, hace concurrencia, papelera y mails. `fetchEventos`/`upsertEvento`/`deleteEvento` de data-service son código muerto: no usarlos.

**Permisos**: la UI esconde pantallas (`PERFILES[].rutas` en `lib/profile-context.tsx`, `app-shell`, `sidebar`), pero esconder no es seguridad. Lo único que protege son las rutas que chequean el perfil: `perfilDesdeRequest`, `soloAdministracion` y `lib/*-permisos.ts`. El proxy `/api/db` **no filtra por perfil**: cualquier sesión, incluso la de DJ, puede leer y escribir esas tablas (plan en "Pendiente: permisos por perfil"). Una restricción que importe va en una ruta del servidor. Dos trampas:
- `rutas: []` significa acceso **total**, no "sin acceso".
- El Vendedor **nunca** recibe costos, ganancias ni márgenes, tampoco en respuestas de la API.

**Cadenas de impacto**: cambiar algo arriba mueve todo lo de abajo.
- Insumos (precio, unidad, contenido por unidad) → recetas y cócteles → costo **en vivo** de cada evento no archivado → Costos del evento, Caja Eventos (Por pagar menú/barra) y resúmenes.
- Servicios → `eventos.servicios`, que guarda una **foto** de precios (borrar un servicio primero la guarda en cada evento) → señas y saldos a proveedores (candado de señas según fecha de alta) → Caja Eventos.
- Personal → asignaciones → pagos y sueldos (los pendientes se generan en el cliente al cargar) → Caja Eventos.
- Plan de cuotas y pagos del evento (JSON dentro de la fila) → `movimientos_caja` (Caja Eventos / Caja Jazmines, por salón) → resumen diario y semanal (mails), planilla de cuotas, "Vienen a pagar". La seña que se cobra al crear el evento se reparte entre las dos cajas con la misma regla que las cuotas (`construirSenaInicial` en `lib/cobrar-cuota.ts`). Las filas de seña (concepto "Seña …") las suma también el control de comisiones de vendedores (`lib/hooks/use-caja-jazmines.ts`).
- `historial_ipc` → proyección de cuotas en el cliente (`proyectarIPC`) → validación en el servidor al cobrar.
- Cotizador del vendedor → `cotizaciones` → aprobar → `POST /api/eventos` (evento con `precioVentaFijo`). El recargo de sábado y el "recargo propio" de las fechas especiales tienen un % por rubro (`porcentajesPorRubro` en `lib/cotizador-salon.ts`, columnas jsonb de la 020); lo guardado antes, sin esa columna, se lee como un solo % para los rubros tildados. La Cocina suma un plato por paso del menú (entrada, plato principal y postre, según `recetas.categoria`) y promedia las opciones del mismo paso (`cocinaPorPasos`); para enviar se piden los pasos que el salón ofrece (`pasosMenuFaltantes`, en las dos rutas de envío). Cambiar la categoría de una receta cambia su paso y su precio en el cotizador. La barra cuyo nombre dice "bebida de mesa" (`esBebidaDeMesa`: se reconoce por el nombre) va primero en el cotizador y se marca sola con el primer plato; si se la renombra, pasa a ser una barra común.
- Conteos de stock por salón → `stock_salones`. Los eventos descuentan o devuelven en su salón (`stockDescontado` evita descontar dos veces).

**Poco acoplado** (riesgo bajo):
- Vistas de solo lectura del staff externo (`/eventos/staff`).
- Cambios puramente visuales.
- El chat de ayuda: no toca la base, responde con `lib/guia-sistema.ts`.
- Novedades.
- La configuración vieja del cotizador (`tarifario_salon`, `precios_base_salones`, `salon_incluye_*`, `cotizador_config`, `cotizador_servicio_oculto`) ya no la usa el cotizador. Está escondida con `MOSTRAR_* = false` y su limpieza queda pendiente. En cambio `precios_venta` (Calendario de Precios) **sigue en el código** del planificador, aunque hoy la tabla está vacía.

## Cuidados por tema

**Un campo nuevo toca muchos lugares.** Es la causa de bugs como "la API de cócteles no guardaba X" o "guardado de servicios robusto". Hay que revisar todo esto:
- Migración en `scripts/`.
- Tabla papelera espejo si existe: `servicios_eliminados` y `cotizaciones_eliminadas` copian columnas. `eventos_eliminados` y `paquetes_salones_eliminados` guardan JSON.
- Tipo en `lib/store.ts`.
- Mapeo de ida **y** vuelta:
  - Para tablas de data-service: el fetch, el upsert y los mappers duplicados, como `mapServicioRow`.
  - Para eventos: en `app/api/eventos/route.ts`, `toRow`, `fromRow`, el SELECT del GET, el INSERT y el re-SELECT. En `app/api/eventos/[id]/route.ts`, los SELECT, `fieldMap`/`jsonFields` del PATCH y el UPDATE del PUT.
- Verificar el ida y vuelta: guardar, recargar y ver que el valor sigue ahí.
- `lib/database.types.ts` no lo usa nadie y está desactualizado. El esquema real está en `scripts/*.sql` y en la base.

**Estado del cliente** (`lib/store-context.tsx`)
- Carga todo al abrir y lo tiene en memoria. `localStorage` solo guarda estado de UI, porque `saveState` vacía los módulos de datos.
- Al iniciar corren migraciones "one-time": si una tabla viene **vacía** y el navegador tiene datos viejos, los sube. Por eso:
  - Nunca vaciar una tabla "para empezar de cero".
  - Distinguir error de lista vacía. Ojo: `fetchPersonal` y `fetchCostosOperativos` devuelven `[]` ante un error.
- Un mutador nuevo del store tiene que ir envuelto en `syncGuard.run(...)`. Si no, el refresco cada 15 s de `useSyncTiempoReal` puede pisar el cambio.
- El nombre del mutador tiene que empezar con `add|update|delete|set|archivar|desarchivar|aplicar|generar|sincronizar|clear` (`MUTATOR_RE`). Es lo que lo apaga en modo solo lectura.
- Los eventos que ven los componentes (`useStore().eventos` y `.state.eventos`) vienen **proyectados con IPC**. Ese `planDeCuotas` no se guarda como si fuera el de la base.
- Muchas pantallas escriben con `fetch` directo sin pasar por el store. Si se reactiva el "viaje en el tiempo" (`lib/clock-context.tsx`, hoy su botón no está montado), esas escrituras no respetan `soloLectura`.

**Plata**
- Cobro de cuota: `PATCH /api/eventos/[id]`. Todo pasa en una transacción con `FOR UPDATE`:
  - Concurrencia: `_planEsperado`/`_pagosEsperados`, que devuelven 409 si el evento cambió.
  - Idempotencia: `_operacionCobro`.
  - Validación de IPC: `lib/validar-cobro-ipc.ts`.
  - El INSERT en `movimientos_caja` va en la misma transacción.
  - Los eventos con IPC rechazan el PUT.
  - Tests que lo cubren: `test-cobro-ipc-api`, `test-ipc-provisorio`, `test-candado-senas`, `test-caja-eventos`, `test-desglose-ipc`.
- Los pagos anulados no se borran: pasan a `planDeCuotas.pagosAnulados`.
- El IPC aplica solo con `ajustaPorIPC === true`. En `historial_ipc.mes` los meses van de 0 a 11; en un `periodo` "YYYY-MM" van de 1 a 12.
- Para "hoy" se usa la fecha de negocio de Argentina, `fechaNegocio()` en `lib/ipc-cuotas.ts`. `toISOString().slice(0,10)` da el día UTC: desde las 21:00 ya es "mañana". Hay decenas de usos viejos; no sumar más.
- Pesos con centavos: redondear a 2 decimales y comparar con tolerancia (0,005 / 0,01), como hace el código.
- Usar `??` y no `||` para defaults numéricos, porque `|| 30` pisa un 0 legítimo.
- El pasado no se recalcula:
  - Los eventos completados guardan costos congelados (`costosCalculados.archivoCongelado`).
  - Las cotizaciones aprobadas dejan precio fijo.
  - Un cambio de fórmula no reescribe eventos archivados, cotizaciones aprobadas ni cuotas cobradas.
- Una sola cuenta compartida (`lib/cotizador-salon.ts`, `lib/costo-evento.ts`, etc.). Si dos pantallas muestran el mismo número, usan la misma función. El servidor **recalcula siempre** y no confía en el navegador.
- `fetchWithRetry` reintenta los POST ante 5xx o timeout. Toda escritura nueva tiene que ser idempotente: id generado en el cliente con `ON CONFLICT`, o una clave de operación.
- Los guardados que "reemplazan todo" (DELETE + INSERT, por ejemplo tarifario, cotizador-config o insumos de recetas y cócteles) van dentro de `sql.begin` y nunca con una lista que pudo venir vacía por un error de carga. Ver el patrón `serviciosSincronizados`.

**Valores guardados como texto: se pueden agregar, no renombrar.**
- Claves de salón `SALONES` ("Quinta", "Casona", "Salon", "Salon 4", "Salon 5"). El nombre visible se cambia en Configuración (`salonLabel`), nunca la clave.
- Estados de evento (`borrador|pendiente|en_preparacion|completado|cancelado`) y de cotización, `cajaDestino`, tipos de movimiento y categorías. Renombrar o borrar un valor exige migrar los datos.
- Los JSON viejos conviven con los nuevos: `servicios_elegidos` v1 y v2, movimientos sin `cajaDestino`, cotizaciones de una sola barra. Leer siempre tolerando el formato viejo.
- Los años de evento válidos son 2026 a 2032 (`lib/validacion-anio-evento.ts`). Hay que extenderlo antes de 2033.

**Efectos laterales**
- Crons a las 00:00 UTC (21:00 en Argentina): el resumen diario todos los días y el semanal los sábados. Los dos mandan mail.
- Si cambia una pantalla o un flujo, actualizar `lib/guia-sistema.ts`, que es lo que lee el chat de ayuda de Soporte.

## Protocolo de trabajo

**Antes de tocar**
1. Partir de `main` actualizado (`git fetch origin main`), con una rama por cambio: `feature/…` o `fix/…`, o la que asigne la sesión.
2. Guardar la línea base: tests y la lista de errores de tsc.
3. Medir el radio de impacto: buscar con `grep` **todos** los usos del campo, función, tabla o valor, y ubicarlo en las cadenas de impacto de arriba.
4. Clasificar el cambio:
   - **Solo pantalla**: riesgo bajo.
   - **Cálculo**: test con un caso de referencia en pesos.
   - **Esquema o datos**: migración más OK del dueño.
   - **Plata o permisos**: máximo cuidado, test y explicación en el PR.
5. Las reglas de negocio (cómo se cobra, quién ve qué) se le preguntan al dueño; no se inventan.

**Durante**
- Cambio mínimo, del alcance pedido. Sin refactors de paso ni limpiezas mezcladas.
- Esconder en vez de borrar (`MOSTRAR_X = false`); la limpieza va en un PR aparte.
- Reusar el camino ya probado. Por ejemplo, aprobar una cotización reusa `POST /api/eventos`.
- La lógica va en funciones puras en `lib/`, con test en `scripts/test-*.cjs`. Para rutas, mockear `@/lib/db`, `activity-logger` y `event-notifications` con `Module._load` (ver `test-cobro-ipc-api.cjs`).
- Comentarios en español que expliquen el porqué, como en el resto del código.
- UI: seguir `DESIGN.md` (íconos solo de `lucide-react`, un color por categoría o estado) y probar a 390 px sin scroll horizontal.

**Migraciones** (`scripts/0NN_descripcion.sql`; la última es la 020)
- Encabezado con qué hace y por qué, "SOLO ADITIVA" si lo es, y "Aplicada el <fecha>" cuando se aplique.
- Idempotente (`if not exists`) y aditiva por defecto, con defaults que no cambien el comportamiento.
- Si tiene varios pasos, va en `begin`/`commit`. Si borra, lleva un freno que verifique que no esté en uso y aborte.
- `add column … default X` llena las filas existentes. Ver `supabase/migrations/20261002_fecha_alta_eventos.sql`, que lo hace en dos pasos.
- Las tablas nuevas llevan RLS activado y sin políticas, porque el acceso es por service role. Además, `anon` y `authenticated` no deben tener permisos sobre ellas (ver "La base real").
- Después de aplicarla, verificar en `information_schema` que quedó. El historial de migraciones no siempre la registra.
- Se aplica **antes** de publicar el código que la usa: el upsert manda todas las columnas y, si falta una, falla cualquier guardado. Si no se puede garantizar el orden, leer la columna con `to_jsonb(tabla) ->> 'col'`.
- Claude no aplica migraciones ni corre SQL que modifique datos reales sin un OK explícito. Antes de borrar o actualizar datos se hace un respaldo fuera del repo.

**Antes de commitear y abrir el PR**
- Tests todos OK y tsc sin errores nuevos (`diff` de listas).
- Si el cambio deja algo de este archivo desactualizado (línea base de tests o tsc, última migración, mapa, problemas conocidos), actualizarlo en el mismo PR.
- `git status`: no commitear `tsconfig.tsbuildinfo`, `next-env.d.ts`, `.next/` ni `.env*`.
- Releer el diff entero buscando:
  - campos sin ida y vuelta;
  - `||` que pisa ceros;
  - fechas UTC;
  - escrituras no idempotentes;
  - permisos solo en la UI;
  - renombres de valores guardados;
  - costos o márgenes que le llegan al Vendedor.
- Probar en la app si hay base disponible, siguiendo el protocolo de datos reales.
- Commits `feat: …` / `fix: …` en español llano.
- PR contra `main` con título "Área: qué cambia". Secciones del cuerpo:
  - `## Qué hace`, diciendo también qué **no** cambia ("solo pantalla: no cambia cálculos").
  - `## Base de datos`, si hay migración y si ya está aplicada.
  - `## Probado`: tests, "tsc: 153 = 153 contra main", montos concretos de la prueba en la app y la limpieza verificada.
- El merge lo hace el dueño.

**Nunca sin OK explícito del dueño**
- Push a `main`, force-push o borrar ramas.
- Aplicar migraciones, correr SQL que modifique o borre datos reales, o vaciar papeleras.
- Tocar variables de entorno o PINs. Los PINs nunca van en código de cliente.
- Renombrar valores guardados o cambiar fórmulas de plata que afecten eventos ya cobrados o archivados.
- Saltear, borrar o debilitar tests para que algo pase.

## Problemas conocidos (detectados el 6 y 7/10/2026, sin arreglar)

No se arreglan de paso: cada uno va en su propio PR y solo si el dueño lo pide.
- **Permisos, lo más grave** (plan en "Pendiente: permisos por perfil"):
  - El proxy `/api/db` no filtra por perfil (ver "Permisos"): un perfil como DJ, con sesión, puede leer y modificar tablas de finanzas como `movimientos_caja`. También puede escribir `eventos` directo (pagos y plan de cuotas), salteando las protecciones de `/api/eventos`.
  - Al abrir, la app (`StoreProvider` en `components/app-shell.tsx`) descarga para cualquier perfil las tablas de data-service: cajas, personal, pagos y demás.
  - `GET /api/eventos` le devuelve los DNI y los pagos a cualquier sesión.
  - `getPins()` (`lib/auth/server.ts`) tiene PINs de reserva para cuando falta una variable `PIN_*`, y el repositorio de GitHub es público (7/10/2026).
  - El freno de intentos de PIN (`lib/auth/rate-limit.ts`) vive en memoria: es por instancia y por IP.
- **Señas duplicadas en `movimientos_caja`** (arreglado el 7/10/2026, código y datos):
  - Al crear un evento con "Seña + Cuotas" la seña se anotaba dos veces: repartida entre las cajas y además entera sin `caja_destino`.
  - Las 85 filas viejas sin caja ($374.776.186,99, una por evento, cada una con su seña repartida por el mismo monto) se borraron el 7/10/2026 con OK del dueño, desde el SQL Editor de Supabase. Respaldo: `backup.movimientos_caja_senas_duplicadas_20261007` (RLS activado, sin permisos para `anon` ni `authenticated`).
  - Mientras estuvieron, los resúmenes diario y semanal las sumaban a Caja Eventos y el control de comisiones las contaba. Las pantallas de caja nunca las usaron.
  - Al borrarlas, la comisión del evento del 3/10 en Casona dejó de figurar lista para pagar: la seña la cubría solo contada dos veces.
  - El conector de Supabase cancela solo las escrituras en las sesiones en la nube (no puede mostrar la confirmación). Lo que modifique datos lo corre el dueño en el SQL Editor.
  - El ajuste "Aporte a Administración" de Configuración de Cajas solo actuaba en esa seña sin caja, así que desde el arreglo no hace nada. Nunca generó movimientos: en la base no hay ninguno de tipo `aporte_admin`.
- **Seña de los eventos que vienen de una cotización** (detectado el 8/10/2026): aprobar crea el evento sin plan de cuotas. La seña se anota sola en las cajas solo al **crear** un evento desde el planificador (`construirSenaInicial` en `handleSaveEvento`); al cargar "Seña + Cuotas" en un evento ya creado, como el de una cotización, no se anota ningún movimiento. Además el control de comisiones no ve esa seña y la comisión queda lista para pagar recién con 4 cuotas. Hasta el 8/10/2026 no se aprobó ninguna cotización (tabla `cotizaciones` vacía).
- `deleteServicio` (data-service) borra el servicio aunque falle la copia a `servicios_eliminados`. En ese caso no se puede restaurar.
- En data-service, una seña guardada en 0 % se lee como 30 % (`Number(...) || 30`). Lo mismo pasa con los días de anticipación de seña y de saldo (`|| 30`, `|| 7`). Hoy ningún servicio tiene 0, así que no afecta a los datos actuales.
- Recetas y cócteles reemplazan sus insumos con DELETE + INSERT **sin transacción** (`app/api/recetas/[id]`, `app/api/cocteles/[id]`). Si falla a mitad de camino, la receta queda incompleta y cambia el costo de los eventos.
- `fetchPersonal` y `fetchCostosOperativos` devuelven `[]` ante un error (ver "Estado del cliente").
- Los años de evento válidos van de 2026 a 2032 (ver "Valores guardados"). Hay 1 evento activo de 2025, ya completado: si se guarda mandando la fecha, el servidor lo rechaza.
- 3 políticas "allow_all" viejas en `paquetes_salones`, `precios_venta` y `temporadas` (ver "La base real").
- 48 eventos activos sin `fecha_alta`. El script de carga que menciona `supabase/migrations/20261002_fecha_alta_eventos.sql` no está en el repo.
- Aviso de seguridad de Supabase (nivel WARN): la función `update_updated_at_column` no tiene `search_path` fijo.

## Pendiente: permisos por perfil (anotado el 7/10/2026)

El dueño decidió dejarlo para más adelante. Cuando se retome:
- **El dueño, sin código:** pasar el repositorio de GitHub a privado; revisar en Vercel que estén cargadas `AUTH_SECRET`, `PIN_STOCK_EXTRA` y las once `PIN_*` por perfil; cambiar los PINs que tenga gente que ya no trabaja con ellos. Nunca pedir ni recibir los valores por el chat.
- **Código, un PR por paso y con OK del dueño** (es "Plata o permisos"):
  1. Sacar los PINs de reserva de `getPins()`: si falta la variable, ese perfil no entra. Antes, confirmar que estén todas cargadas.
  2. Permisos en el servidor: el proxy mira el perfil de la sesión y tiene una lista de qué tablas puede leer y cuáles modificar cada perfil; `eventos` deja de escribirse por el proxy (lo que lo hace en data-service es código muerto); `GET /api/eventos` manda DNI y plata solo a los perfiles que los usan; el store carga solo lo de cada perfil.
  3. Activarlo por partes (primero el staff externo, después cocina y barra, al final cobro y vendedor), probando cada perfil pantalla por pantalla en la base local de prueba.
- **Borrador de quién ve qué**, sacado de `PERFILES[].rutas` (a confirmar con el dueño):

  | Perfil | Ve | Modifica |
  |---|---|---|
  | administracion, soporte | Todo | Todo |
  | cobro | Eventos con sus cuotas y el resumen del día | Solo cobra cuotas (`PATCH /api/eventos/[id]`) |
  | cocina | Eventos sin DNI ni plata, recetas e insumos | Conteos de stock |
  | barra | Lo mismo para barra | Stock y cócteles |
  | vendedor | Su catálogo con precios, nunca costos | Sus cotizaciones |
  | coordinacion, dj, fotografo, vestido, pantalla | Eventos (fecha, salón, horario, invitados, nota para staff), sin DNI ni plata | Nada |

- **Preguntas abiertas para el dueño:** ¿el staff externo ve el nombre y el teléfono del cliente? ¿Cobrar cuota ve el resumen de las cajas?

## Referencia

- **Perfiles** (login por PIN, sesión firmada en `lib/auth/server.ts`, cookie `lj_session` o header `x-lj-session`):
  - Gestión: administracion, soporte, cobro, coordinacion, vendedor.
  - Evento: cocina, barra, dj, fotografo, vestido, pantalla.
  - `middleware.ts` solo exige sesión en `/api/*`; las páginas redirigen solas a `/login`.
- **Variables de entorno**:
  - `POSTGRES_URL`: pooler de Supabase en modo transacción, por eso `prepare: false`.
  - Supabase: `SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_URL`, y `SUPABASE_SERVICE_ROLE_KEY`.
  - Sesiones y cron: `AUTH_SECRET`, `CRON_SECRET`.
  - Mails: `RESEND_API_KEY`, `NOTIFICATION_EMAIL`.
  - PINs: `PIN_*` por perfil, más `PIN_STOCK_EXTRA`.
- **Rutas**:
  - `app/admin/*`: catálogos y administración.
  - `app/eventos/*`: lista, calendario, pagos, costos, producción, staff, cotizaciones y papeleras.
  - `app/finanzas/*`: cajas, IPC, servicios, personal y configuración.
  - `app/vendedor/*`: cotizador.
  - `app/stock`: conteos por salón.
