"use client"

// La maqueta 3D de la vista de Clientes (ver components/clientes/maqueta).
//
// El motor (three.js) se baja aparte, recién cuando hace falta, y hay uno solo
// para toda la página: cada <Maqueta3D> le presta su lugar y el lienzo se muda
// (portada → pasos → "Tu fiesta está lista") sin crear otro WebGL.
// Si el navegador no puede dibujar 3D, avisa con onFalla y la pantalla sigue
// sin maqueta, como antes.
// Con onTocar, un toque corto (no un arrastre para girarla) la abre a
// pantalla completa; el lienzo se agranda solo (el motor mira el tamaño).

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react"
import type { EstadoMaqueta } from "@/lib/clientes-maqueta"
import type { Foco, MotorMaqueta } from "./maqueta/motor"

type ModuloMotor = typeof import("./maqueta/motor")

let modulo: Promise<ModuloMotor> | null = null
let motor: MotorMaqueta | null = null
let sinWebGL = false
let usos = 0
let cierre: ReturnType<typeof setTimeout> | null = null

/** Empieza a bajar el 3D sin mostrar nada (para que esté listo al empezar). */
export function precargarMaqueta() {
  if (typeof window === "undefined" || sinWebGL) return
  modulo ??= import("./maqueta/motor")
}

async function obtenerMotor(familia: string): Promise<{ motor: MotorMaqueta | null; m: ModuloMotor | null }> {
  if (sinWebGL) return { motor: null, m: null }
  precargarMaqueta()
  const m = await (modulo as Promise<ModuloMotor>)
  if (!motor) {
    const reducido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
    motor = m.crearMotor({ reducido, familia })
    if (!motor) sinWebGL = true
  }
  return { motor, m }
}

export interface ManejoMaqueta {
  /** Foto de la maqueta como está ahora (JPG), o null si no hay maqueta. */
  foto(): string | null
  /** La caja de la maqueta (para ponerla a pantalla completa). */
  elemento(): HTMLDivElement | null
}

/** Un toque y no un arrastre: poco movimiento y poco tiempo. */
const TOQUE_PX = 10
const TOQUE_MS = 450

export const Maqueta3D = forwardRef<
  ManejoMaqueta,
  {
    estado: EstadoMaqueta
    /** Adónde mira la cámara (un plano de motor.ts; si no existe, la isla). */
    foco: string
    descripcion: string
    className?: string
    onFalla?: () => void
    /** Un toque corto sobre la maqueta (no un arrastre). */
    onTocar?: () => void
    /** Lo que va encima de la maqueta (la guirnalda de pasos, avisos). */
    children?: ReactNode
  }
>(function Maqueta3D({ estado, foco, descripcion, className, onFalla, onTocar, children }, ref) {
  const caja = useRef<HTMLDivElement>(null)
  const exterior = useRef<HTMLDivElement>(null)
  const toque = useRef<{ x: number; y: number; t: number; id: number } | null>(null)
  const [listo, setListo] = useState(false)
  const modRef = useRef<ModuloMotor | null>(null)
  const ultimo = useRef({ estado, foco })
  ultimo.current = { estado, foco }
  const falla = useRef(onFalla)
  falla.current = onFalla

  const focoValido = (f: string): Foco => (modRef.current?.esFoco(f) ? f : "isla")

  useEffect(() => {
    let vivo = true
    usos++
    if (cierre) {
      clearTimeout(cierre)
      cierre = null
    }
    const el = caja.current
    // La letra de los carteles: la de la vista de Clientes (Bodoni Moda).
    const familia = (el && getComputedStyle(el).getPropertyValue("--font-fiesta").trim()) || "Georgia, serif"
    ;(async () => {
      try {
        const { motor: mo, m } = await obtenerMotor(familia)
        if (!vivo || !el) return
        if (!mo || !m) {
          falla.current?.()
          return
        }
        modRef.current = m
        try {
          await document.fonts?.load(`500 40px ${familia}`)
        } catch {
          // Sin la letra, los carteles salen con la de reserva.
        }
        if (!vivo) return
        mo.onFalla = () => {
          sinWebGL = true
          falla.current?.()
        }
        mo.montar(el)
        mo.actualizar(ultimo.current.estado, focoValido(ultimo.current.foco))
        setListo(true)
      } catch {
        if (vivo) falla.current?.()
      }
    })()
    return () => {
      vivo = false
      motor?.desmontar(el)
      usos--
      if (usos <= 0) {
        // Si en un rato nadie la vuelve a usar (se fue de la página), se libera.
        cierre = setTimeout(() => {
          if (usos <= 0 && motor) {
            motor.destruir()
            motor = null
          }
        }, 4000)
      }
    }
    // Solo al montar: los cambios de estado van por el efecto de abajo.
  }, [])

  useEffect(() => {
    if (listo) motor?.actualizar(estado, focoValido(foco))
  }, [listo, estado, foco])

  useImperativeHandle(ref, () => ({ foto: () => (listo && motor ? motor.foto() : null), elemento: () => exterior.current }), [listo])

  return (
    <div ref={exterior} className={className}>
      <div
        ref={caja}
        role="img"
        aria-label={descripcion}
        data-foco={foco}
        onPointerDown={onTocar ? (e) => (toque.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId }) : undefined}
        onPointerUp={
          onTocar
            ? (e) => {
                const t = toque.current
                toque.current = null
                if (!t || t.id !== e.pointerId) return
                if (Math.hypot(e.clientX - t.x, e.clientY - t.y) <= TOQUE_PX && e.timeStamp - t.t <= TOQUE_MS) onTocar()
              }
            : undefined
        }
        onPointerCancel={onTocar ? () => (toque.current = null) : undefined}
        className={`absolute inset-0 transition-opacity duration-700 ${listo ? "opacity-100" : "opacity-0"}`}
        style={{ touchAction: "pan-y" }}
      />
      {children}
    </div>
  )
})
