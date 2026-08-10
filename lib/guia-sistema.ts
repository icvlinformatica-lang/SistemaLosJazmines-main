// Guía del sistema Los Jazmines para el chat de ayuda con IA.
// Es SOLO texto de referencia: el chat no toca la base de datos.
// Si se agregan pantallas o flujos nuevos, actualizar esta guía.

export const GUIA_SISTEMA = `
# Sistema Los Jazmines — Guía de uso

Sistema de gestión para el complejo de eventos Los Jazmines (salones: Casona, Quinta y otros).
Perfiles de acceso (con PIN): Administración, Soporte, Cocina, Barra y Cobrar cuota.

## Pantalla de Inicio (/)
- Botones: "Novedades", "Resumen diario" (dinero que entró hoy por caja y por salón, movimientos importantes, cuotas cobradas hoy, y desde ahí se puede enviar el resumen por mail), "Este finde" (eventos del fin de semana con desglose de costos) y "Vienen a pagar" (quiénes deben pagar cuota esta semana, con atrasos).
- Todos los días a las 21:00 llega automáticamente un mail con el resumen diario.

## Eventos
- **Lista** (/eventos/lista): todos los eventos activos. Desde acá se abre cada evento para editar datos, servicios, plan de cuotas y contrato. También se puede imprimir la última versión del contrato.
- **Calendario** (/eventos/calendario): vista mensual de eventos. Permite crear eventos en una fecha.
- **Contratos** (/eventos/contratos): generador de contratos. Se elige el evento, se seleccionan los servicios incluidos (con su letra chica), el precio del paquete y el plan de cuotas; tiene Vista Previa e impresión. El contrato imprime dos sectores de firma: El Cliente y Los Jazmines.
- **Vendedores** (/eventos/vendedores): gestión de vendedores y sus comisiones.
- **Archivo** (/eventos/finalizados): eventos ya realizados/archivados.
- **Papelera** (/eventos/papelera): eventos borrados, se pueden restaurar.
- **Cobrar cuota** (/eventos/pagos): registrar el pago de una cuota de un evento. Se elige el evento, la cuota y el medio de pago. El dinero impacta en la caja y en el resumen diario.
- **Costos** (/eventos/costos): costos de cocina, barra, servicios y personal de cada evento. Los costos de cocina usan las recetas y su "rinde para X personas" (factor de rendimiento).
- **Asignaciones**: dentro de cada evento se asigna el personal que trabaja (mozos, cocina, etc.).

## Almacén
- **Insumos Cocina** (/admin/almacen): insumos de cocina con precio y unidad (KG, GR, LT, CC, UN...). Acá se actualizan los precios que alimentan el costo de las recetas.
- **Insumos Bebidas** (/admin/barra): lo mismo para la barra.

## Producción
- **Recetas** (/admin/recetario): recetas de cocina con ingredientes, cantidades y "rinde para X personas". El costo por persona de un evento sale de acá.
- **Cocteles** (/admin/cocteles): recetas de coctelería para la barra.
- **Guías Producción** (/eventos/produccion): guía de producción para cocina y barra de cada evento (cantidades a producir según cantidad de invitados).

## Finanzas
- **Caja Jazmines** (/finanzas/caja-jazmines): caja general del complejo. Registra ingresos y egresos, gastos fijos por carpeta (con "Cargar nuevo monto" mensual por vencimiento) y la evolución de gastos.
- **Caja Eventos** (/finanzas/caja-eventos): caja específica de los eventos (cuotas cobradas, gastos de eventos).
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
