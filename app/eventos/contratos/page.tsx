"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, FileText, Clock } from "lucide-react"

export default function ContratosPage() {
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

      <main className="mx-auto max-w-4xl px-6 py-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-24 text-center">
            <div className="rounded-full bg-muted p-6 mb-6">
              <Clock className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Proximamente</h2>
            <p className="text-muted-foreground max-w-md">
              Aqui podras gestionar los contratos de cada evento, generar documentos y llevar un registro de los acuerdos con tus clientes.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
