import {
  formatCurrency,
  type EventoGuardado,
  type Receta,
  type PagoPersonal,
  type BarraTemplate,
  type Coctel,
} from "@/lib/store"

// =====================================================================
// HELPER: Personal asignado al evento para el contrato.
// Combina el personal cargado desde el generador (evento.personalEvento)
// con los compromisos asignados despues desde Finanzas → Personal
// (pagosPersonal), sin duplicar personas.
// =====================================================================
export interface PersonalContrato {
  nombre: string
  funcion: string
}

export function buildPersonalContrato(
  evento: EventoGuardado,
  pagosPersonal: PagoPersonal[] = [],
): PersonalContrato[] {
  const resultado: PersonalContrato[] = []
  const vistos = new Set<string>()

  // 1) Personal del generador de contrato/evento
  for (const pe of evento.personalEvento || []) {
    const clave = pe.personalId || pe.nombre.toLowerCase()
    if (vistos.has(clave)) continue
    vistos.add(clave)
    resultado.push({ nombre: pe.nombre, funcion: pe.funcion })
  }

  // 2) Compromisos asignados manualmente (cualquier estado, son personal del evento)
  for (const pp of pagosPersonal) {
    if (pp.eventoId !== evento.id) continue
    const clave = pp.personalId || pp.nombrePersonal.toLowerCase()
    if (vistos.has(clave) || vistos.has(pp.nombrePersonal.toLowerCase())) continue
    vistos.add(clave)
    resultado.push({ nombre: pp.nombrePersonal, funcion: pp.servicioNombre })
  }

  return resultado
}

const SALON_DIRECCIONES: Record<string, string> = {
  Casona: "Casona Florida 6040 \u2013 Del Viso \u2013 Bs. As.",
  Quinta: "Quinta Los Jazmines \u2013 Del Viso \u2013 Bs. As.",
  Salon: "Salon Los Jazmines \u2013 Del Viso \u2013 Bs. As.",
}

