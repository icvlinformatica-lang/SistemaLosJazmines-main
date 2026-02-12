"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useStore } from "@/lib/store-context"
import {
  formatCurrency,
  calcularFechaCuota,
  calcularTotalesPaquete,
  type EventoGuardado,
  type Receta,
} from "@/lib/store"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, FileText, Printer, Calendar, Users, Eye } from "lucide-react"

// =====================================================================
// SALON ADDRESS MAP
// =====================================================================
const SALON_DIRECCIONES: Record<string, string> = {
  Casona: "Casona Florida 6040 - Del Viso - Bs. As.",
  Quinta: "Quinta Los Jazmines - Del Viso - Bs. As.",
  Salon: "Salon Los Jazmines - Del Viso - Bs. As.",
}

// =====================================================================
// HELPER: Build menu details from event recipes
// =====================================================================
function buildMenuDetails(
  evento: EventoGuardado,
  recetas: Receta[]
): {
  recepcion: string[]
  entradaAdultos: string[]
  entradaAdolescentes: string[]
  menuInfantil: string[]
  platoPrincipalAdultos: string[]
  platoPrincipalAdolescentes: string[]
  guarniciones: string[]
  postre: string[]
} {
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
// MAIN: Contract Print HTML Generator
// =====================================================================
function generateContractHTML(
  evento: EventoGuardado,
  recetas: Receta[],
  serviciosIncluidos: string[],
  paquetePrecio: number
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

  // Price
  const precioEvento = evento.precioVenta || paquetePrecio || 0

  // Plan de cuotas info
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
      if (porcentajeRecargo > 0) {
        cuotasInfo += ` Se aplica un recargo por financiacion del ${porcentajeRecargo}% sobre el saldo financiado, resultando un monto financiado con recargo de PESOS ${formatCurrency(montoConRecargo)}.`
      }
      cuotasInfo += ` El monto de cada cuota es de PESOS (${formatCurrency(montoCuotaCalc)}) + IPC acumulativo. Cuotas posteriores se deberan abonar de forma mensual y consecutiva (el ${planCuotas.diaVencimiento || 10} de cada mes). Las cuotas se ajustan mensualmente segun indice IPC Nacional.`
    } else {
      cuotasInfo = `En este acto se acuerda el pago total de (PESOS ${formatCurrency(planCuotas.montoTotal)}) a cancelar en ${planCuotas.numeroCuotas} cuotas.`
      if (porcentajeRecargo > 0) {
        cuotasInfo += ` Se aplica un recargo por financiacion del ${porcentajeRecargo}%, resultando un monto total financiado de PESOS ${formatCurrency(montoConRecargo)}.`
      }
      cuotasInfo += ` El monto de cada cuota es de PESOS (${formatCurrency(montoCuotaCalc)}) + IPC acumulativo. Cuotas posteriores se deberan abonar de forma mensual y consecutiva (el ${planCuotas.diaVencimiento || 10} de cada mes). Las cuotas se ajustan mensualmente segun indice IPC Nacional.`
    }
  }

  // Servicios list
  const serviciosList = serviciosIncluidos.length > 0
    ? serviciosIncluidos.map((s) => `<li style="margin-bottom:4px;">${s}</li>`).join("")
    : `<li>Mesas y Sillas</li>
       <li>Vajilla y cristaleria completa</li>
       <li>Manteleria y fundas para sillas con lazos y caminos</li>
       <li>Ambientacion led</li>
       <li>Dj - Sonido Completo / Luces robotizadas / Maquina de humo / Laser</li>
       <li>Personal en puerta / Encargado de Salon</li>
       <li>Limpieza Posterior incluida</li>
       <li>Estacionamiento privado</li>
       <li>Servicio de Emergencias Medicas</li>`

  // Menu section
  let menuHTML = ""
  menuHTML += `<h3 style="text-align:center;font-weight:bold;font-size:11pt;margin-top:20px;text-decoration:underline;">Anexo I: Catering y bebidas</h3>`
  menuHTML += `<div style="text-align:center;margin-top:8px;">`
  menuHTML += `<p>Adultos: ${evento.adultos}</p>`
  menuHTML += `<p>Adolescentes: ${evento.adolescentes}</p>`
  menuHTML += `<p>Ninos: ${evento.ninos}</p>`
  menuHTML += `</div>`

  if (menu.recepcion.length > 0) {
    menuHTML += `<p style="text-align:center;font-weight:bold;margin-top:16px;">Recepcion:</p>`
    menuHTML += `<p style="text-align:center;">${menu.recepcion.join(", ")}</p>`
  }

  if (menu.entradaAdultos.length > 0) {
    menuHTML += `<p style="text-align:center;font-weight:bold;margin-top:12px;">Entrada adultos:</p>`
    menuHTML += `<p style="text-align:center;">${menu.entradaAdultos.join(", ")}</p>`
  }

  if (menu.entradaAdolescentes.length > 0) {
    menuHTML += `<p style="text-align:center;font-weight:bold;margin-top:12px;">Entrada Adolescentes:</p>`
    menuHTML += `<p style="text-align:center;">${menu.entradaAdolescentes.join(", ")}</p>`
  }

  if (menu.menuInfantil.length > 0) {
    menuHTML += `<p style="text-align:center;font-weight:bold;margin-top:12px;">Menu infantil:</p>`
    menuHTML += `<p style="text-align:center;">${menu.menuInfantil.join(", ")}</p>`
  }

  if (menu.platoPrincipalAdultos.length > 0) {
    menuHTML += `<p style="text-align:center;font-weight:bold;margin-top:12px;">Plato principal Adultos:</p>`
    menuHTML += `<p style="text-align:center;">${menu.platoPrincipalAdultos.join(", ")}</p>`
  }

  if (menu.platoPrincipalAdolescentes.length > 0) {
    menuHTML += `<p style="text-align:center;font-weight:bold;margin-top:12px;">Plato principal Adolescentes:</p>`
    menuHTML += `<p style="text-align:center;">${menu.platoPrincipalAdolescentes.join(", ")}</p>`
  }

  if (menu.guarniciones.length > 0) {
    menuHTML += `<p style="text-align:center;font-weight:bold;margin-top:12px;">Guarniciones:</p>`
    menuHTML += `<p style="text-align:center;">${[...new Set(menu.guarniciones)].join(", ")}</p>`
  }

  if (menu.postre.length > 0) {
    menuHTML += `<p style="text-align:center;font-weight:bold;margin-top:12px;">Postre:</p>`
    menuHTML += `<p style="text-align:center;">${[...new Set(menu.postre)].join(", ")}</p>`
  }

  // Observaciones
  const observaciones = evento.descripcionPersonalizada || ""

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Contrato - ${nombreEvento}</title>
<style>
  @page { margin: 2cm 2.5cm; size: A4; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Times New Roman', Times, serif;
    color: #1a1a1a;
    background: #fff;
    font-size: 11pt;
    line-height: 1.55;
  }
  .header {
    text-align: center;
    margin-bottom: 28px;
    padding-bottom: 8px;
  }
  .logo-text {
    font-family: 'Brush Script MT', 'Lucida Handwriting', cursive;
    font-size: 32pt;
    font-style: italic;
    color: #1a1a1a;
    margin-bottom: 0;
  }
  .logo-sub {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 14pt;
    font-weight: bold;
    letter-spacing: 6px;
    text-transform: uppercase;
    margin-top: -4px;
  }
  .titulo-convenio {
    text-align: center;
    font-size: 12pt;
    margin-top: 20px;
    margin-bottom: 4px;
  }
  .titulo-direccion {
    text-align: center;
    font-size: 11pt;
    margin-bottom: 12px;
  }
  .titulo-evento {
    text-align: center;
    font-size: 12pt;
    margin-bottom: 24px;
  }
  .section-title {
    font-weight: bold;
    text-decoration: underline;
    margin-top: 18px;
    margin-bottom: 8px;
  }
  .clause {
    margin-bottom: 14px;
    text-align: justify;
  }
  .clause-title {
    font-weight: bold;
    text-decoration: underline;
  }
  .personal-data {
    margin-left: 20px;
    margin-bottom: 14px;
  }
  .personal-data p {
    margin-bottom: 2px;
  }
  .services-list {
    margin-left: 40px;
    margin-bottom: 14px;
  }
  .services-list li {
    margin-bottom: 3px;
  }
  .firma-section {
    margin-top: 60px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  .firma-box {
    text-align: center;
    width: 30%;
  }
  .firma-line {
    border-top: 1px solid #000;
    margin-top: 60px;
    padding-top: 4px;
    font-size: 10pt;
    font-weight: bold;
  }
  .page-break {
    page-break-before: always;
    break-before: page;
  }
</style>
</head>
<body>

<!-- ==================== PAGE 1: HEADER & PERSONAL DATA ==================== -->
<div class="header">
  <p class="logo-text">Los Jazmines</p>
  <p class="logo-sub">EVENTOS</p>
</div>

<p class="titulo-convenio"><strong>Convenio de realizacion de eventos</strong></p>
<p class="titulo-direccion">${direccion} &nbsp; Fecha ${fechaContrato}</p>
<p class="titulo-evento">${nombreEvento}</p>

<!-- 1) DATOS PERSONALES -->
<p><strong>1) <span class="section-title">Datos personales:</span></strong></p>
<div class="personal-data">
  <p>&bull;Nombre completo: ${contrato.nombreCompleto || "________________________"}</p>
  <p>&bull;Dni: ${contrato.dni || "________________________"}</p>
  <p>&bull;Telefono: ${contrato.telefono || "________________________"}</p>
  <p>&bull;Direccion: ${contrato.direccion || "________________________"}</p>
  <p>&bull;Correo electronico: ${contrato.email || "________________________"}</p>
  <p>&bull;IVA: ${condicionIVA}</p>
