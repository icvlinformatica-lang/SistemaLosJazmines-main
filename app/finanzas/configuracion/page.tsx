"use client"

import { useState, useEffect } from "react"
import { useStore } from "@/lib/store-context"
import { SALONES, ConfiguracionCajas } from "@/lib/store"
import { formatCurrency } from "@/lib/utils-financieros"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Building2, Percent, Wallet, Save, Building } from "lucide-react"

export default function ConfiguracionCajasPage() {
  const { configuracionCajas, updateConfiguracionCajas } = useStore()
  const { toast } = useToast()

  const [config, setConfig] = useState<ConfiguracionCajas>(configuracionCajas)

  useEffect(() => {
    setConfig(configuracionCajas)
  }, [configuracionCajas])

  const handleSalonChange = (salon: string, field: "saldoInicial" | "porcentajeAporteAdmin", value: number) => {
    setConfig((prev) => ({
      ...prev,
      salones: {
        ...prev.salones,
        [salon]: {
          ...prev.salones[salon],
          [field]: value,
        },
      },
    }))
  }

  const handleAdminSaldoChange = (value: number) => {
    setConfig((prev) => ({
      ...prev,
      admin: { saldoInicial: value },
    }))
  }

  const handleGuardar = () => {
    updateConfiguracionCajas(config)
    toast({
      title: "Configuracion guardada",
      description: "Los saldos iniciales y porcentajes de aporte fueron actualizados.",
    })
  }

  // Calcular resumen de aportes para admin
  const resumenAportes = SALONES.map((salon) => ({
    salon,
    porcentaje: config.salones[salon]?.porcentajeAporteAdmin ?? 0,
  })).filter((a) => a.porcentaje > 0)

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuracion de Cajas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define el saldo inicial de cada caja y el porcentaje que aporta a Administracion General
          </p>
        </div>
        <Button onClick={handleGuardar} className="gap-2">
          <Save className="h-4 w-4" />
          Guardar Cambios
        </Button>
      </div>

      {/* Salones Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SALONES.map((salon) => {
          const salonConfig = config.salones[salon] || { saldoInicial: 0, porcentajeAporteAdmin: 0 }
          return (
            <Card key={salon} className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5 text-primary" />
                  {salon}
                </CardTitle>
                <CardDescription>Caja del salon {salon}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Saldo Inicial */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-sm font-medium">
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                    Saldo Inicial
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      type="number"
                      min={0}
                      value={salonConfig.saldoInicial || ""}
                      onChange={(e) => handleSalonChange(salon, "saldoInicial", Number(e.target.value) || 0)}
                      className="pl-7"
                      placeholder="0"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Cuanta plata hay hoy en esta caja</p>
                </div>

                {/* Porcentaje Aporte Admin */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-1.5 text-sm font-medium">
                    <Percent className="h-4 w-4 text-muted-foreground" />
                    Aporte a Administracion
                  </Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[salonConfig.porcentajeAporteAdmin]}
                      onValueChange={([val]) => handleSalonChange(salon, "porcentajeAporteAdmin", val)}
                      max={100}
                      step={1}
                      className="flex-1"
                    />
                    <span className="w-12 text-right font-mono text-sm font-medium">
                      {salonConfig.porcentajeAporteAdmin}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Porcentaje de cada ingreso que se transfiere automaticamente a Admin
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Admin Card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building className="h-5 w-5 text-primary" />
            Administracion General
          </CardTitle>
          <CardDescription>Caja central que recibe aportes de todos los salones</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Saldo Inicial Admin */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                Saldo Inicial
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number"
                  min={0}
                  value={config.admin.saldoInicial || ""}
                  onChange={(e) => handleAdminSaldoChange(Number(e.target.value) || 0)}
                  className="pl-7"
                  placeholder="0"
                />
              </div>
              <p className="text-xs text-muted-foreground">Saldo inicial de la caja de administracion</p>
            </div>

            {/* Resumen de Aportes */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Resumen de Aportes por Salon</Label>
              {resumenAportes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Ningun salon tiene configurado aporte a administracion
                </p>
              ) : (
                <div className="space-y-1.5">
                  {resumenAportes.map(({ salon, porcentaje }) => (
                    <div key={salon} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{salon}</span>
                      <span className="font-medium">{porcentaje}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
