// Guía del sistema Los Jazmines para el chat de ayuda con IA.
// Es SOLO texto de referencia: el chat no toca la base de datos.
// Si se agregan pantallas o flujos nuevos, actualizar esta guía.

export const GUIA_SISTEMA = `
# Sistema Los Jazmines — Guía de uso

Sistema de gestión para el complejo de eventos Los Jazmines (salones: Casona, Quinta y otros).
Perfiles de acceso (con PIN):
- Gestión: Administración, Soporte, Cobrar cuota, Coordinación y Vendedor.
- Del evento: Cocina, Barra y el staff externo (DJ, Fotógrafo, Vestido y Pantalla).
Cada perfil ve solo las pantallas de su trabajo en el menú.

## Pantalla de Inicio (/)
- Botones: "Novedades", "Resumen diario" (dinero que entró hoy por caja y por salón, movimientos importantes, cuotas cobradas hoy, y desde ahí se puede enviar el resumen por mail), "Este finde" (eventos del fin de semana con desglose de costos y lo que queda por pagarles a proveedores y personal, el mismo número que "Pendiente por evento" de Caja Eventos) y "Vienen a pagar" (quiénes deben pagar cuota esta semana, con atrasos).
- Si hay cotizaciones esperando aprobación, Administración y Soporte ven arriba el botón "N cotizaciones para revisar". Administración y Cobrar cuota tienen además "Cargar gastos".
- El botón redondo "?" de abajo a la derecha abre esta guía.
- Todos los días a las 21:00 llega automáticamente un mail con el resumen diario.

## Eventos
- **Lista** (/eventos/lista): todos los eventos activos. Desde acá se abre cada evento para editar datos, servicios, plan de cuotas y contrato. También se puede imprimir la última versión del contrato. Arriba, los botones "Todos", "Borrador", "Pendientes" y "En preparación" dicen cuántos eventos hay de cada estado en el salón elegido y, al tocarlos, muestran solo esos. "En archivo" lleva a los eventos ya realizados.
- **Calendario** (/eventos/calendario): vista mensual de eventos. Permite crear eventos en una fecha.
- **Contratos** (/eventos/contratos): generador de contratos. Se elige el evento, se seleccionan los servicios incluidos (con su letra chica), el precio del paquete y el plan de cuotas; tiene Vista Previa e impresión. El contrato imprime dos sectores de firma: El Cliente y Los Jazmines.
- **Vendedores** (/eventos/vendedores): gestión de vendedores y sus comisiones.
- **Archivo** (/eventos/finalizados): eventos ya realizados/archivados.
- **Papelera** (/eventos/papelera): eliminar un evento desde la Lista, el Calendario o el Archivo no lo borra del todo: va a la papelera y desde ahí se restaura. Solo lo que se elimina desde la papelera se pierde para siempre.
- **Cobrar cuota** (/eventos/pagos): registrar el pago de una cuota de un evento. Se elige el evento, la cuota y el medio de pago. El dinero impacta en la caja y en el resumen diario.
- **Costos** (/eventos/costos): costos de cocina, barra, servicios y personal de cada evento. Los costos de cocina usan las recetas y su "rinde para X personas" (factor de rendimiento).
- **Asignaciones**: dentro de cada evento se asigna el personal que trabaja (mozos, cocina, etc.).

## Cotizaciones
- **Cotizador del vendedor** (/vendedor/cotizar): el vendedor arma la cotización en tarjetas (cliente, salón, comensales, menú, barra y servicios) y ve el precio total en vivo, sin costos. "Guardar borrador" la guarda para seguir después; "Enviar a Administración" la manda a revisión. Arriba, en Cliente, dice quién vende el evento: es el usuario con el que se entró (por ejemplo, si entró Diego, vende Diego). En la tarjeta Servicios aparecen primero los incluidos en el salón (no se cobran aparte) y después los adicionales, que se suman al precio. Administración tiene en el panel lateral un botón "Cotizar", arriba de "Generar Contrato", que abre este mismo cotizador.
- **Menú por pasos**: si se elige algún plato, para enviarla hay que elegir un plato de cada paso que el salón tenga habilitado: entrada, plato principal y postre. El borrador se puede guardar con el menú incompleto. La Cocina cobra por persona la suma de los pasos; si se eligen dos opciones del mismo paso (por ejemplo, dos principales), se cobra el promedio entre ellas.
- **Bebida de mesa**: si el salón tiene la barra "Bebida de mesa", aparece primero dentro de Barra, en un grupo aparte ("Con el menú"), y se marca sola al elegir el primer plato del menú. Se puede destildar y se cobra como cualquier barra (cuenta para el máximo de 2 barras).
- **Mis cotizaciones y Paquetes** (/vendedor/paquetes): el vendedor ve las cotizaciones que guardó, con su estado (sin enviar, esperando revisión, rechazada, convertida en evento); las abre para seguir editándolas y manda un borrador a revisión con "Enviar a revisión". Abajo están los paquetes armados para sus salones. Lo que borra va a "Mi papelera" (/vendedor/papelera), de donde lo puede recuperar.
- **Cotizaciones a aprobar** (/eventos/cotizaciones): Administración revisa las cotizaciones enviadas, con costos y ganancias, y las aprueba (se convierten en evento) o las rechaza con un comentario. Al aprobar, el vendedor de la comisión ya viene elegido con quien hizo la cotización, si está en la lista de vendedores; se puede cambiar. El evento que sale de una cotización no trae la dirección del cliente ni la forma de pago (seña y cuotas): en la bandeja de cotizaciones (antes de aprobar), en Eventos > Lista y en el planificador se ve un aviso **"Falta: …"** (contrato, plan de pagos, servicios, menú o barra) hasta que se completa. Cuando se le carga **"Seña + Cuotas"** en el planificador por primera vez, al guardar la seña se anota sola en las cajas (repartida entre Caja Eventos y Caja Jazmines, igual que al crear un evento) y cuenta para la comisión del vendedor. En la pestaña **Configuración** se cargan, por salón, los costos y ganancias, qué platos, barras y servicios se ofrecen, el recargo de sábado (monto fijo o un porcentaje por rubro) y las fechas especiales.

## Almacén
- **Insumos Cocina** (/admin/almacen): insumos de cocina con precio y unidad (KG, GR, LT, CC, UN...). Acá se actualizan los precios que alimentan el costo de las recetas.
- **Insumos Bebidas** (/admin/barra): lo mismo para la barra.
- Desde Administración o Soporte, el lapicito de un insumo (en Insumos Cocina o Bebidas) muestra un campo de stock por cada salón: se cambia el número del salón que haga falta (vacío = no se toca) y al guardar el Stock total pasa a ser la suma de los salones. Cada cambio queda en Actividad como "Ajuste desde Almacén", con el número de antes y el de ahora. No pide el PIN de carga extraordinaria.
- **Stock por salón** (/stock): Cocina y Barra cuentan lo que quedó en un salón. Se elige el salón y aparece "Cargar stock disponible luego del evento X" cuando un evento de ese salón ya terminó (sin PIN). Para contar en cualquier otro momento está el botón chico "Carga extraordinaria", al final de la pantalla, que pide el PIN de carga extraordinaria. Se escribe la cantidad de cada insumo que se contó (vacío = no contado; si no queda nada, 0) y se confirma con el nombre de quien carga. Al guardar, el stock de Insumos Cocina y Bebidas pasa a ser la suma de lo contado en todos los salones. Al imprimir el documento de un evento, lo que usa la cocina se descuenta del stock de su salón.

## Producción
- **Recetas** (/admin/recetario): recetas de cocina con ingredientes, cantidades y "rinde para X personas". El costo por persona de un evento sale de acá.
- **Cocteles** (/admin/cocteles): recetas de coctelería para la barra.
- **Guías Producción** (/eventos/produccion): guía de producción de cocina de cada evento (cantidades a producir según cantidad de invitados). Es solo para Cocina y Administración; Barra no entra acá.

## Próximos eventos del staff (/eventos/staff)
- Calendario de solo lectura para Coordinación, Barra y el staff externo (DJ, Fotógrafo, Vestido y Pantalla). Al tocar un evento se ve la fecha, los festejados, el teléfono de contacto y los servicios contratados, con el del perfil resaltado.
- Barra elige primero un salón y ve además las barras contratadas de cada evento (qué barra y cuántos tragos por persona). Barra también consulta de qué está hecho cada cóctel en Cocteles, sin precios.

## Finanzas
- **Caja Jazmines** (/finanzas/caja-jazmines): caja general del complejo. Registra ingresos y egresos, gastos fijos por carpeta (con "Cargar nuevo monto" mensual por vencimiento) y la evolución de gastos.
- **Caja Eventos** (/finanzas/caja-eventos): caja específica de los eventos (cuotas cobradas, gastos de eventos). Abajo de todo está la "Proyección en 12 meses": tocando el monto de "A cobrar" de un mes se ve cuánto debía ingresar, cuánto ya ingresó y cuánto falta, con la lista de quién debe cada cuota; tocando "A pagar" se ve el total a pagar del mes, lo ya pagado y lo que falta, por proveedor o persona. Si un mes ya está todo cobrado o pagado, dice "al día".
- **Servicios** (/finanzas/servicios): catálogo de servicios que se venden (DJ, ambientación, altar, etc.) con categoría, precio y "Descripción (letra chica del contrato)": ese texto se imprime debajo del servicio en el contrato. ACÁ ES DONDE SE CARGA UN SERVICIO NUEVO: botón de agregar, se completa nombre, categoría, precio y la letra chica. Para incluirlo en un evento después se selecciona desde el generador de contratos o desde el evento.
- **Personal** (/finanzas/personal): personal, sueldos y pagos pendientes.
- **IPC** (/finanzas/ipc): índice de inflación para ajustar precios.

## Configuración (/configuracion)
- Ajustes generales del sistema.

## Conceptos clave
- **Plan de cuotas**: cada evento puede tener un plan (cantidad de cuotas, día de vencimiento, montos). Las cuotas se cobran en "Cobrar cuota" y aparecen en el resumen diario y en "Vienen a pagar".
- **Factor de rendimiento**: cada receta rinde para X personas; todos los cálculos de costos de cocina dividen por ese factor.
- **Letra chica**: la descripción larga de un servicio (hasta ~90 palabras) que se imprime en cursiva debajo del servicio en el contrato. Se carga en Finanzas → Servicios, columna Descripción.
- **Versiones de contrato**: al guardar un contrato se crea una versión con snapshot de servicios y precios; la impresión usa siempre la última versión.
- **Cajas**: el dinero de cuotas va a Caja Eventos o Caja Jazmines según cómo se registre. El resumen diario muestra ambas y también el total por salón.
`