</div>

<!-- 2) DATOS DEL EVENTO -->
<p><strong>2) <span class="section-title">Datos del evento a contratar:</span></strong></p>
<div class="clause" style="margin-left:20px;">
  <p>Los Jazmines hace cesion precaria del inmueble y sus instalaciones para la realizacion de eventos privados segun las normas que aqui se detallan:</p>
  <p style="margin-top:6px;"><span style="text-decoration:underline;">Fecha:</span> ${fechaEvento}</p>
  <p><span style="text-decoration:underline;">Horario:</span> de las ${evento.fecha ? evento.fecha.split("-").reverse().join("/") : "___/___/___"} ${horarioInicio} &nbsp; a las ${horarioFin} &nbsp; (Sujeto a protocolo vigente)</p>
  <p><span style="text-decoration:underline;">Cantidad de cubiertos/invitados:</span> ${totalPersonas}</p>
  <p><span style="text-decoration:underline;">Precio:</span> El precio por el uso del salon y la prestacion detallada en el presente contrato y sus anexos es de (PESOS ${precioEvento > 0 ? formatCurrency(precioEvento) : "________________"}). tomandose como base un minimo de ${totalPersonas} invitados.</p>
</div>

<!-- 3) FORMA DE PAGO -->
<p><strong>3) <span class="section-title">Forma de pago:</span></strong></p>
<div class="clause" style="margin-left:20px;">
  ${cuotasInfo || `<p>En este acto se abona la suma de (PESOS ________________) en concepto de sena y el saldo de PESOS ________________ a cancelar en _____ cuotas. Las cuotas se ajustan mensualmente segun indice IPC Nacional.</p>`}
  ${planCuotas && planCuotas.numeroCuotas > 0 && planCuotas.fechaInicioPlan ? `
  <div style="margin-top:12px;">
    <p style="font-weight:bold;margin-bottom:4px;">Calendario de cuotas:</p>
    <table style="width:100%;border-collapse:collapse;font-size:10pt;">
      <thead>
        <tr>
          <th style="border:1px solid #999;padding:4px 8px;text-align:left;background:#f0f0f0;">Cuota</th>
          <th style="border:1px solid #999;padding:4px 8px;text-align:left;background:#f0f0f0;">Fecha Vencimiento</th>
          <th style="border:1px solid #999;padding:4px 8px;text-align:right;background:#f0f0f0;">Monto Base</th>
        </tr>
      </thead>
      <tbody>
        ${Array.from({ length: planCuotas.numeroCuotas }).map((_, idx) => {
          const cuotaNum = idx + 1
          const fechaCuota = calcularFechaCuota(planCuotas.fechaInicioPlan, cuotaNum, planCuotas.diaVencimiento || 10)
          const monto = planCuotas.montoCuota || Math.round(planCuotas.montoTotal / planCuotas.numeroCuotas)
          return `<tr>
            <td style="border:1px solid #999;padding:4px 8px;">Cuota ${cuotaNum}</td>
            <td style="border:1px solid #999;padding:4px 8px;">${fechaCuota}</td>
            <td style="border:1px solid #999;padding:4px 8px;text-align:right;font-family:monospace;">${formatCurrency(monto)}</td>
          </tr>`
        }).join("")}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="border:1px solid #999;padding:4px 8px;font-weight:bold;text-align:right;">Total:</td>
          <td style="border:1px solid #999;padding:4px 8px;text-align:right;font-weight:bold;font-family:monospace;">${formatCurrency(planCuotas.montoTotal)}</td>
        </tr>
      </tfoot>
    </table>
  </div>
  ` : ""}
