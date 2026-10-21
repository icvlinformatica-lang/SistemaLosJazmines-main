// Texturas dibujadas en un canvas para la maqueta 3D (vista de Clientes):
// el brillo de las lamparitas, el atril de la entrada, el cartel del salón,
// la pantalla LED, el cartel de neón y los pisos y paredes de cada salón (el
// plano, la madera, el parquet, el mármol, la terracota, la boiserie, la cal
// y el friso de madera) y la piedra blanca de la entrada de la Quinta. Todo se dibuja acá (sin imágenes que bajar), con la letra de la
// vista de Clientes (Bodoni Moda) cuando ya cargó.

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

// ── Pisos y paredes de cada salón ───────────────────────────────────────────
// Todo se dibuja acá (sin fotos que bajar). Las que se repiten son "baldosas"
// sin costura: lo que sale por un borde entra por el otro.

/** Números al azar que siempre salen iguales (para que no cambie el dibujo). */
function azarTex(semilla: number) {
  let s = semilla >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function repetida(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = textura(c)
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  return t
}

/** Manchas suaves repetidas por los bordes (para que no se note la costura). */
function manchas(g: CanvasRenderingContext2D, ancho: number, alto: number, cantidad: number, color: (a: () => number) => string, radio: [number, number], semilla: number) {
  const a = azarTex(semilla)
  for (let i = 0; i < cantidad; i++) {
    const x = a() * ancho
    const y = a() * alto
    const r = radio[0] + a() * (radio[1] - radio[0])
    g.fillStyle = color(a)
    for (const dx of [-ancho, 0, ancho]) {
      for (const dy of [-alto, 0, alto]) {
        g.beginPath()
        g.arc(x + dx, y + dy, r, 0, Math.PI * 2)
        g.fill()
      }
    }
  }
}

/**
 * El plano de la isla (antes de elegir salón): verde oscuro con una grilla
 * dorada y, en punteado, dónde van a ir la pista, las mesas y las barras.
 * Cubre la isla entera (16 × 12 m, 64 px por metro).
 */
export function texturaPlano(
  mesas: Array<[number, number]>,
  pista: { x: number; z: number; ancho: number; fondo: number },
  barras: Array<{ x: number; z: number; giro: number }>,
): THREE.CanvasTexture {
  const PX = 64
  const { c, g } = lienzo(16 * PX, 12 * PX)
  const X = (x: number) => (x + 8) * PX
  const Z = (z: number) => (z + 6) * PX
  g.fillStyle = "#0f2419"
  g.fillRect(0, 0, c.width, c.height)
  const luz = g.createRadialGradient(c.width / 2, c.height * 0.55, 60, c.width / 2, c.height * 0.55, c.width * 0.62)
  luz.addColorStop(0, "rgba(52,96,66,0.42)")
  luz.addColorStop(1, "rgba(0,0,0,0)")
  g.fillStyle = luz
  g.fillRect(0, 0, c.width, c.height)
  // Grilla: cada medio metro, y más marcada cada dos.
  for (let m = 0; m <= 32; m++) {
    g.fillStyle = m % 4 === 0 ? "rgba(243,207,122,0.16)" : "rgba(243,207,122,0.06)"
    g.fillRect(m * 32 - 1, 0, m % 4 === 0 ? 2 : 1, c.height)
  }
  for (let m = 0; m <= 24; m++) {
    g.fillStyle = m % 4 === 0 ? "rgba(243,207,122,0.16)" : "rgba(243,207,122,0.06)"
    g.fillRect(0, m * 32 - 1, c.width, m % 4 === 0 ? 2 : 1)
  }
  // Marco y esquinas, como en un plano.
  g.strokeStyle = "rgba(243,207,122,0.5)"
  g.lineWidth = 3
  g.strokeRect(X(-7.55), Z(-5.55), 15.1 * PX, 11.1 * PX)
  g.lineWidth = 5
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const cx = X(sx * 7.55)
    const cz = Z(sz * 5.55)
    g.beginPath()
    g.moveTo(cx, cz - sz * 34)
    g.lineTo(cx, cz)
    g.lineTo(cx - sx * 34, cz)
    g.stroke()
  }
  // Lo que va a ir, en punteado.
  g.setLineDash([12, 9])
  g.lineWidth = 3
  g.strokeStyle = "rgba(248,242,228,0.42)"
  g.strokeRect(X(pista.x - pista.ancho / 2), Z(pista.z - pista.fondo / 2), pista.ancho * PX, pista.fondo * PX)
  g.strokeStyle = "rgba(243,207,122,0.4)"
  for (const [x, z] of mesas) {
    g.beginPath()
    g.arc(X(x), Z(z), 0.8 * PX, 0, Math.PI * 2)
    g.stroke()
  }
  for (const b of barras) {
    g.save()
    g.translate(X(b.x), Z(b.z))
    g.rotate(-b.giro)
    g.strokeRect(-1.2 * PX, -0.45 * PX, 2.4 * PX, 0.9 * PX)
    g.restore()
  }
  g.setLineDash([])
  return textura(c)
}

