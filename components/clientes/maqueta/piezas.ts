// Piezas de la maqueta 3D (vista de Clientes): la isla del jardín, la casa,
// la guirnalda, las mesas con la gente, las barras y cada adicional que se
// puede sumar. Todo con formas simples (sin modelos que bajar), en metros:
// la isla mide 16 × 12, el frente mira hacia +z y el piso está en y = 0.
//
// Lo compartido (materiales, texturas y geometrías que se repiten) vive en
// Kit y se libera una sola vez, al cerrar la maqueta.

import * as THREE from "three"
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js"
import { PantallaLed, texturaCartel, texturaHalo, texturaLetrero, texturaNeon, texturaSombra } from "./texturas"
import { SEPARACION_LETRAS, anchoLetra, formaLetra } from "./letras"

export const ISLA = { ancho: 16, fondo: 12 }

/** Dónde va cada cosa en la isla (x, z) y hacia dónde mira (giro en y). */
export const LUGARES = {
  casa: { x: -5.6, z: -4.6 },
  dj: { x: 0, z: -4.25 },
  pantalla: { x: 0, z: -5.15 },
  shimmer: { x: 5.3, z: -4.95 },
  altar: { x: 3.0, z: -4.5 },
  pista: { x: 0, z: -2.0, ancho: 4.0, fondo: 3.0 },
  barras: [
    { x: -6.75, z: -1.1, giro: Math.PI / 2 },
    { x: 6.75, z: -1.1, giro: -Math.PI / 2 },
  ],
  mesaDulce: { x: 6.95, z: 2.2, giro: -Math.PI / 2 },
  plataforma360: { x: 5.45, z: 4.65 },
  letras: { x: -6.6, z: 4.95 },
  entrada: { x: 0, z: 5.3 },
  cartel: { x: 1.75, z: 5.0, giro: -0.22 },
  fotografia: { x: 1.55, z: -0.85, giro: -2.6 },
  maquillaje: { x: -6.75, z: -3.2 },
  vestido: { x: -5.45, z: -3.25 },
  invitacion: { x: -0.0, y: 2.25, z: 4.2 },
  neon: { x: -2.75, z: -4.9 },
}

/** Mesas de adultos: primero las más cerca de la pista. */
export const LUGARES_MESAS: Array<[number, number]> = [
  [-1.85, 0.7], [1.85, 0.7], [-3.55, 0.7], [3.55, 0.7], [-5.25, 0.7], [5.25, 0.7],
  [-1.85, 2.3], [1.85, 2.3], [-3.55, 2.3], [3.55, 2.3], [-5.25, 2.3], [5.25, 2.3],
  [-3.45, -2.65], [3.45, -2.65], [-3.45, -1.05], [3.45, -1.05],
]
export const LUGARES_MESAS_NINOS: Array<[number, number]> = [
  [-1.85, 3.9], [1.85, 3.9],
]

// ── Utilidades ──────────────────────────────────────────────────────────────

/** Pinta toda la geometría de un color (para unir piezas en una sola malla). */
function conColor(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation): THREE.BufferGeometry {
  const c = new THREE.Color(color)
  const n = geo.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r
    arr[i * 3 + 1] = c.g
    arr[i * 3 + 2] = c.b
  }
  geo.setAttribute("color", new THREE.BufferAttribute(arr, 3))
  return geo
}

function unir(partes: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // Algunas formas vienen sin índice (el icosaedro): si se mezclan, todas sin índice.
  const mezcla = partes.some((p) => p.index) && partes.some((p) => !p.index)
  const listas = mezcla ? partes.map((p) => (p.index ? p.toNonIndexed() : p)) : partes
  const g = mergeGeometries(listas, false)
  for (const p of new Set([...partes, ...listas])) p.dispose()
  if (!g) throw new Error("No se pudieron unir las piezas")
  return g
}