</div>

<!-- 4) INCUMPLIMIENTO -->
<p class="clause"><strong>4) <span class="clause-title">Incumplimiento:</span></strong> En caso de incumplimiento por parte del cliente respecto al pago de las cuotas pactadas dentro de los terminos estipulados en el inciso 3 del presente contrato Los Jazmines Eventos operara la mora del cliente en forma automatica al vencimiento de la fecha de pago pactada, devengandose a partir de la misma una multa de 3000 pesos por cada dia de atraso en el cumplimiento de la obligacion respectiva.</p>

<!-- 5) DETALLE DEL SERVICIO -->
<p><strong>5) <span class="section-title">Detalle del servicio a prestar por Los Jazmines:</span></strong></p>
<ul class="services-list">
  ${serviciosList}
</ul>

<!-- 6) SADAIC / AADICAPIF -->
<p class="clause"><strong>6) <span class="clause-title">Compromiso de pago SADAIC / AADICAPIF:</span></strong> El precio convenido incluye los importes correspondientes a SADAIC y AADICAPIF.</p>

<!-- 7) NUMERO MAXIMO DE PARTICIPANTES -->
<p class="clause"><strong>7) <span class="clause-title">Numero maximo de participantes:</span></strong> En aquellos eventos donde no se conoce el numero fijo de participantes (desfiles, recepciones, cocktails, congresos, seminarios, invitados despues del postre a una fiesta u otros) el cliente garantizara a Los Jazmines eventos la asistencia de una cantidad de personas acorde al tamano del salon. El Cliente se hara directamente responsable, en los terminos del articulo 1113, ante Los Jazmines eventos y ante los invitados que no puedan entrar por haberse excedido la capacidad del salon.</p>