/** Piso de tablas de madera clara (2 × 2 m; tablas de 20 cm a lo largo). */
export function texturaMadera(): THREE.CanvasTexture {
  const { c, g } = lienzo(512, 512)
  const a = azarTex(5)
  const tonos = ["#b07f50", "#a47446", "#ba8a5b", "#9c6c40", "#aa7a4c"]
  const filas = 10
  const h = 512 / filas
  for (let f = 0; f < filas; f++) {
    // Tablas de largos distintos; la que pasa el borde sigue del otro lado.
    let x = a() * 512
    const fin = x + 512
    while (x < fin) {
      const largo = Math.min(fin - x, 150 + a() * 190)
      const tono = tonos[Math.floor(a() * tonos.length)]
      // Las vetas, iguales en las dos copias (la del borde y la de adentro).
      const vetas = [0, 1, 2, 3].map((k) => f * h + 6 + k * 11 + a() * 4)
      for (const dx of [0, -512]) {
        g.fillStyle = tono
        g.fillRect(x + dx, f * h, largo, h)
        g.strokeStyle = "rgba(92,58,30,0.16)"
        g.lineWidth = 1
        for (const y of vetas) {
          g.beginPath()
          g.moveTo(x + dx, y)
          g.bezierCurveTo(x + dx + largo * 0.3, y + 3, x + dx + largo * 0.6, y - 3, x + dx + largo, y + 1)
          g.stroke()
        }
        g.fillStyle = "rgba(60,38,20,0.55)"
        g.fillRect(x + dx, f * h, 2, h)
      }
      x += largo
    }
    g.fillStyle = "rgba(60,38,20,0.6)"
    g.fillRect(0, f * h, 512, 2)
  }
  return repetida(c)
}

/** Piso de mármol claro en baldosas de 1 m (la textura tiene 2 × 2 m). */
export function texturaMarmol(): THREE.CanvasTexture {
  const { c, g } = lienzo(512, 512)
  const a = azarTex(9)
  for (let ty = 0; ty < 2; ty++) {
    for (let tx = 0; tx < 2; tx++) {
      const x0 = tx * 256
      const y0 = ty * 256
      g.save()
      g.beginPath()
      g.rect(x0, y0, 256, 256)
      g.clip()
      const fondo = g.createLinearGradient(x0, y0, x0 + 256, y0 + 256)
      fondo.addColorStop(0, (tx + ty) % 2 ? "#e2d9c7" : "#e9e1d1")
      fondo.addColorStop(1, (tx + ty) % 2 ? "#d7ccb7" : "#dfd5c2")
      g.fillStyle = fondo
      g.fillRect(x0, y0, 256, 256)
      // Vetas: cada baldosa tiene las suyas.
      for (let k = 0; k < 5; k++) {
        g.strokeStyle = `rgba(126,112,92,${0.1 + a() * 0.16})`
        g.lineWidth = 0.8 + a() * 1.6
        g.beginPath()
        let px = x0 + a() * 256
        let py = y0 - 10
        g.moveTo(px, py)
        for (let s = 0; s < 6; s++) {
          const nx = px + (a() - 0.4) * 90
          const ny = py + 50 + a() * 20
          g.quadraticCurveTo(px + (a() - 0.5) * 80, (py + ny) / 2, nx, ny)
          px = nx
          py = ny
        }
        g.stroke()
      }
      g.restore()
    }
  }
  g.fillStyle = "rgba(176,141,42,0.55)"
  for (const p of [0, 255]) {
    g.fillRect(p, 0, 2, 512)
    g.fillRect(0, p, 512, 2)
  }
  return repetida(c)
}

