"use client"

import { useEffect, useState } from "react"
import { useProfile } from "@/lib/profile-context"

const STORAGE_KEY = "jazmines_welcome_dismissed"

// Piezas de confeti para el festejo de Leila (rosa, azul y dorado)
const CONFETI = [
  { left: "6%", delay: "0s", color: "#e91e8c", size: 10 },
  { left: "14%", delay: "0.5s", color: "#c9a227", size: 8 },
  { left: "22%", delay: "0.2s", color: "#2563eb", size: 9 },
  { left: "30%", delay: "0.9s", color: "#e91e8c", size: 7 },
  { left: "38%", delay: "0.35s", color: "#c9a227", size: 11 },
  { left: "46%", delay: "0.7s", color: "#2563eb", size: 8 },
  { left: "54%", delay: "0.15s", color: "#e91e8c", size: 9 },
  { left: "62%", delay: "0.55s", color: "#c9a227", size: 10 },
  { left: "70%", delay: "0.05s", color: "#2563eb", size: 7 },
  { left: "78%", delay: "0.8s", color: "#e91e8c", size: 11 },
  { left: "86%", delay: "0.4s", color: "#c9a227", size: 8 },
  { left: "94%", delay: "0.65s", color: "#2563eb", size: 9 },
]

// Brillos que titilan alrededor del mensaje de Leila
const BRILLOS = [
  { top: "8%", left: "12%", delay: "0s", size: 16 },
  { top: "16%", left: "84%", delay: "0.6s", size: 12 },
  { top: "38%", left: "5%", delay: "1.1s", size: 10 },
  { top: "30%", left: "92%", delay: "0.3s", size: 14 },
  { top: "70%", left: "10%", delay: "0.9s", size: 12 },
  { top: "78%", left: "88%", delay: "0.45s", size: 16 },
  { top: "55%", left: "94%", delay: "1.3s", size: 9 },
  { top: "60%", left: "4%", delay: "0.2s", size: 11 },
]

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

  if (usuario === "Leila") {
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
        style={{ backgroundColor: "rgba(15,10,25,0.82)", backdropFilter: "blur(5px)" }}
      >
        <style>{`
          @keyframes lj-confeti-caida {
            0% { transform: translateY(-12vh) rotate(0deg); opacity: 1; }
            100% { transform: translateY(112vh) rotate(720deg); opacity: 0.85; }
          }
          @keyframes lj-brillo-titileo {
            0%, 100% { opacity: 0; transform: scale(0.5) rotate(0deg); }
            50% { opacity: 1; transform: scale(1.15) rotate(20deg); }
          }
          @keyframes lj-entrada-festejo {
            0% { transform: scale(0.6); opacity: 0; }
            60% { transform: scale(1.06); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes lj-titulo-brillo {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          @keyframes lj-halo-pulso {
            0%, 100% { box-shadow: 0 0 34px 4px rgba(201,162,39,0.35), 0 0 70px 8px rgba(233,30,140,0.18); }
            50% { box-shadow: 0 0 48px 10px rgba(201,162,39,0.55), 0 0 90px 16px rgba(37,99,235,0.25); }
          }
        `}</style>

        {/* Confeti de festejo */}
        {CONFETI.map((c, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="pointer-events-none absolute top-0 rounded-sm"
            style={{
              left: c.left,
              width: c.size,
              height: c.size * 0.45,
              backgroundColor: c.color,
              animation: `lj-confeti-caida 3.4s linear ${c.delay} infinite`,
            }}
          />
        ))}

        <div
          className="relative flex flex-col items-center gap-6 rounded-3xl px-10 py-12 text-center max-w-md w-full mx-4"
          style={{
            background: "linear-gradient(160deg, #fdf6ff 0%, #fff9ec 55%, #f0f5ff 100%)",
            border: "1.5px solid rgba(201,162,39,0.55)",
            animation: "lj-entrada-festejo 0.7s cubic-bezier(0.22, 1.2, 0.36, 1) both, lj-halo-pulso 2.6s ease-in-out infinite",
          }}
        >
          {/* Brillos titilantes */}
          {BRILLOS.map((b, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="pointer-events-none absolute"
              style={{
                top: b.top,
                left: b.left,
                fontSize: b.size,
                color: i % 3 === 0 ? "#c9a227" : i % 3 === 1 ? "#e91e8c" : "#2563eb",
                animation: `lj-brillo-titileo 1.8s ease-in-out ${b.delay} infinite`,
              }}
            >
              ✦
            </span>
          ))}

          <div className="text-5xl" aria-hidden="true">
            👑
          </div>

          <div className="space-y-3">
            <h2
              className="text-4xl font-extrabold tracking-wide text-balance"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #e91e8c 0%, #c9a227 35%, #2563eb 65%, #e91e8c 100%)",
                backgroundSize: "220% 100%",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                animation: "lj-titulo-brillo 3.2s ease-in-out infinite",
                textShadow: "0 0 26px rgba(201,162,39,0.25)",
              }}
            >
              HOLA LEILA!
            </h2>
            <p className="text-sm font-medium tracking-[0.28em] uppercase" style={{ color: "#a8892c" }}>
              Una alegría tenerte de vuelta
            </p>
            <p className="text-sm" style={{ color: "#6b5f7a" }}>
              El sistema brilla más cuando entrás vos ✨
            </p>
          </div>

          <button
            onClick={handleDismiss}
            className="text-5xl transition-transform duration-150 hover:scale-125 active:scale-95 focus:outline-none"
            title="Empezar"
            aria-label="Entrar al sistema"
          >
            💖
          </button>
          <p className="text-xs" style={{ color: "#b0a3c0" }}>
            Presioná el corazón para empezar
          </p>
        </div>
      </div>
    )
  }

  // Diego: el mensaje de siempre
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
    >
      <div className="flex flex-col items-center gap-6 rounded-2xl bg-white px-10 py-10 text-center shadow-2xl max-w-sm w-full mx-4">
        <div className="text-6xl">🌿</div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-[#2d5a3d]">Hola Diego,</h2>
          <p className="text-xl font-semibold text-gray-800">bienvenido!</p>
          <p className="text-gray-500 text-sm mt-1">te extrañamos!</p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-5xl transition-transform duration-150 hover:scale-125 active:scale-95 focus:outline-none"
          title="Empezar"
          aria-label="Entrar al sistema"
        >
          😊
        </button>
        <p className="text-xs text-gray-400">Presioná el emoji para empezar</p>
      </div>
    </div>
  )
}