<!-- 8) POLITICA DE CANCELACION -->
<p class="clause"><strong>8) <span class="clause-title">Politica de cancelacion:</span></strong> En caso de que el evento sea cancelado por exclusiva culpa de El Cliente, Los Jazmines Eventos se encontrara facultado a retener los importes que hubiese recibido a la fecha de la cancelacion, en concepto de indemnizacion pactada. En ningun caso se admitira el cambio de fecha para el evento, ni la invocacion por el Cliente de causal alguna, incluso caso fortuito o fuerza mayor. Tampoco se admitira la anulacion, reduccion y/o modificacion de la indemnizacion estipulada precedentemente. En caso que el evento se vea afectado por las restricciones sanitarias producto de la pandemia de COVID-19 que esta afectando al pais, el evento sera reprogramado sin sufrir ningun incremento en el costo del salon ni de los servicios contratados dentro del periodo de un ano desde la fecha de contratacion original.</p>

<!-- 9) VOLUMEN DE SONIDO -->
<p class="clause"><strong>9) <span class="clause-title">Volumen de sonido:</span></strong> El volumen del sonido en un evento con una presentacion, show o baile no debera exceder los 90 decibeles dentro del salon principal medidos frente a los parlantes. Por esta razon quedan expresamente prohibidas todas las presentaciones de comparsas, murgas y/o batucadas en vivo en cualquier area del predio, dia y horario. El Cliente se compromete a volver el sonido a este volumen a solicitud del coordinador del evento por parte de Los Jazmines Eventos. En caso contrario Los Jazmines eventos se reserva el derecho de hacer concluir el hecho generador del sonido inadecuado y aun el de dar por finalizado el evento, no haciendose responsable por eventuales danos y perjuicios ni teniendo el cliente derecho a reclamar suma alguna en concepto de reintegro o indemnizacion.</p>

<!-- 10) ACTIVIDADES EN AREAS DESCUBIERTAS -->
<p class="clause"><strong>10) <span class="clause-title">Actividades en areas descubiertas:</span></strong> Queda prohibido realizar shows musicales, tandas de baile y toda actividad que generen sonido en los jardines del predio, excepto musica funcional para recepciones a no mas de 45 decibeles.</p>

<!-- 11) CONSUMO DE BEBIDAS ALCOHOLICAS -->
<p class="clause"><strong>11) <span class="clause-title">Consumo de bebidas alcoholicas:</span></strong> Queda prohibido el expendio y consumo de bebidas alcoholicas por parte de menores de 18 anos. Ley 24.788.-</p>

