"use client"

import { useStore } from "@/lib/store-context"
import {
  formatCurrency,
  calcularComprasSegmentadas,
  calcularComprasBarras,
  type Receta,
  type Evento,
  type Insumo,
  type InsumoBarra,
  type Coctel,
  type CalculoCompraBarra,
} from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"

function smartUnitsForShopping(amount: number, unit: string): string {
  const normalizedUnit = unit.toUpperCase()

  if ((normalizedUnit === "GRS" || normalizedUnit === "GR") && amount >= 1000) {
    return `${(amount / 1000).toFixed(2)} KG`
  }
  if (normalizedUnit === "GRS" || normalizedUnit === "GR") {
    return `${(amount / 1000).toFixed(3)} KG`
  }

  if ((normalizedUnit === "CC" || normalizedUnit === "ML") && amount >= 1000) {
    return `${(amount / 1000).toFixed(2)} L`
  }
  if (normalizedUnit === "CC" || normalizedUnit === "ML") {
    return `${(amount / 1000).toFixed(3)} L`
  }

  if (normalizedUnit === "KG" || normalizedUnit === "L") {
    return `${amount.toFixed(2)} ${normalizedUnit}`
  }

  return `${amount.toFixed(1)} ${unit}`
}

function smartUnitsForKitchen(amount: number, unit: string): string {
  const normalizedUnit = unit.toUpperCase()

  if (normalizedUnit === "GRS" || normalizedUnit === "GR") {
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(2)} KG`
    }
    return `${Math.round(amount)} GRS`
  }

  if (normalizedUnit === "CC" || normalizedUnit === "ML") {
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(2)} L`
    }
    return `${Math.round(amount)} CC`
  }

  if (normalizedUnit === "KG") {
    if (amount < 1) {
      return `${Math.round(amount * 1000)} GRS`
    }
    return `${amount.toFixed(2)} KG`
  }

  if (normalizedUnit === "L") {
    if (amount < 1) {
      return `${Math.round(amount * 1000)} CC`
    }
    return `${amount.toFixed(2)} L`
  }

  return `${amount.toFixed(1)} ${unit}`
}

// Snapshot data structure for history reprinting
interface SnapshotData {
  evento: Evento
  compras: Array<{
    insumoId: string
    insumo: Insumo
    cantidadNecesaria: number
    cantidadAComprar: number
    costoEstimado: number
    costoMateriaPrima: number
  }>
  comprasBarras?: CalculoCompraBarra[]
  recetas: {
    adultos: Receta[]
    adolescentes: Receta[]
    ninos: Receta[]
    dietasEspeciales: Receta[]
  }
  insumos: Insumo[]
  insumosBarra?: InsumoBarra[]
  cocteles?: Coctel[]
}

export interface DocumentSections {
  listaCompras: boolean
  barraCocteles: boolean
  guiaProduccion: boolean
}

interface UnifiedDocumentProps {
  snapshot?: SnapshotData
  onClose?: () => void
  sections?: DocumentSections
}

