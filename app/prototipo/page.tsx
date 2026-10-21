"use client"

// Entrada del link del prototipo (lib/link-prototipo.ts): guarda el acceso
// rápido del perfil "clientes" que trae el link y entra por el login de
// siempre. Si el link venció o está roto, lo dice; nunca abre otro perfil.

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useProfile } from "@/lib/profile-context"
import { PERFIL_LINK_PROTOTIPO, tokenDeLinkPrototipo } from "@/lib/link-prototipo"

export default function PrototipoPage() {
  const router = useRouter()
  const { seleccionarPerfilRapido } = useProfile()
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelado = false
    const token = tokenDeLinkPrototipo(window.location.hash)
    if (!token) {
      setError(true)
      return
    }
    try {
      localStorage.setItem(`acceso_rapido_${PERFIL_LINK_PROTOTIPO}`, token)
    } catch {}
    seleccionarPerfilRapido(PERFIL_LINK_PROTOTIPO).then((ok) => {
      if (cancelado) return
      if (ok) router.replace("/clientes")
      else setError(true)
    })
    return () => {
      cancelado = true
    }
    // Solo al abrir el link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex min-h-svh items-center justify-center bg-[#0d1d14] px-6 text-center text-[#f5f0e8]">
      {error ? (
        <div className="max-w-sm">
          <p className="text-[22px]">Este link ya no sirve</p>
          <p className="mt-2 text-[15px] text-[#f5f0e8]/70">Venció o está incompleto. Pedí uno nuevo a Los Jazmines.</p>
        </div>
      ) : (
        <Loader2 className="h-7 w-7 animate-spin text-[#f3cf7a]" aria-label="Abriendo el simulador" />
      )}
    </div>
  )
}