<!-- 12) RESPONSABILIDADES -->
<p class="clause"><strong>12) <span class="clause-title">Responsabilidades:</span></strong> Los Jazmines Eventos no se responsabiliza por eventuales danos, robos, perdidas o extravios sufridos por el cliente y/o terceros cualquiera fuere la causa, producidos antes, durante o despues del evento. Quedara a cargo del cliente la seguridad de bienes o mercaderias, pudiendo contratar su propio servicio de seguridad. Los Jazmines Eventos podra brindar un servicio extra de seguridad a solicitud del Cliente, facturando el mismo de acuerdo a la cantidad de horas y de personal involucrado. Cualquier objeto deja en Los Jazmines Eventos, con o sin previo conocimiento del mismo sera considerado abandonado y Los Jazmines Eventos no se hara responsable de roturas, perdida, ningun otro tipo de reclamo. Los Jazmines Eventos no tendra responsabilidad sobre los compromisos adquiridos con terceros por el cliente o un organizador (proveedores, expositores, servicio de catering, clientes, etc.) En relacion al evento. El Cliente asume entera responsabilidad de la conducta de todas las personas, sean concurrentes o que cumplan algun servicio y por cualquier dano causado a Los Jazmines Eventos y/o cualquier persona en ocasion o como consecuencia del evento. El Cliente acuerda reembolsar a Los Jazmines Eventos por el valor justo, por cualquier dano o perdida causada a Los Jazmines Eventos o a un tercero, sea por el propio cliente, su personal, los terceros por el contratados o el publico asistente al evento. A tales fines, el Cliente entregara a Los Jazmines Eventos, si este asi lo considerase, en concepto de deposito de garantia, un cheque o su equivalente en pesos igual al 10% del valor del alquiler del salon. Que sera restituido dentro de las 72hs de finalizado el evento siempre que no se hubiese producido ninguno de los supuestos comprendidos en la presente clausula. Caso contrario el cheque podra ser depositado al cobro por parte de Los Jazmines Eventos en concepto de indemnizacion por los danos causados, sin prejuicios de mayores danos por los que el cliente debera responder.</p>

<p class="clause">Los Jazmines Eventos en ningun supuesto y bajo ninguna circunstancia sera responsable por hechos ajenos, caso fortuito o fuerza mayor, como asi tampoco por cuestiones ajenas a su orbita de competencia, entendiendose como tales aquellas obligaciones y servicios no incorporados al presente y que dependan de la voluntad exclusiva del Cliente.</p>

<p class="clause">Sin mengua de lo expuesto y en caso que el evento no pudiese realizarse por exclusiva responsabilidad de la firma Los Jazmines Eventos, esta respondera exclusivamente hasta el valor de la suma que hubiese recibido del cliente; por lo que este ultimo renuncia expresamente, en caso de corresponder, a reclamar cualquier suma adicional por cualquier concepto.</p>

<!-- 13) DERECHO DE IMAGENES -->
<p class="clause"><strong>13) <span class="clause-title">Derecho de imagenes:</span></strong> Los Jazmines Eventos se reserva el derecho sobre las imagenes y contenido multimedia que surja de la filmacion y fotografias del evento, pudiendo utilizar parcial o totalmente las imagenes para publicar en redes sociales o hacer marketing con las mismas.</p>

<!-- 14) SEGURIDAD Y ORDEN PUBLICO -->
<p class="clause"><strong>14) <span class="clause-title">Seguridad y Orden Publico:</span></strong> Las partes acuerdan que, durante la ejecucion del presente contrato, se mantendra el orden y la seguridad en el evento. En caso de que se produzcan disturbios, actos de violencia, vandalismo o cualquier otra situacion que ponga en riesgo la integridad de los asistentes, el organizador se reserva el derecho de suspender el evento sin previo aviso.</p>
<p class="clause">Asimismo, cualquier dano causado a la propiedad, equipo o instalaciones debido a altercados sera responsabilidad de los involucrados, quienes deberan asumir los costos de reparacion o reposicion. La contratacion de personal de seguridad sera determinada por el organizador segun la naturaleza del evento y las condiciones del lugar.</p>

<!-- 15) PROHIBICION DE ALCOHOL A MENORES -->
<p class="clause"><strong>15) <span class="clause-title">Prohibicion de Suministro de Alcohol a Menores:</span></strong> El organizador del evento establece como norma estricta la prohibicion de suministro, de bebidas alcoholicas a menores de edad, conforme a la legislacion vigente. En caso de detectarse que cualquier adulto proporciona alcohol a menores dentro del evento, el organizador se reserva el derecho de suspender inmediatamente la celebracion, sin derecho a reembolso para los asistentes ni para la parte contratante.</p>

