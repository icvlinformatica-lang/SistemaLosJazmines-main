"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PapeleraVendedor } from "@/components/papelera-vendedor"

export default function PapeleraVendedorPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3 sm:px-6 sticky top-0 z-40">
        <div className="mx-auto max-w-4xl flex items-center gap-3">
          <Link href="/vendedor/paquetes" className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">Mi papelera</h1>
            <p className="text-xs text-muted-foreground">Lo que borraste vos en Cotizar y Paquetes</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <PapeleraVendedor modo="personal" />
      </main>
    </div>
  )
}
