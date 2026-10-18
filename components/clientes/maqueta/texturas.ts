// Texturas dibujadas en un canvas para la maqueta 3D (vista de Clientes):
// el brillo de las lamparitas, el atril de la entrada, el cartel de la casa,
// la pantalla LED y el cartel de neón. Todo se dibuja acá (sin imágenes que
// bajar), con la letra de la vista de Clientes (Bodoni Moda) cuando ya cargó.

import * as THREE from "three"

function lienzo(ancho: number, alto: number) {
  const c = document.createElement("canvas")
  c.width = ancho
  c.height = alto
  const g = c.getContext("2d")
  if (!g) throw new Error("canvas 2d")
  return { c, g }
}

function textura(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Brillo redondo: centro blanco que se apaga hacia el borde. */
export function texturaHalo(): THREE.CanvasTexture {
  const { c, g } = lienzo(64, 64)
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  r.addColorStop(0, "rgba(255,255,255,1)")
  r.addColorStop(0.08, "rgba(255,255,255,0.9)")
  r.addColorStop(0.2, "rgba(255,255,255,0.34)")
  r.addColorStop(0.45, "rgba(255,255,255,0.08)")
  r.addColorStop(1, "rgba(255,255,255,0)")
  g.fillStyle = r
  g.fillRect(0, 0, 64, 64)
  return textura(c)
}

/** Sombra suave para apoyar los objetos en el pasto. */
export function texturaSombra(): THREE.CanvasTexture {
  const { c, g } = lienzo(64, 64)
  const r = g.createRadialGradient(32, 32, 4, 32, 32, 32)
  r.addColorStop(0, "rgba(0,0,0,0.55)")
  r.addColorStop(1, "rgba(0,0,0,0)")
  g.fillStyle = r
  g.fillRect(0, 0, 64, 64)
  return textura(c)
}

/** Achica la letra hasta que el texto entre en el ancho. */
function ajustar(g: CanvasRenderingContext2D, texto: string, peso: number, tam: number, familia: string, ancho: number) {
  let t = tam
  g.font = `${peso} ${t}px ${familia}`
  while (g.measureText(texto).width > ancho && t > 12) {
    t -= 2
    g.font = `${peso} ${t}px ${familia}`
  }
  return t
}

function primeraMayuscula(s: string) {
  return s ? s.charAt(0).toLocaleUpperCase("es") + s.slice(1) : s
}

/** Atril de la entrada: pizarra verde con marco dorado, el título y la fecha. */
export function texturaCartel(titulo: string, fecha: string | null, familia: string): THREE.CanvasTexture {
  const { c, g } = lienzo(512, 384)
  g.fillStyle = "#16301f"
  g.fillRect(0, 0, 512, 384)
  g.strokeStyle = "rgba(243,207,122,0.85)"
  g.lineWidth = 4
  g.strokeRect(22, 22, 468, 340)
  g.strokeStyle = "rgba(243,207,122,0.35)"
  g.lineWidth = 2
  g.strokeRect(34, 34, 444, 316)
  g.textAlign = "center"
  g.textBaseline = "middle"
  g.fillStyle = "#f8f2e4"
  ajustar(g, titulo, 500, 92, familia, 420)
  g.fillText(titulo, 256, fecha ? 158 : 192)
  if (fecha) {
    g.fillStyle = "#f3cf7a"
    const f = primeraMayuscula(fecha)
    ajustar(g, f, 500, 40, familia, 420)
    g.fillText(f, 256, 268)
  }
  return textura(c)
}

/** Cartel de la casa: el nombre del salón en letras claras. */
export function texturaLetrero(nombre: string, familia: string): THREE.CanvasTexture {
  const { c, g } = lienzo(512, 128)
  g.clearRect(0, 0, 512, 128)
  g.textAlign = "center"
  g.textBaseline = "middle"
  g.shadowColor = "rgba(243,207,122,0.9)"
  g.shadowBlur = 14
  g.fillStyle = "#fff6e0"
  ajustar(g, nombre, 500, 78, familia, 470)
  g.fillText(nombre, 256, 66)
  return textura(c)
}

/** Cartel de neón: el texto en tubos que brillan. */
export function texturaNeon(texto: string, color: string, familia: string): THREE.CanvasTexture {
  const { c, g } = lienzo(512, 256)
  g.clearRect(0, 0, 512, 256)
  g.textAlign = "center"
  g.textBaseline = "middle"
  ajustar(g, texto, 600, 118, familia, 450)
  g.lineJoin = "round"
  // Tres pasadas: el resplandor, el tubo y el centro casi blanco.
  g.shadowColor = color
  g.shadowBlur = 34
  g.strokeStyle = color
  g.lineWidth = 9
  g.strokeText(texto, 256, 132)
  g.shadowBlur = 12
  g.lineWidth = 5
  g.strokeText(texto, 256, 132)
  g.shadowBlur = 0
  g.strokeStyle = "rgba(255,250,240,0.95)"
  g.lineWidth = 1.6
  g.strokeText(texto, 256, 132)
  return textura(c)
}

/**
 * Pantalla LED: un canvas que se vuelve a pintar unas 20 veces por segundo,
 * con ondas de color del festejo, la palabra en el medio y la grilla de LEDs.
 */
export class PantallaLed {
  readonly textura: THREE.CanvasTexture
  private readonly g: CanvasRenderingContext2D
  private readonly grilla: HTMLCanvasElement
  private acumulado = 0
  palabra = ""
  paleta: string[] = ["#f3cf7a", "#2f8f5b", "#f8f2e4"]

  constructor(private readonly familia: string) {
    const { c, g } = lienzo(256, 144)
    this.g = g
    this.textura = textura(c)
    const rejilla = lienzo(256, 144)
    rejilla.g.fillStyle = "rgba(0,0,0,0.38)"
    for (let x = 0; x < 256; x += 4) rejilla.g.fillRect(x, 0, 1, 144)
    for (let y = 0; y < 144; y += 4) rejilla.g.fillRect(0, y, 256, 1)
    this.grilla = rejilla.c
    this.pintar(0)
  }

  /** Se llama en cada cuadro; repinta solo cada 50 ms. */
  avanzar(dt: number, t: number) {
    this.acumulado += dt
    if (this.acumulado < 0.05) return
    this.acumulado = 0
    this.pintar(t)
  }

  pintar(t: number) {
    const g = this.g
    g.fillStyle = "#04080a"
    g.fillRect(0, 0, 256, 144)
    const colores = this.paleta.length ? this.paleta : ["#f3cf7a"]
    for (let i = 0; i < 5; i++) {
      const color = colores[i % colores.length]
      const fase = t * (0.6 + i * 0.13) + i * 1.7
      const x = 128 + Math.sin(fase) * 110
      const y = 72 + Math.cos(fase * 0.8) * 50
      const r = g.createRadialGradient(x, y, 0, x, y, 95)
      r.addColorStop(0, color)
      r.addColorStop(1, "rgba(0,0,0,0)")
      g.globalAlpha = 0.55
      g.fillStyle = r
      g.fillRect(0, 0, 256, 144)
    }
    g.globalAlpha = 1
    if (this.palabra) {
      g.textAlign = "center"
      g.textBaseline = "middle"
      const latido = 1 + Math.sin(t * 2.4) * 0.04
      g.save()
      g.translate(128, 76)
      g.scale(latido, latido)
      ajustar(g, this.palabra, 600, 74, this.familia, 220)
      g.shadowColor = "rgba(255,240,200,0.9)"
      g.shadowBlur = 16
      g.fillStyle = "#fffaf0"
      g.fillText(this.palabra, 0, 0)
      g.restore()
    }
    g.drawImage(this.grilla, 0, 0)
    this.textura.needsUpdate = true
  }

  liberar() {
    this.textura.dispose()
  }
}