/** Piso de baldosas de terracota (la textura tiene 1 × 1 m: 3 × 3 baldosas). */
export function texturaTerracota(): THREE.CanvasTexture {
  const { c, g } = lienzo(256, 256)
  const a = azarTex(15)
  const lado = 256 / 3
  g.fillStyle = "#6f4430"
  g.fillRect(0, 0, 256, 256)
  const tonos = ["#b5653f", "#a95b37", "#bd7149", "#a4593a", "#b86a42"]
  for (let f = 0; f < 3; f++) {
    for (let k = 0; k < 3; k++) {
      const x = k * lado + 2
      const y = f * lado + 2
      const l = lado - 4
      g.fillStyle = tonos[Math.floor(a() * tonos.length)]
      g.fillRect(x, y, l, l)
      const sombra = g.createRadialGradient(x + l / 2, y + l / 2, l * 0.2, x + l / 2, y + l / 2, l * 0.75)
      sombra.addColorStop(0, "rgba(255,220,180,0.10)")
      sombra.addColorStop(1, "rgba(60,30,15,0.22)")
      g.fillStyle = sombra
      g.fillRect(x, y, l, l)
    }
  }
  return repetida(c)
}

/**
 * Pared con boiserie (salón elegante): crema, con un zócalo de paneles, una
 * moldura dorada y un panel alto. Un tramo de 2 m de ancho por el alto entero.
 */
export function texturaBoiserie(): THREE.CanvasTexture {
  const PX = 256
  const { c, g } = lienzo(2 * PX, 3 * PX)
  const Y = (m: number) => (3 - m) * PX
  g.fillStyle = "#eee6d6"
  g.fillRect(0, 0, c.width, c.height)
  const panel = (x0: number, y0: number, x1: number, y1: number) => {
    g.fillStyle = "rgba(255,252,244,0.5)"
    g.fillRect(x0 * PX, Y(y1), (x1 - x0) * PX, (y1 - y0) * PX)
    g.lineWidth = 3
    g.strokeStyle = "rgba(122,100,70,0.38)"
    g.strokeRect(x0 * PX + 2, Y(y1) + 2, (x1 - x0) * PX, (y1 - y0) * PX)
    g.strokeStyle = "rgba(255,255,252,0.95)"
    g.strokeRect(x0 * PX, Y(y1), (x1 - x0) * PX, (y1 - y0) * PX)
  }
  panel(0.16, 0.16, 1.84, 0.8)
  panel(0.22, 1.14, 1.78, 2.62)
  g.fillStyle = "#c9a227"
  g.fillRect(0, Y(0.97), c.width, 5)
  g.fillStyle = "rgba(122,100,70,0.3)"
  g.fillRect(0, Y(0.97) + 5, c.width, 3)
  g.fillStyle = "#e3d8c3"
  g.fillRect(0, 0, c.width, Y(2.86))
  return repetida(c)
}

/** Pared revocada a la cal, blanca y cálida (la textura tiene 1 × 1 m). */
export function texturaRevoque(): THREE.CanvasTexture {
  const { c, g } = lienzo(256, 256)
  g.fillStyle = "#ece3d1"
  g.fillRect(0, 0, 256, 256)
  manchas(g, 256, 256, 90, (r) => `rgba(${r() > 0.5 ? "255,250,240" : "190,170,140"},${0.05 + r() * 0.07})`, [6, 22], 31)
  manchas(g, 256, 256, 200, (r) => `rgba(150,130,100,${0.04 + r() * 0.05})`, [0.6, 1.6], 32)
  return repetida(c)
}

/**
 * Pared de la Quinta: blanca, con un friso de tablas de madera hasta 1,1 m y
 * una moldura de madera arriba del friso (las fotos del 19/10/2026: paredes
 * blancas y todo el salón con estética de madera). Un tramo de 2 m de ancho
 * por el alto entero de la pared (`alto`, en metros).
 */
