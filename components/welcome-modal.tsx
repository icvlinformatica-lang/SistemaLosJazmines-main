"use client"

import { useEffect, useState } from "react"
import { useProfile } from "@/lib/profile-context"

const STORAGE_KEY = "jazmines_welcome_dismissed"

export function WelcomeModal() {
  const { perfilActivo } = useProfile()
  const [visible, setVisible] = useState(false)
  const [usuario, setUsuario] = useState<string | null>(null)

  useEffect(() => {
    // Solo desde Administración: Diego ve su mensaje, Leila el suyo.
    if (perfilActivo?.id !== "administracion") return
    let nombre: string | null = null
    try {
      nombre = sessionStorage.getItem("admin_usuario")
    } catch {}
    if (nombre !== "Diego" && nombre !== "Leila") return
    let dismissed: string | null = null
    try {
      dismissed = sessionStorage.getItem(STORAGE_KEY)
    } catch {}
    if (!dismissed) {
      setUsuario(nombre)
      setVisible(true)
    }
  }, [perfilActivo])

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1")
    } catch {}
    setVisible(false)
  }

  if (!visible || !usuario) return null

  // Tarjeta de bienvenida profesional, idéntica para Diego y Leila
  const saludo = usuario === "Leila" ? "bienvenida!" : "bienvenido!"

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div className="flex flex-col items-center gap-6 rounded-2xl bg-white px-10 py-10 text-center shadow-2xl max-w-sm w-full mx-4">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-semibold text-white"
          style={{ backgroundColor: "#2d5a3d" }}
          aria-hidden="true"
        >
          {usuario.charAt(0)}
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-[#2d5a3d]">Hola {usuario},</h2>
          <p className="text-xl font-semibold text-gray-800">{saludo}</p>
          <p className="text-gray-500 text-sm mt-1">Que tengas una buena jornada.</p>
        </div>
        <button
          onClick={handleDismiss}
          className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{ backgroundColor: "#2d5a3d" }}
        >
          Ingresar
        </button>
      </div>
    </div>
  )
}