<!-- CLAUSULA DE SEGURIDAD (repetida del original) -->
<p style="margin-top:24px;font-weight:bold;">Clausula de Seguridad y Orden Publico</p>
<p class="clause">Las partes acuerdan que, durante la ejecucion del presente contrato, se mantendra el orden y la seguridad en el evento. En caso de que se produzcan disturbios, actos de violencia, vandalismo o cualquier otra situacion que ponga en riesgo la integridad de los asistentes, el organizador se reserva el derecho de suspender el evento sin previo aviso. Asimismo, cualquier dano causado a la propiedad, equipo o instalaciones debido a altercados sera responsabilidad de los involucrados, quienes deberan asumir los costos de reparacion o reposicion. La contratacion de personal de seguridad sera determinada por el organizador segun la naturaleza del evento y las condiciones del lugar.</p>

<!-- ==================== ANEXO I: CATERING Y BEBIDAS ==================== -->
<div class="page-break"></div>
${menuHTML}

${observaciones ? `<p style="text-align:center;font-weight:bold;margin-top:20px;">Observaciones:</p><p style="text-align:center;">${observaciones}</p>` : ""}

<!-- FIRMA -->
<div class="firma-section">
  <div class="firma-box">
    <div class="firma-line">FIRMA</div>
  </div>
  <div class="firma-box">
    <div class="firma-line">ACLARACION</div>
  </div>
  <div class="firma-box">
    <div class="firma-line">DNI</div>
  </div>
</div>

