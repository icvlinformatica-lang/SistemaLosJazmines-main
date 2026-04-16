"use client"

import { useState } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { Archive, Search, Users, Building2, Calendar, RotateCcw } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type ArchivoEvento = {
  id: string
  nombre: string
  nombrePareja: string
  fecha: string
  salon: string
  tipoEvento: string
  adultos: number
  adolescentes: number
  ninos: number
  personasDietasEspeciales: number
  precioVenta?: number
  estado: string
  updatedAt: string
}

function formatFecha(fecha: string | null) {
  if (!fecha) return "-"
  return new Date(fecha + "T12:00:00").toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function getTotalInvitados(e: ArchivoEvento) {
  return (e.adultos || 0) + (e.adolescentes || 0) + (e.ninos || 0) + (e.personasDietasEspeciales || 0)
}

export default function ArchivoPage() {
  const { data: eventos = [], isLoading, mutate } = useSWR<ArchivoEvento[]>("/api/eventos/archivo", fetcher, {
    refreshInterval: 30000,
  })
  const [search, setSearch] = useState("")
  const [reabrirId, setReabrirId] = useState<string | null>(null)
  const { toast } = useToast()

  const filtrados = eventos.filter((e) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (e.nombrePareja || e.nombre || "").toLowerCase().includes(q) ||
      (e.salon || "").toLowerCase().includes(q) ||
      (e.tipoEvento || "").toLowerCase().includes(q)
    )
  })

  const handleReabrir = async () => {
    if (!reabrirId) return
    await fetch(`/api/eventos/${reabrirId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "en_preparacion" }),
    })
    toast({ title: "Evento reabierto", description: "El evento volvio a la lista activa." })
    setReabrirId(null)
    mutate()
  }

  return (
    <main className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Archive className="h-7 w-7 text-emerald-700" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Archivo</h1>
          <p className="text-sm text-muted-foreground">Eventos finalizados y cerrados</p>
        </div>
        <Badge variant="secondary" className="ml-auto">
          {eventos.length} evento{eventos.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Buscador */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar en el archivo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-16">Cargando archivo...</div>
      ) : filtrados.length === 0 ? (
        <div className="text-center text-muted-foreground py-16 space-y-2">
          <Archive className="h-12 w-12 mx-auto opacity-20" />
          <p className="font-medium">No hay eventos finalizados</p>
          <p className="text-sm">Cuando marques un evento como finalizado aparecera aqui.</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Evento</TableHead>
                <TableHead><Calendar className="inline h-3.5 w-3.5 mr-1" />Fecha</TableHead>
                <TableHead><Building2 className="inline h-3.5 w-3.5 mr-1" />Salon</TableHead>
                <TableHead><Users className="inline h-3.5 w-3.5 mr-1" />Invitados</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((evento) => (
                <TableRow key={evento.id} className="hover:bg-muted/30">
                  <TableCell>
                    <p className="font-semibold text-sm">{evento.nombrePareja || evento.nombre}</p>
                    <p className="text-xs text-muted-foreground">{evento.tipoEvento || "-"}</p>
                  </TableCell>
                  <TableCell className="text-sm">{formatFecha(evento.fecha)}</TableCell>
                  <TableCell className="text-sm">{evento.salon || "-"}</TableCell>
                  <TableCell className="text-sm">{getTotalInvitados(evento)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground gap-1.5"
                      onClick={() => setReabrirId(evento.id)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reabrir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog reabrir */}
      <AlertDialog open={!!reabrirId} onOpenChange={(o) => { if (!o) setReabrirId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reabrir Evento</AlertDialogTitle>
            <AlertDialogDescription>
              El evento volvera a la lista activa con estado "En Preparacion". Podras editarlo normalmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReabrir}>
              Si, Reabrir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
