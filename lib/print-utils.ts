import {
  formatCurrency,
  calcularComprasSegmentadas,
  calcularComprasBarras,
  type Receta,
  type Evento,
  type Insumo,
  type InsumoBarra,
  type Coctel,
  type BarraTemplate,
  type CalculoCompraBarra,
} from "@/lib/store"

export interface DocumentSections {
  listaCompras: boolean
  barraCocteles: boolean
  guiaProduccion: boolean
}

export interface PrintData {
  evento: Evento
  recetas: Receta[]
  insumos: Insumo[]
  insumosBarra: InsumoBarra[]
  cocteles: Coctel[]
  barrasTemplates: BarraTemplate[]
}

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

export function imprimirDocumentoEvento(data: PrintData, sections: DocumentSections) {
  const { evento, recetas, insumos, insumosBarra, cocteles, barrasTemplates } = data
  const showListaCompras = sections.listaCompras
  const showBarraCocteles = sections.barraCocteles
  const showGuiaProduccion = sections.guiaProduccion

  const recetasAdultos = evento.recetasAdultos || []
  const recetasAdolescentes = evento.recetasAdolescentes || []
  const recetasNinos = evento.recetasNinos || []
  const recetasDietasEspeciales = evento.recetasDietasEspeciales || []
  const multipliersAdultos = evento.multipliersAdultos || {}
  const multipliersAdolescentes = evento.multipliersAdolescentes || {}
  const multipliersNinos = evento.multipliersNinos || {}
  const multipliersDietasEspeciales = evento.multipliersDietasEspeciales || {}

  const recetasAdultosSeleccionadas = recetas.filter((r) => recetasAdultos.includes(r.id))
  const recetasAdolescentesSeleccionadas = recetas.filter((r) => recetasAdolescentes.includes(r.id))
  const recetasNinosSeleccionadas = recetas.filter((r) => recetasNinos.includes(r.id))
  const recetasDietasEspecialesSeleccionadas = recetas.filter((r) => recetasDietasEspeciales.includes(r.id))

  const compras = calcularComprasSegmentadas(evento, recetas, insumos)
  const comprasBarras: CalculoCompraBarra[] = calcularComprasBarras(evento, cocteles, insumosBarra)

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

    if (evento.barras && evento.barras.length > 0) {
      html += `<div style="${S.barInfoBox}">`
      evento.barras.forEach((barra) => {
        const template = (barrasTemplates || []).find((t) => t.id === barra.barraTemplateId)
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
          const insumo = insumos.find((i) => i.id === insumoReceta.insumoId)
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
  html += `<p>Fecha de impresion: ${new Date().toLocaleDateString("es-AR")}</p>`
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