</body>
</html>`

  return html
}

// =====================================================================
// CONTRACT PREVIEW COMPONENT
// =====================================================================
function ContractPreview({
  evento,
  recetas,
  serviciosIncluidos,
  paquetePrecio,
  onClose,
}: {
  evento: EventoGuardado
  recetas: Receta[]
  serviciosIncluidos: string[]
  paquetePrecio: number
  onClose: () => void
}) {
  const handlePrint = () => {
    const html = generateContractHTML(evento, recetas, serviciosIncluidos, paquetePrecio)
    const printWindow = window.open("", "_blank", "width=900,height=700")
    if (!printWindow) return
    printWindow.document.write(html)
    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
    }, 300)
  }

  const contrato = evento.contrato || {}
  const totalPersonas = evento.adultos + evento.adolescentes + evento.ninos + (evento.personasDietasEspeciales || 0)
  const fechaEvento = evento.fecha ? new Date(evento.fecha + "T12:00:00").toLocaleDateString("es-AR") : "Sin fecha"
  const precioEvento = evento.precioVenta || paquetePrecio || 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-card-foreground">Vista Previa del Contrato</h2>
            <p className="text-sm text-muted-foreground">{evento.nombrePareja || evento.nombre}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="bg-transparent">
              Cerrar
            </Button>
            <Button onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Imprimir / PDF
            </Button>
          </div>
        </div>

        {/* Preview content */}
        <div className="flex-1 overflow-auto bg-muted/30 p-6">
          <div className="mx-auto max-w-3xl space-y-6 rounded-lg border border-border bg-card p-8 font-serif text-card-foreground shadow-sm">
            {/* Header */}
            <div className="text-center">
              <p className="text-3xl italic" style={{ fontFamily: "'Brush Script MT', cursive" }}>
                Los Jazmines
              </p>
              <p className="text-sm font-bold tracking-[0.3em] uppercase">EVENTOS</p>
            </div>

            <div className="text-center">
              <p className="font-bold">Convenio de realizacion de eventos</p>
              <p className="text-sm">{SALON_DIRECCIONES[evento.salon || ""] || "Del Viso - Bs. As."} &mdash; Fecha {new Date().toLocaleDateString("es-AR")}</p>
              <p className="mt-2 font-semibold">{evento.nombrePareja || evento.nombre}</p>
            </div>

            {/* Datos Personales */}
            <div>
              <p className="font-bold">1) <span className="underline">Datos personales:</span></p>
              <div className="ml-5 mt-2 space-y-1 text-sm">
                <p>Nombre completo: {contrato.nombreCompleto || "---"}</p>
                <p>DNI: {contrato.dni || "---"}</p>
                <p>Telefono: {contrato.telefono || "---"}</p>
                <p>Direccion: {contrato.direccion || "---"}</p>
                <p>Email: {contrato.email || "---"}</p>
                <p>IVA: {evento.condicionIVA || "Consumidor Final"}</p>
              </div>
            </div>

            {/* Datos del Evento */}
            <div>
              <p className="font-bold">2) <span className="underline">Datos del evento a contratar:</span></p>
              <div className="ml-5 mt-2 space-y-1 text-sm">
                <p>Fecha: {fechaEvento}</p>
                <p>Horario: {evento.horario || "---"} a {evento.horarioFin || "---"}</p>
                <p>Cantidad de cubiertos/invitados: {totalPersonas}</p>
                <p>Precio: {precioEvento > 0 ? formatCurrency(precioEvento) : "---"}</p>
              </div>
            </div>

            {/* Forma de Pago */}
            {evento.planDeCuotas && evento.planDeCuotas.numeroCuotas > 0 && (
              <div>
                <p className="font-bold">3) <span className="underline">Forma de pago:</span></p>
                <div className="ml-5 mt-2 text-sm">
                  <p>Total: {formatCurrency(evento.planDeCuotas.montoTotal)} en {evento.planDeCuotas.numeroCuotas} cuotas + IPC</p>
                </div>
              </div>
            )}

            {/* Servicios */}
            {serviciosIncluidos.length > 0 && (
              <div>
                <p className="font-bold">5) <span className="underline">Detalle del servicio:</span></p>
                <ul className="ml-10 mt-2 list-disc space-y-1 text-sm">
                  {serviciosIncluidos.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Clausulas */}
            <div className="border-t border-border pt-4">
              <p className="text-center text-xs text-muted-foreground">
                Clausulas 4 a 15: Incumplimiento, Servicios, SADAIC, Numero maximo de participantes, Cancelacion, Volumen de sonido, Areas descubiertas, Bebidas alcoholicas, Responsabilidades, Derecho de imagenes, Seguridad y Alcohol a menores.
              </p>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                (El documento completo se genera al imprimir)
              </p>
            </div>

            {/* Firma */}
            <div className="mt-8 flex justify-between pt-8">
              <div className="w-1/3 text-center">
                <div className="mt-12 border-t border-foreground pt-1 text-xs font-bold">FIRMA</div>
              </div>
              <div className="w-1/3 text-center">
                <div className="mt-12 border-t border-foreground pt-1 text-xs font-bold">ACLARACION</div>
              </div>
              <div className="w-1/3 text-center">
                <div className="mt-12 border-t border-foreground pt-1 text-xs font-bold">DNI</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// =====================================================================
// MAIN PAGE
// =====================================================================
export default function ContratosPage() {
  const { state, eventos, recetas, servicios: catalogoServicios, paquetesSalones } = useStore()
  const [selectedEventoId, setSelectedEventoId] = useState<string>("")
  const [showPreview, setShowPreview] = useState(false)

  // Filter events with useful data (at least name and date)
  const eventosDisponibles = useMemo(() => {
    return (eventos || [])
      .filter((e) => e.estado !== "cancelado" && (e.nombre || e.nombrePareja) && e.fecha)
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
  }, [eventos])

  const selectedEvento = useMemo(() => {
    return eventosDisponibles.find((e) => e.id === selectedEventoId)
  }, [eventosDisponibles, selectedEventoId])

  // Get services list from packages
  const serviciosIncluidos = useMemo(() => {
    if (!selectedEvento) return []
    const names: string[] = []
    const paquetes = selectedEvento.paquetesSeleccionados || []
    paquetes.forEach((pid) => {
      const paq = (paquetesSalones || []).find((p) => p.id === pid)
      if (!paq) return
      paq.serviciosIncluidos.forEach((si) => {
        const nombre = si.nombre || (catalogoServicios || []).find((s) => s.id === si.servicioId)?.nombre || "Servicio"
        if (!names.includes(nombre)) names.push(nombre)
      })
    })
    // Fallback to direct servicios
    if (names.length === 0 && selectedEvento.servicios) {
      selectedEvento.servicios.forEach((s) => {
        if (!names.includes(s.nombre)) names.push(s.nombre)
      })
    }
    return names
  }, [selectedEvento, paquetesSalones, catalogoServicios])

  // Get package price
  const paquetePrecio = useMemo(() => {
    if (!selectedEvento) return 0
    const paquetes = selectedEvento.paquetesSeleccionados || []
    return paquetes.reduce((total, pid) => {
      const paq = (paquetesSalones || []).find((p) => p.id === pid)
      if (!paq) return total
      const totales = calcularTotalesPaquete(paq, catalogoServicios || [])
      return total + totales.precioOficial
    }, 0)
  }, [selectedEvento, paquetesSalones, catalogoServicios])

  const handleGenerateContract = () => {
    if (!selectedEvento) return
    setShowPreview(true)
  }

  const handleDirectPrint = () => {
    if (!selectedEvento) return
    const html = generateContractHTML(selectedEvento, recetas, serviciosIncluidos, paquetePrecio)
    const printWindow = window.open("", "_blank", "width=900,height=700")
    if (!printWindow) return
    printWindow.document.write(html)
    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
    }, 300)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background px-6 py-4">
        <div className="mx-auto max-w-4xl flex items-center gap-4">
          <Link href="/eventos/calendario" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold">Contratos de Eventos</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-6 space-y-6">
        {/* Event Selector */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-card-foreground mb-1">Generar Contrato</h2>
              <p className="text-sm text-muted-foreground">
                Selecciona un evento para generar el convenio de realizacion con todos los datos del planificador de fiesta.
              </p>
            </div>

            {eventosDisponibles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-muted p-6 mb-4">
                  <Calendar className="h-10 w-10 text-muted-foreground" />
                </div>
                <p className="text-lg font-semibold text-card-foreground mb-1">No hay eventos guardados</p>
                <p className="text-sm text-muted-foreground max-w-md">
                  Primero crea un evento desde el planificador de fiesta con los datos del cliente y el plan de cuotas.
                </p>
                <Link href="/evento">
                  <Button className="mt-4">Crear Evento</Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-card-foreground">Evento</label>
                  <Select value={selectedEventoId} onValueChange={setSelectedEventoId}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Selecciona un evento..." />
                    </SelectTrigger>
                    <SelectContent>
                      {eventosDisponibles.map((ev) => (
                        <SelectItem key={ev.id} value={ev.id}>
                          <span className="flex items-center gap-2">
                            <span className="font-medium">{ev.nombrePareja || ev.nombre}</span>
                            <span className="text-muted-foreground text-xs">
                              {new Date(ev.fecha + "T12:00:00").toLocaleDateString("es-AR")}
                            </span>
                            <Badge variant="outline" className="text-xs ml-1">
                              {ev.salon || "Sin salon"}
                            </Badge>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Event Summary */}
                {selectedEvento && (
                  <div className="rounded-xl border border-border bg-muted/30 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-card-foreground">{selectedEvento.nombrePareja || selectedEvento.nombre}</h3>
                      <Badge variant={selectedEvento.estado === "confirmado" ? "default" : "secondary"}>
                        {selectedEvento.estado}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <div>
                        <p className="text-muted-foreground">Fecha</p>
                        <p className="font-medium">{new Date(selectedEvento.fecha + "T12:00:00").toLocaleDateString("es-AR")}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Salon</p>
                        <p className="font-medium">{selectedEvento.salon || "---"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Invitados</p>
                        <p className="font-medium flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {selectedEvento.adultos + selectedEvento.adolescentes + selectedEvento.ninos + (selectedEvento.personasDietasEspeciales || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Precio</p>
                        <p className="font-medium">
                          {selectedEvento.precioVenta
                            ? formatCurrency(selectedEvento.precioVenta)
                            : paquetePrecio > 0
                              ? formatCurrency(paquetePrecio)
                              : "Sin precio"}
                        </p>
                      </div>
                    </div>

                    {/* Contract data status */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                      <Badge variant={selectedEvento.contrato?.nombreCompleto ? "default" : "outline"} className="text-xs">
                        {selectedEvento.contrato?.nombreCompleto ? "Cliente cargado" : "Sin datos cliente"}
                      </Badge>
                      <Badge variant={selectedEvento.planDeCuotas?.numeroCuotas ? "default" : "outline"} className="text-xs">
                        {selectedEvento.planDeCuotas?.numeroCuotas ? `${selectedEvento.planDeCuotas.numeroCuotas} cuotas` : "Sin plan cuotas"}
                      </Badge>
                      <Badge variant={serviciosIncluidos.length > 0 ? "default" : "outline"} className="text-xs">
                        {serviciosIncluidos.length > 0 ? `${serviciosIncluidos.length} servicios` : "Sin servicios"}
                      </Badge>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handleGenerateContract}
                    disabled={!selectedEvento}
                    className="flex-1 h-12 gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Vista Previa del Contrato
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDirectPrint}
                    disabled={!selectedEvento}
                    className="h-12 gap-2 bg-transparent"
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir Directo
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Info about missing data */}
        {selectedEvento && (!selectedEvento.contrato?.nombreCompleto || !selectedEvento.planDeCuotas?.numeroCuotas) && (
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">
                <strong className="text-card-foreground">Datos faltantes:</strong> Para un contrato completo, edita el evento desde el{" "}
                <Link href={`/evento?id=${selectedEvento.id}`} className="text-primary underline hover:no-underline">
                  planificador de fiesta
                </Link>{" "}
                y completa la seccion &quot;Datos del Contrato&quot; con la informacion del cliente y el plan de cuotas.
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Contract Preview Modal */}
      {showPreview && selectedEvento && (
        <ContractPreview
          evento={selectedEvento}
          recetas={recetas}
          serviciosIncluidos={serviciosIncluidos}
          paquetePrecio={paquetePrecio}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}
