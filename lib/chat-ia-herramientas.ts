// Herramientas que el chat de ayuda (Administración y Soporte) le ofrece a la IA:
// buscar eventos con su plata, ver quién viene a pagar, el resumen del día,
// poner botones a pantallas y preparar un gasto o el cobro de una cuota.
// TODAS son de solo lectura: ninguna escribe en la base (proponerGasto y
// proponerCobroCuota solo arman la propuesta; la carga o el cobro los hace la
// persona con el botón: /api/chat/gasto, o Cobrar cuota por el store). Los botones se
// arman acá, con direcciones fijas: la IA solo elige el evento o la
// pantalla, nunca escribe una dirección.
//
// Corre SOLO en el servidor (lo usa app/api/chat/route.ts).
import { tool } from "ai"
import { z } from "zod"
import { sql } from "@/lib/db"
import { buildResumenDiario, buildVienenAPagar, historialIPCServidor } from "@/lib/resumen-diario"
import { cambiarDiaResumen, fechaResumenValida } from "@/lib/resumen-fecha"
import type { HistorialIPCEntry } from "@/lib/store"
import {
  PANTALLAS_CHAT,
  botonesFuenteEventos,
  SALONES_CHAT,
  accesosEvento,
  filtrarEventosChat,
  resumenEventoChat,
  sumarAcciones,
  tarjetaEventoChat,
  type AccionChat,
  type FilaEventoChat,
  type PantallaChat,
} from "@/lib/chat-ia-datos"
import { MAX_TARJETAS_CHAT, sumarTarjetas, type TarjetaEventoChat } from "@/lib/chat-ia-tarjetas"
import { SALONES_GASTO_CHAT, armarPropuestaGasto, type PropuestaGastoChat } from "@/lib/chat-ia-gasto"
import { armarPropuestaCobro, eventoCobroDesdeFila, opcionesCobroChat, type PropuestaCobroChat } from "@/lib/chat-ia-cobro"
import { proyectarIPC } from "@/lib/ipc-cuotas"
import {
  CATEGORIAS_RECETA_CHAT,
  UNIDADES_INSUMO_CHAT,
  UNIDADES_RECETA_CHAT,
  armarPropuestaInsumo,
  armarPropuestaReceta,
  insumoDesdeFila,
  nombreComparable,
  porUnidad,
  type InsumoCatalogo,
  type PropuestaInsumoChat,
  type PropuestaRecetaChat,
} from "@/lib/chat-ia-catalogo"
import { diaArgentina, periodoActividadValido, registroDesdeFila, registroEsDe, resumirActividad } from "@/lib/chat-ia-actividad"
import {
  DIMENSIONES_ACTIVIDAD,
  DIMENSIONES_EVENTOS,
  MAX_COLUMNAS_TABLA,
  MAX_TABLAS_CHAT,
  MEDIDAS_EVENTOS,
  eventoParaTabla,
  periodoTablaValido,
  tablaActividad,
  tablaEventos,
  type TablaChat,
} from "@/lib/chat-ia-tabla"

/** "$2.450,5" → "$2.450,50": la IA copia el precio tal cual, ya con punto de miles. */
const precioTexto = (n: number) =>
  `$${n.toLocaleString("es-AR", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`

/** Lo que necesita el botón a la pantalla de un evento. */
const datosBoton = (f: FilaEventoChat) => ({
  id: String(f.id),
  nombre: String(f.nombre_pareja || f.nombre || "Evento"),
  estado: String(f.estado ?? ""),
})

/** Máximo de eventos que se le pasan a la IA por búsqueda. */
export const MAX_EVENTOS_POR_BUSQUEDA = 10

const fechaISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("Fecha en formato AAAA-MM-DD, por ejemplo 2026-10-06")

