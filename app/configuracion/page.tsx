"use client"

import Link from "next/link"
import { useStore } from "@/lib/store-context"
import { formatCurrency, type EventoHistorial } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Download, Upload, ArrowLeft, FileText, Trash2, History, Check, RefreshCw, Database, Package, ChefHat, Wine, ClipboardList, Cloud, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import type { Insumo, Receta } from "@/lib/store"
import { UnifiedDocument } from "@/components/unified-document"

export default function ConfiguracionPage() {
  const { state, insumos, recetas, historial, setInsumos, setRecetas, deleteEventoHistorial, clearHistorial } = useStore()
  const [selectedHistorial, setSelectedHistorial] = useState<EventoHistorial | null>(null)
  const [showHistorialDocument, setShowHistorialDocument] = useState(false)
  const { toast } = useToast()
  
  // Save status state
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<Record<string, { count: number; synced: boolean }>>({
    insumos: { count: 0, synced: true },
    insumosBarra: { count: 0, synced: true },
    recetas: { count: 0, synced: true },
    cocteles: { count: 0, synced: true },
  })
  
  // Restore progress state
  const [isRestoring, setIsRestoring] = useState(false)
  const [restoreProgress, setRestoreProgress] = useState(0)
  const [restoreStatus, setRestoreStatus] = useState("")

  // Check data status on mount and when state changes
  useEffect(() => {
    const checkDataStatus = async () => {
      try {
        const [insumosRes, insumosBarraRes, recetasRes, coctelesRes] = await Promise.all([
          fetch("/api/insumos").then(r => r.ok ? r.json() : []),
          fetch("/api/insumos-barra").then(r => r.ok ? r.json() : []),
          fetch("/api/recetas").then(r => r.ok ? r.json() : []),
          fetch("/api/cocteles").then(r => r.ok ? r.json() : []),
        ])
        
        setSyncStatus({
          insumos: { count: Array.isArray(insumosRes) ? insumosRes.length : 0, synced: true },
          insumosBarra: { count: Array.isArray(insumosBarraRes) ? insumosBarraRes.length : 0, synced: true },
          recetas: { count: Array.isArray(recetasRes) ? recetasRes.length : 0, synced: true },
          cocteles: { count: Array.isArray(coctelesRes) ? coctelesRes.length : 0, synced: true },
        })
        
        // Get last save time from localStorage metadata
        const STORAGE_KEY = "los-jazmines-data"
        const savedData = localStorage.getItem(STORAGE_KEY)
        if (savedData) {
          const parsed = JSON.parse(savedData)
          if (parsed._lastSaved) {
            setLastSaveTime(new Date(parsed._lastSaved))
          } else {
            setLastSaveTime(new Date())
          }
        }
      } catch (error) {
        console.error("Error checking data status:", error)
      }
    }
    
    checkDataStatus()
  }, [state])

  const handleManualSync = async () => {
    setIsSyncing(true)
    try {
      // Save current timestamp to localStorage
      const STORAGE_KEY = "los-jazmines-data"
      const savedData = localStorage.getItem(STORAGE_KEY)
      if (savedData) {
        const parsed = JSON.parse(savedData)
        parsed._lastSaved = new Date().toISOString()
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
      }
      setLastSaveTime(new Date())
      
      toast({
        title: "Datos sincronizados",
        description: "Toda la informacion esta guardada correctamente.",
      })
    } catch (error) {
      toast({
        title: "Error al sincronizar",
        description: "Hubo un problema al guardar los datos.",
        variant: "destructive",
      })
    } finally {
      setIsSyncing(false)
    }
  }

  const formatLastSaveTime = (date: Date | null) => {
    if (!date) return "Sin informacion"
    return date.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // ==================== BACKUP FUNCTIONS ====================

  const exportFullBackup = () => {
    // Fetch ALL data from localStorage
    const STORAGE_KEY = "los-jazmines-data"
    const storedData = localStorage.getItem(STORAGE_KEY)
    
    const backup = {
      version: "2.0",
      date: new Date().toISOString(),
      data: storedData ? JSON.parse(storedData) : { insumos, recetas, historial, eventoActual: null }
    }
    
    const dataStr = JSON.stringify(backup, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = "LosJazmines_Backup.json"
    link.click()
    URL.revokeObjectURL(url)

    toast({
      title: "Copia guardada",
      description: "El archivo se descargo en tu computadora",
    })
  }

  const importFullBackup = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json,application/json"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string)

          // SAFETY CHECK 1: Validate the file has valid data keys
          const data = parsed.data || parsed // Support both v2.0 format and legacy
          if (!data.insumos && !data.recetas) {
            toast({
              title: "Archivo invalido",
              description: "Este archivo no contiene datos validos del sistema.",
              variant: "destructive",
            })
            return
          }

          // SAFETY CHECK 2: User Confirmation
          const confirmed = window.confirm(
            "ATENCION: Esto sincronizara los datos del archivo con la base de datos en la nube. Los insumos y recetas existentes se actualizaran y los nuevos se crearan. Continuar?"
          )
          
          if (!confirmed) return

          // START CLOUD SYNC
          setIsRestoring(true)
          setRestoreProgress(0)
          setRestoreStatus("Preparando sincronizacion...")

          const results = {
            insumosCreated: 0,
            insumosUpdated: 0,
            insumosBarraCreated: 0,
            insumosBarraUpdated: 0,
            recetasCreated: 0,
            recetasUpdated: 0,
            coctelesCreated: 0,
            coctelesUpdated: 0,
          }

          // Get existing data from DB to compare
          const [existingInsumos, existingInsumosBarra, existingRecetas, existingCocteles] = await Promise.all([
            fetch("/api/insumos").then(r => r.ok ? r.json() : []).then(d => Array.isArray(d) ? d : []),
            fetch("/api/insumos-barra").then(r => r.ok ? r.json() : []).then(d => Array.isArray(d) ? d : []),
            fetch("/api/recetas").then(r => r.ok ? r.json() : []).then(d => Array.isArray(d) ? d : []),
            fetch("/api/cocteles").then(r => r.ok ? r.json() : []).then(d => Array.isArray(d) ? d : []),
          ])

          const existingInsumosMap = new Map(existingInsumos.map((i: any) => [i.codigo, i]))
          const existingInsumosBarraMap = new Map(existingInsumosBarra.map((i: any) => [i.codigo, i]))
          const existingRecetasMap = new Map(existingRecetas.map((r: any) => [r.nombre, r]))
          const existingCoctelesMap = new Map(existingCocteles.map((c: any) => [c.nombre, c]))

          // Calculate total items for progress
          const totalItems = 
            (data.insumos?.length || 0) + 
            (data.insumosBarra?.length || 0) + 
            (data.recetas?.length || 0) + 
            (data.cocteles?.length || 0)
          let processedItems = 0

          // SYNC INSUMOS (Cocina)
          if (data.insumos && Array.isArray(data.insumos)) {
            setRestoreStatus("Sincronizando insumos de cocina...")
            for (const insumo of data.insumos) {
              const existing = existingInsumosMap.get(insumo.codigo)
              const payload = {
                codigo: insumo.codigo,
                descripcion: insumo.descripcion,
                unidad: insumo.unidad,
                stockActual: insumo.stockActual ?? insumo.stock_actual ?? 0,
                precioUnitario: insumo.precioUnitario ?? insumo.precio_unitario ?? 0,
                proveedor: insumo.proveedor || "",
              }

              if (existing) {
                // Update existing
                await fetch(`/api/insumos/${existing.id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                })
                results.insumosUpdated++
              } else {
                // Create new
                await fetch("/api/insumos", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                })
                results.insumosCreated++
              }
              processedItems++
              setRestoreProgress(Math.round((processedItems / totalItems) * 100))
            }
          }

          // SYNC INSUMOS BARRA
          if (data.insumosBarra && Array.isArray(data.insumosBarra)) {
            setRestoreStatus("Sincronizando insumos de barra...")
            for (const insumo of data.insumosBarra) {
              const existing = existingInsumosBarraMap.get(insumo.codigo)
              const payload = {
                codigo: insumo.codigo,
                descripcion: insumo.descripcion,
                unidad: insumo.unidad,
                categoria: insumo.categoria || "Otros",
                stockActual: insumo.stockActual ?? insumo.stock_actual ?? 0,
                precioUnitario: insumo.precioUnitario ?? insumo.precio_unitario ?? 0,
                proveedor: insumo.proveedor || "",
              }

              if (existing) {
                await fetch(`/api/insumos-barra/${existing.id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                })
                results.insumosBarraUpdated++
              } else {
                await fetch("/api/insumos-barra", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                })
                results.insumosBarraCreated++
              }
              processedItems++
              setRestoreProgress(Math.round((processedItems / totalItems) * 100))
            }
          }

          // SYNC RECETAS
          if (data.recetas && Array.isArray(data.recetas)) {
            setRestoreStatus("Sincronizando recetas...")
            for (const receta of data.recetas) {
              const existing = existingRecetasMap.get(receta.nombre)
              
              // Map backup format to API format
              // Backup: { insumoId, detalleCorte, cantidadBasePorPersona, unidadReceta }
              // API expects: { insumoId, cantidadBasePorPersona, unidadReceta, detalleCorte }
              const insumos = (receta.insumos || receta.ingredientes || []).map((ing: any) => ({
                insumoId: ing.insumoId || ing.id,
                cantidadBasePorPersona: ing.cantidadBasePorPersona ?? ing.cantidad ?? 0,
                unidadReceta: ing.unidadReceta || ing.unidad || "GRS",
                detalleCorte: ing.detalleCorte || "",
              }))
              
              const payload = {
                nombre: receta.nombre,
                categoria: receta.categoria || "Plato Principal",
                porcionesBase: receta.porcionesBase ?? receta.porciones ?? 1,
                instrucciones: receta.instrucciones || null,
                insumos,
              }

              if (existing) {
                await fetch(`/api/recetas/${existing.id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                })
                results.recetasUpdated++
              } else {
                await fetch("/api/recetas", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                })
                results.recetasCreated++
              }
              processedItems++
              setRestoreProgress(Math.round((processedItems / totalItems) * 100))
            }
          }

          // SYNC COCTELES
          if (data.cocteles && Array.isArray(data.cocteles)) {
            setRestoreStatus("Sincronizando cocteles...")
            for (const coctel of data.cocteles) {
              const existing = existingCoctelesMap.get(coctel.nombre)
              
              const insumos = (coctel.insumos || coctel.ingredientes || []).map((ing: any) => ({
                insumoId: ing.insumoId || ing.id,
                cantidadBasePorPersona: ing.cantidadBasePorPersona ?? ing.cantidad ?? 0,
                unidadReceta: ing.unidadReceta || ing.unidad || "ML",
                detalleCorte: ing.detalleCorte || "",
              }))
              
              const payload = {
                nombre: coctel.nombre,
                categoria: coctel.categoria || "Coctel",
                porcionesBase: coctel.porcionesBase ?? coctel.porciones ?? 1,
                instrucciones: coctel.instrucciones || null,
                insumos,
              }

              if (existing) {
                await fetch(`/api/cocteles/${existing.id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                })
                results.coctelesUpdated++
              } else {
                await fetch("/api/cocteles", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                })
                results.coctelesCreated++
              }
              processedItems++
              setRestoreProgress(Math.round((processedItems / totalItems) * 100))
            }
          }

          // Also save to localStorage for local state
          const STORAGE_KEY = "los-jazmines-data"
          const existingLocalData = localStorage.getItem(STORAGE_KEY)
          const localData = existingLocalData ? JSON.parse(existingLocalData) : {}
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            ...localData,
            ...data,
            _lastSaved: new Date().toISOString(),
          }))

          setRestoreProgress(100)
          setRestoreStatus("Sincronizacion completada!")
          setLastSaveTime(new Date())

          // Show results
          const totalCreated = results.insumosCreated + results.insumosBarraCreated + results.recetasCreated + results.coctelesCreated
          const totalUpdated = results.insumosUpdated + results.insumosBarraUpdated + results.recetasUpdated + results.coctelesUpdated

          toast({
            title: "Sincronizacion exitosa",
            description: `${totalCreated} registros creados, ${totalUpdated} actualizados.`,
          })

          // Refresh data status
          setTimeout(() => {
            setIsRestoring(false)
            window.location.reload()
          }, 2000)

        } catch (error) {
          console.error("[v0] Import error:", error)
          setIsRestoring(false)
          toast({
            title: "Error al sincronizar",
            description: "Hubo un problema al procesar el archivo.",
            variant: "destructive",
          })
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const resetToDefaults = () => {
    localStorage.removeItem("los-jazmines-data")
    toast({
      title: "Sistema reiniciado",
      description: "Se cargaron los datos predeterminados. Recargando...",
    })
    setTimeout(() => window.location.reload(), 1000)
  }

  // ==================== HISTORIAL FUNCTIONS ====================

  const viewHistorialPDF = (entry: EventoHistorial) => {
    setSelectedHistorial(entry)
    setShowHistorialDocument(true)
  }

  const closeHistorialDocument = () => {
    setShowHistorialDocument(false)
    setSelectedHistorial(null)
  }

  // Parse the snapshot data for the UnifiedDocument component
  const getSnapshotData = () => {
    if (!selectedHistorial) return undefined
    try {
      return JSON.parse(selectedHistorial.snapshot)
    } catch {
      return undefined
    }
  }

  // If viewing a historial document, show it fullscreen
  if (showHistorialDocument && selectedHistorial) {
    const snapshotData = getSnapshotData()
    return (
      <div className="min-h-screen bg-background">
        <UnifiedDocument 
          snapshot={snapshotData} 
          onClose={closeHistorialDocument}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background px-6 py-4">
        <div className="mx-auto max-w-4xl flex items-center gap-4">
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-xl font-semibold">Configuracion</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8 space-y-8">
        {/* Section 0: Estado de Guardado */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Database className="h-6 w-6" />
                  Estado de Guardado
                </CardTitle>
                <CardDescription className="text-base mt-1">
                  Informacion almacenada en la base de datos
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                {lastSaveTime ? (
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg">
                    <Check className="h-5 w-5" />
                    <span className="font-medium">Guardado</span>
                  </div>
                ) : (
                  <Button 
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className="bg-blue-500 hover:bg-blue-600"
                  >
                    {isSyncing ? (
                      <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-5 w-5 mr-2" />
                    )}
                    Guardar
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Last save time */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <span className="text-muted-foreground">Ultimo guardado automatico:</span>
              <span className="font-medium">{formatLastSaveTime(lastSaveTime)}</span>
            </div>
            
            {/* Data counts grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-4 border rounded-lg">
                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <Package className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{syncStatus.insumos.count}</p>
                  <p className="text-sm text-muted-foreground">Insumos Cocina</p>
                </div>
                {syncStatus.insumos.synced && (
                  <Check className="h-4 w-4 text-green-500 ml-auto" />
                )}
              </div>
              
              <div className="flex items-center gap-3 p-4 border rounded-lg">
                <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <Wine className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{syncStatus.insumosBarra.count}</p>
                  <p className="text-sm text-muted-foreground">Insumos Barra</p>
                </div>
                {syncStatus.insumosBarra.synced && (
                  <Check className="h-4 w-4 text-green-500 ml-auto" />
                )}
              </div>
              
              <div className="flex items-center gap-3 p-4 border rounded-lg">
                <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <ChefHat className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{syncStatus.recetas.count}</p>
                  <p className="text-sm text-muted-foreground">Recetas</p>
                </div>
                {syncStatus.recetas.synced && (
                  <Check className="h-4 w-4 text-green-500 ml-auto" />
                )}
              </div>
              
              <div className="flex items-center gap-3 p-4 border rounded-lg">
                <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-rose-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{syncStatus.cocteles.count}</p>
                  <p className="text-sm text-muted-foreground">Cocteles</p>
                </div>
                {syncStatus.cocteles.synced && (
                  <Check className="h-4 w-4 text-green-500 ml-auto" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 1: Historial */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <History className="h-6 w-6" />
              Historial de Eventos
            </CardTitle>
            <CardDescription className="text-base">
              Eventos cerrados anteriormente. Puedes reimprimir los documentos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {historial.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-lg">No hay eventos en el historial</p>
                <p className="text-base mt-1">Los eventos cerrados apareceran aqui</p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-base">Evento</TableHead>
                      <TableHead className="text-base">Fecha</TableHead>
                      <TableHead className="text-base text-right">Personas</TableHead>
                      <TableHead className="text-base text-right">Costo</TableHead>
                      <TableHead className="w-32"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historial.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium text-base">{entry.nombre}</TableCell>
                        <TableCell className="text-base">
                          {new Date(entry.fecha).toLocaleDateString("es-AR")}
                        </TableCell>
                        <TableCell className="text-right text-base">{entry.totalPersonas}</TableCell>
                        <TableCell className="text-right text-base">{formatCurrency(entry.costoTotal)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10"
                              onClick={() => viewHistorialPDF(entry)}
                              title="Ver PDF Original"
                            >
                              <FileText className="h-5 w-5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-10 w-10" title="Eliminar">
                                  <Trash2 className="h-5 w-5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Eliminar del Historial</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esto eliminara permanentemente este evento del historial.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="h-12">Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="h-12 bg-destructive hover:bg-destructive/90"
                                    onClick={() => deleteEventoHistorial(entry.id)}
                                  >
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 2: Respaldo y Recuperacion */}
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Respaldo y Recuperacion de Datos</h2>
            <p className="text-base text-muted-foreground mt-1">
              Guarda una copia de tu sistema en la computadora para no perder nada.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card A: Export/Download */}
            <Card className="border-2 border-blue-200 bg-blue-50">
              <CardContent className="pt-6 pb-6 flex flex-col items-center text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-blue-500 flex items-center justify-center">
                  <Download className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-blue-900">GUARDAR COPIA</h3>
                  <p className="text-base text-blue-700 mt-1">Descarga todos tus datos</p>
                </div>
                <Button 
                  onClick={exportFullBackup} 
                  className="w-full h-16 text-lg bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Download className="mr-3 h-6 w-6" />
                  DESCARGAR COPIA
                </Button>
                <p className="text-sm text-blue-600">Guardar en mi PC</p>
              </CardContent>
            </Card>

            {/* Card B: Import/Restore */}
            <Card className="border-2 border-green-200 bg-green-50">
              <CardContent className="pt-6 pb-6 flex flex-col items-center text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-green-500 flex items-center justify-center">
                  <Cloud className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-green-900">RESTAURAR A LA NUBE</h3>
                  <p className="text-base text-green-700 mt-1">Sincronizar archivo con la base de datos</p>
                </div>
                
                {isRestoring ? (
                  <div className="w-full space-y-3">
                    <div className="flex items-center justify-center gap-2 text-green-700">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm font-medium">{restoreStatus}</span>
                    </div>
                    <Progress value={restoreProgress} className="h-3" />
                    <p className="text-lg font-bold text-green-800">{restoreProgress}%</p>
                  </div>
                ) : (
                  <>
                    <Button 
                      onClick={importFullBackup} 
                      className="w-full h-16 text-lg bg-green-500 hover:bg-green-600 text-white"
                    >
                      <Upload className="mr-3 h-6 w-6" />
                      RESTAURAR Y SINCRONIZAR
                    </Button>
                    <p className="text-sm text-green-600">Carga archivo JSON y guarda en la nube</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Section 3: Zona Peligrosa - REMOVED */}

      </main>
    </div>
  )
}