export function texturaFrisoMadera(alto: number): THREE.CanvasTexture {
  const PX = 256
  const { c, g } = lienzo(2 * PX, Math.round(alto * PX))
  const Y = (m: number) => (alto - m) * PX
  const a = azarTex(41)
  // Arriba, revoque blanco apenas cálido.
  g.fillStyle = "#efe9df"
  g.fillRect(0, 0, c.width, c.height)
  manchas(g, c.width, c.height, 120, (r) => `rgba(${r() > 0.5 ? "255,253,248" : "200,186,165"},${0.04 + r() * 0.05})`, [8, 26], 42)
  // El friso: 16 tablas verticales de 12,5 cm (así el tramo se repite sin costura).
  const tonos = ["#9a6a42", "#8f6039", "#a5734a", "#94653e", "#a06e45"]
  const arriba = Y(1.05)
  const tabla = c.width / 16
  for (let k = 0; k < 16; k++) {
    const x = k * tabla
    g.fillStyle = tonos[Math.floor(a() * tonos.length)]
    g.fillRect(x, arriba, tabla, c.height - arriba)
    // Vetas a lo largo de la tabla.
    g.strokeStyle = "rgba(70,42,20,0.18)"
    g.lineWidth = 1
    for (let v = 0; v < 3; v++) {
      const vx = x + 5 + v * 9 + a() * 4
      g.beginPath()
      g.moveTo(vx, arriba)
      g.bezierCurveTo(vx + 3, arriba + 60, vx - 3, arriba + 150, vx + 1, c.height)
      g.stroke()
    }
    // La junta del machimbre.
    g.fillStyle = "rgba(48,28,14,0.6)"
    g.fillRect(x, arriba, 2, c.height - arriba)
  }
  // La moldura de arriba del friso: madera más oscura con un filo de luz.
  g.fillStyle = "#5e3d25"
  g.fillRect(0, Y(1.12), c.width, Y(1.05) - Y(1.12))
  g.fillStyle = "rgba(255,226,180,0.35)"
  g.fillRect(0, Y(1.12), c.width, 3)
  g.fillStyle = "rgba(40,24,12,0.35)"
  g.fillRect(0, Y(1.05) - 3, c.width, 3)
  return repetida(c)
}

/** Parquet en punta de Hungría (las tablitas forman una V), madera cálida. La
 *  textura tiene 2 × 2 m: 8 columnas de 25 cm. */
export function texturaParquet(): THREE.CanvasTexture {
  const { c, g } = lienzo(512, 512)
  const tonos = ["#a0703f", "#94663a", "#ab7a48", "#8c5f35", "#9a6a3c", "#a7764a"]
  const col = 64
  const paso = 32
  // El tono de cada tablita depende de su columna y de su lugar en la vuelta
  // (16 por columna), así la de arriba y la de abajo empalman sin costura.
  const tono = (j: number, k: number) => {
    const m = ((k % 16) + 16) % 16
    const h = Math.sin((j + 1) * 12.9898 + (m + 1) * 78.233) * 43758.5453
    return tonos[Math.floor((h - Math.floor(h)) * tonos.length)]
  }
  for (let j = 0; j < 8; j++) {
    const x0 = j * col
    const x1 = x0 + col
    // Las columnas pares suben hacia la derecha y las impares bajan: la V.
    const y = (x: number, k: number) => (j % 2 === 0 ? x - x0 : x1 - x) + k * paso
    g.save()
    g.beginPath()
    g.rect(x0, 0, col, 512)
    g.clip()
    for (let k = -3; k <= 17; k++) {
      g.fillStyle = tono(j, k)
      g.beginPath()
      g.moveTo(x0, y(x0, k))
      g.lineTo(x1, y(x1, k))
      g.lineTo(x1, y(x1, k + 1))
      g.lineTo(x0, y(x0, k + 1))
      g.closePath()
      g.fill()
      // Una veta por tablita y la junta con la siguiente.
      g.strokeStyle = "rgba(70,42,20,0.16)"
      g.lineWidth = 1
      g.beginPath()
      g.moveTo(x0, y(x0, k) + paso * 0.55)
      g.lineTo(x1, y(x1, k) + paso * 0.55)
      g.stroke()
      g.strokeStyle = "rgba(52,30,14,0.55)"
      g.lineWidth = 1.5
      g.beginPath()
      g.moveTo(x0, y(x0, k))
      g.lineTo(x1, y(x1, k))
      g.stroke()
    }
    g.restore()
    g.fillStyle = "rgba(52,30,14,0.6)"
    g.fillRect(x0, 0, 1.5, 512)
  }
  return repetida(c)
}

/** Piedra partida blanca (la entrada de la Quinta). La textura tiene 1 × 1 m. */
export function texturaGrava(): THREE.CanvasTexture {
  const { c, g } = lienzo(256, 256)
  g.fillStyle = "#d6d1c6"
  g.fillRect(0, 0, 256, 256)
  manchas(g, 256, 256, 900, (r) => `rgba(${r() > 0.45 ? "250,248,242" : "150,142,128"},${0.35 + r() * 0.4})`, [0.8, 2.4], 51)
  manchas(g, 256, 256, 260, (r) => `rgba(110,102,90,${0.2 + r() * 0.25})`, [0.5, 1.2], 52)
  return repetida(c)
}
