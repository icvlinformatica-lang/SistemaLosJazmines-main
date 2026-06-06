"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { useStore } from "@/lib/store-context"
import {
  formatCurrency,
  calcularTotalesPaquete,
  type EventoGuardado,
  type Receta,
  type VersionContrato,
  type ImpactoContrato,
} from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import {
  ArrowLeft,
  FileText,
  Printer,
  Calendar,
  Users,
  Eye,
  Save,
  Plus,
  X,
  CheckCircle2,
  User,
  ListChecks,
  History,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Package,
  Info,
  Pencil,
  ExternalLink,
} from "lucide-react"

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
// CHANGE DETECTION
// =====================================================================
function detectarImpactos(
  prevVersion: VersionContrato | null,
  contratoActual: {
    nombreCompleto: string; dni: string; telefono: string; direccion: string; email: string; condicionIVA: string
  },
  serviciosActuales: string[],
  serviciosLibresActuales: string[],
  planCuotasActual: EventoGuardado["planDeCuotas"],
): ImpactoContrato[] {
  if (!prevVersion) return []
  const impactos: ImpactoContrato[] = []

  // Datos del cliente
  const prev = prevVersion.snapshotContrato
  if (
    prev.nombreCompleto !== contratoActual.nombreCompleto ||
    prev.dni !== contratoActual.dni ||
    prev.telefono !== contratoActual.telefono ||
    prev.direccion !== contratoActual.direccion ||
    prev.email !== contratoActual.email ||
    prev.condicionIVA !== contratoActual.condicionIVA
  ) impactos.push("datos_cliente")

  // Servicios
  const prevServs = [...prevVersion.snapshotServicios].sort().join(",")
  const currServs = [...serviciosActuales].sort().join(",")
  const prevLibres = [...prevVersion.snapshotServiciosLibres].sort().join(",")
  const currLibres = [...serviciosLibresActuales].sort().join(",")
  if (prevServs !== currServs || prevLibres !== currLibres) impactos.push("servicios")

  // Financiero — plan de cuotas
  const prevPlan = prevVersion.snapshotPlanCuotas
  const currPlan = planCuotasActual
  if (prevPlan || currPlan) {
    const montoChanged = (prevPlan?.montoTotal ?? 0) !== (currPlan?.montoTotal ?? 0)
    const cuotasChanged = (prevPlan?.numeroCuotas ?? 0) !== (currPlan?.numeroCuotas ?? 0)
    const modalidadChanged = (prevPlan?.modalidadPago ?? "") !== (currPlan?.modalidadPago ?? "")
    const senaChanged = (prevPlan?.montoSena ?? 0) !== (currPlan?.montoSena ?? 0)
    if (montoChanged || cuotasChanged || modalidadChanged || senaChanged) impactos.push("financiero")
  }

  return impactos.length > 0 ? impactos : ["sin_cambios"]
}

// =====================================================================
// IMPACT BADGE
// =====================================================================
const IMPACTO_CONFIG: Record<ImpactoContrato, { label: string; className: string; icon: React.ReactNode }> = {
  financiero: { label: "Impacto financiero", className: "bg-red-100 text-red-700 border-red-200", icon: <DollarSign className="h-3 w-3" /> },
  servicios: { label: "Cambian servicios", className: "bg-amber-100 text-amber-700 border-amber-200", icon: <Package className="h-3 w-3" /> },
  datos_cliente: { label: "Datos del cliente", className: "bg-sky-100 text-sky-700 border-sky-200", icon: <User className="h-3 w-3" /> },
  sin_cambios: { label: "Sin cambios", className: "bg-muted text-muted-foreground", icon: <Info className="h-3 w-3" /> },
}

// =====================================================================
// CONTRACT PREVIEW MODAL
// =====================================================================
function ContractPreview({
  evento, recetas, serviciosIncluidos, paquetePrecio, onClose,
}: {
  evento: EventoGuardado; recetas: Receta[]; serviciosIncluidos: string[]; paquetePrecio: number; onClose: () => void
}) {
  const html = generateContractHTML(evento, recetas, serviciosIncluidos, paquetePrecio)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            <span className="font-semibold">Vista Previa del Contrato</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        <iframe
          srcDoc={html}
          className="flex-1 w-full rounded-b-xl"
          title="Vista previa del contrato"
        />
      </div>
    </div>
  )
}