/** Números al azar que siempre salen iguales (para que la maqueta no cambie). */
function azar(semilla: number) {
  let s = semilla >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const ROPA = ["#1f2b3a", "#2a2a2a", "#7d3446", "#c9a227", "#2f8f5b", "#e8a3b5", "#f5f0e8", "#34495e", "#5b3a6b", "#b56b45"]
const PIEL = ["#e7c3a0", "#c99772", "#8e5b3c", "#f2d4b5", "#a8714e"]

export interface Pieza3D {
  grupo: THREE.Group
  /** Animación propia de cada cuadro (gira, brilla, titila…). */
  avanzar?(dt: number, t: number): void
  /** Lo propio de la pieza (no lo compartido del Kit). */
  liberar?(): void
}

// ── Lo compartido ───────────────────────────────────────────────────────────

const VERTICE_HALO = /* glsl */ `
  attribute float aTam;
  attribute float aBrillo;
  attribute vec3 aColor;
  uniform float uEscala;
  uniform float uMaximo;
  varying float vBrillo;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // De cerca no se agrandan sin límite: se topean y se suavizan.
    float tam = aTam * uEscala / max(-mv.z, 0.1);
    gl_PointSize = min(tam, uMaximo);
    vBrillo = aBrillo * (1.0 - 0.86 * smoothstep(uMaximo * 0.5, uMaximo * 1.8, tam));
    vColor = aColor;
  }
`
const FRAGMENTO_HALO = /* glsl */ `
  uniform sampler2D uMapa;
  varying float vBrillo;
  varying vec3 vColor;
  void main() {
    float a = texture2D(uMapa, gl_PointCoord).r * vBrillo;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vColor, a);
  }
`

const VERTICE_HAZ = /* glsl */ `
  varying float vAltura;
  void main() {
    vAltura = uv.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const FRAGMENTO_HAZ = /* glsl */ `
  uniform vec3 uColor;
  uniform float uFuerza;
  varying float vAltura;
  void main() {
    float a = pow(vAltura, 1.6) * uFuerza;
    gl_FragColor = vec4(uColor, a);
  }
`

export class Kit {
  readonly halo = texturaHalo()
  readonly sombra = texturaSombra()
  readonly matHalo: THREE.ShaderMaterial
  /** Para brillos grandes y suaves (el humo, el neón): sin tope de tamaño. */
  readonly matHaloGrande: THREE.ShaderMaterial
  readonly mat: {
    cesped: THREE.MeshStandardMaterial
    tierra: THREE.MeshStandardMaterial
    piedra: THREE.MeshStandardMaterial
    pista: THREE.MeshStandardMaterial
    madera: THREE.MeshStandardMaterial
    oscuro: THREE.MeshStandardMaterial
    dorado: THREE.MeshStandardMaterial
    crema: THREE.MeshStandardMaterial
    pared: THREE.MeshStandardMaterial
    techo: THREE.MeshStandardMaterial
    ventana: THREE.MeshStandardMaterial
    colores: THREE.MeshStandardMaterial
    coloresBrillo: THREE.MeshStandardMaterial
    foco: THREE.MeshBasicMaterial
    cable: THREE.LineBasicMaterial
    sombra: THREE.MeshBasicMaterial
  }
  private readonly cache = new Map<string, THREE.BufferGeometry>()

  constructor(public familia: string) {
    this.matHalo = new THREE.ShaderMaterial({
      uniforms: { uMapa: { value: this.halo }, uEscala: { value: 400 }, uMaximo: { value: 80 } },
      vertexShader: VERTICE_HALO,
      fragmentShader: FRAGMENTO_HALO,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    this.matHaloGrande = this.matHalo.clone()
    this.matHaloGrande.uniforms.uMapa.value = this.halo
    this.matHaloGrande.uniforms.uMaximo.value = 900
    const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p)
    this.mat = {
      cesped: std({ color: "#21452e", roughness: 1 }),
      tierra: std({ color: "#3a2a1e", roughness: 1 }),
      piedra: std({ color: "#8d8574", roughness: 0.95 }),
      pista: std({ color: "#2b1f17", roughness: 0.32, metalness: 0.15 }),
      madera: std({ color: "#5a3d28", roughness: 0.7 }),
      oscuro: std({ color: "#15201a", roughness: 0.6 }),
      dorado: std({ color: "#c9a227", roughness: 0.38, metalness: 0.75 }),
      crema: std({ color: "#f5f0e8", roughness: 0.9 }),
      pared: std({ color: "#d8cdb6", roughness: 0.9 }),
      techo: std({ color: "#263228", roughness: 0.85 }),
      ventana: std({ color: "#3a2c18", emissive: "#f3cf7a", emissiveIntensity: 0.85, roughness: 0.4 }),
      colores: std({ vertexColors: true, roughness: 0.72, metalness: 0.08 }),
      coloresBrillo: std({ vertexColors: true, roughness: 0.3, metalness: 0.12 }),
      foco: new THREE.MeshBasicMaterial({ color: "#fff1c9" }),
      cable: new THREE.LineBasicMaterial({ color: "#1d241e" }),
      sombra: new THREE.MeshBasicMaterial({ map: this.sombra, transparent: true, depthWrite: false }),
    }
  }

  /** Geometría que se repite, guardada por nombre. */
  geo(clave: string, crear: () => THREE.BufferGeometry): THREE.BufferGeometry {
    let g = this.cache.get(clave)
    if (!g) {
      g = crear()
      this.cache.set(clave, g)
    }
    return g
  }

  /** Brillos (puntos que se suman a la luz) en esas posiciones. */
  halos(
    posiciones: THREE.Vector3[],
    color: THREE.ColorRepresentation | THREE.ColorRepresentation[],
    tam: number,
    brillo = 1,
    grande = false,
  ): THREE.Points {
    const n = posiciones.length
    const pos = new Float32Array(n * 3)
    const col = new Float32Array(n * 3)
    const tams = new Float32Array(n)
    const brillos = new Float32Array(n)
    const c = new THREE.Color()
    posiciones.forEach((p, i) => {
      pos.set([p.x, p.y, p.z], i * 3)
      c.set(Array.isArray(color) ? color[i % color.length] : color)
      col.set([c.r, c.g, c.b], i * 3)
      tams[i] = tam
      brillos[i] = brillo
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3))
    g.setAttribute("aTam", new THREE.BufferAttribute(tams, 1))
    g.setAttribute("aBrillo", new THREE.BufferAttribute(brillos, 1))
    const puntos = new THREE.Points(g, grande ? this.matHaloGrande : this.matHalo)
    puntos.frustumCulled = false
    puntos.renderOrder = 5
    return puntos
  }

  /** Sombra suave en el pasto, debajo de un objeto. */
  sombraBajo(ancho: number, fondo = ancho): THREE.Mesh {
    const m = new THREE.Mesh(this.geo("sombra", () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), this.mat.sombra)
    m.scale.set(ancho, 1, fondo)
    m.position.y = 0.012
    m.renderOrder = 1
    return m
  }

  haz(color: THREE.ColorRepresentation, fuerza: number): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uFuerza: { value: fuerza } },
      vertexShader: VERTICE_HAZ,
      fragmentShader: FRAGMENTO_HAZ,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })
  }

  liberar() {
    for (const g of this.cache.values()) g.dispose()
    this.cache.clear()
    for (const m of Object.values(this.mat)) m.dispose()
    this.matHalo.dispose()
    this.matHaloGrande.dispose()
    this.halo.dispose()
    this.sombra.dispose()
  }
}

/** Cambia el brillo de un grupo de halos (todos o uno). */
export function brilloHalos(p: THREE.Points, valor: number | ((i: number) => number)) {
  const a = p.geometry.getAttribute("aBrillo") as THREE.BufferAttribute
  for (let i = 0; i < a.count; i++) a.setX(i, typeof valor === "number" ? valor : valor(i))
  a.needsUpdate = true
}

// ── La isla, la pista, la casa y los árboles ────────────────────────────────

export function crearIsla(kit: Kit): THREE.Group {
  const grupo = new THREE.Group()
  const { ancho, fondo } = ISLA
  const r = 1.5
  const forma = new THREE.Shape()
  const x0 = -ancho / 2
  const y0 = -fondo / 2
  forma.moveTo(x0 + r, y0)
  forma.lineTo(x0 + ancho - r, y0)
  forma.quadraticCurveTo(x0 + ancho, y0, x0 + ancho, y0 + r)
  forma.lineTo(x0 + ancho, y0 + fondo - r)
  forma.quadraticCurveTo(x0 + ancho, y0 + fondo, x0 + ancho - r, y0 + fondo)
  forma.lineTo(x0 + r, y0 + fondo)
  forma.quadraticCurveTo(x0, y0 + fondo, x0, y0 + fondo - r)
  forma.lineTo(x0, y0 + r)
  forma.quadraticCurveTo(x0, y0, x0 + r, y0)
  const profundidad = 0.9
  const geo = new THREE.ExtrudeGeometry(forma, {
    depth: profundidad,
    bevelEnabled: true,
    bevelThickness: 0.12,
    bevelSize: 0.12,
    bevelSegments: 2,
    curveSegments: 10,
  })
  // La forma está en el plano xy: se acuesta y el pasto queda arriba (y = 0).
  geo.rotateX(Math.PI / 2)
  geo.translate(0, 0, 0)
  const isla = new THREE.Mesh(geo, [kit.mat.cesped, kit.mat.tierra])
  isla.position.y = -0.12
  grupo.add(isla)

  // Pista de baile (madera oscura lustrada, con un filo dorado).
  const p = LUGARES.pista
  const pista = new THREE.Mesh(new THREE.BoxGeometry(p.ancho, 0.05, p.fondo), kit.mat.pista)
  pista.position.set(p.x, 0.025, p.z)
  grupo.add(pista)
  const filo = new THREE.Mesh(new THREE.BoxGeometry(p.ancho + 0.08, 0.035, p.fondo + 0.08), kit.mat.dorado)
  filo.position.set(p.x, 0.0175, p.z)
  grupo.add(filo)

  // Camino de piedras desde la entrada hasta la pista.
  const azarPiedras = azar(7)
  const piedras: THREE.BufferGeometry[] = []
  for (let z = 5.75; z > -0.2; z -= 0.42) {
    const g = new THREE.CylinderGeometry(0.2, 0.22, 0.04, 9)
    g.scale(1 + azarPiedras() * 0.3, 1, 0.8 + azarPiedras() * 0.25)
    g.rotateY(azarPiedras() * Math.PI)
    g.translate((azarPiedras() - 0.5) * 0.18, 0.02, z)
    piedras.push(conColor(g, azarPiedras() > 0.5 ? "#958c7a" : "#857c6b"))
  }
  grupo.add(new THREE.Mesh(unir(piedras), kit.mat.colores))

  grupo.add(crearArboles(kit))
  return grupo
}

function crearArboles(kit: Kit): THREE.Mesh {
  const lugares: Array<[number, number, number]> = [
    [7.25, -5.25, 1.15], [-7.35, -5.35, 1.0], [7.35, 5.25, 0.95], [-7.4, 5.35, 0.9],
    [-2.6, -5.55, 0.85], [7.5, -3.9, 0.8],
  ]
  const partes: THREE.BufferGeometry[] = []
  const a = azar(21)
  for (const [x, z, s] of lugares) {
    const tronco = new THREE.CylinderGeometry(0.07 * s, 0.11 * s, 0.9 * s, 7)
    tronco.translate(x, 0.45 * s, z)
    partes.push(conColor(tronco, "#4a3424"))
    for (let k = 0; k < 3; k++) {
      const copa = new THREE.IcosahedronGeometry((0.62 - k * 0.12) * s, 1)
      copa.scale(1, 0.92, 1)
      copa.translate(x + (a() - 0.5) * 0.3 * s, (1.05 + k * 0.48) * s, z + (a() - 0.5) * 0.3 * s)
      partes.push(conColor(copa, k === 1 ? "#1d4a30" : k === 0 ? "#173d27" : "#245a39"))
    }
  }
  return new THREE.Mesh(unir(partes), kit.mat.colores)
}

/** La casa del salón: paredes claras, ventanas con luz y el cartel con el nombre. */
export class Casa implements Pieza3D {
  grupo = new THREE.Group()
  private letrero: THREE.Mesh | null = null
  private nombre = ""

  constructor(private kit: Kit) {
    const { x, z } = LUGARES.casa
    const ancho = 4.0
    const alto = 1.75
    const fondo = 1.8
    const paredes = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), kit.mat.pared)
    paredes.position.y = alto / 2
    this.grupo.add(paredes)
    // Techo a dos aguas.
    const perfil = new THREE.Shape()
    perfil.moveTo(-fondo / 2 - 0.18, 0)
    perfil.lineTo(0, 0.8)
    perfil.lineTo(fondo / 2 + 0.18, 0)
    perfil.lineTo(-fondo / 2 - 0.18, 0)
    const techoGeo = new THREE.ExtrudeGeometry(perfil, { depth: ancho + 0.3, bevelEnabled: false })
    techoGeo.translate(0, 0, -(ancho + 0.3) / 2)
    techoGeo.rotateY(Math.PI / 2)
    const techo = new THREE.Mesh(techoGeo, kit.mat.techo)
    techo.position.y = alto
    this.grupo.add(techo)
    // Ventanales con luz cálida y la puerta.
    const vidrio = new THREE.PlaneGeometry(0.62, 1.0)
    for (const vx of [-1.45, -0.72, 0.72, 1.45]) {
      const v = new THREE.Mesh(vidrio, kit.mat.ventana)
      v.position.set(vx, 0.78, fondo / 2 + 0.005)
      this.grupo.add(v)
    }
    const puerta = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.2), kit.mat.ventana)
    puerta.position.set(0, 0.6, fondo / 2 + 0.005)
    this.grupo.add(puerta)
    const marco = new THREE.Mesh(new THREE.BoxGeometry(ancho + 0.04, 0.08, 0.05), kit.mat.dorado)
    marco.position.set(0, 1.36, fondo / 2 + 0.02)
    this.grupo.add(marco)
    this.grupo.add(kit.sombraBajo(5.2, 3.0))
    this.grupo.position.set(x, 0, z)
  }

  setNombre(nombre: string | null) {
    const n = nombre ?? ""
    if (n === this.nombre) return
    this.nombre = n
    if (this.letrero) {
      this.grupo.remove(this.letrero)
      ;(this.letrero.material as THREE.MeshBasicMaterial).map?.dispose()
      ;(this.letrero.material as THREE.Material).dispose()
      this.letrero = null
    }
    if (!n) return
    const mat = new THREE.MeshBasicMaterial({ map: texturaLetrero(n, this.kit.familia), transparent: true, depthWrite: false })
    this.letrero = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), mat)
    this.letrero.position.set(0, 1.56, 0.92)
    this.grupo.add(this.letrero)
  }

  liberar() {
    this.setNombre(null)
  }
}

// ── La guirnalda de la maqueta ──────────────────────────────────────────────

/** Cuatro tiras de lamparitas cruzando el jardín. Se prenden de a poco:
 *  `prender(fraccion)` (de 0 a 1), con un parpadeo al encenderse. */
export class Guirnalda3D implements Pieza3D {
  grupo = new THREE.Group()
  private focos: THREE.InstancedMesh
  private halos: THREE.Points
  private brillo: Float32Array
  private objetivo: Float32Array
  private fase: Float32Array
  private orden: number[]
  private colorPrendido = new THREE.Color("#ffe6a8")
  private colorApagado = new THREE.Color("#3d3b33")
  private color = new THREE.Color()
  festejo = false

  constructor(kit: Kit, private reducido: boolean) {
    const tiras = [-3.2, -0.3, 2.0, 4.4]
    // Postes en el borde de la isla, por fuera de las barras.
    const xIzq = -7.78
    const xDer = 7.78
    const alto = 2.95
    const caida = 0.62
    const puntos: THREE.Vector3[] = []
    const postes: THREE.BufferGeometry[] = []
    tiras.forEach((z, k) => {
      const cable: THREE.Vector3[] = []
      for (let i = 0; i <= 40; i++) {
        const u = i / 40
        const x = xIzq + (xDer - xIzq) * u
        cable.push(new THREE.Vector3(x, alto - caida * (1 - Math.pow(2 * u - 1, 2)), z))
      }
      const linea = new THREE.Line(new THREE.BufferGeometry().setFromPoints(cable), kit.mat.cable)
      this.grupo.add(linea)
      const n = 27
      for (let i = 1; i < n; i++) {
        const u = i / n
        const x = xIzq + (xDer - xIzq) * u
        const y = alto - caida * (1 - Math.pow(2 * u - 1, 2)) - 0.075
        puntos.push(new THREE.Vector3(x, y, z + (k % 2 ? 0.02 : -0.02)))
      }
      for (const x of [xIzq, xDer]) {
        const poste = new THREE.CylinderGeometry(0.045, 0.06, alto + 0.05, 7)
        poste.translate(x, (alto + 0.05) / 2, z)
        postes.push(conColor(poste, "#5b4330"))
      }
    })
    this.grupo.add(new THREE.Mesh(unir(postes), kit.mat.colores))
    const esfera = kit.geo("foco", () => new THREE.SphereGeometry(0.05, 10, 8))
    this.focos = new THREE.InstancedMesh(esfera, kit.mat.foco, puntos.length)
    const m = new THREE.Matrix4()
    puntos.forEach((p, i) => {
      m.makeTranslation(p.x, p.y, p.z)
      this.focos.setMatrixAt(i, m)
      this.focos.setColorAt(i, this.colorApagado)
    })
    this.grupo.add(this.focos)
    this.halos = kit.halos(puntos, "#ffcf7d", 0.36, 0)
    this.grupo.add(this.halos)
    this.brillo = new Float32Array(puntos.length)
    this.objetivo = new Float32Array(puntos.length)
    const a = azar(3)
    this.fase = Float32Array.from(puntos, () => a() * Math.PI * 2)
    // Se prenden de adelante hacia atrás, de izquierda a derecha.
    this.orden = puntos.map((_, i) => i).sort((i, j) => puntos[j].z - puntos[i].z || puntos[i].x - puntos[j].x)
  }

  get cantidad() {
    return this.brillo.length
  }

  prender(fraccion: number) {
    const n = Math.round(Math.max(0, Math.min(1, fraccion)) * this.brillo.length)
    this.orden.forEach((indice, posicion) => {
      this.objetivo[indice] = posicion < n ? 1 : 0
    })
  }

  avanzar(dt: number, t: number) {
    const halos = this.halos.geometry.getAttribute("aBrillo") as THREE.BufferAttribute
    let cambio = false
    for (let i = 0; i < this.brillo.length; i++) {
      const antes = this.brillo[i]
      const meta = this.objetivo[i]
      // Al prenderse sube rápido (con un parpadeo); al apagarse baja suave.
      const vel = meta > antes ? 5.5 : 3
      let b = this.reducido ? meta : antes + (meta - antes) * Math.min(1, dt * vel)
      if (Math.abs(meta - b) < 0.002) b = meta
      this.brillo[i] = b
      let visible = b
      if (!this.reducido && b > 0.05) {
        visible *= 0.9 + 0.1 * Math.sin(t * 2.1 + this.fase[i])
        if (this.festejo) visible *= 0.78 + 0.32 * Math.max(0, Math.sin(t * 5 - i * 0.37))
        if (meta > 0 && b < 0.85) visible *= 0.55 + 0.45 * Math.abs(Math.sin(t * 38 + this.fase[i]))
      }
      halos.setX(i, visible * 0.9)
      if (Math.abs(antes - b) > 0.0005 || b > 0) {
        this.color.copy(this.colorApagado).lerp(this.colorPrendido, Math.min(1, visible))
        this.focos.setColorAt(i, this.color)
        cambio = true
      }
    }
    halos.needsUpdate = true
    if (cambio && this.focos.instanceColor) this.focos.instanceColor.needsUpdate = true
  }

  liberar() {
    this.focos.dispose()
    this.halos.geometry.dispose()
    for (const o of this.grupo.children) if (o instanceof THREE.Line || o instanceof THREE.Mesh) o.geometry.dispose()
  }
}

// ── Mesas, gente, platos y botellas ─────────────────────────────────────────

const SILLAS = 10

function geometriaMesa(radio: number, mantel: THREE.ColorRepresentation, escalaSilla: number): THREE.BufferGeometry {
  const partes: THREE.BufferGeometry[] = []
  const tela = new THREE.CylinderGeometry(radio, radio + 0.07, 0.74, 28)
  tela.translate(0, 0.37, 0)
  partes.push(conColor(tela, mantel))
  const rSilla = radio + 0.26
  for (let i = 0; i < SILLAS; i++) {
    const a = (i / SILLAS) * Math.PI * 2
    const s = escalaSilla
    const asiento = new THREE.BoxGeometry(0.25 * s, 0.045, 0.25 * s)
    asiento.translate(0, 0.45 * s, 0)
    const respaldo = new THREE.BoxGeometry(0.25 * s, 0.42 * s, 0.035)
    respaldo.translate(0, 0.66 * s, 0.11 * s)
    const patas = new THREE.BoxGeometry(0.22 * s, 0.44 * s, 0.03)
    patas.translate(0, 0.22 * s, 0.1 * s)
    const patas2 = patas.clone().translate(0, 0, -0.2 * s)
    for (const g of [asiento, respaldo, patas, patas2]) {
      // La silla mira hacia el centro de la mesa.
      g.rotateY(-a + Math.PI / 2)
      g.translate(Math.cos(a) * rSilla, 0, Math.sin(a) * rSilla)
      partes.push(conColor(g, "#c9a227"))
    }
  }
  return unir(partes)
}

function geometriaPersonas(cantidad: number, radio: number, escala: number, semilla: number): THREE.BufferGeometry {
  const partes: THREE.BufferGeometry[] = []
  const a = azar(semilla)
  const r = radio + 0.2
  for (let i = 0; i < cantidad; i++) {
    const ang = (i / SILLAS) * Math.PI * 2
    const cuerpo = new THREE.CapsuleGeometry(0.088 * escala, 0.2 * escala, 3, 8)
    cuerpo.translate(Math.cos(ang) * r, 0.7 * escala, Math.sin(ang) * r)
    partes.push(conColor(cuerpo, ROPA[Math.floor(a() * ROPA.length)]))
    const cabeza = new THREE.SphereGeometry(0.085 * escala, 10, 8)
    cabeza.translate(Math.cos(ang) * r, 1.0 * escala, Math.sin(ang) * r)
    partes.push(conColor(cabeza, PIEL[Math.floor(a() * PIEL.length)]))
  }
  return unir(partes)
}

function geometriaPlatos(radio: number): THREE.BufferGeometry {
  const partes: THREE.BufferGeometry[] = []
  for (let i = 0; i < SILLAS; i++) {
    const ang = (i / SILLAS) * Math.PI * 2
    const plato = new THREE.CylinderGeometry(0.075, 0.068, 0.016, 14)
    plato.translate(Math.cos(ang) * (radio - 0.14), 0.75, Math.sin(ang) * (radio - 0.14))
    partes.push(conColor(plato, "#fbf8f2"))
    const copa = new THREE.CylinderGeometry(0.02, 0.012, 0.07, 8)
    copa.translate(Math.cos(ang + 0.28) * (radio - 0.2), 0.78, Math.sin(ang + 0.28) * (radio - 0.2))
    partes.push(conColor(copa, "#cfe3dc"))
  }
  return unir(partes)
}

function geometriaBotellas(): THREE.BufferGeometry {
  const partes: THREE.BufferGeometry[] = []
  ;([[-0.11, "#1f6b45"], [0.11, "#8a5a1c"]] as Array<[number, string]>).forEach(([x, color]) => {
    const cuerpo = new THREE.CylinderGeometry(0.036, 0.036, 0.17, 10)
    cuerpo.translate(x, 0.825, 0.06)
    const cuello = new THREE.CylinderGeometry(0.012, 0.03, 0.08, 8)
    cuello.translate(x, 0.95, 0.06)
    partes.push(conColor(cuerpo, color), conColor(cuello, color))
  })
  return unir(partes)
}

function geometriaFlores(paleta: string[]): THREE.BufferGeometry {
  const partes: THREE.BufferGeometry[] = []
  const a = azar(11)
  const hojas = new THREE.CylinderGeometry(0.11, 0.13, 0.05, 10)
  hojas.translate(0, 0.765, -0.04)
  partes.push(conColor(hojas, "#2f5a3a"))
  for (let i = 0; i < 6; i++) {
    const f = new THREE.IcosahedronGeometry(0.052, 0)
    const ang = (i / 6) * Math.PI * 2
    f.translate(Math.cos(ang) * 0.07, 0.81 + a() * 0.04, Math.sin(ang) * 0.07 - 0.04)
    partes.push(conColor(f, paleta[i % paleta.length]))
  }
  return unir(partes)
}

function geometriaCandelabro(): THREE.BufferGeometry {
  const partes: THREE.BufferGeometry[] = []
  const base = new THREE.CylinderGeometry(0.06, 0.08, 0.03, 12)
  base.translate(0, 0.76, -0.04)
  const tallo = new THREE.CylinderGeometry(0.014, 0.018, 0.5, 8)
  tallo.translate(0, 1.0, -0.04)
  const brazo = new THREE.BoxGeometry(0.3, 0.018, 0.018)
  brazo.translate(0, 1.18, -0.04)
  partes.push(conColor(base, "#c9a227"), conColor(tallo, "#c9a227"), conColor(brazo, "#c9a227"))
  for (const x of [-0.15, 0, 0.15]) {
    const vela = new THREE.CylinderGeometry(0.014, 0.014, 0.09, 8)
    vela.translate(x, x === 0 ? 1.3 : 1.235, -0.04)
    partes.push(conColor(vela, "#fbf6ea"))
  }
  return unir(partes)
}

export class Mesa implements Pieza3D {
  grupo = new THREE.Group()
  private personas: THREE.Mesh
  private platos: THREE.Mesh
  private botellas: THREE.Mesh
  private flores: THREE.Mesh | null = null
  private candelabro: THREE.Group | null = null
  private cantidad = -1
  private paleta = ""

  constructor(
    private kit: Kit,
    private ninos: boolean,
    private semilla: number,
  ) {
    const radio = ninos ? 0.46 : 0.56
    const mantel = ninos ? "#f3e2b8" : "#f5f0e8"
    const base = new THREE.Mesh(
      kit.geo(ninos ? "mesa-ninos" : "mesa", () => geometriaMesa(radio, mantel, ninos ? 0.8 : 1)),
      kit.mat.colores,
    )
    this.grupo.add(base)
    this.grupo.add(kit.sombraBajo(radio * 3.4))
    this.personas = new THREE.Mesh(new THREE.BufferGeometry(), kit.mat.colores)
    this.grupo.add(this.personas)
    this.platos = new THREE.Mesh(kit.geo(ninos ? "platos-ninos" : "platos", () => geometriaPlatos(radio)), kit.mat.colores)
    this.platos.visible = false
    this.grupo.add(this.platos)
    this.botellas = new THREE.Mesh(kit.geo("botellas", geometriaBotellas), kit.mat.coloresBrillo)
    this.botellas.visible = false
    this.grupo.add(this.botellas)
  }

  /** La gente sentada. Devuelve la malla si llegó gente nueva (para animarla). */
  setPersonas(n: number, visibles: boolean): THREE.Mesh | null {
    const cant = visibles ? Math.max(0, Math.min(SILLAS, n)) : 0
    if (cant === this.cantidad) return null
    const llegaron = cant > Math.max(0, this.cantidad)
    this.cantidad = cant
    const radio = this.ninos ? 0.46 : 0.56
    this.personas.geometry = cant
      ? this.kit.geo(`personas-${this.ninos ? "n" : "a"}-${cant}-${this.semilla % 4}`, () =>
          geometriaPersonas(cant, radio, this.ninos ? 0.72 : 1, 100 + (this.semilla % 4) * 17),
        )
      : this.kit.geo("vacia", () => new THREE.BufferGeometry())
    return llegaron ? this.personas : null
  }

  /** Lo que hay arriba de la mesa. Devuelve lo que apareció recién (para animarlo). */
  setMesa(o: { platos: boolean; botellas: boolean; flores: boolean; candelabro: boolean; paleta: string[] }): THREE.Object3D[] {
    const nuevos: THREE.Object3D[] = []
    if (o.platos && !this.platos.visible) nuevos.push(this.platos)
    this.platos.visible = o.platos
    if (o.botellas && !this.botellas.visible) nuevos.push(this.botellas)
    this.botellas.visible = o.botellas
    const clavePaleta = o.paleta.join(",")
    if (this.flores && (!o.flores || clavePaleta !== this.paleta)) {
      this.grupo.remove(this.flores)
      this.flores = null
    }
    if (o.flores && !this.flores) {
      this.flores = new THREE.Mesh(this.kit.geo(`flores-${clavePaleta}`, () => geometriaFlores(o.paleta)), this.kit.mat.colores)
      this.grupo.add(this.flores)
      nuevos.push(this.flores)
    }
    this.paleta = clavePaleta
    if (o.candelabro && !this.candelabro) {
      this.candelabro = new THREE.Group()
      this.candelabro.add(new THREE.Mesh(this.kit.geo("candelabro", geometriaCandelabro), this.kit.mat.coloresBrillo))
      this.candelabro.add(
        this.kit.halos(
          [new THREE.Vector3(-0.15, 1.3, -0.04), new THREE.Vector3(0, 1.37, -0.04), new THREE.Vector3(0.15, 1.3, -0.04)],
          "#ffc56b",
          0.2,
          1,
        ),
      )
      if (this.flores) this.flores.position.x = 0.16
      this.grupo.add(this.candelabro)
      nuevos.push(this.candelabro)
    } else if (!o.candelabro && this.candelabro) {
      this.grupo.remove(this.candelabro)
      ;(this.candelabro.children[1] as THREE.Points).geometry.dispose()
      this.candelabro = null
      if (this.flores) this.flores.position.x = 0
    }
    return nuevos
  }

  liberar() {
    if (this.candelabro) (this.candelabro.children[1] as THREE.Points).geometry.dispose()
  }
}

// ── Barra ───────────────────────────────────────────────────────────────────

export function crearBarra(kit: Kit, giro: number): Pieza3D {
  const grupo = new THREE.Group()
  const partes: THREE.BufferGeometry[] = []
  const frente = new THREE.BoxGeometry(2.3, 0.95, 0.55)
  frente.translate(0, 0.475, 0)
  partes.push(conColor(frente, "#4a3223"))
  const tapa = new THREE.BoxGeometry(2.42, 0.06, 0.68)
  tapa.translate(0, 0.98, 0)
  partes.push(conColor(tapa, "#1b1b1b"))
  const estante = new THREE.BoxGeometry(2.2, 1.3, 0.24)
  estante.translate(0, 0.65, -0.78)
  partes.push(conColor(estante, "#2a1d15"))
  for (const y of [0.78, 1.12]) {
    const tabla = new THREE.BoxGeometry(2.1, 0.025, 0.2)
    tabla.translate(0, y, -0.64)
    partes.push(conColor(tabla, "#c9a227"))
  }
  const a = azar(5)
  const vidrios = ["#1f6b45", "#8a5a1c", "#d9e7e1", "#6b1f2e", "#c9a227"]
  for (const y of [0.79, 1.13]) {
    for (let x = -0.95; x <= 0.95; x += 0.13) {
      const alto = 0.17 + a() * 0.08
      const botella = new THREE.CylinderGeometry(0.03, 0.033, alto, 8)
      botella.translate(x, y + alto / 2, -0.62)
      partes.push(conColor(botella, vidrios[Math.floor(a() * vidrios.length)]))
    }
  }
  // Un barman detrás de la barra.
  const cuerpo = new THREE.CapsuleGeometry(0.1, 0.34, 3, 8)
  cuerpo.translate(0.35, 0.92, -0.38)
  partes.push(conColor(cuerpo, "#1b1b1b"))
  const cabeza = new THREE.SphereGeometry(0.09, 10, 8)
  cabeza.translate(0.35, 1.32, -0.38)
  partes.push(conColor(cabeza, "#c99772"))
  grupo.add(new THREE.Mesh(unir(partes), kit.mat.coloresBrillo))
  // Tira de luz en el frente.
  const tira = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.035, 0.02), new THREE.MeshBasicMaterial({ color: "#f3cf7a" }))
  tira.position.set(0, 0.9, 0.285)
  grupo.add(tira)
  grupo.add(kit.halos([new THREE.Vector3(-0.7, 0.92, 0.3), new THREE.Vector3(0, 0.92, 0.3), new THREE.Vector3(0.7, 0.92, 0.3)], "#f3cf7a", 0.9, 0.55))
  grupo.add(kit.sombraBajo(2.8, 1.8))
  grupo.rotation.y = giro
  return {
    grupo,
    liberar() {
      ;(grupo.children[0] as THREE.Mesh).geometry.dispose()
      ;(tira.material as THREE.Material).dispose()
      tira.geometry.dispose()
      ;(grupo.children[2] as THREE.Points).geometry.dispose()
    },
  }
}

// ── DJ con luces y humo ─────────────────────────────────────────────────────

export function crearDJ(kit: Kit, reducido: boolean): Pieza3D {
  const grupo = new THREE.Group()
  const partes: THREE.BufferGeometry[] = []
  const cabina = new THREE.BoxGeometry(1.7, 0.85, 0.62)
  cabina.translate(0, 0.425, 0)
  partes.push(conColor(cabina, "#111814"))
  for (const x of [-0.42, 0.42]) {
    const disco = new THREE.CylinderGeometry(0.16, 0.16, 0.03, 18)
    disco.translate(x, 0.87, -0.02)
    partes.push(conColor(disco, "#2c2c2c"))
  }
  const dj = new THREE.CapsuleGeometry(0.11, 0.36, 3, 8)
  dj.translate(0, 1.0, -0.5)
  partes.push(conColor(dj, "#1d1d1d"))
  const cabeza = new THREE.SphereGeometry(0.095, 10, 8)
  cabeza.translate(0, 1.42, -0.5)
  partes.push(conColor(cabeza, "#a8714e"))
  for (const x of [-1.45, 1.45]) {
    const parlante = new THREE.BoxGeometry(0.42, 1.1, 0.4)
    parlante.translate(x, 0.55, 0.05)
    partes.push(conColor(parlante, "#141414"))
  }
  grupo.add(new THREE.Mesh(unir(partes), kit.mat.colores))
  const frente = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.12), new THREE.MeshBasicMaterial({ color: "#f3cf7a" }))
  frente.position.set(0, 0.62, 0.315)
  grupo.add(frente)
  grupo.add(kit.sombraBajo(3.6, 1.6))

  // Cabezales móviles con su haz de luz, a los lados de la pista.
  const haces: Array<{ pivote: THREE.Group; fase: number; mat: THREE.ShaderMaterial }> = []
  const colores = ["#f3cf7a", "#7fd1a8", "#f3a6c1", "#f3cf7a"]
  const conoGeo = new THREE.ConeGeometry(0.55, 3.0, 22, 1, true)
  conoGeo.translate(0, -1.5, 0)
  const soportes: THREE.BufferGeometry[] = []
  ;[-2.45, -2.1, 2.1, 2.45].forEach((x, i) => {
    const pie = new THREE.CylinderGeometry(0.03, 0.04, 2.5, 6)
    pie.translate(x, 1.25, 0.25)
    soportes.push(conColor(pie, "#222"))
    const cabezal = new THREE.BoxGeometry(0.2, 0.16, 0.2)
    cabezal.translate(x, 2.55, 0.25)
    soportes.push(conColor(cabezal, "#111"))
    const mat = kit.haz(colores[i], 0.3)
    const pivote = new THREE.Group()
    pivote.position.set(x, 2.5, 0.25)
    const cono = new THREE.Mesh(conoGeo, mat)
    cono.renderOrder = 4
    pivote.add(cono)
    grupo.add(pivote)
    haces.push({ pivote, fase: i * 1.3, mat })
  })
  const soportesMesh = new THREE.Mesh(unir(soportes), kit.mat.colores)
  grupo.add(soportesMesh)

  // Humo bajo, apenas visible sobre la pista.
  const a = azar(9)
  const humoPos = Array.from({ length: 14 }, () => new THREE.Vector3((a() - 0.5) * 4.6, 0.25 + a() * 0.4, 1.0 + a() * 2.6))
  const humo = kit.halos(humoPos, "#9fb3c9", 2.6, 0.07, true)
  grupo.add(humo)

  const { x, z } = LUGARES.dj
  grupo.position.set(x, 0, z)
  return {
    grupo,
    avanzar(_dt, t) {
      for (const h of haces) {
        const vaiven = reducido ? 0 : Math.sin(t * 0.9 + h.fase)
        h.pivote.rotation.z = (h.pivote.position.x < 0 ? -0.45 : 0.45) + vaiven * 0.35
        h.pivote.rotation.x = 0.55 + (reducido ? 0 : Math.cos(t * 0.7 + h.fase) * 0.2)
      }
      if (!reducido) {
        const p = humo.geometry.getAttribute("position") as THREE.BufferAttribute
        for (let i = 0; i < p.count; i++) p.setX(i, humoPos[i].x + Math.sin(t * 0.2 + i) * 0.35)
        p.needsUpdate = true
      }
    },
    liberar() {
      ;(grupo.children[0] as THREE.Mesh).geometry.dispose()
      frente.geometry.dispose()
      ;(frente.material as THREE.Material).dispose()
      conoGeo.dispose()
      for (const h of haces) h.mat.dispose()
      humo.geometry.dispose()
      soportesMesh.geometry.dispose()
    },
  }
}

// ── Pantalla LED y pista LED ────────────────────────────────────────────────

export function crearPantallaLed(kit: Kit, palabra: string, paleta: string[]): Pieza3D & { setContenido(p: string, c: string[]): void } {
  const grupo = new THREE.Group()
  const pantalla = new PantallaLed(kit.familia)
  pantalla.palabra = palabra
  pantalla.paleta = paleta
  const marco = new THREE.Mesh(new THREE.BoxGeometry(3.7, 2.1, 0.14), kit.mat.oscuro)
  marco.position.y = 1.62
  grupo.add(marco)
  const vidrio = new THREE.Mesh(
    new THREE.PlaneGeometry(3.52, 1.94),
    new THREE.MeshBasicMaterial({ map: pantalla.textura, toneMapped: false }),
  )
  vidrio.position.set(0, 1.62, 0.075)
  grupo.add(vidrio)
  for (const x of [-1.6, 1.6]) {
    const pata = new THREE.Mesh(kit.geo("pata-pantalla", () => new THREE.BoxGeometry(0.1, 0.6, 0.1)), kit.mat.oscuro)
    pata.position.set(x, 0.3, 0)
    grupo.add(pata)
  }
  const { x, z } = LUGARES.pantalla
  grupo.position.set(x, 0, z)
  return {
    grupo,
    avanzar(dt, t) {
      pantalla.avanzar(dt, t)
    },
    setContenido(p, c) {
      pantalla.palabra = p
      pantalla.paleta = c
      pantalla.pintar(0)
    },
    liberar() {
      pantalla.liberar()
      marco.geometry.dispose()
      vidrio.geometry.dispose()
      ;(vidrio.material as THREE.Material).dispose()
    },
  }
}

export function crearPistaLed(kit: Kit, paleta: string[], reducido: boolean): Pieza3D & { setPaleta(c: string[]): void } {
  const grupo = new THREE.Group()
  const p = LUGARES.pista
  const cols = 8
  const filas = 6
  const lado = p.ancho / cols
  const baldosas = new THREE.InstancedMesh(
    kit.geo("baldosa", () => new THREE.BoxGeometry(1, 0.02, 1)),
    new THREE.MeshBasicMaterial({ toneMapped: false }),
    cols * filas,
  )
  const m = new THREE.Matrix4()
  const centros: Array<[number, number]> = []
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < cols; c++) {
      const bx = -p.ancho / 2 + lado * (c + 0.5)
      const bz = -p.fondo / 2 + (p.fondo / filas) * (f + 0.5)
      m.makeScale(lado * 0.92, 1, (p.fondo / filas) * 0.92).setPosition(bx, 0.062, bz)
      baldosas.setMatrixAt(f * cols + c, m)
      centros.push([bx, bz])
    }
  }
  grupo.add(baldosas)
  // En la pista, los colores claros del festejo se cambian por dorado: el
  // blanco encendido encandila.
  const deLed = (c: string[]) => {
    const fuertes = c.map((x) => new THREE.Color(x)).filter((x) => x.getHSL({ h: 0, s: 0, l: 0 }).l < 0.78)
    const base = ["#f3cf7a", "#2f8f5b", "#e8a3b5"].map((x) => new THREE.Color(x))
    return fuertes.length >= 2 ? fuertes : [...fuertes, ...base].slice(0, 3)
  }
  let colores = deLed(paleta)
  const color = new THREE.Color()
  const negro = new THREE.Color("#0b0d0c")
  const pintar = (t: number) => {
    centros.forEach(([bx, bz], i) => {
      const d = Math.hypot(bx, bz)
      const onda = reducido ? 0.5 : 0.5 + 0.5 * Math.sin(d * 2.6 - t * 3.2)
      const k = reducido ? i % colores.length : Math.floor((d * 0.9 - t * 0.6) % colores.length + colores.length) % colores.length
      color.copy(negro).lerp(colores[k], 0.12 + 0.6 * onda)
      baldosas.setColorAt(i, color)
    })
    if (baldosas.instanceColor) baldosas.instanceColor.needsUpdate = true
  }
  pintar(0)
  grupo.position.set(p.x, 0, p.z)
  return {
    grupo,
    avanzar(_dt, t) {
      if (!reducido) pintar(t)
    },
    setPaleta(c) {
      colores = deLed(c)
      pintar(0)
    },
    liberar() {
      baldosas.dispose()
      ;(baldosas.material as THREE.Material).dispose()
    },
  }
}

// ── Shimmer wall ────────────────────────────────────────────────────────────

export function crearShimmer(kit: Kit, reducido: boolean): Pieza3D {
  const grupo = new THREE.Group()
  const ancho = 2.4
  const alto = 1.7
  const cols = 26
  const filas = 18
  const fondo = new THREE.Mesh(new THREE.BoxGeometry(ancho + 0.12, alto + 0.12, 0.08), kit.mat.oscuro)
  fondo.position.y = 0.3 + alto / 2
  grupo.add(fondo)
  const marco = new THREE.Mesh(new THREE.BoxGeometry(ancho + 0.2, 0.06, 0.12), kit.mat.dorado)
  marco.position.y = 0.3 + alto + 0.06
  grupo.add(marco)
  for (const x of [-(ancho / 2 + 0.06), ancho / 2 + 0.06]) {
    const pie = new THREE.Mesh(kit.geo("pie-shimmer", () => new THREE.BoxGeometry(0.07, 2.1, 0.08)), kit.mat.dorado)
    pie.position.set(x, 1.05, 0)
    grupo.add(pie)
  }
  const lentejuelas = new THREE.InstancedMesh(
    kit.geo("lentejuela", () => new THREE.PlaneGeometry(0.085, 0.085)),
    new THREE.MeshBasicMaterial({ toneMapped: false }),
    cols * filas,
  )
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const a = azar(13)
  const fases = new Float32Array(cols * filas)
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < cols; c++) {
      const i = f * cols + c
      q.setFromEuler(new THREE.Euler(0, 0, Math.PI / 4))
      m.compose(
        new THREE.Vector3(-ancho / 2 + (ancho / cols) * (c + 0.5), 0.3 + (alto / filas) * (f + 0.5), 0.045),
        q,
        new THREE.Vector3(1, 1, 1),
      )
      lentejuelas.setMatrixAt(i, m)
      fases[i] = a() * 100
    }
  }
  const base = new THREE.Color("#9c7a2c")
  const destello = new THREE.Color("#fff4cf")
  const color = new THREE.Color()
  const pintar = (t: number) => {
    for (let i = 0; i < fases.length; i++) {
      const s = Math.sin(t * 2.3 + fases[i])
      const brillo = reducido ? 0.25 : Math.pow(Math.max(0, s), 18)
      color.copy(base).lerp(destello, 0.15 + brillo * 0.85)
      lentejuelas.setColorAt(i, color)
    }
    if (lentejuelas.instanceColor) lentejuelas.instanceColor.needsUpdate = true
  }
  pintar(0)
  grupo.add(lentejuelas)
  grupo.add(kit.sombraBajo(3.0, 1.0))
  const { x, z } = LUGARES.shimmer
  grupo.position.set(x, 0, z)
  return {
    grupo,
    avanzar(_dt, t) {
      if (!reducido) pintar(t)
    },
    liberar() {
      lentejuelas.dispose()
      ;(lentejuelas.material as THREE.Material).dispose()
      fondo.geometry.dispose()
      marco.geometry.dispose()
    },
  }
}

// ── Plataforma 360 ──────────────────────────────────────────────────────────

export function crearPlataforma360(kit: Kit, paleta: string[], reducido: boolean): Pieza3D {
  const grupo = new THREE.Group()
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.78, 0.15, 36), kit.mat.crema)
  base.position.y = 0.075
  grupo.add(base)
  const aro = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.022, 8, 56), new THREE.MeshBasicMaterial({ color: "#f3cf7a" }))
  aro.rotation.x = Math.PI / 2
  aro.position.y = 0.155
  grupo.add(aro)
  // Alguien posando arriba.
  const partes = [
    conColor(new THREE.CapsuleGeometry(0.1, 0.62, 3, 10).translate(0, 0.62, 0), paleta[0] ?? "#e8a3b5"),
    conColor(new THREE.SphereGeometry(0.095, 10, 8).translate(0, 1.15, 0), "#e7c3a0"),
  ]
  const persona = new THREE.Mesh(unir(partes), kit.mat.coloresBrillo)
  persona.position.y = 0.15
  grupo.add(persona)
  // El brazo que gira con la cámara en la punta.
  const brazo = new THREE.Group()
  const barra = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.035, 0.05), kit.mat.oscuro)
  barra.position.set(0.48, 0.2, 0)
  brazo.add(barra)
  const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.2, 6), kit.mat.oscuro)
  palo.position.set(0.95, 0.8, 0)
  brazo.add(palo)
  const anillo = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.015, 6, 24), new THREE.MeshBasicMaterial({ color: "#fff3d6" }))
  anillo.position.set(0.95, 1.42, 0)
  anillo.rotation.y = Math.PI / 2
  brazo.add(anillo)
  const luz = kit.halos([new THREE.Vector3(0.95, 1.42, 0)], "#fff1d0", 0.6, 0.9)
  brazo.add(luz)
  grupo.add(brazo)
  grupo.add(kit.sombraBajo(2.0))
  const { x, z } = LUGARES.plataforma360
  grupo.position.set(x, 0, z)
  return {
    grupo,
    avanzar(dt) {
      if (!reducido) brazo.rotation.y += dt * 1.6
    },
    liberar() {
      base.geometry.dispose()
      aro.geometry.dispose()
      ;(aro.material as THREE.Material).dispose()
      persona.geometry.dispose()
      barra.geometry.dispose()
      palo.geometry.dispose()
      anillo.geometry.dispose()
      ;(anillo.material as THREE.Material).dispose()
      luz.geometry.dispose()
    },
  }
}

// ── Fotógrafo ───────────────────────────────────────────────────────────────

export function crearFotografo(kit: Kit, reducido: boolean): Pieza3D & { luz: THREE.PointLight } {
  const grupo = new THREE.Group()
  const partes: THREE.BufferGeometry[] = []
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2
    const pata = new THREE.CylinderGeometry(0.012, 0.012, 1.15, 6)
    pata.rotateX(0.22)
    pata.rotateY(ang)
    pata.translate(Math.sin(ang) * 0.13, 0.56, Math.cos(ang) * 0.13)
    partes.push(conColor(pata, "#222"))
  }
  const camara = new THREE.BoxGeometry(0.16, 0.11, 0.1)
  camara.translate(0, 1.16, 0)
  const lente = new THREE.CylinderGeometry(0.035, 0.04, 0.09, 12)
  lente.rotateX(Math.PI / 2)
  lente.translate(0, 1.16, 0.09)
  partes.push(conColor(camara, "#151515"), conColor(lente, "#2a2a2a"))
  const cuerpo = new THREE.CapsuleGeometry(0.1, 0.62, 3, 8)
  cuerpo.translate(0.05, 0.58, -0.32)
  const cabeza = new THREE.SphereGeometry(0.09, 10, 8)
  cabeza.translate(0.05, 1.12, -0.32)
  partes.push(conColor(cuerpo, "#202833"), conColor(cabeza, "#c99772"))
  grupo.add(new THREE.Mesh(unir(partes), kit.mat.colores))
  const destello = kit.halos([new THREE.Vector3(0, 1.24, 0.06)], "#ffffff", 1.6, 0, true)
  grupo.add(destello)
  const luz = new THREE.PointLight("#ffffff", 0, 6, 2)
  luz.position.set(0, 1.3, 0.3)
  grupo.add(luz)
  grupo.add(kit.sombraBajo(0.9))
  const { x, z, giro } = LUGARES.fotografia
  grupo.position.set(x, 0, z)
  grupo.rotation.y = giro
  let reloj = 1.2
  return {
    grupo,
    luz,
    avanzar(dt) {
      if (reducido) return
      reloj -= dt
      if (reloj <= 0) reloj = 2.6 + Math.random() * 1.8
      // Un flash corto cada tanto.
      const f = reloj < 0.14 ? Math.sin((reloj / 0.14) * Math.PI) : 0
      brilloHalos(destello, f * 2.2)
      luz.intensity = f * 9
    },
    liberar() {
      ;(grupo.children[0] as THREE.Mesh).geometry.dispose()
      destello.geometry.dispose()
      luz.dispose()
    },
  }
}

// ── Mesa dulce y torta ──────────────────────────────────────────────────────

export function crearMesaDulce(kit: Kit, paleta: string[]): Pieza3D {
  const grupo = new THREE.Group()
  const partes: THREE.BufferGeometry[] = []
  const tela = new THREE.BoxGeometry(1.9, 0.74, 0.66)
  tela.translate(0, 0.37, 0)
  partes.push(conColor(tela, "#f8f2e4"))
  const pollera = new THREE.BoxGeometry(1.94, 0.12, 0.7)
  pollera.translate(0, 0.68, 0)
  partes.push(conColor(pollera, paleta[0] ?? "#f3cf7a"))
  const pisos: Array<[number, number]> = [[0.21, 0.16], [0.16, 0.15], [0.11, 0.14]]
  let y = 0.74
  for (const [r, h] of pisos) {
    const piso = new THREE.CylinderGeometry(r, r, h, 24)
    piso.translate(0, y + h / 2, 0)
    partes.push(conColor(piso, "#fbf6ea"))
    const cinta = new THREE.CylinderGeometry(r + 0.004, r + 0.004, 0.025, 24)
    cinta.translate(0, y + 0.03, 0)
    partes.push(conColor(cinta, "#c9a227"))
    y += h
  }
  const adorno = new THREE.TorusGeometry(0.05, 0.012, 6, 16)
  adorno.translate(0, y + 0.07, 0)
  partes.push(conColor(adorno, "#c9a227"))
  const a = azar(17)
  const dulces = ["#e8a3b5", "#f3cf7a", "#f8f2e4", "#b98a5a", "#7fd1a8"]
  for (let i = 0; i < 16; i++) {
    const lado = i % 2 ? 1 : -1
    const dx = lado * (0.32 + (Math.floor(i / 2) % 4) * 0.15)
    const dz = (Math.floor(i / 8) - 0.5) * 0.24
    const dulce = i % 3 ? new THREE.CylinderGeometry(0.04, 0.036, 0.05, 10) : new THREE.SphereGeometry(0.045, 10, 8)
    dulce.translate(dx, 0.79, dz)
    partes.push(conColor(dulce, dulces[Math.floor(a() * dulces.length)]))
  }
  grupo.add(new THREE.Mesh(unir(partes), kit.mat.coloresBrillo))
  grupo.add(kit.sombraBajo(2.4, 1.2))
  const { x, z, giro } = LUGARES.mesaDulce
  grupo.position.set(x, 0, z)
  grupo.rotation.y = giro
  return {
    grupo,
    liberar() {
      ;(grupo.children[0] as THREE.Mesh).geometry.dispose()
    },
  }
}

// ── Cartel de neón (en la pared de la casa) ─────────────────────────────────

export function crearNeon(kit: Kit, color: string): Pieza3D {
  const grupo = new THREE.Group()
  const tablero = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.62, 0.04), kit.mat.oscuro)
  grupo.add(tablero)
  const tex = texturaNeon("A bailar", color, kit.familia)
  const frente = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 0.6),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false }),
  )
  frente.position.z = 0.025
  grupo.add(frente)
  grupo.add(kit.halos([new THREE.Vector3(0, 0, 0.1)], color, 2.4, 0.35, true))
  const postes = new THREE.Mesh(
    kit.geo("postes-neon", () => {
      const a = new THREE.BoxGeometry(0.05, 1.25, 0.05).translate(-0.5, -0.62, -0.03)
      const b = new THREE.BoxGeometry(0.05, 1.25, 0.05).translate(0.5, -0.62, -0.03)
      return unir([conColor(a, "#222"), conColor(b, "#222")])
    }),
    kit.mat.colores,
  )
  grupo.add(postes)
  const { x, z } = LUGARES.neon
  grupo.position.set(x, 1.25, z)
  return {
    grupo,
    liberar() {
      tex.dispose()
      tablero.geometry.dispose()
      frente.geometry.dispose()
      ;(frente.material as THREE.Material).dispose()
      ;(grupo.children[2] as THREE.Points).geometry.dispose()
    },
  }
}

// ── Altar (arco de flores) ──────────────────────────────────────────────────

export function crearAltar(kit: Kit, paleta: string[]): Pieza3D {
  const grupo = new THREE.Group()
  const partes: THREE.BufferGeometry[] = []
  const radio = 0.95
  const arco = new THREE.TorusGeometry(radio, 0.035, 8, 40, Math.PI)
  arco.translate(0, 1.05, 0)
  partes.push(conColor(arco, "#c9a227"))
  for (const x of [-radio, radio]) {
    const pata = new THREE.CylinderGeometry(0.035, 0.035, 1.05, 8)
    pata.translate(x, 0.525, 0)
    partes.push(conColor(pata, "#c9a227"))
  }
  const a = azar(23)
  const flores = [...paleta, "#f8f2e4"]
  // Flores juntas arriba a la izquierda y abajo a la derecha (como los arreglos de verdad).
  for (let i = 0; i < 46; i++) {
    const enArco = i < 30
    const t = enArco ? 0.55 + a() * 0.4 : 0
    const ang = Math.PI * t
    const px = enArco ? Math.cos(ang) * radio : radio + (a() - 0.5) * 0.25
    const py = enArco ? 1.05 + Math.sin(ang) * radio : 0.15 + a() * 0.5
    const flor = new THREE.IcosahedronGeometry(0.075 + a() * 0.04, 0)
    flor.translate(px + (a() - 0.5) * 0.12, py + (a() - 0.5) * 0.12, (a() - 0.5) * 0.14)
    partes.push(conColor(flor, a() > 0.3 ? flores[Math.floor(a() * flores.length)] : "#3f6b45"))
  }
  const alfombra = new THREE.BoxGeometry(0.7, 0.012, 1.0)
  alfombra.translate(0, 0.006, 0.7)
  partes.push(conColor(alfombra, "#f8f2e4"))
  grupo.add(new THREE.Mesh(unir(partes), kit.mat.coloresBrillo))
  grupo.add(kit.sombraBajo(2.4, 1.0))
  const { x, z } = LUGARES.altar
  grupo.position.set(x, 0, z)
  return {
    grupo,
    liberar() {
      ;(grupo.children[0] as THREE.Mesh).geometry.dispose()
    },
  }
}

// ── Maquillaje y peinado (tocador con luces) ────────────────────────────────

export function crearMaquillaje(kit: Kit): Pieza3D {
  const grupo = new THREE.Group()
  const partes: THREE.BufferGeometry[] = []
  const mueble = new THREE.BoxGeometry(0.95, 0.72, 0.42)
  mueble.translate(0, 0.36, 0)
  partes.push(conColor(mueble, "#f5f0e8"))
  const espejoMarco = new THREE.BoxGeometry(0.78, 0.86, 0.04)
  espejoMarco.translate(0, 1.22, -0.17)
  partes.push(conColor(espejoMarco, "#c9a227"))
  const banqueta = new THREE.CylinderGeometry(0.17, 0.15, 0.42, 14)
  banqueta.translate(0, 0.21, 0.42)
  partes.push(conColor(banqueta, "#e8a3b5"))
  grupo.add(new THREE.Mesh(unir(partes), kit.mat.coloresBrillo))
  const espejo = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.7), new THREE.MeshStandardMaterial({ color: "#cfd8dc", metalness: 1, roughness: 0.08 }))
  espejo.position.set(0, 1.22, -0.145)
  grupo.add(espejo)
  const focos: THREE.Vector3[] = []
  for (let i = 0; i < 4; i++) {
    focos.push(new THREE.Vector3(-0.36, 0.9 + i * 0.2, -0.13), new THREE.Vector3(0.36, 0.9 + i * 0.2, -0.13))
  }
  for (let i = 0; i < 3; i++) focos.push(new THREE.Vector3(-0.2 + i * 0.2, 1.62, -0.13))
  const bombitas = new THREE.InstancedMesh(kit.geo("foco", () => new THREE.SphereGeometry(0.05, 10, 8)), kit.mat.foco, focos.length)
  const m = new THREE.Matrix4()
  focos.forEach((p, i) => bombitas.setMatrixAt(i, m.makeScale(0.6, 0.6, 0.6).setPosition(p)))
  grupo.add(bombitas)
  grupo.add(kit.halos(focos, "#ffe2a8", 0.42, 0.8))
  grupo.add(kit.sombraBajo(1.2, 0.9))
  const { x, z } = LUGARES.maquillaje
  grupo.position.set(x, 0, z)
  return {
    grupo,
    liberar() {
      ;(grupo.children[0] as THREE.Mesh).geometry.dispose()
      espejo.geometry.dispose()
      ;(espejo.material as THREE.Material).dispose()
      bombitas.dispose()
      ;(grupo.children[3] as THREE.Points).geometry.dispose()
    },
  }
}

// ── Vestido (maniquí con el vestido) ────────────────────────────────────────

export function crearVestido(kit: Kit, color: string): Pieza3D {
  const grupo = new THREE.Group()
  const perfil = [
    [0.0, 0.0], [0.44, 0.02], [0.4, 0.2], [0.31, 0.48], [0.2, 0.78], [0.12, 0.96],
    [0.105, 1.04], [0.13, 1.16], [0.14, 1.27], [0.1, 1.35], [0.035, 1.39], [0.0, 1.4],
  ].map(([r, y]) => new THREE.Vector2(r, y))
  const tela = new THREE.Mesh(
    new THREE.LatheGeometry(perfil, 28),
    new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.18 }),
  )
  tela.position.y = 0.1
  grupo.add(tela)
  const pie = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.1, 18), kit.mat.dorado)
  pie.position.y = 0.05
  grupo.add(pie)
  const cuello = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 6), kit.mat.dorado)
  cuello.position.y = 1.6
  grupo.add(cuello)
  grupo.add(kit.sombraBajo(1.2))
  const a = azar(31)
  const brillos = Array.from({ length: 10 }, () => {
    const ang = a() * Math.PI * 2
    const h = 0.2 + a() * 0.8
    const r = 0.44 - h * 0.3
    return new THREE.Vector3(Math.cos(ang) * r, h + 0.1, Math.sin(ang) * r)
  })
  const destellos = kit.halos(brillos, "#fff6dc", 0.16, 0.9)
  grupo.add(destellos)
  const { x, z } = LUGARES.vestido
  grupo.position.set(x, 0, z)
  return {
    grupo,
    avanzar(_dt, t) {
      brilloHalos(destellos, (i) => Math.pow(Math.max(0, Math.sin(t * 2 + i * 1.7)), 6) * 1.4)
    },
    liberar() {
      tela.geometry.dispose()
      ;(tela.material as THREE.Material).dispose()
      pie.geometry.dispose()
      cuello.geometry.dispose()
      destellos.geometry.dispose()
    },
  }
}

// ── Invitación digital (un sobre que flota) ─────────────────────────────────

export function crearInvitacion(kit: Kit, reducido: boolean): Pieza3D {
  const grupo = new THREE.Group()
  const sobre = new THREE.Group()
  const papel = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.38, 0.02), kit.mat.crema)
  sobre.add(papel)
  const solapa = new THREE.Mesh(
    new THREE.CircleGeometry(0.33, 3),
    new THREE.MeshStandardMaterial({ color: "#efe6d2", roughness: 0.9, side: THREE.DoubleSide }),
  )
  solapa.rotation.z = -Math.PI / 2
  solapa.scale.set(0.62, 0.86, 1)
  solapa.position.set(0, 0.085, 0.012)
  sobre.add(solapa)
  const sello = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.015, 16), kit.mat.dorado)
  sello.rotation.x = Math.PI / 2
  sello.position.set(0, -0.01, 0.02)
  sobre.add(sello)
  sobre.add(kit.halos([new THREE.Vector3(0, 0, -0.05)], "#f3cf7a", 1.6, 0.35, true))
  grupo.add(sobre)
  const { x, y, z } = LUGARES.invitacion
  grupo.position.set(x, y, z)
  return {
    grupo,
    avanzar(_dt, t) {
      if (reducido) return
      sobre.position.y = Math.sin(t * 1.4) * 0.12
      sobre.rotation.y = Math.sin(t * 0.6) * 0.5
      sobre.rotation.z = Math.sin(t * 0.9) * 0.08
    },
    liberar() {
      papel.geometry.dispose()
      solapa.geometry.dispose()
      ;(solapa.material as THREE.Material).dispose()
      sello.geometry.dispose()
      ;(sobre.children[3] as THREE.Points).geometry.dispose()
    },
  }
}

// ── Arco de globos en la entrada ────────────────────────────────────────────

export class Globos implements Pieza3D {
  grupo = new THREE.Group()
  private globos: THREE.InstancedMesh
  private datos: Array<{ p: THREE.Vector3; escala: number; demora: number }> = []
  private tiempo = 0
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private s = new THREE.Vector3()
  private material: THREE.MeshStandardMaterial

  constructor(kit: Kit, paleta: string[], private reducido: boolean) {
    const a = azar(41)
    const radio = 1.12
    // Dos capas de globos sobre un medio arco, y racimos al pie.
    for (let i = 0; i < 34; i++) {
      const t = i / 33
      const ang = Math.PI * t
      const capa = i % 2 ? 0.1 : -0.1
      this.datos.push({
        p: new THREE.Vector3(Math.cos(ang) * radio + (a() - 0.5) * 0.08, 0.08 + Math.sin(ang) * (radio + 0.25) + (a() - 0.5) * 0.08, capa),
        escala: 0.85 + a() * 0.45,
        demora: t * 0.55,
      })
    }
    for (const lado of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        this.datos.push({
          p: new THREE.Vector3(lado * (radio + 0.12) + (a() - 0.5) * 0.2, 0.14 + a() * 0.18, (a() - 0.5) * 0.3),
          escala: 0.9 + a() * 0.4,
          demora: 0.1 + a() * 0.3,
        })
      }
    }
    this.material = new THREE.MeshStandardMaterial({ roughness: 0.28, metalness: 0.08 })
    this.globos = new THREE.InstancedMesh(
      kit.geo("globo", () => new THREE.SphereGeometry(0.14, 16, 12).scale(1, 1.14, 1)),
      this.material,
      this.datos.length,
    )
    const c = new THREE.Color()
    this.datos.forEach((_, i) => {
      c.set(paleta[i % paleta.length])
      this.globos.setColorAt(i, c)
    })
    this.grupo.add(this.globos)
    this.grupo.add(kit.sombraBajo(3.0, 0.9))
    const { x, z } = LUGARES.entrada
    this.grupo.position.set(x, 0, z)
    this.avanzar(this.reducido ? 10 : 0)
  }

  avanzar(dt: number) {
    if (this.tiempo > 2) return
    this.tiempo += dt
    this.datos.forEach((d, i) => {
      const u = this.reducido ? 1 : Math.max(0, Math.min(1, (this.tiempo - d.demora) / 0.45))
      // Se inflan con un rebote.
      const e = u === 1 ? 1 : 1 + 2.2 * Math.pow(u - 1, 3) + 1.2 * Math.pow(u - 1, 2)
      const s = Math.max(0.0001, d.escala * e)
      this.s.set(s, s, s)
      this.m.compose(d.p, this.q, this.s)
      this.globos.setMatrixAt(i, this.m)
    })
    this.globos.instanceMatrix.needsUpdate = true
  }

  liberar() {
    this.globos.dispose()
    this.material.dispose()
  }
}

// ── Atril de la entrada ─────────────────────────────────────────────────────

export class Cartel implements Pieza3D {
  grupo = new THREE.Group()
  private tablero: THREE.Mesh
  private texto = ""

  constructor(private kit: Kit) {
    const partes: THREE.BufferGeometry[] = []
    for (const [x, ang] of [[-0.28, 0.12], [0.28, -0.12]] as Array<[number, number]>) {
      const pata = new THREE.BoxGeometry(0.035, 1.3, 0.035)
      pata.rotateZ(ang)
      pata.translate(x, 0.62, 0)
      partes.push(conColor(pata, "#6b4b33"))
    }
    const trasera = new THREE.BoxGeometry(0.035, 1.25, 0.035)
    trasera.rotateX(-0.32)
    trasera.translate(0, 0.6, -0.2)
    partes.push(conColor(trasera, "#6b4b33"))
    const apoyo = new THREE.BoxGeometry(0.8, 0.04, 0.06)
    apoyo.translate(0, 0.66, 0.03)
    partes.push(conColor(apoyo, "#6b4b33"))
    this.grupo.add(new THREE.Mesh(unir(partes), kit.mat.colores))
    this.tablero = new THREE.Mesh(
      new THREE.BoxGeometry(0.84, 0.63, 0.03),
      new THREE.MeshStandardMaterial({ color: "#1a3a2a", roughness: 0.8, emissive: "#ffffff", emissiveIntensity: 0.55 }),
    )
    this.tablero.position.set(0, 1.0, 0.05)
    this.tablero.rotation.x = -0.08
    this.grupo.add(this.tablero)
    this.grupo.add(kit.sombraBajo(0.9))
    const { x, z, giro } = LUGARES.cartel
    this.grupo.position.set(x, 0, z)
    this.grupo.rotation.y = giro
  }

  setTexto(titulo: string, fecha: string | null) {
    const clave = `${titulo}|${fecha ?? ""}`
    if (clave === this.texto) return
    this.texto = clave
    const mat = this.tablero.material as THREE.MeshStandardMaterial
    mat.map?.dispose()
    const tex = texturaCartel(titulo, fecha, this.kit.familia)
    mat.map = tex
    mat.emissiveMap = tex
    mat.color.set("#ffffff")
    mat.needsUpdate = true
  }

  liberar() {
    const mat = this.tablero.material as THREE.MeshStandardMaterial
    mat.map?.dispose()
    mat.dispose()
    this.tablero.geometry.dispose()
    ;(this.grupo.children[0] as THREE.Mesh).geometry.dispose()
  }
}

// ── Letras luminosas ────────────────────────────────────────────────────────

export function crearLetra(kit: Kit, letra: string): Pieza3D & { ancho: number } {
  const grupo = new THREE.Group()
  const forma = formaLetra(letra)
  const cuerpo = new THREE.Mesh(forma.cuerpo, kit.mat.dorado)
  grupo.add(cuerpo)
  const focos = new THREE.InstancedMesh(kit.geo("foco", () => new THREE.SphereGeometry(0.05, 10, 8)), kit.mat.foco, forma.focos.length)
  const m = new THREE.Matrix4()
  forma.focos.forEach((p, i) => focos.setMatrixAt(i, m.makeScale(0.52, 0.52, 0.52).setPosition(p)))
  grupo.add(focos)
  const halos = kit.halos(forma.focos, "#ffd88f", 0.3, 0.95)
  grupo.add(halos)
  const ancho = anchoLetra(letra)
  grupo.add(kit.sombraBajo(ancho + 0.4, 0.5).translateX(ancho / 2))
  return {
    grupo,
    ancho,
    avanzar(_dt, t) {
      // Las lamparitas "corren" a lo largo de la letra, como en las de verdad.
      brilloHalos(halos, (i) => 0.75 + 0.35 * Math.max(0, Math.sin(t * 4 - i * 0.6)))
    },
    liberar() {
      focos.dispose()
      halos.geometry.dispose()
    },
  }
}

/** Lo más ancho que pueden ocupar las letras: hasta antes del arco de globos. */
const ANCHO_LETRAS = 5.0

/** Dónde va cada letra (x del borde izquierdo) y de qué tamaño: si son muchas,
 *  se achican todas para no pisar el arco de la entrada. */
export function posicionesLetras(letras: string[]): { xs: number[]; escala: number } {
  const total = letras.reduce((a, l) => a + anchoLetra(l), 0) + Math.max(0, letras.length - 1) * SEPARACION_LETRAS
  const escala = total > ANCHO_LETRAS ? ANCHO_LETRAS / total : 1
  const xs: number[] = []
  let x = LUGARES.letras.x
  for (const l of letras) {
    xs.push(x)
    x += (anchoLetra(l) + SEPARACION_LETRAS) * escala
  }
  return { xs, escala }
}

// ── Festejo final: chispas frías, papelitos y gente bailando ────────────────

export class Festejo implements Pieza3D {
  grupo = new THREE.Group()
  private chispas: THREE.Points
  private datosChispas: Array<{ p: THREE.Vector3; v: THREE.Vector3; vida: number; espera: number; fuente: number }> = []
  private papelitos: THREE.InstancedMesh
  private datosPapelitos: Array<{ p: THREE.Vector3; v: THREE.Vector3; giro: THREE.Vector3; r: THREE.Euler }> = []
  private bailarines: THREE.InstancedMesh
  private datosBailarines: Array<{ x: number; z: number; fase: number; escala: number }> = []
  private tiempo = 0
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private s = new THREE.Vector3(1, 1, 1)
  private materialPapel: THREE.MeshBasicMaterial
  private fuentes = [
    new THREE.Vector3(-1.75, 0.08, -0.65),
    new THREE.Vector3(1.75, 0.08, -0.65),
    new THREE.Vector3(-1.75, 0.08, -3.35),
    new THREE.Vector3(1.75, 0.08, -3.35),
  ]

  constructor(kit: Kit, paleta: string[]) {
    const n = 360
    for (let i = 0; i < n; i++) {
      this.datosChispas.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), vida: 0, espera: Math.random() * 1.1, fuente: i % 4 })
    }
    this.chispas = kit.halos(
      Array.from({ length: n }, () => new THREE.Vector3(0, -10, 0)),
      ["#fff6dc", "#ffe1a0", "#ffffff"],
      0.11,
      0,
    )
    this.grupo.add(this.chispas)

    this.materialPapel = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
    const cantidad = 170
    this.papelitos = new THREE.InstancedMesh(
      kit.geo("papelito", () => new THREE.PlaneGeometry(0.07, 0.11)),
      this.materialPapel,
      cantidad,
    )
    const colores = [...paleta, "#f3cf7a", "#f8f2e4"]
    const c = new THREE.Color()
    for (let i = 0; i < cantidad; i++) {
      this.datosPapelitos.push({
        p: new THREE.Vector3((Math.random() - 0.5) * 12, 4 + Math.random() * 3.5, (Math.random() - 0.5) * 9),
        v: new THREE.Vector3((Math.random() - 0.5) * 0.4, -0.6 - Math.random() * 0.7, (Math.random() - 0.5) * 0.4),
        giro: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        r: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      })
      c.set(colores[i % colores.length])
      this.papelitos.setColorAt(i, c)
    }
    this.papelitos.frustumCulled = false
    this.grupo.add(this.papelitos)

    const a = azar(55)
    const cuantos = 22
    const partes = [
      conColor(new THREE.CapsuleGeometry(0.09, 0.6, 3, 8).translate(0, 0.42, 0), "#ffffff"),
      conColor(new THREE.SphereGeometry(0.088, 10, 8).translate(0, 0.9, 0), "#ffffff"),
    ]
    this.bailarines = new THREE.InstancedMesh(unir(partes), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), cuantos)
    const p = LUGARES.pista
    for (let i = 0; i < cuantos; i++) {
      this.datosBailarines.push({
        x: p.x + (a() - 0.5) * (p.ancho - 0.6),
        z: p.z + (a() - 0.5) * (p.fondo - 0.6),
        fase: a() * Math.PI * 2,
        escala: 0.9 + a() * 0.2,
      })
      c.set(ROPA[Math.floor(a() * ROPA.length)])
      this.bailarines.setColorAt(i, c)
    }
    this.grupo.add(this.bailarines)
    this.avanzar(0)
  }

  avanzar(dt: number) {
    this.tiempo += dt
    const t = this.tiempo
    // Chispas frías: fuentes que tiran chispas hacia arriba durante unos segundos.
    const pos = this.chispas.geometry.getAttribute("position") as THREE.BufferAttribute
    const br = this.chispas.geometry.getAttribute("aBrillo") as THREE.BufferAttribute
    const activas = t < 6.5
    this.datosChispas.forEach((d, i) => {
      if (d.vida <= 0) {
        // Esperando para salir (al principio, escalonadas) o ya se terminó.
        d.espera -= dt
        if (d.espera > 0 || !activas) {
          br.setX(i, 0)
          return
        }
        d.p.copy(this.fuentes[d.fuente])
        d.v.set((Math.random() - 0.5) * 0.7, 2.6 + Math.random() * 1.6, (Math.random() - 0.5) * 0.7)
        d.vida = 0.7 + Math.random() * 0.6
        d.espera = 0
      }
      d.vida -= dt
      d.v.y -= 4.2 * dt
      d.p.addScaledVector(d.v, dt)
      pos.setXYZ(i, d.p.x, d.p.y, d.p.z)
      br.setX(i, Math.max(0, Math.min(1, d.vida * 2.2)) * 1.3)
    })
    pos.needsUpdate = true
    br.needsUpdate = true

    // Papelitos que caen girando.
    this.datosPapelitos.forEach((d, i) => {
      d.p.addScaledVector(d.v, dt)
      d.p.x += Math.sin(t * 2 + i) * 0.15 * dt
      d.r.x += d.giro.x * dt
      d.r.y += d.giro.y * dt
      if (d.p.y < 0.03) {
        d.p.y = 0.03
        d.v.set(0, 0, 0)
        d.giro.set(0, 0, 0)
      }
      this.q.setFromEuler(d.r)
      this.m.compose(d.p, this.q, this.s)
      this.papelitos.setMatrixAt(i, this.m)
    })
    this.papelitos.instanceMatrix.needsUpdate = true

    // La gente baila en la pista.
    const entrada = Math.min(1, t / 0.8)
    this.datosBailarines.forEach((d, i) => {
      const salto = Math.abs(Math.sin(t * 4.2 + d.fase)) * 0.09
      this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(t * 1.8 + d.fase) * 0.8)
      const e = d.escala * entrada
      this.m.compose(new THREE.Vector3(d.x, 0.05 + salto, d.z), this.q, new THREE.Vector3(e, e, e))
      this.bailarines.setMatrixAt(i, this.m)
    })
    this.bailarines.instanceMatrix.needsUpdate = true
  }

  liberar() {
    this.chispas.geometry.dispose()
    this.papelitos.dispose()
    this.materialPapel.dispose()
    this.bailarines.geometry.dispose()
    ;(this.bailarines.material as THREE.Material).dispose()
    this.bailarines.dispose()
  }
}
