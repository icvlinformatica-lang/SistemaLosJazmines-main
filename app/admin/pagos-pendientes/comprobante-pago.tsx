"use client"

import { useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Printer, Download, CheckCircle2 } from "lucide-react"
import type { PagoPersonal, PersonalEvento } from "@/lib/store"

interface ComprobantePagoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pago: PagoPersonal
  personal?: PersonalEvento
}

export default function ComprobantePago({ open, onOpenChange, pago, personal }: ComprobantePagoProps) {
  const comprobanteRef = useRef<HTMLDivElement>(null)

  const formatearPrecio = (precio: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
    }).format(precio)
  }

  const formatearFecha = (fecha: string) => {
    if (!fecha) return "-"
    return new Date(fecha).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  const handleImprimir = () => {
    const printContent = comprobanteRef.current
    if (!printContent) return

    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Comprobante de Pago - ${pago.nombrePersonal}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #1a1a1a; }
          .comprobante { max-width: 600px; margin: 0 auto; border: 2px solid #2d5a3d; border-radius: 12px; padding: 32px; }
          .header { text-align: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 24px; }
          .header h1 { font-size: 20px; color: #2d5a3d; margin: 0 0 4px 0; }
          .header p { font-size: 13px; color: #6b7280; margin: 0; }
          .check { color: #16a34a; font-size: 40px; margin-bottom: 8px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
          .field label { display: block; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
          .field span { display: block; font-size: 14px; font-weight: 600; }
          .monto { text-align: center; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0; }
          .monto label { font-size: 12px; color: #6b7280; }
          .monto span { font-size: 28px; font-weight: 700; color: #16a34a; }
          .footer { text-align: center; border-top: 2px solid #e5e7eb; padding-top: 16px; margin-top: 24px; font-size: 11px; color: #9ca3af; }
          .firmas { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; }
          .firma { text-align: center; width: 45%; }
          .firma .linea { border-top: 1px solid #1a1a1a; margin-top: 60px; padding-top: 8px; font-size: 12px; }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Comprobante de Pago</DialogTitle>
        </DialogHeader>

        <div ref={comprobanteRef}>
          <div className="comprobante">
            {/* Header */}
            <div className="header" style={{ textAlign: "center", borderBottom: "2px solid #e5e7eb", paddingBottom: "16px", marginBottom: "24px" }}>
              <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-2" />
              <h1 style={{ fontSize: "20px", color: "#2d5a3d", margin: "0 0 4px 0" }}>Los Jazmines - Comprobante de Pago</h1>
              <p style={{ fontSize: "13px", color: "#6b7280", margin: 0 }}>Pago registrado correctamente</p>
            </div>

            {/* Datos del Pago */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
              <div className="field">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Personal</label>
                <span className="text-sm font-semibold">{pago.nombrePersonal}</span>
              </div>
              <div className="field">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Servicio</label>
                <span className="text-sm font-semibold">{pago.servicioNombre}</span>
              </div>
              <div className="field">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Fecha del Evento</label>
                <span className="text-sm font-semibold">{formatearFecha(pago.fechaEvento)}</span>
              </div>
              <div className="field">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Fecha de Pago</label>
                <span className="text-sm font-semibold">{pago.fechaPago ? formatearFecha(pago.fechaPago) : "-"}</span>
              </div>
              <div className="field">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Tipo de Pago</label>
                <span className="text-sm font-semibold capitalize">{pago.tipoPago || "-"}</span>
              </div>
              {personal?.dni && (
                <div className="field">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">DNI</label>
                  <span className="text-sm font-semibold">{personal.dni}</span>
                </div>
              )}
            </div>

            {/* Monto */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center my-5">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">Monto Total</label>
              <div className="text-3xl font-bold text-green-600 mt-1">
                {formatearPrecio(pago.montoTotal)}
              </div>
            </div>

            {/* Datos Bancarios */}
            {personal?.cuentaBancaria && personal.cuentaBancaria.cbu && (
              <div className="bg-muted/50 rounded-lg p-4 text-sm mb-5">
                <label className="text-xs text-muted-foreground uppercase tracking-wide block mb-2">Datos Bancarios</label>
                <div>Banco: <strong>{personal.cuentaBancaria.banco}</strong></div>
                <div>CBU: <strong>{personal.cuentaBancaria.cbu}</strong></div>
                <div>Alias: <strong>{personal.cuentaBancaria.alias}</strong></div>
              </div>
            )}

            {/* Notas */}
            {pago.notasPago && (
              <div className="text-sm text-muted-foreground italic border-t pt-3 mt-3">
                <strong>Notas:</strong> {pago.notasPago}
              </div>
            )}

            {/* Firmas */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "40px", paddingTop: "20px" }}>
              <div style={{ textAlign: "center", width: "45%" }}>
                <div style={{ borderTop: "1px solid #1a1a1a", marginTop: "60px", paddingTop: "8px", fontSize: "12px" }}>
                  Firma Empresa
                </div>
              </div>
              <div style={{ textAlign: "center", width: "45%" }}>
                <div style={{ borderTop: "1px solid #1a1a1a", marginTop: "60px", paddingTop: "8px", fontSize: "12px" }}>
                  Firma {pago.nombrePersonal}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ textAlign: "center", borderTop: "2px solid #e5e7eb", paddingTop: "16px", marginTop: "24px", fontSize: "11px", color: "#9ca3af" }}>
              Los Jazmines Catering - Comprobante generado el {new Date().toLocaleDateString("es-AR")}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button onClick={handleImprimir}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
