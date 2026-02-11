"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/eventos/calendario", label: "Calendario" },
  { href: "/admin/almacen", label: "Almacen Cocina" },
  { href: "/admin/barra", label: "Almacen Barra" },
  { href: "/admin/recetario", label: "Recetario" },
  { href: "/admin/cocteles", label: "Cocteles" },
  { href: "/admin/servicios", label: "Servicios" },
  { href: "/evento", label: "Planificador" },
  { href: "/configuracion", label: "Configuracion" },
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="no-print border-b border-border bg-background">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex h-14 items-center justify-between">
          <Link href="/" className="text-base font-medium">
            Los Jazmines Cocina
          </Link>

          <div className="flex items-center gap-6">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/")

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "text-sm transition-colors",
                    isActive ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}
