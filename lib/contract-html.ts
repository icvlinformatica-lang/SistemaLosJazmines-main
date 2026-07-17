import {
  formatCurrency,
  type EventoGuardado,
  type Receta,
  type PagoPersonal,
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
  Casona: "Casona Florida 6040 - Del Viso - Bs. As.",
  Quinta: "Quinta Los Jazmines - Del Viso - Bs. As.",
  Salon: "Salon Los Jazmines - Del Viso - Bs. As.",
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
  }
}

// =====================================================================
// CONTRACT HTML GENERATOR
// =====================================================================
export function generateContractHTML(
  evento: EventoGuardado,
  recetas: Receta[],
  serviciosIncluidos: string[],
  paquetePrecio: number,
  personalAsignado: PersonalContrato[] = [],
) {
  const totalPersonas = evento.adultos + evento.adolescentes + evento.ninos + (evento.personasDietasEspeciales || 0)
  const contrato = evento.contrato || {}
  const planCuotas = evento.planDeCuotas
  const menu = buildMenuDetails(evento, recetas)
  const fechaEvento = evento.fecha ? new Date(evento.fecha + "T12:00:00").toLocaleDateString("es-AR") : "___/___/______"
  const fechaContrato = new Date().toLocaleDateString("es-AR")
  const salon = evento.salon || "___________"
  const direccion = SALON_DIRECCIONES[salon] || `${salon} - Del Viso - Bs. As.`
  const nombreEvento = evento.nombrePareja || evento.nombre || "Evento"
  const horarioInicio = evento.horario || "___:___"
  const horarioFin = evento.horarioFin || "___:___"
  const condicionIVA = evento.condicionIVA || "Consumidor Final"
  const precioEvento = evento.precioVenta || paquetePrecio || 0
  const modalidadPago = planCuotas?.modalidadPago || "cuotas"
  const montoSena = planCuotas?.montoSena || 0
  const porcentajeRecargo = planCuotas?.porcentajeRecargo || 0
  const montoFinanciado = modalidadPago === "sena" ? Math.max(0, (planCuotas?.montoTotal || 0) - montoSena) : (planCuotas?.montoTotal || 0)
  const importeRecargo = montoFinanciado * (porcentajeRecargo / 100)
  const montoConRecargo = montoFinanciado + importeRecargo
  const montoCuotaCalc = planCuotas && planCuotas.numeroCuotas > 0 ? montoConRecargo / planCuotas.numeroCuotas : 0
  const totalFinalContrato = (modalidadPago === "sena" ? montoSena : 0) + montoConRecargo

  let cuotasInfo = ""
  if (planCuotas && planCuotas.montoTotal > 0) {
    if (modalidadPago === "completo") {
      cuotasInfo = `Se abona el monto total de (PESOS ${formatCurrency(planCuotas.montoTotal)}) en un unico pago al momento de la firma del presente contrato.`
    } else if (modalidadPago === "sena" && montoSena > 0) {
      cuotasInfo = `En este acto se abona la suma de (PESOS ${formatCurrency(montoSena)}) en concepto de sena y el saldo de PESOS ${formatCurrency(montoFinanciado)} a cancelar en ${planCuotas.numeroCuotas} cuotas.`
    } else if (planCuotas.numeroCuotas > 0) {
      cuotasInfo = `El monto total de (PESOS ${formatCurrency(planCuotas.montoTotal)}) se abonara en ${planCuotas.numeroCuotas} cuotas${porcentajeRecargo > 0 ? ` con un recargo del ${porcentajeRecargo}%` : ""}.`
    }
  }

  const menuRows = [
    menu.recepcion.length > 0 ? `<tr><td style="font-weight:bold;padding:4px 8px;">Recepcion</td><td style="padding:4px 8px;">${menu.recepcion.join(", ")}</td></tr>` : "",
    menu.entradaAdultos.length > 0 ? `<tr><td style="font-weight:bold;padding:4px 8px;">Entrada (adultos)</td><td style="padding:4px 8px;">${menu.entradaAdultos.join(", ")}</td></tr>` : "",
    menu.entradaAdolescentes.length > 0 ? `<tr><td style="font-weight:bold;padding:4px 8px;">Entrada (adolescentes)</td><td style="padding:4px 8px;">${menu.entradaAdolescentes.join(", ")}</td></tr>` : "",
    menu.platoPrincipalAdultos.length > 0 ? `<tr><td style="font-weight:bold;padding:4px 8px;">Plato Principal (adultos)</td><td style="padding:4px 8px;">${menu.platoPrincipalAdultos.join(", ")}</td></tr>` : "",
    menu.platoPrincipalAdolescentes.length > 0 ? `<tr><td style="font-weight:bold;padding:4px 8px;">Plato Principal (adolescentes)</td><td style="padding:4px 8px;">${menu.platoPrincipalAdolescentes.join(", ")}</td></tr>` : "",
    menu.guarniciones.length > 0 ? `<tr><td style="font-weight:bold;padding:4px 8px;">Guarniciones</td><td style="padding:4px 8px;">${menu.guarniciones.join(", ")}</td></tr>` : "",
    menu.menuInfantil.length > 0 ? `<tr><td style="font-weight:bold;padding:4px 8px;">Menu Infantil</td><td style="padding:4px 8px;">${menu.menuInfantil.join(", ")}</td></tr>` : "",
    menu.postre.length > 0 ? `<tr><td style="font-weight:bold;padding:4px 8px;">Postre</td><td style="padding:4px 8px;">${menu.postre.join(", ")}</td></tr>` : "",
  ].filter(Boolean).join("")

  const serviciosRows = serviciosIncluidos.map((s) => `<li style="margin-bottom:4px;">${s}</li>`).join("")

  const personalRows = personalAsignado
    .map((p) => `<tr><td style="font-weight:bold;padding:4px 8px;width:220px;">${p.funcion}</td><td style="padding:4px 8px;">${p.nombre}</td></tr>`)
    .join("")

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Contrato - ${nombreEvento}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 0; padding: 0; }
  .page { max-width: 780px; margin: 0 auto; padding: 40px 48px; }
  h1 { font-size: 20px; text-align: center; margin-bottom: 4px; }
  h2 { font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 20px; margin-bottom: 8px; }
  table.data td { padding: 3px 8px; vertical-align: top; }
  table.data td:first-child { font-weight: bold; width: 180px; }
  .firma { display: flex; gap: 60px; margin-top: 60px; }
  .firma-box { flex: 1; text-align: center; }
  .firma-line { border-top: 1px solid #111; margin-top: 48px; padding-top: 6px; font-size: 11px; }
  @media print { body { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page">
  <h1>LOS JAZMINES</h1>
  <p style="text-align:center;font-size:11px;color:#555;">${direccion}</p>
  <h1 style="font-size:16px;margin-top:16px;">CONTRATO DE SERVICIOS</h1>
  <p style="text-align:center;color:#555;font-size:11px;">Fecha: ${fechaContrato}</p>

  <h2>DATOS DEL CLIENTE</h2>
  <table class="data">
    <tr><td>Nombre completo</td><td>${contrato.nombreCompleto || "___________________________"}</td></tr>
    <tr><td>DNI</td><td>${contrato.dni || "___________________________"}</td></tr>
    <tr><td>Telefono</td><td>${contrato.telefono || "___________________________"}</td></tr>
    <tr><td>Direccion</td><td>${contrato.direccion || "___________________________"}</td></tr>
    <tr><td>Email</td><td>${contrato.email || "___________________________"}</td></tr>
    <tr><td>Condicion IVA</td><td>${condicionIVA}</td></tr>
  </table>

  <h2>DATOS DEL EVENTO</h2>
  <table class="data">
    <tr><td>Evento</td><td>${nombreEvento}</td></tr>
    <tr><td>Fecha</td><td>${fechaEvento}</td></tr>
    <tr><td>Horario</td><td>${horarioInicio} a ${horarioFin} hs.</td></tr>
    <tr><td>Salon</td><td>${salon} — ${direccion}</td></tr>
    <tr><td>Invitados</td><td>${totalPersonas} personas (${evento.adultos} adultos, ${evento.adolescentes} adolescentes, ${evento.ninos} ninos)</td></tr>
  </table>

  ${serviciosIncluidos.length > 0 ? `
  <h2>SERVICIOS CONTRATADOS</h2>
  <ul style="margin:0;padding-left:20px;">${serviciosRows}</ul>
  ` : ""}

  ${personalRows ? `
  <h2>PERSONAL ASIGNADO AL EVENTO</h2>
  <table style="width:100%;border-collapse:collapse;">${personalRows}</table>
  ` : ""}

  ${menuRows ? `
  <h2>MENU</h2>
  <table style="width:100%;border-collapse:collapse;">${menuRows}</table>
  ` : ""}

  ${planCuotas && planCuotas.montoTotal > 0 ? `
  <h2>CONDICIONES ECONOMICAS</h2>
  <table class="data">
    <tr><td>Precio total</td><td>${formatCurrency(planCuotas.montoTotal)}</td></tr>
    ${modalidadPago === "sena" ? `<tr><td>Sena abonada</td><td>${formatCurrency(montoSena)}</td></tr>` : ""}
    ${planCuotas.numeroCuotas > 1 ? `
      <tr><td>Cuotas</td><td>${planCuotas.numeroCuotas} cuotas de ${formatCurrency(montoCuotaCalc)}${porcentajeRecargo > 0 ? ` (con ${porcentajeRecargo}% de recargo)` : ""}</td></tr>
      <tr><td>Total con recargo</td><td>${formatCurrency(totalFinalContrato)}</td></tr>
    ` : ""}
  </table>
  <p style="margin-top:8px;font-size:11px;">${cuotasInfo}</p>
  ` : ""}

  <h2>CLAUSULAS</h2>
  <p style="line-height:1.6;">El presente contrato regula la prestacion de servicios de catering y salon para el evento indicado. El incumplimiento en los plazos de pago podra dar lugar a la rescision del contrato con perdida de la sena abonada. Los servicios seran prestados en el salon indicado en las condiciones y horarios especificados. Cualquier modificacion debera ser acordada por escrito entre ambas partes.</p>

  <div class="firma">
    <div class="firma-box">
      <div class="firma-line">Firma del Cliente<br/>${contrato.nombreCompleto || ""}</div>
    </div>
    <div class="firma-box">
      <div class="firma-line">Firma Los Jazmines<br/>Representante Autorizado</div>
    </div>
  </div>
</div>
</body>
</html>`
}

// =====================================================================
// HELPER: Imprime la ultima version del contrato de un evento.
// Usa el snapshot de la version mas reciente si existe; si no, cae al
// estado actual del evento.
// =====================================================================
export function imprimirUltimaVersionContrato(
  evento: EventoGuardado,
  recetas: Receta[],
  catalogoServicios: { id: string; nombre: string }[],
  pagosPersonal: PagoPersonal[] = [],
) {
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
  const html = generateContractHTML(eventoParaImprimir, recetas, serviciosNombres, 0, personalAsignado)
  const win = window.open("", "_blank")
  if (win) {
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 600)
  }
}