// =====================================================================
// HELPER: Numero a letras (pesos) — para montos del contrato
// =====================================================================
function numeroALetras(num: number): string {
  const unidades = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"]
  const especiales: Record<number, string> = {
    10: "DIEZ", 11: "ONCE", 12: "DOCE", 13: "TRECE", 14: "CATORCE", 15: "QUINCE",
    16: "DIECISEIS", 17: "DIECISIETE", 18: "DIECIOCHO", 19: "DIECINUEVE",
    20: "VEINTE", 21: "VEINTIUNO", 22: "VEINTIDOS", 23: "VEINTITRES", 24: "VEINTICUATRO",
    25: "VEINTICINCO", 26: "VEINTISEIS", 27: "VEINTISIETE", 28: "VEINTIOCHO", 29: "VEINTINUEVE",
  }
  const decenas = ["", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"]
  const centenas = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"]

  function tresDigitos(n: number): string {
    if (n === 0) return ""
    if (n === 100) return "CIEN"
    const c = Math.floor(n / 100)
    const resto = n % 100
    let out = c > 0 ? centenas[c] : ""
    if (resto > 0) {
      if (out) out += " "
      if (resto < 30 && resto >= 10) out += especiales[resto]
      else if (resto < 10) out += unidades[resto]
      else {
        const d = Math.floor(resto / 10)
        const u = resto % 10
        out += decenas[d] + (u > 0 ? " Y " + unidades[u] : "")
      }
    }
    return out
  }

  const n = Math.round(Math.abs(num))
  if (n === 0) return "CERO"
  const millones = Math.floor(n / 1000000)
  const miles = Math.floor((n % 1000000) / 1000)
  const resto = n % 1000
  const partes: string[] = []
  if (millones > 0) partes.push(millones === 1 ? "UN MILLON" : `${tresDigitos(millones)} MILLONES`)
  if (miles > 0) partes.push(miles === 1 ? "MIL" : `${tresDigitos(miles)} MIL`)
  if (resto > 0) partes.push(tresDigitos(resto))
  return partes.join(" ")
}

// =====================================================================
// HELPER: Build menu details from event recipes
// =====================================================================
function buildMenuDetails(evento: EventoGuardado, recetas: Receta[]) {
  const recetasAdultos = (evento.recetasAdultos || []).map((id) => recetas.find((r) => r.id === id)).filter(Boolean) as Receta[]
  const recetasAdolescentes = (evento.recetasAdolescentes || []).map((id) => recetas.find((r) => r.id === id)).filter(Boolean) as Receta[]
  const recetasNinos = (evento.recetasNinos || []).map((id) => recetas.find((r) => r.id === id)).filter(Boolean) as Receta[]
  return {
    recepcion: recetasAdultos.filter((r) => r.categoria === "Recepcion" || r.categoria === "Recepción").map((r) => r.nombre),
    entradaAdultos: recetasAdultos.filter((r) => r.categoria === "Entrada").map((r) => r.nombre),
    entradaAdolescentes: recetasAdolescentes.filter((r) => r.categoria === "Entrada").map((r) => r.nombre),
    menuInfantil: recetasNinos.map((r) => r.nombre),
    platoPrincipalAdultos: recetasAdultos.filter((r) => r.categoria === "Plato Principal").map((r) => r.nombre),
    platoPrincipalAdolescentes: recetasAdolescentes.filter((r) => r.categoria === "Plato Principal").map((r) => r.nombre),
    guarniciones: [
      ...recetasAdultos.filter((r) => r.categoria === "Guarnicion" || r.categoria === "Guarnición").map((r) => r.nombre),
      ...recetasAdolescentes.filter((r) => r.categoria === "Guarnicion" || r.categoria === "Guarnición").map((r) => r.nombre),
    ],
    postre: [
      ...recetasAdultos.filter((r) => r.categoria === "Postre").map((r) => r.nombre),
      ...recetasNinos.filter((r) => r.categoria === "Postre").map((r) => r.nombre),
    ],
    mesaDulce: recetasAdultos.filter((r) => r.categoria === "Mesa Dulce").map((r) => r.nombre),
  }
}

// =====================================================================
// CONTRACT HTML GENERATOR — replica el modelo real de Los Jazmines:
// "Convenio de realizacion de eventos" con clausulas 1-15 y Anexo I.
// =====================================================================
export function generateContractHTML(
  evento: EventoGuardado,
  recetas: Receta[],
  serviciosIncluidos: string[],
  paquetePrecio: number,
  personalAsignado: PersonalContrato[] = [],
  barrasTemplates: BarraTemplate[] = [],
  cocteles: Coctel[] = [],
) {
  const totalPersonas = evento.adultos + evento.adolescentes + evento.ninos + (evento.personasDietasEspeciales || 0)
  const contrato = evento.contrato || {}
  const planCuotas = evento.planDeCuotas
  const menu = buildMenuDetails(evento, recetas)
  const fechaEvento = evento.fecha ? new Date(evento.fecha + "T12:00:00").toLocaleDateString("es-AR") : "___/___/______"
  const fechaContrato = new Date().toLocaleDateString("es-AR")
  const salon = evento.salon || "___________"
  const direccion = SALON_DIRECCIONES[salon] || `${salon} \u2013 Del Viso \u2013 Bs. As.`
  const nombreEvento = evento.nombrePareja || evento.nombre || "Evento"
  const tipoEvento = evento.tipoEvento || ""
  const tituloEvento = tipoEvento && evento.nombrePareja
    ? `${tipoEvento === "Casamiento" ? "Boda" : tipoEvento} de ${evento.nombrePareja}`
    : nombreEvento
  const horarioInicio = evento.horario || "___:___"
  const horarioFin = evento.horarioFin || "___:___"
  const condicionIVA = evento.condicionIVA || "Consumidor Final"

  // Fecha fin: si el horario de fin es menor al de inicio, el evento termina al dia siguiente
  let fechaFin = fechaEvento
  if (evento.fecha && evento.horario && evento.horarioFin && evento.horarioFin < evento.horario) {
    const d = new Date(evento.fecha + "T12:00:00")
    d.setDate(d.getDate() + 1)
    fechaFin = d.toLocaleDateString("es-AR")
  }

  const precioEvento = planCuotas?.montoTotal || evento.precioVenta || paquetePrecio || 0
  const modalidadPago = planCuotas?.modalidadPago || "cuotas"
  const montoSena = planCuotas?.montoSena || 0
  const numeroCuotas = planCuotas?.numeroCuotas || 0
  const saldo = Math.max(0, precioEvento - montoSena)
  const montoPrimeraCuota =
    planCuotas?.cuotas && planCuotas.cuotas.length > 0
      ? planCuotas.cuotas[0].montoCuota
      : planCuotas?.montoCuota || (numeroCuotas > 0 ? saldo / numeroCuotas : 0)
  const diaVencimiento = planCuotas?.diaVencimiento || 10
  const ajustaIPC = planCuotas?.ajustaPorIPC !== false

  // ---- 3) Forma de pago ----
  let formaPago = ""
  if (planCuotas && precioEvento > 0) {
    if (modalidadPago === "completo") {
      formaPago = `En este acto abona la suma de (PESOS) ${formatCurrency(precioEvento)} correspondiente al monto total del evento en un unico pago.`
    } else if (montoSena > 0 && numeroCuotas > 0) {
      formaPago = `En este acto abona la suma de (PESOS) ${formatCurrency(montoSena)} en concepto de se\u00f1a y el saldo de PESOS ${formatCurrency(saldo)} a cancelar en ${numeroCuotas} cuotas. El monto de la primer cuota es de PESOS (${numeroALetras(montoPrimeraCuota)}) (${formatCurrency(montoPrimeraCuota)})${ajustaIPC ? " + IPC acumulativo" : ""}. Cuotas posteriores se deber\u00e1n abonar de forma mensual y consecutiva (el ${diaVencimiento} de cada mes).${ajustaIPC ? " Las cuotas se ajustan mensualmente seg\u00fan \u00edndice IPC Nacional." : " Las cuotas son fijas y no sufren ajustes."}`
    } else if (montoSena > 0) {
      formaPago = `En este acto abona la suma de (PESOS) ${formatCurrency(montoSena)} en concepto de se\u00f1a y el saldo de PESOS ${formatCurrency(saldo)} a cancelar antes de la fecha del evento.`
    } else if (numeroCuotas > 0) {
      formaPago = `El monto total de (PESOS) ${formatCurrency(precioEvento)} se abonar\u00e1 en ${numeroCuotas} cuotas mensuales y consecutivas (el ${diaVencimiento} de cada mes)${ajustaIPC ? ", ajustadas mensualmente seg\u00fan \u00edndice IPC Nacional" : ""}.`
    }
  }

  // ---- 5) Detalle del servicio ----
  const detalleServicio = serviciosIncluidos.length > 0
    ? serviciosIncluidos
    : [
        "Mesas y Sillas",
        "Vajilla y cristaleria completa",
        "Manteleria y fundas para sillas con lazos y caminos",
        "Personal en puerta / Encargado de Salon",
        "Limpieza Posterior incluida",
        "Estacionamiento privado",
        "Servicio de Emergencias Medicas",
      ]
  const detalleServicioRows = detalleServicio.map((s) => `<div class="svc-item">\u2022${s}</div>`).join("")

  // ---- Anexo: barras ----
  let tipoBarra = ""
  let tragosIncluidos = ""
  if (evento.barras && evento.barras.length > 0 && barrasTemplates.length > 0) {
    const nombresBarras: string[] = []
    const nombresCocteles: string[] = []
    for (const b of evento.barras) {
      const tpl = barrasTemplates.find((t) => t.id === b.barraTemplateId)
      if (tpl) nombresBarras.push(`${tpl.nombre} ${b.tragosPorPersona} tragos a eleccion`)
      for (const cid of b.coctelesIncluidos || []) {
        const c = cocteles.find((x) => x.id === cid)
        if (c && !nombresCocteles.includes(c.nombre)) nombresCocteles.push(c.nombre)
      }
    }
    tipoBarra = nombresBarras.join(" / ")
    tragosIncluidos = nombresCocteles.join(", ")
  }

  const personalRows = personalAsignado
    .map((p) => `<div>${p.funcion}: ${p.nombre}</div>`)
    .join("")

  const anexoLinea = (titulo: string, valor: string) => `
    <p class="anexo-title">${titulo}:</p>
    ${valor ? `<p class="anexo-value">${valor}</p>` : `<p class="anexo-value anexo-empty">&nbsp;</p>`}`

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Contrato - ${nombreEvento}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; margin: 0; padding: 0; line-height: 1.5; }
  .page { max-width: 780px; margin: 0 auto; padding: 40px 56px; }
  .logo { margin-bottom: 40px; }
  .logo-script { font-family: 'Brush Script MT', 'Segoe Script', cursive; font-size: 44px; line-height: 1; }
  .logo-sub { font-weight: bold; letter-spacing: 2px; font-size: 14px; margin-left: 56px; }
  .titulo { text-align: center; font-size: 16px; margin: 28px 0 2px; }
  .subtitulo { text-align: center; font-size: 14px; margin: 0; }
  .nombre-evento { text-align: center; font-size: 13px; margin: 14px 0 30px; }
  h3.clausula { font-size: 12.5px; margin: 22px 0 8px; }
  h3.clausula span { text-decoration: underline; }
  .datos-lista { margin-left: 16px; }
  .datos-lista div { margin-bottom: 2px; }
  .parrafo { text-align: justify; margin: 6px 0; }
  .campo { text-decoration: underline; font-weight: bold; }
  .svc-item { margin-left: 32px; margin-bottom: 2px; }
  .anexo { page-break-before: always; }
  .anexo-title { text-align: center; font-weight: bold; margin: 14px 0 2px; }
  .anexo-value { text-align: center; margin: 0 0 4px; }
  .anexo-empty { min-height: 14px; }
  .firma-row { display: flex; gap: 40px; margin-top: 70px; font-weight: bold; }
  .firma-row > div { flex: 1; }
  .firma-line { border-top: 1px solid #111; margin-top: 40px; padding-top: 4px; font-size: 11px; font-weight: normal; text-align: center; }
  @media print { body { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page">

  <div class="logo">
    <div class="logo-script">Los Jazmines</div>
    <div class="logo-sub">EVENTOS</div>
  </div>

  <p class="titulo">Convenio de realizaci\u00f3n de eventos</p>
  <p class="subtitulo">${direccion}&nbsp;&nbsp;Fecha ${fechaContrato}</p>
  <p class="nombre-evento">${tituloEvento}</p>

  <h3 class="clausula">1) <span>Datos personales:</span></h3>
  <div class="datos-lista">
    <div>\u2022Nombre completo: ${contrato.nombreCompleto || ""}</div>
    <div>\u2022Dni: ${contrato.dni || ""}</div>
    <div>\u2022Tel\u00e9fono: ${contrato.telefono || ""}</div>
    <div>\u2022Direcci\u00f3n: ${contrato.direccion || ""}</div>
    <div>\u2022Correo electronico: ${contrato.email || ""}</div>
    <div>\u2022IVA: ${condicionIVA}.</div>
  </div>

  <h3 class="clausula">2) <span>Datos del evento a contratar:</span></h3>
  <p class="parrafo">Los Jazmines hace cesi\u00f3n precaria del inmueble y sus instalaciones para la realizaci\u00f3n de eventos privados seg\u00fan las normas que aqu\u00ed se detallan:</p>
  <p class="parrafo"><span class="campo">Fecha:</span> ${fechaEvento}</p>
  <p class="parrafo"><span class="campo">Horario:</span> de las ${fechaEvento} ${horarioInicio} a las ${fechaFin} ${horarioFin} (Sujeto a protocolo vigente)</p>
  <p class="parrafo"><span class="campo">Cantidad de cubiertos/invitados:</span> ${totalPersonas || ""}</p>
  <p class="parrafo"><span class="campo">Precio:</span> El precio por el uso del sal\u00f3n y la prestaci\u00f3n detallada en el presente contrato y sus anexos es de (PESOS) ${precioEvento > 0 ? formatCurrency(precioEvento) : "$______________"}. tom\u00e1ndose como base un m\u00ednimo de ${totalPersonas || "___"} invitados.</p>

  <h3 class="clausula">3) <span>Forma de pago:</span></h3>
  <p class="parrafo">${formaPago || "A convenir entre las partes."}</p>

  <h3 class="clausula">4) <span>Incumplimiento:</span></h3>
  <p class="parrafo">En caso de incumplimiento por parte del cliente respecto al pago de las cuotas pactadas dentro de los t\u00e9rminos estipulados en el inciso 3 del presente contrato Los Jazmines Eventos operar\u00e1 la mora del cliente en forma autom\u00e1tica al vencimiento de la fecha de pago pactada, deveng\u00e1ndose a partir de la misma una multa de 3000 pesos por cada d\u00eda de atraso en el cumplimiento de la obligaci\u00f3n respectiva.</p>

  <h3 class="clausula">5) <span>Detalle del servicio a prestar por Los Jazmines:</span></h3>
  ${detalleServicioRows}
  ${personalRows ? `<p class="parrafo" style="margin-top:10px;"><strong>Personal asignado al evento:</strong></p><div class="datos-lista">${personalRows}</div>` : ""}

  <h3 class="clausula">6) <span>Compromiso de pago SADAIC / AADICAPIF:</span></h3>
  <p class="parrafo">El precio convenido incluye los importes correspondientes a SADAIC y AADICAPIF.</p>

  <h3 class="clausula">7) <span>N\u00famero m\u00e1ximo de participantes:</span></h3>
  <p class="parrafo">En aquellos eventos donde no se conoce el n\u00famero fijo de participantes (desfiles, recepciones, cocktail\u00b4s, congresos, seminarios, invitados despu\u00e9s del postre a una fiesta u otros) el cliente garantizar\u00e1 a Los Jazmines eventos la asistencia de una cantidad de personas acorde al tama\u00f1o del sal\u00f3n. El Cliente se har\u00e1 directamente responsable, en los t\u00e9rminos del art\u00edculo 1113, ante Los Jazmines eventos y ante los invitados que no puedan entrar por haberse excedido la capacidad del sal\u00f3n.</p>

  <h3 class="clausula">8) <span>Pol\u00edtica de cancelaci\u00f3n:</span></h3>
  <p class="parrafo">En caso de que el evento sea cancelado por exclusiva culpa de El Cliente, Los Jazmines Eventos se encontrar\u00e1 facultado a retener los importes que hubiese recibido a la fecha de la cancelaci\u00f3n, en concepto de indemnizaci\u00f3n pactada. En ning\u00fan caso se admitir\u00e1 el cambio de fecha para el evento, ni la invocaci\u00f3n por el Cliente de causal alguna, incluso caso fortuito o fuerza mayor. Tampoco se admitir\u00e1 la anulaci\u00f3n, reducci\u00f3n y/o modificaci\u00f3n de la indemnizaci\u00f3n estipulada precedentemente. En caso que el evento se vea afectado por restricciones sanitarias, el evento ser\u00e1 reprogramado sin sufrir ning\u00fan incremento en el costo del sal\u00f3n ni de los servicios contratados dentro del periodo de un a\u00f1o desde la fecha de contrataci\u00f3n original.</p>

  <h3 class="clausula">9) <span>Volumen de sonido:</span></h3>
  <p class="parrafo">El volumen del sonido en un evento con una presentaci\u00f3n, show o baile no deber\u00e1 exceder los 90 decibeles dentro del sal\u00f3n principal medidos frente a los parlantes. Por esta raz\u00f3n quedan expresamente prohibidas todas las presentaciones de comparsas, murgas y/o batucadas en vivo en cualquier \u00e1rea del predio, d\u00eda y horario. El Cliente se compromete a volver el sonido a este volumen a solicitud del coordinador del evento por parte de Los Jazmines Eventos. En caso contrario Los Jazmines eventos se reserva el derecho de hacer concluir el hecho generador del sonido inadecuado y aun el de dar por finalizado el evento, no haci\u00e9ndose responsable por eventuales da\u00f1os y perjuicios ni teniendo el cliente derecho a reclamar suma alguna en concepto de reintegro o indemnizaci\u00f3n.</p>

  <h3 class="clausula">10) <span>Actividades en \u00e1reas descubiertas:</span></h3>
  <p class="parrafo">Queda prohibido realizar shows musicales, tandas de baile y toda actividad que generen sonido en los jardines del predio, excepto m\u00fasica funcional para recepciones a no m\u00e1s de 45 decibeles.</p>

  <h3 class="clausula">11) <span>Consumo de bebidas alcoh\u00f3licas:</span></h3>
  <p class="parrafo">Queda prohibido el expendio y consumo de bebidas alcoh\u00f3licas por parte de menores de 18 a\u00f1os. Ley 24.788.-</p>

  <h3 class="clausula">12) <span>Responsabilidades:</span></h3>
  <p class="parrafo">Los Jazmines Eventos no se responsabiliza por eventuales da\u00f1os, robos, p\u00e9rdidas o extrav\u00edos sufridos por el cliente y/o terceros cualquiera fuere la causa, producidos antes, durante o despu\u00e9s del evento. Quedar\u00e1 a cargo del cliente la seguridad de bienes o mercader\u00edas, pudiendo contratar su propio servicio de seguridad. Los Jazmines Eventos podr\u00e1 brindar un servicio extra de seguridad a solicitud del Cliente, factur\u00e1ndolo de acuerdo a la cantidad de horas y de personal involucrado. Cualquier objeto que quede en Los Jazmines Eventos, con o sin previo conocimiento del mismo, ser\u00e1 considerado abandonado y Los Jazmines Eventos no se har\u00e1 responsable de roturas, p\u00e9rdida, ni ning\u00fan otro tipo de reclamo. Los Jazmines Eventos no tendr\u00e1 responsabilidad sobre los compromisos adquiridos con terceros por el cliente o un organizador (proveedores, expositores, servicio de catering, clientes, etc.) en relaci\u00f3n al evento. El Cliente asume entera responsabilidad por la conducta de todas las personas, sean concurrentes o que cumplan alg\u00fan servicio y por cualquier da\u00f1o causado a Los Jazmines Eventos y/o cualquier persona en ocasi\u00f3n o como consecuencia del evento. El Cliente acuerda reembolsar a Los Jazmines Eventos por el valor justo, por cualquier da\u00f1o o p\u00e9rdida causada a Los Jazmines Eventos \u00f3 a un tercero, sea por el propio cliente, su personal, los terceros por \u00e9l contratados o el p\u00fablico asistente al evento. A tales fines, el Cliente entregar\u00e1 a Los Jazmines Eventos, si este as\u00ed lo considerase, en concepto de dep\u00f3sito de garant\u00eda, un cheque o su equivalente en pesos igual al 10% del valor del alquiler del sal\u00f3n. Que ser\u00e1 restituido dentro de las 72hs de finalizado el evento siempre que no se hubiese producido ninguno de los supuestos comprendidos en la presente cl\u00e1usula. Caso contrario el cheque podr\u00e1 ser depositado al cobro por parte de Los Jazmines Eventos en concepto de indemnizaci\u00f3n por los da\u00f1os causados, sin perjuicios de mayores da\u00f1os por los que el cliente deber\u00e1 responder. Los Jazmines Eventos en ning\u00fan supuesto y bajo ninguna circunstancia ser\u00e1 responsable por hechos ajenos, caso fortuito o fuerza mayor, como as\u00ed tampoco por cuestiones ajenas a su \u00f3rbita de competencia, entendi\u00e9ndose como tales aquellas obligaciones y servicios no incorporados al presente y que dependen de la voluntad exclusiva del Cliente. Sin mengua de lo expuesto y en caso que el evento no pudiese realizarse por exclusiva responsabilidad de la firma Los Jazmines Eventos, esta responder\u00e1 exclusivamente hasta el valor de la suma que hubiese recibido del cliente; por lo que este \u00faltimo renuncia expresamente, en caso de corresponder, a reclamar cualquier suma adicional por cualquier concepto.</p>

  <h3 class="clausula">13) <span>Derecho de imagenes:</span></h3>
  <p class="parrafo">Los Jazmines Eventos se reserva el derecho sobre las im\u00e1genes y contenido multimedia que surja de la filmaci\u00f3n y fotograf\u00edas del evento, pudiendo utilizar parcial o totalmente las im\u00e1genes para publicar en redes sociales o hacer marketing con las mismas.</p>

  <h3 class="clausula">14) <span>Seguridad y Orden P\u00fablico:</span></h3>
  <p class="parrafo">Las partes acuerdan que, durante la ejecuci\u00f3n del presente contrato, se mantendr\u00e1 el orden y la seguridad en el evento. En caso de que se produzcan disturbios, actos de violencia, vandalismo o cualquier otra situaci\u00f3n que ponga en riesgo la integridad de los asistentes, el organizador se reserva el derecho de suspender el evento sin previo aviso. Asimismo, cualquier da\u00f1o causado a la propiedad, equipo o instalaciones debido a altercados ser\u00e1 responsabilidad de los involucrados, quienes deber\u00e1n asumir los costos de reparaci\u00f3n o reposici\u00f3n. La contrataci\u00f3n de personal de seguridad ser\u00e1 determinada por el organizador seg\u00fan la naturaleza del evento y las condiciones del lugar.</p>

  <h3 class="clausula">15) <span>Prohibici\u00f3n de Suministro de Alcohol a Menores:</span></h3>
  <p class="parrafo">El organizador del evento establece como norma estricta la prohibici\u00f3n de suministro, de bebidas alcoh\u00f3licas a menores de edad, conforme a la legislaci\u00f3n vigente. En caso de detectarse que cualquier adulto proporciona alcohol a menores dentro del evento, el organizador se reserva el derecho de suspender inmediatamente la celebraci\u00f3n, sin derecho a reembolso para los asistentes ni para la parte contratante.</p>

  <div class="anexo">
    <h3 class="clausula"><span>Anexo I : Catering y bebidas</span></h3>

    ${anexoLinea("Adultos", String(evento.adultos || ""))}
    ${anexoLinea("Adolescentes", evento.adolescentes ? String(evento.adolescentes) : "")}
    ${anexoLinea("Ni\u00f1os", evento.ninos ? String(evento.ninos) : "")}

    ${anexoLinea(`Recepci\u00f3n (${menu.recepcion.length > 0 ? menu.recepcion.length : 5} item a elecci\u00f3n)`, menu.recepcion.join(", "))}
    ${anexoLinea("Entrada adultos", menu.entradaAdultos.join(", "))}
    ${anexoLinea("Entrada Adolescentes", menu.entradaAdolescentes.join(", "))}
    ${anexoLinea("Men\u00fa infantil", menu.menuInfantil.join(", "))}
    ${anexoLinea("Plato principal Adolescentes", menu.platoPrincipalAdolescentes.join(", "))}
    ${anexoLinea("Plato principal", menu.platoPrincipalAdultos.join(", "))}
    ${anexoLinea("Guarniciones", menu.guarniciones.join(", "))}
    ${anexoLinea("Postre", menu.postre.join(", "))}
    ${anexoLinea("Bebida de mesa Adultos", "")}

    ${anexoLinea("Tipo de barra", tipoBarra)}
    ${anexoLinea("Tragos incluidos", tragosIncluidos)}

    ${anexoLinea("Mesa dulce", menu.mesaDulce.join(", "))}

    ${anexoLinea("Observaciones", evento.descripcionPersonalizada || "")}

    <div class="firma-row">
      <div>FIRMA:<div class="firma-line">&nbsp;</div></div>
      <div>ACLARACI\u00d3N:<div class="firma-line">${contrato.nombreCompleto || "&nbsp;"}</div></div>
      <div>DNI:<div class="firma-line">${contrato.dni || "&nbsp;"}</div></div>
    </div>
  </div>

