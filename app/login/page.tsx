"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { PERFILES, useProfile } from "@/lib/profile-context"

export default function LoginPage() {
  const router = useRouter()
  const { seleccionarPerfil } = useProfile()

  const [pinsGuardados, setPinsGuardados] = useState<Record<string, boolean>>({})
  const [perfilSeleccionado, setPerfilSeleccionado] = useState<string | null>(null)
  const [pinInput, setPinInput] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    const guardados: Record<string, boolean> = {}
    PERFILES.forEach((p) => {
      try {
        const pin = localStorage.getItem(`pin_guardado_${p.id}`)
        guardados[p.id] = pin === p.pin
      } catch {
        guardados[p.id] = false
      }
    })
    setPinsGuardados(guardados)
  }, [])

  const handleCardClick = (id: string) => {
    if (pinsGuardados[id]) {
      const perfil = PERFILES.find((p) => p.id === id)!
      const ok = seleccionarPerfil(id, perfil.pin)
      if (ok) router.push("/")
    } else {
      setPerfilSeleccionado(id)
      setPinInput("")
      setError("")
    }
  }

  const handleIngresar = () => {
    if (!perfilSeleccionado) return
    const ok = seleccionarPerfil(perfilSeleccionado, pinInput)
    if (ok) {
      router.push("/")
    } else {
      setError("PIN incorrecto")
    }
  }

  const handleOlvidarPins = () => {
    PERFILES.forEach((p) => {
      try {
        localStorage.removeItem(`pin_guardado_${p.id}`)
      } catch {}
    })
    setPinsGuardados({})
    setPerfilSeleccionado(null)
    setPinInput("")
    setError("")
  }

  const perfilActual = PERFILES.find((p) => p.id === perfilSeleccionado)

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ backgroundColor: "#0f1923" }}
    >
      {/* Logo */}
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-white tracking-tight">Los Jazmines</h1>
        <p className="text-white/50 text-sm mt-1 tracking-widest uppercase">Sistema</p>
      </div>

      {/* Grid de perfiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full max-w-2xl">
        {PERFILES.map((perfil) => {
          const pinGuardado = pinsGuardados[perfil.id]
          const esSeleccionado = perfilSeleccionado === perfil.id && !pinGuardado

          return (
            <div key={perfil.id} className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => handleCardClick(perfil.id)}
                className="group relative flex flex-col items-center gap-3 w-full focus:outline-none"
              >
                {/* Circulo con emoji */}
                <div
                  className="relative w-24 h-24 rounded-2xl flex items-center justify-center text-4xl transition-transform duration-200 group-hover:scale-105 group-active:scale-95 shadow-lg"
                  style={{ backgroundColor: perfil.color }}
                >
                  <span role="img" aria-label={perfil.nombre}>{perfil.emoji}</span>
                  {/* Check verde si PIN guardado */}
                  {pinGuardado && (
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shadow-md">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  {/* Borde resaltado si seleccionado */}
                  {esSeleccionado && (
                    <div className="absolute inset-0 rounded-2xl ring-2 ring-white/80" />
                  )}
                </div>
                <span className="text-white/90 text-sm font-medium">{perfil.nombre}</span>
              </button>

              {/* Input PIN inline si seleccionado */}
              {esSeleccionado && (
                <div className="w-full flex flex-col items-center gap-2 mt-1">
                  <input
                    type="password"
                    maxLength={6}
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value.replace(/\D/g, ""))
                      setError("")
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleIngresar()}
                    placeholder="PIN"
                    autoFocus
                    className="w-full text-center rounded-lg px-3 py-2 text-sm bg-white/10 text-white placeholder-white/30 border border-white/20 focus:outline-none focus:border-white/50 tracking-widest"
                  />
                  {error && <p className="text-red-400 text-xs">{error}</p>}
                  <button
                    type="button"
                    onClick={handleIngresar}
                    className="w-full rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors"
                    style={{ backgroundColor: perfilActual?.color }}
                  >
                    Ingresar
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Pie */}
      <div className="mt-16">
        <button
          type="button"
          onClick={handleOlvidarPins}
          className="text-white/30 text-xs hover:text-white/60 transition-colors underline underline-offset-2"
        >
          Olvidar todos los PINs
        </button>
      </div>
    </div>
  )
}
