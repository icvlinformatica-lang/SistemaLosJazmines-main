"use client"

import { useEffect, useState } from "react"

const STORAGE_KEY = "jazmines_welcome_dismissed"

export function WelcomeModal() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const dismissed = sessionStorage.getItem(STORAGE_KEY)
    if (!dismissed) {
      setVisible(true)
    }
  }, [])

  const handleDismiss = () => {
    sessionStorage.setItem(STORAGE_KEY, "1")
    setVisible(false)
  }

  if (!visible) return null

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
