"use client"

import { useEffect } from "react"
import { Home, RefreshCw } from "lucide-react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Silenciar el error — no lo loguear en consola
  }, [error])

  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "sans-serif", backgroundColor: "#f8f8f6" }}>
        <div
          style={{
            display: "flex",
            minHeight: "100svh",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1.5rem",
              textAlign: "center",
              maxWidth: "20rem",
            }}
          >
            <div
              style={{
                display: "flex",
                height: "4rem",
                width: "4rem",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "9999px",
                backgroundColor: "#e5e7eb",
              }}
            >
              <RefreshCw style={{ height: "1.75rem", width: "1.75rem", color: "#6b7280" }} />
            </div>
            <div>
              <p style={{ margin: "0 0 0.25rem", fontSize: "0.875rem", fontWeight: 600, color: "#111827" }}>
                Algo no cargó bien
              </p>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "#6b7280", lineHeight: 1.6 }}>
                Podés intentar de nuevo o volver al inicio.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%" }}>
              <button
                onClick={reset}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #d1d5db",
                  backgroundColor: "white",
                  padding: "0.625rem 1rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  color: "#111827",
                }}
              >
                <RefreshCw style={{ height: "1rem", width: "1rem" }} />
                Intentar de nuevo
              </button>
              <button
                onClick={() => (window.location.href = "/")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  backgroundColor: "#1a3a2a",
                  padding: "0.625rem 1rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  color: "white",
                }}
              >
                <Home style={{ height: "1rem", width: "1rem" }} />
                Volver al inicio
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