export function crearHerramientasChat({
  hoy,
  acciones = [],
  tarjetas = [],
  gasto = { propuesta: null },
  cobro = { propuesta: null },
  insumo = { propuesta: null },
  receta = { propuesta: null },
  tablas = [],
  usuario = "",
}: {
  hoy: string
  /**
   * Botones que se muestran debajo de la respuesta. Cada herramienta que lee
   * datos agrega sola el de la pantalla de donde salen, para que siempre se
   * pueda ir a verlos en el sistema (no depende de que la IA se acuerde).
   */
  acciones?: AccionChat[]
  tarjetas?: TarjetaEventoChat[]
  /** Dónde queda la propuesta de gasto de esta respuesta (una sola). */
  gasto?: { propuesta: PropuestaGastoChat | null }
  /** Dónde queda la propuesta de cobro de esta respuesta (una sola). */
  cobro?: { propuesta: PropuestaCobroChat | null }
  /** Dónde quedan el insumo y la receta nuevos propuestos en esta respuesta (uno de cada uno). */
  insumo?: { propuesta: PropuestaInsumoChat | null }
  receta?: { propuesta: PropuestaRecetaChat | null }
  /** Tablas ordenadas que se muestran debajo de la respuesta. */
  tablas?: TablaChat[]
  /** Quién usa el chat (Diego, Leila, Ricky…): se sugiere como quien recibe la plata. */
  usuario?: string
}) {
  // Se lee una sola vez por pregunta, y solo si la IA lo necesita.
  let eventos: Promise<FilaEventoChat[]> | null = null
  let historial: Promise<HistorialIPCEntry[]> | null = null
  // Sin DNI, teléfonos ni contrato: esto termina en el modelo de IA.
  const cargarEventos = () =>
    (eventos ??= sql`
      SELECT id, nombre, nombre_pareja, fecha, horario, salon, tipo_evento, estado,
             adultos, adolescentes, ninos, precio_venta, plan_de_cuotas, pagos
      FROM eventos
      WHERE deleted_at IS NULL
    ` as unknown as Promise<FilaEventoChat[]>)
  const cargarHistorial = () => (historial ??= historialIPCServidor())
  // Catálogo de cocina (Almacén y Recetario), leído una vez por pregunta.
  let insumosCatalogo: Promise<InsumoCatalogo[]> | null = null
  const cargarInsumos = () =>
    (insumosCatalogo ??= (
      sql`
        SELECT id, codigo, descripcion, unidad, precio_unitario, proveedor, contenido_cantidad, contenido_unidad
        FROM insumos
      ` as unknown as Promise<Record<string, unknown>[]>
    ).then((filas) => filas.map(insumoDesdeFila)))
  const cargarRecetas = () => sql`SELECT nombre FROM recetas` as unknown as Promise<{ nombre: string }[]>
  // El evento para cobrar, con el IPC proyectado como lo ve Cobrar cuota.
  const eventoParaCobro = async (eventoId: string) => {
    const [filas, hist] = await Promise.all([cargarEventos(), cargarHistorial()])
    const fila = filas.find((f) => String(f.id) === eventoId)
    return fila ? { evento: proyectarIPC(eventoCobroDesdeFila(fila), hist, hoy), hist } : null
  }

  return {
    buscarEventos: tool({
      description:
        "Busca eventos (activos y finalizados) por nombre de los agasajados, fecha exacta, rango de fechas o salón. " +
        "Devuelve fecha, salón, estado, invitados y la plata: total, seña, cobrado, saldo pendiente y cuotas por cobrar (con vencimiento y si está atrasada). " +
        "Usala para cualquier pregunta sobre un evento o sus montos.",
      inputSchema: z.object({
        texto: z.string().max(80).optional().describe("Parte del nombre del evento o de los agasajados"),
        fecha: fechaISO.optional(),
        desde: fechaISO.optional().describe("Desde esta fecha (incluida)"),
        hasta: fechaISO.optional().describe("Hasta esta fecha (incluida)"),
        salon: z.enum(SALONES_CHAT).optional().describe('Clave del salón. "Salon" es el que se muestra como "Salón"'),
      }),
      execute: async (filtro) => {
        const [filas, hist] = await Promise.all([cargarEventos(), cargarHistorial()])
        const encontrados = filtrarEventosChat(filas, filtro)
        sumarAcciones(acciones, botonesFuenteEventos(encontrados.slice(0, MAX_EVENTOS_POR_BUSQUEDA).map(datosBoton)))
        return {
          hoy,
          cantidad: encontrados.length,
          mostrados: Math.min(encontrados.length, MAX_EVENTOS_POR_BUSQUEDA),
          eventos: encontrados.slice(0, MAX_EVENTOS_POR_BUSQUEDA).map((f) => resumenEventoChat(f, hist, hoy)),
        }
      },
    }),

    vienenAPagar: tool({
      description:
        "Cuotas que vencen esta semana o la próxima (de lunes a domingo), por evento, más las atrasadas. Es lo mismo que la tarjeta 'Vienen a pagar' de Inicio.",
      inputSchema: z.object({ semana: z.enum(["esta", "proxima"]) }),
      execute: async ({ semana }) => {
        const referencia = semana === "proxima" ? cambiarDiaResumen(hoy, 7) : hoy
        const r = await buildVienenAPagar(referencia)
        sumarAcciones(acciones, [PANTALLAS_CHAT.vienen_a_pagar])
        return {
          desde: r.inicioSemana,
          hasta: r.finSemana,
          eventos: r.vienenAPagar.slice(0, 30).map((v) => ({
            eventoId: v.eventoId,
            evento: v.evento,
            salon: v.salon,
            fechaEvento: v.fechaEvento,
            cuotaDeLaSemana: v.cuotaSemana,
            cuotasAtrasadas: v.cuotasAtrasadas,
            montoAtrasado: Math.round(v.montoAtrasado * 100) / 100,
          })),
          totalEventos: r.vienenAPagar.length,
        }
      },
    }),

    resumenDelDia: tool({
      description:
        "Resumen de caja de un día: lo que entró y salió de Caja Jazmines y Caja Eventos, ingresos por salón, saldo actual de cada salón por caja y las cuotas cobradas ese día. Es el 'Resumen diario' de Inicio.",
      inputSchema: z.object({ fecha: fechaISO.optional().describe("Día a consultar; si falta, hoy") }),
      execute: async ({ fecha }) => {
        const dia = fecha && fechaResumenValida(fecha) ? fecha : hoy
        const r = await buildResumenDiario(dia)
        sumarAcciones(acciones, [PANTALLAS_CHAT.resumen_diario])
        return {
          fecha: r.fecha,
          ingresoCajaJazmines: r.ingresoCajaJazmines,
          ingresoCajaEventos: r.ingresoCajaEventos,
          egresoCajaJazmines: r.egresoCajaJazmines,
          egresoCajaEventos: r.egresoCajaEventos,
          ingresosPorSalon: r.ingresosPorSalon,
          saldoActualPorSalon: r.saldoPorSalon,
          cuotasCobradas: r.cuotasDelDia.map((c) => ({ evento: c.evento, salon: c.salon, monto: c.monto })),
          totalCuotas: r.totalCuotas,
        }
      },
    }),

    mostrarTablaEventos: tool({
      description:
        "Ordena los eventos de un período en una tabla que aparece en el chat: filas y columnas por salón, mes, estado o tipo de evento, con totales. " +
        "Cada celda es la cantidad de eventos o una suma: invitados, total vendido, cobrado, lo que falta cobrar o lo atrasado en cuotas. " +
        "Usala para cualquier pregunta de contar, agrupar u ordenar eventos: '¿cuántos eventos hay hasta fin de año por salón y mes?', " +
        "'¿cuánto falta cobrar por salón?', 'eventos por tipo', 'invitados por mes'. Cuenta los eventos no borrados (incluye borradores). " +
        "Los números salen de la base: no los repitas en el texto.",
      inputSchema: z.object({
        desde: fechaISO.describe("Primer día, AAAA-MM-DD (por ejemplo hoy)"),
        hasta: fechaISO.describe("Último día, AAAA-MM-DD (por ejemplo el 31/12)"),
        filas: z.enum(DIMENSIONES_EVENTOS).describe("Qué va en las filas: salon, mes, estado o tipo"),
        columnas: z
          .enum([...DIMENSIONES_EVENTOS, "ninguna"])
          .describe("Qué va en las columnas (distinto de las filas), o 'ninguna' para una sola columna de totales"),
        medida: z
          .enum(MEDIDAS_EVENTOS)
          .describe("cantidad (de eventos), invitados, total (vendido), cobrado, saldo (lo que falta cobrar) o atrasado (cuotas vencidas sin pagar)"),
        salon: z.enum(SALONES_CHAT).optional().describe("Opcional: solo un salón"),
      }),
      execute: async ({ desde, hasta, filas, columnas, medida, salon }) => {
        const error = periodoTablaValido(desde, hasta)
        if (error) return { ok: false, motivo: error }
        if (columnas === filas) return { ok: false, motivo: "Las filas y las columnas tienen que ser distintas (o columnas 'ninguna')." }
        if (tablas.length >= MAX_TABLAS_CHAT) return { ok: false, motivo: "Ya hay dos tablas en esta respuesta." }
        const [todas, hist] = await Promise.all([cargarEventos(), cargarHistorial()])
        const enPeriodo = todas.filter((f) => {
          const fecha = String(f.fecha ?? "").slice(0, 10)
          return fecha >= desde && fecha <= hasta
        })
        // La plata sale de la misma cuenta que las tarjetas de eventos (resumenEventoChat).
        const eventos = enPeriodo.map((f) => eventoParaTabla(f, resumenEventoChat(f, hist, hoy)))
        const t = tablaEventos(eventos, { desde, hasta, filas, columnas: columnas === "ninguna" ? null : columnas, medida, salon })
        tablas.push(t)
        sumarAcciones(acciones, botonesFuenteEventos(enPeriodo.map(datosBoton)))
        return {
          ok: true,
          aviso: "La tabla ya está en el chat con todos los números: escribí solo una o dos frases con lo importante (el total, qué fila o columna tiene más, o lo que llama la atención).",
          titulo: t.titulo,
          total: t.total,
          porFila: Object.fromEntries(t.filas.map((f) => [f.etiqueta, f.total])),
          ...(t.columnas.length > 0 ? { porColumna: Object.fromEntries(t.columnas.map((c, i) => [c.etiqueta, t.totalPorColumna[i]])) } : {}),
          ...(filas === "salon" || columnas === "salon"
            ? { salonesSinEventos: SALONES_CHAT.filter((s) => (!salon || s === salon) && !eventos.some((e) => e.salon === s)) }
            : {}),
          ...(t.nota ? { nota: t.nota } : {}),
        }
      },
    }),

    consultarActividad: tool({
      description:
        "Lee el Historial de Actividad (Configuración → Historial de Actividad): qué se hizo en el sistema en un período (eventos creados o cambiados, pagos, caja, insumos, recetas, stock…) " +
        "y quién lo hizo. Sirve para 'qué se hizo ayer', 'qué hizo Leila esta semana' o 'qué cargó Barra'. Devuelve totales por persona y por tipo, y los registros más nuevos primero. " +
        "El historial no guarda el perfil: quién lo hizo sale del nombre que quedó anotado (Diego, Leila, Ricky, Soporte) o, en las cargas de stock, del sector (Cocina, Barra).",
      inputSchema: z.object({
        desde: fechaISO.describe("Primer día, AAAA-MM-DD"),
        hasta: fechaISO.optional().describe("Último día, AAAA-MM-DD; si falta, el mismo día que desde"),
        quien: z.string().max(40).optional().describe("Opcional: persona o sector (Diego, Leila, Ricky, Soporte, Cocina, Barra) o 'sin dato' para lo que no dice quién"),
        tabla: z
          .object({
            filas: z.enum(DIMENSIONES_ACTIVIDAD).describe("persona, tema o dia"),
            columnas: z.enum([...DIMENSIONES_ACTIVIDAD, "ninguna"]),
          })
          .optional()
          .describe("Opcional: además pone en el chat una tabla con la cantidad de registros, por ejemplo personas en filas y temas en columnas"),
      }),
      execute: async ({ desde, hasta, quien, tabla }) => {
        const fin = hasta ?? desde
        const error = periodoActividadValido(desde, fin)
        if (error) return { ok: false, motivo: error }
        // Días de Argentina: de las 00:00 del primero a las 00:00 del día después del último.
        const filas = (await sql`
          SELECT id, tipo, accion, nombre, detalle, created_at
          FROM activity_log
          WHERE created_at >= (${desde}::date)::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires'
            AND created_at < (${fin}::date + 1)::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires'
          ORDER BY created_at DESC
          LIMIT 3000
        `) as unknown as Record<string, unknown>[]
        const resumen = resumirActividad(filas, { desde, hasta: fin, quien: quien?.trim() || undefined })
        sumarAcciones(acciones, [PANTALLAS_CHAT.historial_actividad])
        let tablaAgregada = false
        if (tabla && tabla.filas !== tabla.columnas && tablas.length < MAX_TABLAS_CHAT) {
          const dias = (new Date(`${fin}T12:00:00Z`).getTime() - new Date(`${desde}T12:00:00Z`).getTime()) / 86_400_000 + 1
          if (tabla.columnas !== "dia" || dias <= MAX_COLUMNAS_TABLA) {
            const registros = filas
              .map((f) => {
                const r = registroDesdeFila(f)
                return { dia: diaArgentina(f.created_at), quien: r.quien, tipo: r.tipo, sector: r.sector }
              })
              .filter((r) => !quien?.trim() || registroEsDe(r, quien))
            tablas.push(tablaActividad(registros, { desde, hasta: fin, filas: tabla.filas, columnas: tabla.columnas === "ninguna" ? null : tabla.columnas }))
            tablaAgregada = true
          }
        }
        return {
          ok: true,
          ...resumen,
          ...(tabla
            ? {
                tabla: tablaAgregada
                  ? "La tabla ya está en el chat: no repitas sus números, resumí lo importante."
                  : "No se pudo armar la tabla (con días en columnas van hasta 13 días: poné los días en filas).",
              }
            : {}),
        }
      },
    }),

    mostrarAccesosEvento: tool({
      description:
        "Pone en el chat tres botones para un evento: verlo en la Lista de eventos (o en el Archivo si está finalizado), sus cuotas por cobrar y sus costos. " +
        "Usala cuando el usuario quiera ver, abrir o ir a un evento. Necesita el id que devolvió buscarEventos.",
      inputSchema: z.object({ eventoId: z.string().min(1).max(100) }),
      execute: async ({ eventoId }) => {
        const fila = (await cargarEventos()).find((f) => String(f.id) === eventoId)
        if (!fila) return { ok: false, motivo: "No existe un evento con ese id. Buscalo primero con buscarEventos." }
        const nombre = String(fila.nombre_pareja || fila.nombre || "Evento")
        sumarAcciones(acciones, accesosEvento(eventoId, nombre, String(fila.estado ?? "")))
        return { ok: true, botones: "Lista, cuotas por cobrar y costos" }
      },
    }),

    mostrarResumenEventos: tool({
      description:
        "Pone en el chat una tarjeta por evento con su plata ordenada: total, seña, cobrado (con barra), saldo, cuotas vencidas y la próxima cuota. " +
        `Usala SIEMPRE que respondas montos de uno o más eventos (hasta ${MAX_TARJETAS_CHAT}). Necesita los ids que devolvió buscarEventos.`,
      inputSchema: z.object({ eventoIds: z.array(z.string().min(1).max(100)).min(1).max(MAX_TARJETAS_CHAT) }),
      execute: async ({ eventoIds }) => {
        const [filas, hist] = await Promise.all([cargarEventos(), cargarHistorial()])
        const encontrados = eventoIds
          .map((id) => filas.find((f) => String(f.id) === id))
          .filter((f): f is FilaEventoChat => !!f)
        sumarTarjetas(tarjetas, encontrados.map((f) => tarjetaEventoChat(resumenEventoChat(f, hist, hoy))))
        // Un id repetido cuenta como un solo evento (va directo a él).
        const distintos = encontrados.filter((f, i) => encontrados.indexOf(f) === i)
        if (distintos.length > 0) sumarAcciones(acciones, botonesFuenteEventos(distintos.map(datosBoton)))
        if (encontrados.length === 0) return { ok: false, motivo: "Ningún id coincide. Buscalos primero con buscarEventos." }
        return { ok: true, tarjetas: encontrados.length }
      },
    }),

    proponerGasto: tool({
      description:
        "Prepara un gasto variable para Caja Jazmines (agendado, sin pagar), como 'Cargar gastos' de Inicio. NO lo carga: " +
        "pone en el chat una tarjeta con los datos y los botones 'Sí, cargar' y 'Cancelar'; solo la persona, con el botón, lo carga. " +
        "Usala solo cuando pidan cargar o agendar un gasto, y solo con concepto, monto y salón claros (si falta alguno, preguntalo antes). " +
        "El concepto incluye a nombre de quién es, por ejemplo 'Pepo - arreglo de luces'. Un gasto por respuesta. " +
        "Gastos repartidos entre varios salones, retiros o ya pagados no: para eso está 'Cargar gastos' en Inicio.",
      inputSchema: z.object({
        concepto: z.string().min(2).max(120).describe("Qué es el gasto y a nombre de quién"),
        monto: z.number().positive().describe("Monto en pesos, sin puntos de miles"),
        salon: z.enum(SALONES_GASTO_CHAT).describe('Clave del salón. "Salon" es el que se muestra como "Salón"'),
        vencimiento: fechaISO.optional().describe("Vencimiento; si no lo dicen, hoy"),
      }),
      execute: async (entrada) => {
        if (gasto.propuesta) return { ok: false, motivo: "Ya hay un gasto preparado en esta respuesta: uno por vez." }
        const r = armarPropuestaGasto(entrada, { id: crypto.randomUUID(), hoy })
        if (!r.ok) return r
        gasto.propuesta = r.propuesta
        return {
          ok: true,
          aviso: "Todavía NO está cargado: la persona tiene que tocar 'Sí, cargar' en la tarjeta. Preguntale si está seguro.",
          gasto: { concepto: r.propuesta.concepto, monto: r.propuesta.monto, salon: r.propuesta.salon, vencimiento: r.propuesta.vencimiento },
        }
      },
    }),

    consultarCobroCuota: tool({
      description:
        "Antes de cobrar una cuota: dice qué cuotas de un evento se pueden cobrar hoy (en orden: la que sigue y las que quedaron con un pago parcial), " +
        "cuánto vale cada una (con IPC si corresponde), lo que ya se pagó, los días de atraso y el recargo por atraso ($3.000 por día). " +
        "Usala con el id que devolvió buscarEventos para saber qué preguntar. No cobra nada.",
      inputSchema: z.object({ eventoId: z.string().min(1).max(100) }),
      execute: async ({ eventoId }) => {
        const datos = await eventoParaCobro(eventoId)
        if (!datos) return { ok: false, motivo: "No existe un evento con ese id. Buscalo primero con buscarEventos." }
        const { evento, hist } = datos
        sumarAcciones(acciones, [{ etiqueta: `${evento.nombrePareja || evento.nombre}: cuotas por cobrar`, href: `/eventos/pagos?evento=${encodeURIComponent(eventoId)}` }])
        const r = opcionesCobroChat(evento, hist, hoy)
        if (!r.ok) return r
        return {
          ok: true,
          evento: evento.nombrePareja || evento.nombre,
          salon: evento.salon,
          fechaEvento: evento.fecha,
          ajustaPorIPC: evento.planDeCuotas?.ajustaPorIPC === true,
          quienUsaElChat: usuario || null,
          cuotas: r.opciones,
        }
      },
    }),

    proponerCobroCuota: tool({
      description:
        "Prepara el cobro de UNA cuota de un evento, como 'Cobrar cuota'. NO cobra: pone en el chat una tarjeta con todo el detalle y los botones " +
        "'Sí, cobrar' y 'Cancelar'; solo la persona, con el botón, lo cobra. Usala solo después de consultarCobroCuota y de haber preguntado y " +
        "tenido respuesta de TODO: qué cuota, si se cobra el recargo por atraso (si hay atraso), si paga la cuota completa o cuánto, " +
        "qué pasa con lo que queda (si paga una parte), quién paga y quién recibe la plata. Un cobro por respuesta.",
      inputSchema: z.object({
        eventoId: z.string().min(1).max(100),
        numeroCuota: z.number().int().positive(),
        cobrarRecargo: z.boolean().describe("true: se cobra el recargo por atraso; false: se perdona. Si no hay atraso, true."),
        pagaCompleto: z.boolean().describe("true: paga todo lo que falta de la cuota"),
        monto: z.number().positive().optional().describe("Solo si NO paga completo: lo que entrega, recargo incluido, en pesos sin puntos de miles"),
        saldoRestante: z
          .enum(["acumular", "aparte"])
          .optional()
          .describe("Solo si paga una parte: lo que queda se suma a la cuota siguiente (acumular) o queda aparte"),
        ipcDelSaldo: z
          .enum(["acumula", "congelado"])
          .optional()
          .describe("Solo si paga una parte: lo que queda sigue generando IPC (acumula) o queda congelado"),
        pagadoPor: z.string().min(2).max(80).describe("Nombre de quien paga"),
        recibidoPor: z.string().min(2).max(80).describe("Nombre de quien recibe la plata"),
        pagaCon: z.number().positive().optional().describe("Con cuánto paga, si quiere saber el vuelto"),
      }),
      execute: async ({ eventoId, ...entrada }) => {
        if (cobro.propuesta) return { ok: false, motivo: "Ya hay un cobro preparado en esta respuesta: uno por vez." }
        const datos = await eventoParaCobro(eventoId)
        if (!datos) return { ok: false, motivo: "No existe un evento con ese id. Buscalo primero con buscarEventos." }
        const r = armarPropuestaCobro(datos.evento, datos.hist, hoy, entrada, crypto.randomUUID())
        if (!r.ok) return r
        cobro.propuesta = r.propuesta
        const p = r.propuesta
        return {
          ok: true,
          aviso: "Todavía NO está cobrado: la persona tiene que tocar 'Sí, cobrar' en la tarjeta. Preguntale si está seguro.",
          cobro: {
            evento: p.evento,
            cuota: p.numeroCuota,
            de: p.totalCuotas,
            totalACobrar: p.monto,
            recargo: p.recargo,
            quedaCompleta: p.quedaCompleta,
            saldoQueQueda: p.saldoQueQueda,
            pagadoPor: p.pagadoPor,
            recibidoPor: p.recibidoPor,
            vuelto: p.vuelto ?? 0,
          },
        }
      },
    }),

    buscarInsumos: tool({
      description:
        "Busca insumos de cocina en Almacén por nombre (varios a la vez). Devuelve id, unidad en que se compra y se cuenta (KG, GR, LT, CC o UN), " +
        "precio por esa unidad, cuánto trae cada unidad (si se compra por unidad) y proveedor. Usala antes de dar de alta un insumo (para no repetirlo) " +
        "y para armar los ingredientes de una receta.",
      inputSchema: z.object({ textos: z.array(z.string().min(1).max(60)).min(1).max(15).describe("Nombres a buscar, uno por ingrediente") }),
      execute: async ({ textos }) => {
        const insumos = await cargarInsumos()
        sumarAcciones(acciones, [PANTALLAS_CHAT.insumos_cocina])
        return {
          resultados: textos.map((t) => {
            const buscado = nombreComparable(t)
            const encontrados = insumos.filter((i) => nombreComparable(i.descripcion).includes(buscado)).slice(0, 8)
            return {
              buscado: t,
              insumos: encontrados.map((i) => ({
                id: i.id,
                descripcion: i.descripcion,
                unidad: i.unidad,
                precio: `${precioTexto(i.precioUnitario)} ${porUnidad(i.unidad)}`,
                ...(i.contenidoCantidad ? { traeCadaUnidad: `${i.contenidoCantidad} ${i.contenidoUnidad === "CC" ? "cc" : "gramos"}` } : {}),
                proveedor: i.proveedor || null,
              })),
            }
          }),
        }
      },
    }),

    proponerInsumo: tool({
      description:
        "Prepara el alta de UN insumo de cocina nuevo en Almacén. NO lo carga: pone en el chat una tarjeta con los datos y los botones 'Sí, cargar' y 'Cancelar'. " +
        "Usala solo después de haber preguntado y tenido respuesta de todo: nombre, cómo se mide (unidad), cuánto se pagó y por qué cantidad, " +
        "cuánto trae cada unidad si se compra por unidad, y el proveedor. El precio por unidad lo calcula la herramienta: no lo calcules vos. " +
        "Insumos de barra (bebidas) no: esos van en Insumos Bebidas.",
      inputSchema: z.object({
        descripcion: z.string().min(2).max(80).describe("Nombre del insumo, con la presentación si importa (ej. 'Harina 0000', 'Arvejas en lata')"),
        unidad: z
          .enum(UNIDADES_INSUMO_CHAT)
          .describe("En qué se mide y se cuenta: KG (peso), GR (gramos, solo para cosas muy chicas como especias), LT (líquidos), CC, o UN (por unidad: lata, paquete, huevo)"),
        cantidadComprada: z.number().positive().describe("Por cuánta cantidad se pagó el monto, EN LA UNIDAD elegida. Ej: bolsa de 5 kg con unidad KG → 5; 500 g con unidad KG → 0.5; una lata con unidad UN → 1; maple de 30 huevos con UN → 30"),
        montoPagado: z.number().positive().describe("Cuánto se pagó por esa cantidad, en pesos sin puntos de miles"),
        contenidoCantidad: z.number().positive().optional().describe("Solo si la unidad es UN: cuánto trae cada unidad (ej. lata de 400 gramos → 400)"),
        contenidoUnidad: z.enum(["GRS", "CC"]).optional().describe("Solo si la unidad es UN: GRS (gramos) o CC"),
        seUsaPorUnidad: z.boolean().optional().describe("Solo si la unidad es UN y no tiene contenido: true si en las recetas se usa por unidad (como los huevos)"),
        proveedor: z.string().max(80).optional(),
        sinProveedor: z.boolean().optional().describe("true si confirmaron que no tiene un proveedor fijo"),
      }),
      execute: async (entrada) => {
        if (insumo.propuesta) return { ok: false, motivo: "Ya hay un insumo preparado en esta respuesta: uno por vez." }
        const r = armarPropuestaInsumo(entrada, { id: crypto.randomUUID(), existentes: await cargarInsumos() })
        if (!r.ok) return r
        insumo.propuesta = r.propuesta
        const p = r.propuesta
        return {
          ok: true,
          aviso: "Todavía NO está cargado: la persona tiene que tocar 'Sí, cargar' en la tarjeta. Preguntale si está seguro.",
          insumo: {
            descripcion: p.descripcion,
            unidad: p.unidad,
            precio: `${precioTexto(p.precioUnitario)} ${porUnidad(p.unidad)}`,
            ...(p.contenidoCantidad ? { traeCadaUnidad: `${p.contenidoCantidad} ${p.contenidoUnidad === "CC" ? "cc" : "gramos"}` } : {}),
            proveedor: p.proveedor || "sin proveedor fijo",
          },
        }
      },
    }),

    proponerReceta: tool({
      description:
        "Prepara el alta de UNA receta nueva en el Recetario, con sus ingredientes de Almacén. NO la carga: pone en el chat una tarjeta con los ingredientes, " +
        "el costo por porción y los botones 'Sí, cargar' y 'Cancelar'. Usala solo después de haber preguntado y tenido respuesta de todo: nombre, categoría, " +
        "para cuántas porciones son las cantidades, y cada ingrediente con su cantidad y unidad (buscados con buscarInsumos: necesita sus ids).",
      inputSchema: z.object({
        nombre: z.string().min(2).max(80),
        categoria: z.enum(CATEGORIAS_RECETA_CHAT as [string, ...string[]]),
        rindePara: z.number().int().min(1).max(1000).describe("Para cuántas porciones son las cantidades: 1 si son por persona"),
        descripcion: z.string().max(300).optional(),
        ingredientes: z
          .array(
            z.object({
              insumoId: z.string().min(1).max(100).describe("Id que devolvió buscarInsumos"),
              cantidad: z.number().positive(),
              unidad: z.enum(UNIDADES_RECETA_CHAT).describe("GRS (gramos), KG, CC, L (litros) o UN (unidades)"),
              detalleCorte: z.string().max(60).optional().describe("Opcional: corte o preparación (ej. 'en cubos')"),
            }),
          )
          .min(1)
          .max(40),
      }),
      execute: async (entrada) => {
        if (receta.propuesta) return { ok: false, motivo: "Ya hay una receta preparada en esta respuesta: una por vez." }
        const [insumos, recetas] = await Promise.all([cargarInsumos(), cargarRecetas()])
        const r = armarPropuestaReceta(entrada, { id: crypto.randomUUID(), insumos, recetasExistentes: recetas })
        if (!r.ok) return r
        receta.propuesta = r.propuesta
        return {
          ok: true,
          aviso: "Todavía NO está cargada: la persona tiene que tocar 'Sí, cargar' en la tarjeta. Preguntale si está segura.",
          receta: { nombre: r.propuesta.nombre, categoria: r.propuesta.categoria, ingredientes: r.propuesta.ingredientes.length, costoPorPorcion: r.propuesta.costoPorPorcion },
        }
      },
    }),

    mostrarPantalla: tool({
      description: "Pone en el chat un botón que lleva a una pantalla del sistema.",
      inputSchema: z.object({
        pantalla: z.enum(Object.keys(PANTALLAS_CHAT) as [PantallaChat, ...PantallaChat[]]),
      }),
      execute: async ({ pantalla }) => {
        sumarAcciones(acciones, [PANTALLAS_CHAT[pantalla]])
        return { ok: true }
      },
    }),
  }
}