</div>
</body>
</html>`
}

// =====================================================================
// HELPER: Genera el HTML de la ultima version del contrato de un evento.
// Usa el snapshot de la version mas reciente si existe; si no, cae al
// estado actual del evento.
// =====================================================================
export function buildUltimaVersionContratoHTML(
  evento: EventoGuardado,
  recetas: Receta[],
  catalogoServicios: { id: string; nombre: string }[],
  pagosPersonal: PagoPersonal[] = [],
  barrasTemplates: BarraTemplate[] = [],
  cocteles: Coctel[] = [],
): string {
  const versiones = evento.versionesContrato || []
  let eventoParaImprimir = evento
  let serviciosNombres: string[]

  if (versiones.length > 0) {
    const ultima = [...versiones].sort((a, b) => b.version - a.version)[0]
    serviciosNombres = (ultima.snapshotServicios || [])
      .map((id) => catalogoServicios.find((s) => s.id === id)?.nombre || id)
      .concat(ultima.snapshotServiciosLibres || [])
    eventoParaImprimir = {
      ...evento,
      contrato: {
        nombreCompleto: ultima.snapshotContrato.nombreCompleto,
        dni: ultima.snapshotContrato.dni,
        telefono: ultima.snapshotContrato.telefono,
        direccion: ultima.snapshotContrato.direccion,
        email: ultima.snapshotContrato.email,
      },
      planDeCuotas: ultima.snapshotPlanCuotas || evento.planDeCuotas,
    }
  } else {
    // Sin versiones guardadas: usar servicios actuales del evento
    serviciosNombres = (evento.servicios || [])
      .map((se) => catalogoServicios.find((s) => s.id === se.servicioId)?.nombre || se.nombre)
      .filter(Boolean) as string[]
  }

  const personalAsignado = buildPersonalContrato(evento, pagosPersonal)
  return generateContractHTML(eventoParaImprimir, recetas, serviciosNombres, 0, personalAsignado, barrasTemplates, cocteles)
}

// =====================================================================
// HELPER: Imprime la ultima version del contrato de un evento.
// =====================================================================
export function imprimirUltimaVersionContrato(
  evento: EventoGuardado,
  recetas: Receta[],
  catalogoServicios: { id: string; nombre: string }[],
  pagosPersonal: PagoPersonal[] = [],
  barrasTemplates: BarraTemplate[] = [],
  cocteles: Coctel[] = [],
) {
  const html = buildUltimaVersionContratoHTML(evento, recetas, catalogoServicios, pagosPersonal, barrasTemplates, cocteles)
  const win = window.open("", "_blank")
  if (win) {
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 600)
  }
}