// =====================================================================
// VERSION HISTORY PANEL
// =====================================================================
function VersionHistoryPanel({
  versiones,
  evento,
  recetas,
  catalogoServicios,
}: {
  versiones: VersionContrato[]
  evento: EventoGuardado
  recetas: Receta[]
  catalogoServicios: { id: string; nombre: string }[]
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const sorted = [...versiones].sort((a, b) => b.version - a.version)

  if (sorted.length === 0) return null

  const handlePreview = (v: VersionContrato) => {
    const serviciosNombres = v.snapshotServicios
      .map((id) => catalogoServicios.find((s) => s.id === id)?.nombre || id)
      .concat(v.snapshotServiciosLibres)
    // Build a modified evento snapshot for this version
    const eventoSnapshot: EventoGuardado = {
      ...evento,
      contrato: {
        nombreCompleto: v.snapshotContrato.nombreCompleto,
        dni: v.snapshotContrato.dni,
        telefono: v.snapshotContrato.telefono,
        direccion: v.snapshotContrato.direccion,
        email: v.snapshotContrato.email,
      },
      planDeCuotas: v.snapshotPlanCuotas || evento.planDeCuotas,
    }
    const html = generateContractHTML(eventoSnapshot, recetas, serviciosNombres, 0)
    const win = window.open("", "_blank")
    if (win) { win.document.write(html); win.document.close() }
  }

  const handlePrint = (v: VersionContrato) => {
    const serviciosNombres = v.snapshotServicios
      .map((id) => catalogoServicios.find((s) => s.id === id)?.nombre || id)
      .concat(v.snapshotServiciosLibres)
    const eventoSnapshot: EventoGuardado = {
      ...evento,
      contrato: {
        nombreCompleto: v.snapshotContrato.nombreCompleto,
        dni: v.snapshotContrato.dni,
        telefono: v.snapshotContrato.telefono,
        direccion: v.snapshotContrato.direccion,
        email: v.snapshotContrato.email,
      },
      planDeCuotas: v.snapshotPlanCuotas || evento.planDeCuotas,
    }
    const html = generateContractHTML(eventoSnapshot, recetas, serviciosNombres, 0)
    const win = window.open("", "_blank")
    if (win) {
      win.document.write(html)
      win.document.close()
      win.focus()
      setTimeout(() => { win.print() }, 600)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-primary" />
          Historial de versiones
          <Badge variant="secondary" className="ml-auto">{sorted.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.map((v, idx) => {
          const isExpanded = expandedIdx === idx
          const isFirst = idx === 0
          return (
            <div
              key={v.version}
              className={`rounded-lg border transition-colors ${isFirst ? "border-primary/30 bg-primary/5" : "border-border"}`}
            >
              {/* Row header */}
              <div className="flex w-full items-center gap-3 px-4 py-3">
                {/* Version badge */}
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isFirst ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  v{v.version}
                </div>

                {/* Date + impactos — clickable to expand */}
                <button
                  className="flex-1 min-w-0 text-left"
                  onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {new Date(v.fechaGuardado).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                      {" "}
                      <span className="text-muted-foreground font-normal text-xs">
                        {new Date(v.fechaGuardado).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </span>
                    {isFirst && <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">Actual</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {v.impactos.map((imp) => (
                      <span
                        key={imp}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${IMPACTO_CONFIG[imp].className}`}
                      >
                        {IMPACTO_CONFIG[imp].icon}
                        {IMPACTO_CONFIG[imp].label}
                      </span>
                    ))}
                    {v.motivo && (
                      <span className="text-[11px] text-muted-foreground italic truncate max-w-[280px]">"{v.motivo}"</span>
                    )}
                  </div>
                </button>

                {/* Action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Vista previa"
                    onClick={() => handlePreview(v)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Imprimir"
                    onClick={() => handlePrint(v)}
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                  <Link href={`/evento?id=${evento.id}`}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Editar en el planificador"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>
                  <button
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                    title="Ver detalle"
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Expandable detail */}
              {isExpanded && (
                <div className="border-t border-border px-4 pb-4 pt-3 space-y-3 text-sm">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Cliente</p>
                    <p>{v.snapshotContrato.nombreCompleto || "—"} {v.snapshotContrato.dni ? `· DNI ${v.snapshotContrato.dni}` : ""}</p>
                    {v.snapshotContrato.telefono && <p className="text-muted-foreground">{v.snapshotContrato.telefono}</p>}
                  </div>
                  {(v.snapshotServicios.length > 0 || v.snapshotServiciosLibres.length > 0) && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Servicios</p>
                      <ul className="space-y-0.5">
                        {v.snapshotServicios.map((id, i) => {
                          const nombre = catalogoServicios.find((s) => s.id === id)?.nombre || id
                          return <li key={i} className="text-muted-foreground">{nombre}</li>
                        })}
                        {v.snapshotServiciosLibres.map((s, i) => (
                          <li key={i} className="text-muted-foreground">{s} <span className="text-[10px]">(manual)</span></li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {v.snapshotPlanCuotas && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Financiacion</p>
                      <p>{formatCurrency(v.snapshotPlanCuotas.montoTotal)} · {v.snapshotPlanCuotas.numeroCuotas} cuotas</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// =====================================================================
// MAIN PAGE
// =====================================================================
export default function ContratosPage() {
  const { state, updateEvento } = useStore()
  const { eventos, paquetesSalones, recetas } = state
  const catalogoServicios = state.servicios || []

  const [selectedEventoId, setSelectedEventoId] = useState<string>("")
  const [showPreview, setShowPreview] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [motivoCambio, setMotivoCambio] = useState("")

  // Local editable state
  const [contratoLocal, setContratoLocal] = useState({
    nombreCompleto: "", dni: "", telefono: "", direccion: "", email: "", condicionIVA: "Consumidor Final",
  })
  const [checkedIds, setCheckedIds] = useState<string[]>([])
  const [serviciosLibres, setServiciosLibres] = useState<string[]>([])
  const [nuevoServicio, setNuevoServicio] = useState("")

  // Available events
  const eventosDisponibles = useMemo(() =>
    (eventos || [])
      .filter((e) => e.estado !== "cancelado" && (e.nombre || e.nombrePareja) && e.fecha)
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
    [eventos]
  )

  const selectedEvento = useMemo(
    () => eventosDisponibles.find((e) => e.id === selectedEventoId),
    [eventosDisponibles, selectedEventoId]
  )

  // Auto-sync when event changes — pre-populate from planificador data
  useEffect(() => {
    if (!selectedEvento) {
      setContratoLocal({ nombreCompleto: "", dni: "", telefono: "", direccion: "", email: "", condicionIVA: "Consumidor Final" })
      setCheckedIds([])
      setServiciosLibres([])
      return
    }
    const c = selectedEvento.contrato || {}
    setContratoLocal({
      nombreCompleto: c.nombreCompleto || selectedEvento.nombrePareja || selectedEvento.nombre || "",
      dni: c.dni || selectedEvento.dniNovio1 || "",
      telefono: c.telefono || "",
      direccion: c.direccion || "",
      email: c.email || "",
      condicionIVA: selectedEvento.condicionIVA || "Consumidor Final",
    })
    // Restore services: if the contract was explicitly saved before, honour that.
    // Use length > 0 check so an empty array doesn't mask services added in the planificador.
    const savedIds = selectedEvento.serviciosContrato
    const savedLibres = selectedEvento.serviciosLibresContrato

    if (savedIds && savedIds.length > 0) {
      setCheckedIds(savedIds)
      setServiciosLibres(savedLibres || [])
    } else {
      // Auto-populate from the planificador: use every servicioId attached to this event.
      const fromPlanificador = (selectedEvento.servicios || [])
        .map((se) => se.servicioId)
        .filter((id): id is string => Boolean(id))
      setCheckedIds(fromPlanificador)
      setServiciosLibres(savedLibres || [])
    }
  // Re-run when the event changes OR when its services list changes (planificador edits).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventoId, selectedEvento?.servicios?.length, selectedEvento?.serviciosContrato?.join(",")])

  // Package price
  const paquetePrecio = useMemo(() => {
    if (!selectedEvento) return 0
    return (selectedEvento.paquetesSeleccionados || []).reduce((total, pid) => {
      const paq = (paquetesSalones || []).find((p) => p.id === pid)
      if (!paq) return total
      return total + calcularTotalesPaquete(paq, catalogoServicios || []).precioOficial
    }, 0)
  }, [selectedEvento, paquetesSalones, catalogoServicios])

  // Services list for the contract
  const serviciosIncluidos = useMemo(() => {
    const fromCatalog = (catalogoServicios || [])
      .filter((s) => checkedIds.includes(s.id) && s.activo !== false)
      .map((s) => s.nombre)
    return [...fromCatalog, ...serviciosLibres]
  }, [checkedIds, serviciosLibres, catalogoServicios])

  // Change detection vs last version
  const ultimaVersion = useMemo(() =>
    selectedEvento?.versionesContrato?.length
      ? [...selectedEvento.versionesContrato].sort((a, b) => b.version - a.version)[0]
      : null,
    [selectedEvento]
  )

  const impactosDetectados = useMemo(() =>
    detectarImpactos(ultimaVersion, contratoLocal, checkedIds, serviciosLibres, selectedEvento?.planDeCuotas),
    [ultimaVersion, contratoLocal, checkedIds, serviciosLibres, selectedEvento]
  )

  const hayImpactoFinanciero = impactosDetectados.includes("financiero")
  const hayCambios = !impactosDetectados.includes("sin_cambios") || ultimaVersion === null

  const handleSave = async () => {
    if (!selectedEvento) return

    const versionNueva: VersionContrato = {
      version: (selectedEvento.versionesContrato?.length ?? 0) + 1,
      fechaGuardado: new Date().toISOString(),
      motivo: motivoCambio.trim() || undefined,
      snapshotContrato: { ...contratoLocal },
      snapshotServicios: checkedIds,
      snapshotServiciosLibres: serviciosLibres,
      snapshotPlanCuotas: selectedEvento.planDeCuotas,
      impactos: hayCambios ? impactosDetectados : ["sin_cambios"],
    }

    await updateEvento(selectedEvento.id, {
      contrato: {
        nombreCompleto: contratoLocal.nombreCompleto,
        dni: contratoLocal.dni,
        telefono: contratoLocal.telefono,
        direccion: contratoLocal.direccion,
        email: contratoLocal.email,
      },
      condicionIVA: contratoLocal.condicionIVA as EventoGuardado["condicionIVA"],
      serviciosContrato: checkedIds,
      serviciosLibresContrato: serviciosLibres,
      versionesContrato: [...(selectedEvento.versionesContrato || []), versionNueva],
    })

    setMotivoCambio("")
    setShowMotivo(false)
    setSavedOk(true)
    setTimeout(() => setSavedOk(false), 2500)
  }

  const toggleChecked = (id: string) =>
    setCheckedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  const handleAddServicioLibre = () => {
    const trimmed = nuevoServicio.trim()
    if (!trimmed) return
    setServiciosLibres((prev) => [...prev, trimmed])
    setNuevoServicio("")
  }

  const handleRemoveServicioLibre = (idx: number) =>
    setServiciosLibres((prev) => prev.filter((_, i) => i !== idx))

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center gap-4">
          <Link href="/eventos/lista" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold">Contratos de Eventos</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6 space-y-6">

        {/* Event Selector */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-card-foreground mb-1">Generar Contrato</h2>
              <p className="text-sm text-muted-foreground">
                Selecciona un evento para cargar automaticamente sus datos desde el planificador. Podes editar antes de generar.
              </p>
            </div>

            {eventosDisponibles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-muted p-6 mb-4">
                  <Calendar className="h-10 w-10 text-muted-foreground" />
                </div>
                <p className="text-lg font-semibold text-card-foreground mb-1">No hay eventos guardados</p>
                <p className="text-sm text-muted-foreground max-w-md">
                  Primero crea un evento desde el planificador de fiesta.
                </p>
                <Link href="/evento"><Button className="mt-4">Crear Evento</Button></Link>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Evento</Label>
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
                          <Badge variant="outline" className="text-xs ml-1">{ev.salon || "Sin salon"}</Badge>
                          {ev.versionesContrato?.length ? (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <History className="h-3 w-3" />
                              v{Math.max(...ev.versionesContrato.map((v) => v.version))}
                            </Badge>
                          ) : null}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Event quick summary */}
            {selectedEvento && (
              <div className="rounded-xl border border-border bg-muted/30 p-4">
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
                        : paquetePrecio > 0 ? formatCurrency(paquetePrecio) : "Sin precio"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* VERSION HISTORY + observacion + save — shown first */}
        {selectedEvento && (
          <>
            {selectedEvento.versionesContrato && selectedEvento.versionesContrato.length > 0 && (
              <VersionHistoryPanel
                versiones={selectedEvento.versionesContrato}
                evento={selectedEvento}
                recetas={recetas}
                catalogoServicios={catalogoServicios}
              />
            )}

            {/* Observacion + Guardar version — always visible right after history */}
            <Card>
              <CardContent className="p-5 space-y-3">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Observacion
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    (opcional — razon por la cual se actualiza el contrato)
                  </span>
                </Label>
                <Textarea
                  value={motivoCambio}
                  onChange={(e) => setMotivoCambio(e.target.value)}
                  placeholder="Ej: Cliente solicito agregar servicio de DJ, se modifico el precio acordado..."
                  rows={2}
                  className="resize-none"
                />
                <Button onClick={handleSave} className="gap-2 w-full sm:w-auto">
                  {savedOk ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Guardado — version {selectedEvento.versionesContrato?.length ?? 1}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      {ultimaVersion ? `Guardar version ${ultimaVersion.version + 1}` : "Guardar version 1"}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {/* EDITABLE PANELS */}
        {selectedEvento && (
          <>
            {/* Change impact warning */}
            {ultimaVersion && hayCambios && !impactosDetectados.includes("sin_cambios") && (
              <div className={`rounded-xl border px-5 py-4 flex gap-3 ${hayImpactoFinanciero ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
                <AlertTriangle className={`h-5 w-5 shrink-0 mt-0.5 ${hayImpactoFinanciero ? "text-red-500" : "text-amber-500"}`} />
                <div className="space-y-1.5">
                  <p className={`text-sm font-semibold ${hayImpactoFinanciero ? "text-red-800" : "text-amber-800"}`}>
                    {hayImpactoFinanciero
                      ? "Cambio con impacto financiero — afecta el plan de cuotas y Caja Eventos"
                      : "Hay cambios respecto a la ultima version guardada"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {impactosDetectados.map((imp) => (
                      <span
                        key={imp}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${IMPACTO_CONFIG[imp].className}`}
                      >
                        {IMPACTO_CONFIG[imp].icon}
                        {IMPACTO_CONFIG[imp].label}
                      </span>
                    ))}
                  </div>
                  <p className={`text-xs ${hayImpactoFinanciero ? "text-red-600" : "text-amber-600"}`}>
                    Al guardar se creara la version {(ultimaVersion?.version ?? 0) + 1} del contrato y quedara registrado en el historial.
                  </p>
                </div>
              </div>
            )}

            {/* First version info */}
            {!ultimaVersion && (
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-5 py-3 flex gap-3">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-sky-500" />
                <p className="text-sm text-sky-700">
                  Este evento no tiene contrato guardado todavia. Los datos se precargaron automaticamente desde el planificador. Revisalos y guarda para crear la version 1.
                </p>
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-2">

              {/* PANEL 1: Datos del Contrato */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <User className="h-4 w-4 text-primary" />
                    Datos del Contrato
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="nombreCompleto">Nombre completo</Label>
                      <Input
                        id="nombreCompleto"
                        value={contratoLocal.nombreCompleto}
                        onChange={(e) => setContratoLocal((p) => ({ ...p, nombreCompleto: e.target.value }))}
                        placeholder="Nombre y apellido del cliente"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="dni">DNI</Label>
                        <Input
                          id="dni"
                          value={contratoLocal.dni}
                          onChange={(e) => setContratoLocal((p) => ({ ...p, dni: e.target.value }))}
                          placeholder="12.345.678"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="telefono">Telefono</Label>
                        <Input
                          id="telefono"
                          value={contratoLocal.telefono}
                          onChange={(e) => setContratoLocal((p) => ({ ...p, telefono: e.target.value }))}
                          placeholder="11 1234-5678"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="direccion">Direccion</Label>
                      <Input
                        id="direccion"
                        value={contratoLocal.direccion}
                        onChange={(e) => setContratoLocal((p) => ({ ...p, direccion: e.target.value }))}
                        placeholder="Calle, numero, localidad"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={contratoLocal.email}
                        onChange={(e) => setContratoLocal((p) => ({ ...p, email: e.target.value }))}
                        placeholder="cliente@email.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Condicion IVA</Label>
                      <Select
                        value={contratoLocal.condicionIVA}
                        onValueChange={(v) => setContratoLocal((p) => ({ ...p, condicionIVA: v }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Consumidor Final">Consumidor Final</SelectItem>
                          <SelectItem value="Responsable Inscripto">Responsable Inscripto</SelectItem>
                          <SelectItem value="Monotributista">Monotributista</SelectItem>
                          <SelectItem value="Exento">Exento</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* PANEL 2: Servicios */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ListChecks className="h-4 w-4 text-primary" />
                    Servicios del Contrato
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Servicios del evento (agregados desde el planificador) */}
                  {(() => {
                    const serviciosEvento = selectedEvento?.servicios || []
                    const serviciosEnEvento = serviciosEvento.map((se) => {
                      const cat = catalogoServicios.find((s) => s.id === se.servicioId)
                      return { id: se.servicioId, nombre: se.nombre || cat?.nombre || se.servicioId, precio: cat?.precioVenta, cantidad: se.cantidad, unidad: se.unidad }
                    })

                    // Servicios del catalogo no incluidos en el evento
                    const idsEnEvento = serviciosEvento.map((se) => se.servicioId)
                    const catalogoExtras = catalogoServicios.filter((s) => s.activo !== false && !idsEnEvento.includes(s.id))

                    return (
                      <>
                        {/* Sección principal: los del evento */}
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Contratados en este evento
                          </p>
                          {serviciosEnEvento.length > 0 ? (
                            <div className="rounded-md border border-border divide-y divide-border">
                              {serviciosEnEvento.map((s) => (
                                <label
                                  key={s.id}
                                  className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors"
                                >
                                  <Checkbox
                                    checked={checkedIds.includes(s.id)}
                                    onCheckedChange={() => toggleChecked(s.id)}
                                  />
                                  <span className="flex-1 text-sm font-medium text-card-foreground">{s.nombre}</span>
                                  {s.unidad === "Por Hora" && s.cantidad && s.cantidad > 1 && (
                                    <span className="text-xs text-muted-foreground">{s.cantidad}h</span>
                                  )}
                                  {s.precio != null && (
                                    <span className="text-xs text-muted-foreground tabular-nums">
                                      {formatCurrency(s.unidad === "Por Hora" && s.cantidad ? s.precio * s.cantidad : s.precio)}
                                    </span>
                                  )}
                                </label>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-md border border-dashed border-border px-3 py-4 text-center">
                              <p className="text-sm text-muted-foreground">
                                No hay servicios agregados en el planificador de este evento.
                              </p>
                              <Link
                                href={selectedEvento?.id ? `/evento?id=${selectedEvento.id}` : "/evento"}
                                className="text-xs text-primary underline hover:no-underline"
                              >
                                Ir al planificador del evento
                              </Link>
                            </div>
                          )}
                        </div>

                        {/* Sección secundaria: otros del catálogo no incluidos en el evento */}
                        {catalogoExtras.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              Agregar del catalogo
                            </p>
                            <div className="max-h-40 overflow-y-auto rounded-md border border-border divide-y divide-border">
                              {catalogoExtras.map((s) => (
                                <label
                                  key={s.id}
                                  className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/40 transition-colors"
                                >
                                  <Checkbox
                                    checked={checkedIds.includes(s.id)}
                                    onCheckedChange={() => toggleChecked(s.id)}
                                  />
                                  <span className="flex-1 text-sm text-card-foreground">{s.nombre}</span>
                                  {s.precioVenta != null && (
                                    <span className="text-xs text-muted-foreground tabular-nums">{formatCurrency(s.precioVenta)}</span>
                                  )}
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()}

                  {/* Texto libre */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Agregar servicio manual</p>
                    <div className="flex gap-2">
                      <Input
                        value={nuevoServicio}
                        onChange={(e) => setNuevoServicio(e.target.value)}
                        placeholder="Ej: Barra de tragos premium"
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddServicioLibre() } }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleAddServicioLibre}
                        disabled={!nuevoServicio.trim()}
                        className="bg-transparent"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {serviciosLibres.length > 0 && (
                      <div className="space-y-1">
                        {serviciosLibres.map((s, i) => (
                          <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-1.5">
                            <span className="flex-1 text-sm">{s}</span>
                            <button onClick={() => handleRemoveServicioLibre(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {serviciosIncluidos.length > 0 && (
                    <p className="text-xs text-muted-foreground border-t border-border pt-2">
                      {serviciosIncluidos.length} servicio{serviciosIncluidos.length !== 1 ? "s" : ""} se incluiran en el contrato
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Plan de cuotas info */}
            {selectedEvento.planDeCuotas && selectedEvento.planDeCuotas.montoTotal > 0 && (
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold">Plan de financiacion</p>
                    <Badge variant="outline" className="ml-auto text-xs capitalize">
                      {selectedEvento.planDeCuotas.modalidadPago || "cuotas"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-muted-foreground">Total</p>
                      <p className="font-semibold">{formatCurrency(selectedEvento.planDeCuotas.montoTotal)}</p>
                    </div>
                    {selectedEvento.planDeCuotas.montoSena && selectedEvento.planDeCuotas.montoSena > 0 && (
                      <div>
                        <p className="text-muted-foreground">Sena</p>
                        <p className="font-semibold">{formatCurrency(selectedEvento.planDeCuotas.montoSena)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground">Cuotas</p>
                      <p className="font-semibold">{selectedEvento.planDeCuotas.numeroCuotas}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Por cuota</p>
                      <p className="font-semibold">{formatCurrency(selectedEvento.planDeCuotas.montoCuota)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Para modificar la financiacion, editá el plan de cuotas desde el{" "}
                    <Link href={`/evento?id=${selectedEvento.id}`} className="text-primary underline hover:no-underline">planificador</Link>.
                    Cualquier cambio de monto o modalidad se detectara automaticamente al volver a esta pantalla.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Print / preview actions */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                variant="outline"
                onClick={() => setShowPreview(true)}
                className="flex-1 h-12 gap-2 bg-transparent"
              >
                <Eye className="h-4 w-4" />
                Vista Previa
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (!selectedEvento) return
                  const html = generateContractHTML(selectedEvento, recetas, serviciosIncluidos, paquetePrecio)
                  const printWindow = window.open("", "_blank", "width=900,height=700")
                  if (!printWindow) return
                  printWindow.document.write(html)
                  printWindow.document.close()
                  setTimeout(() => { printWindow.print() }, 300)
                }}
                className="h-12 gap-2 bg-transparent sm:w-44"
              >
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
            </div>

          </>
        )}
      </main>

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