export function UnifiedDocument({ snapshot, onClose, sections }: UnifiedDocumentProps) {
  const showListaCompras = sections?.listaCompras ?? true
  const showBarraCocteles = sections?.barraCocteles ?? true
  const showGuiaProduccion = sections?.guiaProduccion ?? true
  const { state } = useStore()
  
  // Use snapshot data if provided, otherwise use live state
  const isHistoryMode = !!snapshot
  
  const evento = snapshot?.evento || state.eventoActual
  const insumos = snapshot?.insumos || state.insumos
  const recetas = snapshot ? [...snapshot.recetas.adultos, ...snapshot.recetas.adolescentes, ...snapshot.recetas.ninos, ...snapshot.recetas.dietasEspeciales] : state.recetas

  if (!evento) return null

  const recetasAdultos = evento.recetasAdultos || []
  const recetasAdolescentes = evento.recetasAdolescentes || []
  const recetasNinos = evento.recetasNinos || []
  const recetasDietasEspeciales = evento.recetasDietasEspeciales || []
  const multipliersAdultos = evento.multipliersAdultos || {}
  const multipliersAdolescentes = evento.multipliersAdolescentes || {}
  const multipliersNinos = evento.multipliersNinos || {}
  const multipliersDietasEspeciales = evento.multipliersDietasEspeciales || {}

  // For history mode, use snapshot recetas; for live mode, filter from state
  const recetasAdultosSeleccionadas = isHistoryMode 
    ? (snapshot?.recetas.adultos || [])
    : recetas.filter((r) => recetasAdultos.includes(r.id))
  const recetasAdolescentesSeleccionadas = isHistoryMode 
    ? (snapshot?.recetas.adolescentes || [])
    : recetas.filter((r) => recetasAdolescentes.includes(r.id))
  const recetasNinosSeleccionadas = isHistoryMode 
    ? (snapshot?.recetas.ninos || [])
    : recetas.filter((r) => recetasNinos.includes(r.id))
  const recetasDietasEspecialesSeleccionadas = isHistoryMode 
    ? (snapshot?.recetas.dietasEspeciales || [])
    : recetas.filter((r) => recetasDietasEspeciales.includes(r.id))

  // For history mode, use saved compras; for live mode, calculate
  const compras = isHistoryMode 
    ? (snapshot?.compras || [])
    : calcularComprasSegmentadas(evento, state.recetas, state.insumos)

  const comprasBarras: CalculoCompraBarra[] = isHistoryMode
    ? (snapshot?.comprasBarras || [])
    : calcularComprasBarras(evento, state.cocteles, state.insumosBarra)

  const costoTotalMateriaPrima = compras.reduce((sum, c) => sum + (c.costoMateriaPrima || 0), 0) + comprasBarras.reduce((sum, c) => sum + (c.costoMateriaPrima || 0), 0)
  const presupuestoCompra = compras.reduce((sum, c) => sum + (c.costoEstimado || 0), 0) + comprasBarras.reduce((sum, c) => sum + (c.costoEstimado || 0), 0)
  const totalPersonas = evento.adultos + evento.adolescentes + evento.ninos + (evento.personasDietasEspeciales || 0)

  interface DishWithContext {
    receta: Receta
    multiplier: number
    pax: number
    segment: string
  }

  const allDishes: DishWithContext[] = [
    ...recetasAdultosSeleccionadas.map((r) => ({
      receta: r,
      multiplier: multipliersAdultos[r.id] || 1,
      pax: evento.adultos,
      segment: "Adultos",
    })),
    ...recetasAdolescentesSeleccionadas.map((r) => ({
      receta: r,
      multiplier: multipliersAdolescentes[r.id] || 1,
      pax: evento.adolescentes,
      segment: "Adolescentes",
    })),
    ...recetasNinosSeleccionadas.map((r) => ({
      receta: r,
      multiplier: multipliersNinos[r.id] || 1,
      pax: evento.ninos,
      segment: "Ninos",
    })),
    ...recetasDietasEspecialesSeleccionadas.map((r) => ({
      receta: r,
      multiplier: multipliersDietasEspeciales[r.id] || 1,
      pax: evento.personasDietasEspeciales || 0,
      segment: "Dietas Especiales",
    })),
  ]

  // Build print HTML programmatically with inline styles (no CSS classes)
  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=900,height=700")
    if (!printWindow) return

    const S = {
      page: "margin:0;padding:0;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff;font-size:11pt;line-height:1.4;",
      sectionTitle: "margin-bottom:16px;font-size:14pt;font-weight:bold;text-align:center;border:2px solid #000;padding:8px 0;",
      header: "margin-bottom:20px;border-bottom:2px solid #000;padding-bottom:12px;display:flex;justify-content:space-between;align-items:flex-start;",
      headerLeft: "font-size:16pt;font-weight:bold;",
      headerPairing: "font-size:12pt;font-weight:600;margin-top:4px;",
      headerRight: "text-align:right;font-size:9pt;",
      headerTotal: "margin-top:8px;font-size:12pt;font-weight:bold;",
      costBox: "margin-bottom:12px;display:flex;justify-content:space-between;font-size:9pt;border:1px solid #000;padding:10px;",
      table: "width:100%;border-collapse:collapse;font-size:9pt;page-break-inside:avoid;",
      thBlack: "background:#000;color:#fff;border:1px solid #000;padding:6px 8px;font-weight:bold;-webkit-print-color-adjust:exact;print-color-adjust:exact;",
      thGray: "background:#e5e7eb;border:1px solid #000;padding:6px 8px;font-weight:bold;-webkit-print-color-adjust:exact;print-color-adjust:exact;",
      tdEven: "border:1px solid #000;padding:6px 8px;background:#fff;",
      tdOdd: "border:1px solid #000;padding:6px 8px;background:#f9fafb;-webkit-print-color-adjust:exact;print-color-adjust:exact;",
      tfootTd: "background:#000;color:#fff;border:1px solid #000;padding:6px 8px;font-weight:bold;-webkit-print-color-adjust:exact;print-color-adjust:exact;",
      dishBlock: "border:1px solid #000;page-break-inside:avoid;margin-bottom:16px;",
      dishHeader: "background:#000;color:#fff;padding:8px;-webkit-print-color-adjust:exact;print-color-adjust:exact;",
      dishName: "font-weight:bold;font-size:10pt;",
      dishSeg: "font-size:8pt;",
      noIngredients: "padding:12px;text-align:center;color:#6b7280;font-size:9pt;font-style:italic;",
      footer: "margin-top:24px;padding-top:12px;border-top:1px solid #000;text-align:center;font-size:8pt;color:#4b5563;",
      barInfoBox: "margin-bottom:12px;font-size:9pt;border:1px solid #000;padding:10px;",
    }

    let html = ""

    // ========== HEADER ==========
    html += `<div style="${S.header}">`
    html += `<div><div style="${S.headerLeft}">LOS JAZMINES EVENTOS</div>`
    if (evento.nombrePareja) html += `<div style="${S.headerPairing}">${evento.nombrePareja}</div>`
    html += `</div>`
    html += `<div style="${S.headerRight}">`
    html += `<div><strong>Fecha:</strong> ${new Date(evento.fecha).toLocaleDateString("es-AR")}</div>`
    if (evento.horario) html += `<div><strong>Horario:</strong> ${evento.horario}</div>`
    if (evento.salon) html += `<div><strong>Salon:</strong> ${evento.salon}</div>`
    html += `<div style="${S.headerTotal}">Total: ${totalPersonas} personas</div>`
    html += `</div></div>`

    // ========== LISTA DE COMPRAS COCINA ==========
    if (showListaCompras) {
      html += `<h2 style="${S.sectionTitle}">LISTA DE COMPRAS CONSOLIDADA</h2>`
      html += `<div style="${S.costBox}">`
      html += `<div><span style="font-weight:600">Costo Total Insumos:</span> <strong>${formatCurrency(costoTotalMateriaPrima)}</strong> <span style="font-size:8pt;margin-left:4px">(valor real)</span></div>`
      html += `<div><span style="font-weight:600">Precio Stock:</span> <strong>${formatCurrency(presupuestoCompra)}</strong> <span style="font-size:8pt;margin-left:4px">(lo que falta)</span></div>`
      html += `</div>`

      html += `<table style="${S.table}"><thead><tr>`
      html += `<th style="${S.thBlack}text-align:left;">INSUMO</th>`
      html += `<th style="${S.thBlack}text-align:left;width:80px;">PROVEEDOR</th>`
      html += `<th style="${S.thBlack}text-align:right;width:70px;">NECESARIO</th>`
      html += `<th style="${S.thBlack}text-align:right;width:70px;">EN STOCK</th>`
      html += `<th style="${S.thBlack}text-align:right;width:70px;">FALTANTE</th>`
      html += `<th style="${S.thBlack}text-align:right;width:80px;">COSTO TOTAL</th>`
      html += `<th style="${S.thBlack}text-align:right;width:80px;">PRECIO STOCK</th>`
      html += `</tr></thead><tbody>`
      compras.forEach((item, i) => {
        const d = item.insumo
        if (!d) return
        const buy = item.cantidadAComprar > 0
        const td = i % 2 === 0 ? S.tdEven : S.tdOdd
        html += `<tr>`
        html += `<td style="${td}font-weight:500;">${d.descripcion}</td>`
        html += `<td style="${td}font-size:8pt;">${d.proveedor || "-"}</td>`
        html += `<td style="${td}text-align:right;font-family:monospace;">${smartUnitsForShopping(item.cantidadNecesaria, d.unidad)}</td>`
        html += `<td style="${td}text-align:right;font-family:monospace;">${smartUnitsForShopping(d.stockActual, d.unidad)}</td>`
        html += `<td style="${td}text-align:right;font-family:monospace;font-weight:bold;">${buy ? smartUnitsForShopping(item.cantidadAComprar, d.unidad) : "-"}</td>`
        html += `<td style="${td}text-align:right;font-family:monospace;">${formatCurrency(item.costoMateriaPrima || 0)}</td>`
        html += `<td style="${td}text-align:right;font-family:monospace;">${buy ? formatCurrency(item.costoEstimado) : "-"}</td>`
        html += `</tr>`
      })
      html += `</tbody><tfoot><tr>`
      html += `<td colspan="5" style="${S.tfootTd}text-align:right;">TOTALES:</td>`
      html += `<td style="${S.tfootTd}text-align:right;font-size:10pt;">${formatCurrency(costoTotalMateriaPrima)}</td>`
      html += `<td style="${S.tfootTd}text-align:right;font-size:10pt;">${formatCurrency(presupuestoCompra)}</td>`
      html += `</tr></tfoot></table>`
    }

    // ========== LISTA DE COMPRAS BARRA ==========
    if (showBarraCocteles && comprasBarras.length > 0) {
      html += `<div style="margin-top:28px;">`
      html += `<h2 style="${S.sectionTitle}">LISTA DE COMPRAS - BARRA</h2>`

      const barrasArr = Array.isArray(evento.barras) ? evento.barras : (typeof evento.barras === "string" ? (() => { try { return JSON.parse(evento.barras) } catch { return [] } })() : [])
      if (barrasArr && barrasArr.length > 0) {
        html += `<div style="${S.barInfoBox}">`
        barrasArr.forEach((barra: { barraTemplateId: string; tragosPorPersona: number }) => {
          const template = (state.barrasTemplates || []).find((t) => t.id === barra.barraTemplateId)
          const personas = evento.adultos + evento.adolescentes
          html += `<div style="display:flex;justify-content:space-between;"><span style="font-weight:600">${template?.nombre || "Barra"}</span><span>${personas} personas x ${barra.tragosPorPersona} tragos = ${personas * barra.tragosPorPersona} tragos</span></div>`
        })
        html += `</div>`
      }

      html += `<table style="${S.table}"><thead><tr>`
      html += `<th style="${S.thBlack}text-align:left;">INSUMO</th>`
      html += `<th style="${S.thBlack}text-align:left;width:80px;">PROVEEDOR</th>`
      html += `<th style="${S.thBlack}text-align:right;width:70px;">NECESARIO</th>`
      html += `<th style="${S.thBlack}text-align:right;width:70px;">EN STOCK</th>`
      html += `<th style="${S.thBlack}text-align:right;width:70px;">FALTANTE</th>`
      html += `<th style="${S.thBlack}text-align:right;width:80px;">COSTO TOTAL</th>`
      html += `<th style="${S.thBlack}text-align:right;width:80px;">PRECIO STOCK</th>`
      html += `</tr></thead><tbody>`
      comprasBarras.forEach((item, i) => {
        const buy = item.cantidadAComprar > 0
        const td = i % 2 === 0 ? S.tdEven : S.tdOdd
        html += `<tr>`
        html += `<td style="${td}font-weight:500;">${item.insumoBarra.descripcion}</td>`
        html += `<td style="${td}font-size:8pt;">${item.insumoBarra.proveedor || "-"}</td>`
        html += `<td style="${td}text-align:right;font-family:monospace;">${smartUnitsForShopping(item.cantidadNecesaria, item.insumoBarra.unidad)}</td>`
        html += `<td style="${td}text-align:right;font-family:monospace;">${smartUnitsForShopping(item.insumoBarra.stockActual, item.insumoBarra.unidad)}</td>`
        html += `<td style="${td}text-align:right;font-family:monospace;font-weight:bold;">${buy ? smartUnitsForShopping(item.cantidadAComprar, item.insumoBarra.unidad) : "-"}</td>`
        html += `<td style="${td}text-align:right;font-family:monospace;">${formatCurrency(item.costoMateriaPrima || 0)}</td>`
        html += `<td style="${td}text-align:right;font-family:monospace;">${buy ? formatCurrency(item.costoEstimado) : "-"}</td>`
        html += `</tr>`
      })
      const costoTotalBarraMP = comprasBarras.reduce((sum, c) => sum + (c.costoMateriaPrima || 0), 0)
      const costoTotalBarraDesembolso = comprasBarras.reduce((sum, c) => sum + c.costoEstimado, 0)
      html += `</tbody><tfoot><tr>`
      html += `<td colspan="5" style="${S.tfootTd}text-align:right;">TOTALES BARRA:</td>`
      html += `<td style="${S.tfootTd}text-align:right;font-size:10pt;">${formatCurrency(costoTotalBarraMP)}</td>`
      html += `<td style="${S.tfootTd}text-align:right;font-size:10pt;">${formatCurrency(costoTotalBarraDesembolso)}</td>`
      html += `</tr></tfoot></table>`
      html += `</div>`
    }

    // ========== GUIA DE PRODUCCION ==========
    if (showGuiaProduccion) {
      // Page break before this section
      if (showListaCompras || showBarraCocteles) {
        html += `<div style="page-break-before:always;break-before:page;"></div>`
      }

      html += `<h2 style="${S.sectionTitle}">GUIA DE PRODUCCION - MISE EN PLACE</h2>`
      html += `<p style="margin-bottom:12px;font-size:9pt;text-align:center;">`
      if (evento.nombrePareja) html += `<strong>${evento.nombrePareja}</strong> | `
      html += `${new Date(evento.fecha).toLocaleDateString("es-AR")} | ${totalPersonas} personas</p>`

      allDishes.forEach((dish) => {
        html += `<div style="${S.dishBlock}">`
        html += `<div style="${S.dishHeader}"><div style="${S.dishName}">${dish.receta.nombre}`
        if (dish.multiplier !== 1) html += ` <span style="margin-left:6px">(x${dish.multiplier % 1 === 0 ? dish.multiplier : dish.multiplier.toFixed(1)} un/persona)</span>`
        html += `</div><div style="${S.dishSeg}">${dish.segment} - ${dish.pax} pax</div></div>`

        if (!dish.receta.insumos || dish.receta.insumos.length === 0) {
          html += `<div style="${S.noIngredients}">Sin ingredientes cargados</div>`
        } else {
          html += `<table style="${S.table}"><thead><tr>`
          html += `<th style="${S.thGray}text-align:left;">INGREDIENTE</th>`
          html += `<th style="${S.thGray}text-align:right;width:90px;">POR PLATO</th>`
          html += `<th style="${S.thGray}text-align:right;width:100px;">CANTIDAD TOTAL</th>`
          html += `<th style="${S.thGray}text-align:left;">MISE EN PLACE</th>`
          html += `</tr></thead><tbody>`
          dish.receta.insumos.forEach((insumoReceta, idx) => {
            const insumo = isHistoryMode
              ? insumos.find((i) => i.id === insumoReceta.insumoId)
              : state.insumos.find((i) => i.id === insumoReceta.insumoId)
            if (!insumo) return
            const inputQty = insumoReceta.cantidadBasePorPersona
            const inputUnit = insumoReceta.unidadReceta || insumo.unidad
            const cantidadTotal = inputQty * dish.pax * dish.multiplier
            const td = idx % 2 === 0 ? S.tdEven : S.tdOdd
            html += `<tr>`
            html += `<td style="${td}font-weight:500;">${insumo.descripcion}</td>`
            html += `<td style="${td}text-align:right;font-family:monospace;">${inputQty} ${inputUnit}</td>`
            html += `<td style="${td}text-align:right;font-family:monospace;font-weight:bold;">${smartUnitsForKitchen(cantidadTotal, inputUnit)}</td>`
            html += `<td style="${td}">${insumoReceta.detalleCorte || "-"}</td>`
            html += `</tr>`
          })
          html += `</tbody></table>`
        }
        html += `</div>`
      })
    }

    // ========== FOOTER ==========
    html += `<div style="${S.footer}">`
    html += `<p>Documento generado por Los Jazmines Sistema de Gestion</p>`
    html += `<p>${isHistoryMode
      ? `Evento cerrado el: ${snapshot?.evento ? new Date().toLocaleDateString("es-AR") : ""}`
      : `Fecha de impresion: ${new Date().toLocaleDateString("es-AR")}`
    }</p>`
    html += `</div>`

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Los Jazmines - Documento</title>
<style>
  @page { margin: 1.2cm; size: A4; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { ${S.page} }
</style></head><body>${html}</body></html>`)

    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 250)
  }

  return (
    <div className="bg-white p-6">
      {/* Print Button - Hidden on Print */}
      <div className="no-print mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">
          {isHistoryMode ? "Documento del Evento (Historial)" : "Documento Unificado del Evento"}
        </h2>
        <div className="flex gap-2">
          {onClose && (
            <Button variant="outline" onClick={onClose} className="bg-transparent">
              Cerrar
            </Button>
          )}
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            Imprimir / Guardar PDF
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl font-sans text-black">
        {/* ==================== PAGE 1: LISTA DE COMPRAS ==================== */}
        <div>
          {/* Header */}
          <div className="mb-6 border-b-2 border-black pb-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold">LOS JAZMINES EVENTOS</h1>
                {evento.nombrePareja && <p className="text-lg font-semibold mt-1">{evento.nombrePareja}</p>}
              </div>
              <div className="text-right text-sm">
                <p>
                  <strong>Fecha:</strong> {new Date(evento.fecha).toLocaleDateString("es-AR")}
                </p>
                {evento.horario && (
                  <p>
                    <strong>Horario:</strong> {evento.horario}
                  </p>
                )}
                {evento.salon && (
                  <p>
                    <strong>Salon:</strong> {evento.salon}
                  </p>
                )}
                <p className="mt-2 text-lg font-bold">Total: {totalPersonas} personas</p>
              </div>
            </div>
          </div>

          {/* Lista de Compras Cocina */}
          {showListaCompras && (
            <>
              <h2 className="mb-4 text-xl font-bold text-center border-2 border-black py-2">
                LISTA DE COMPRAS CONSOLIDADA
              </h2>

              <div className="mb-4 flex justify-between text-sm border border-black p-3">
                <div>
                  <span className="font-semibold">Costo Total Insumos:</span>{" "}
                  <span className="font-bold">{formatCurrency(costoTotalMateriaPrima)}</span>
                  <span className="text-xs ml-2">(valor real)</span>
                </div>
                <div>
                  <span className="font-semibold">Precio Stock:</span>{" "}
                  <span className="font-bold">{formatCurrency(presupuestoCompra)}</span>
                  <span className="text-xs ml-2">(lo que falta)</span>
                </div>
              </div>

              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-black text-white">
                    <th className="border border-black p-2 text-left font-bold">INSUMO</th>
                    <th className="border border-black p-2 text-left font-bold w-20">PROVEEDOR</th>
                    <th className="border border-black p-2 text-right font-bold w-20">NECESARIO</th>
                    <th className="border border-black p-2 text-right font-bold w-20">EN STOCK</th>
                    <th className="border border-black p-2 text-right font-bold w-20">FALTANTE</th>
                    <th className="border border-black p-2 text-right font-bold w-24">COSTO TOTAL</th>
                    <th className="border border-black p-2 text-right font-bold w-24">PRECIO STOCK</th>
                  </tr>
                </thead>
                <tbody>
                  {compras.map((item, index) => {
                    const needsToBuy = item.cantidadAComprar > 0
                    const insumoData = item.insumo
                    if (!insumoData) return null
                    
                    return (
                      <tr key={item.insumoId || index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="border border-black p-2 font-medium">{insumoData.descripcion}</td>
                        <td className="border border-black p-2 text-[8pt]">{insumoData.proveedor || "-"}</td>
                        <td className="border border-black p-2 text-right font-mono">
                          {smartUnitsForShopping(item.cantidadNecesaria, insumoData.unidad)}
                        </td>
                        <td className="border border-black p-2 text-right font-mono">
                          {smartUnitsForShopping(insumoData.stockActual, insumoData.unidad)}
                        </td>
                        <td className="border border-black p-2 text-right font-mono font-bold">
                          {needsToBuy ? smartUnitsForShopping(item.cantidadAComprar, insumoData.unidad) : "-"}
                        </td>
                        <td className="border border-black p-2 text-right font-mono">
                          {formatCurrency(item.costoMateriaPrima || 0)}
                        </td>
                        <td className="border border-black p-2 text-right font-mono">
                          {needsToBuy ? formatCurrency(item.costoEstimado) : "-"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-black text-white font-bold">
                    <td colSpan={5} className="border border-black p-2 text-right">
                      TOTALES:
                    </td>
                    <td className="border border-black p-2 text-right text-sm">{formatCurrency(costoTotalMateriaPrima)}</td>
                    <td className="border border-black p-2 text-right text-sm">{formatCurrency(presupuestoCompra)}</td>
                  </tr>
                </tfoot>
              </table>
            </>
          )}
        </div>

        {/* ==================== BAR SHOPPING LIST ==================== */}
        {showBarraCocteles && comprasBarras.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-4 text-xl font-bold text-center border-2 border-black py-2">
              LISTA DE COMPRAS - BARRA
            </h2>

            {evento.barras && evento.barras.length > 0 && (
              <div className="mb-4 text-sm border border-black p-3">
                {evento.barras.map((barra) => {
                  const template = (state.barrasTemplates || []).find((t) => t.id === barra.barraTemplateId)
                  const personas = evento.adultos + evento.adolescentes
                  return (
                    <div key={barra.id} className="flex justify-between">
                      <span className="font-semibold">{template?.nombre || "Barra"}</span>
                      <span>
                        {personas} personas x {barra.tragosPorPersona} tragos = {personas * barra.tragosPorPersona} tragos
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-black text-white">
                  <th className="border border-black p-2 text-left font-bold">INSUMO</th>
                  <th className="border border-black p-2 text-left font-bold w-20">PROVEEDOR</th>
                  <th className="border border-black p-2 text-right font-bold w-20">NECESARIO</th>
                  <th className="border border-black p-2 text-right font-bold w-20">EN STOCK</th>
                  <th className="border border-black p-2 text-right font-bold w-20">FALTANTE</th>
                  <th className="border border-black p-2 text-right font-bold w-24">COSTO TOTAL</th>
                  <th className="border border-black p-2 text-right font-bold w-24">PRECIO STOCK</th>
                </tr>
              </thead>
              <tbody>
                {comprasBarras.map((item, index) => {
                  const needsToBuy = item.cantidadAComprar > 0
                  return (
                    <tr key={item.insumoBarraId} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="border border-black p-2 font-medium">{item.insumoBarra.descripcion}</td>
                      <td className="border border-black p-2 text-[8pt]">{item.insumoBarra.proveedor || "-"}</td>
                      <td className="border border-black p-2 text-right font-mono">
                        {smartUnitsForShopping(item.cantidadNecesaria, item.insumoBarra.unidad)}
                      </td>
                      <td className="border border-black p-2 text-right font-mono">
                        {smartUnitsForShopping(item.insumoBarra.stockActual, item.insumoBarra.unidad)}
                      </td>
                      <td className="border border-black p-2 text-right font-mono font-bold">
                        {needsToBuy ? smartUnitsForShopping(item.cantidadAComprar, item.insumoBarra.unidad) : "-"}
                      </td>
                      <td className="border border-black p-2 text-right font-mono">
                        {formatCurrency(item.costoMateriaPrima || 0)}
                      </td>
                      <td className="border border-black p-2 text-right font-mono">
                        {needsToBuy ? formatCurrency(item.costoEstimado) : "-"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-black text-white font-bold">
                  <td colSpan={5} className="border border-black p-2 text-right">
                    TOTALES BARRA:
                  </td>
                  <td className="border border-black p-2 text-right text-sm">
                    {formatCurrency(comprasBarras.reduce((sum, c) => sum + (c.costoMateriaPrima || 0), 0))}
                  </td>
                  <td className="border border-black p-2 text-right text-sm">
                    {formatCurrency(comprasBarras.reduce((sum, c) => sum + c.costoEstimado, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* ==================== PAGE BREAK ==================== */}
        {(showListaCompras || showBarraCocteles) && showGuiaProduccion && (
          <div className="my-8 border-t-2 border-dashed border-gray-400 page-break" />
        )}

        {/* ==================== PAGE 2+: GUIA DE PRODUCCION ==================== */}
        {showGuiaProduccion && (
        <div>
          <h2 className="mb-6 text-xl font-bold text-center border-2 border-black py-2">
            GUIA DE PRODUCCION - MISE EN PLACE
          </h2>

          <p className="mb-4 text-sm text-center">
            {evento.nombrePareja && <span className="font-semibold">{evento.nombrePareja} | </span>}
            {new Date(evento.fecha).toLocaleDateString("es-AR")} | {totalPersonas} personas
          </p>

          <div className="space-y-6">
            {allDishes.map((dish) => {
              if (!dish.receta.insumos || dish.receta.insumos.length === 0) {
                return (
                  <div key={`${dish.receta.id}-${dish.segment}`} className="border border-black">
                    <div className="bg-black text-white p-2">
                      <h3 className="font-bold text-sm">
                        {dish.receta.nombre}
                        {dish.multiplier !== 1 && <span className="ml-2">(x{dish.multiplier % 1 === 0 ? dish.multiplier : dish.multiplier.toFixed(1)} un/persona)</span>}
                      </h3>
                      <p className="text-xs">
                        {dish.segment} - {dish.pax} pax
                      </p>
                    </div>
                    <div className="p-4 text-center text-gray-500 text-sm italic">Sin ingredientes cargados</div>
                  </div>
                )
              }

              return (
                <div key={`${dish.receta.id}-${dish.segment}`} className="border border-black">
                  <div className="bg-black text-white p-2">
                    <h3 className="font-bold text-sm">
                      {dish.receta.nombre}
                      {dish.multiplier !== 1 && <span className="ml-2">(x{dish.multiplier % 1 === 0 ? dish.multiplier : dish.multiplier.toFixed(1)} un/persona)</span>}
                    </h3>
                    <p className="text-xs">
                      {dish.segment} - {dish.pax} pax
                    </p>
                  </div>

                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-200">
                        <th className="border border-black p-2 text-left font-bold">INGREDIENTE</th>
                        <th className="border border-black p-2 text-right font-bold w-28">POR PLATO</th>
                        <th className="border border-black p-2 text-right font-bold w-32">CANTIDAD TOTAL</th>
                        <th className="border border-black p-2 text-left font-bold">MISE EN PLACE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dish.receta.insumos.map((insumoReceta, idx) => {
                        const insumo = isHistoryMode 
                          ? insumos.find((i) => i.id === insumoReceta.insumoId)
                          : state.insumos.find((i) => i.id === insumoReceta.insumoId)
                        if (!insumo) return null

                        const inputQty = insumoReceta.cantidadBasePorPersona
                        const inputUnit = insumoReceta.unidadReceta || insumo.unidad
                        const cantidadTotal = inputQty * dish.pax * dish.multiplier

                        return (
                          <tr key={insumoReceta.insumoId} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="border border-black p-2 font-medium">{insumo.descripcion}</td>
                            <td className="border border-black p-2 text-right font-mono">
                              {inputQty} {inputUnit}
                            </td>
                            <td className="border border-black p-2 text-right font-mono font-bold">
                              {smartUnitsForKitchen(cantidadTotal, inputUnit)}
                            </td>
                            <td className="border border-black p-2">{insumoReceta.detalleCorte || "-"}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-black text-center text-xs text-gray-600">
            <p>Documento generado por Los Jazmines Sistema de Gestion</p>
            <p>
              {isHistoryMode 
                ? `Evento cerrado el: ${snapshot?.evento ? new Date().toLocaleDateString("es-AR") : ""}`
                : `Fecha de impresion: ${new Date().toLocaleDateString("es-AR")}`
              }
            </p>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
