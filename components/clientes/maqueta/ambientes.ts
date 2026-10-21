// Ambientes de la maqueta 3D (vista de Clientes): dónde es la fiesta según el
// salón elegido (Ambiente, de lib/clientes-maqueta.ts).
// - El plano: antes de elegir salón, la isla es un plano con la grilla y, en
//   punteado, dónde van a ir la pista, las mesas y las barras.
// - El jardín (solo la Casona): pasto, árboles y la guirnalda de lamparitas.
//   Al costado, el terreno de la Casona con la casa para quedarse y la pileta,
//   que se ve también cuando la fiesta es adentro.
// - Los salones cerrados (Quinta, Salón y la Casona por dentro): piso, paredes
//   con ventanas, vigas, arañas que se prenden con los pasos y luces de color
//   en las paredes. La pared que tapa la vista (según desde dónde mira la
//   cámara) baja, como en las maquetas de verdad.
// Todo en metros, con el frente hacia +z, como en piezas.ts. Lo que se repite
// (geometrías, texturas y materiales) queda en el Kit para volver a usarlo.

import * as THREE from "three"
import type { Ambiente } from "@/lib/clientes-maqueta"
import {
  Guirnalda3D,
  ISLA,
  LUGARES,
  LUGARES_MESAS,
  Lamparitas,
  Letrero,
  azar,
  conColor,
  formaRedondeada,
  geometriaArboles,
  geometriaBloque,
  unir,
  type Kit,
  type Pieza3D,
} from "./piezas"
import { texturaBoiserie, texturaLadrillo, texturaMadera, texturaMarmol, texturaPlano, texturaRevoque, texturaTerracota } from "./texturas"

export type TipoPiso = "plano" | "cesped" | "casona" | "quinta" | "salon"
export type EstiloSala = "casona" | "quinta" | "salon"

/** Lo que va arriba de la isla en cada lugar (el jardín o un salón cerrado). */
export interface Entorno extends Pieza3D {
  /** Las lamparitas que se prenden con los pasos (la guirnalda o las arañas). */
  luces: Lamparitas | null
  /** Baja las paredes que tapan la vista desde `camara`. Devuelve si cambió algo. */
  cortar?(camara: THREE.Vector3, dt: number, inmediato: boolean): boolean
  setNombre?(nombre: string | null): void
  setPaleta?(paleta: string[]): void
  /** Cuánto de la fiesta está armada (de 0 a 1): las luces de color de las paredes. */
  setNivel?(nivel: number, festejo: boolean): void
}

const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p)

// ── Pisos ───────────────────────────────────────────────────────────────────

/** Coordenadas de textura en metros (x, −z): las texturas se repiten por metro. */
function uvEnMetros(geo: THREE.BufferGeometry) {
  const p = geo.attributes.position
  const uv = new Float32Array(p.count * 2)
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = p.getX(i)
    uv[i * 2 + 1] = -p.getZ(i)
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2))
}

function geometriaPiso(kit: Kit) {
  return kit.geo("piso-isla", () => {
    const g = new THREE.ShapeGeometry(formaRedondeada(-ISLA.ancho / 2, -ISLA.fondo / 2, ISLA.ancho, ISLA.fondo), 6)
    g.rotateX(-Math.PI / 2)
    uvEnMetros(g)
    return g
  })
}

/** Una textura repetida cada `metros` (en x y en z). */
function porMetro(t: THREE.Texture, ancho: number, alto = ancho): THREE.Texture {
  t.repeat.set(1 / ancho, 1 / alto)
  return t
}

function materialPiso(kit: Kit, tipo: TipoPiso): THREE.Material {
  switch (tipo) {
    case "plano": {
      const tex = kit.recurso("tex-plano", () => {
        const t = texturaPlano(LUGARES_MESAS.slice(0, 12), LUGARES.pista, LUGARES.barras)
        // Una sola vez sobre la isla entera.
        t.repeat.set(1 / ISLA.ancho, 1 / ISLA.fondo)
        t.offset.set(0.5, 0.5)
        return t
      })
      return kit.recurso("mat-piso-plano", () =>
        std({ map: tex, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.24, roughness: 0.95 }),
      )
    }
    case "cesped":
      return kit.mat.cesped
    case "casona": {
      const tex = kit.recurso("tex-terracota", () => porMetro(texturaTerracota(), 1))
      return kit.recurso("mat-piso-casona", () => std({ map: tex, roughness: 0.82 }))
    }
    case "quinta": {
      const tex = kit.recurso("tex-madera", () => porMetro(texturaMadera(), 2))
      return kit.recurso("mat-piso-quinta", () => std({ map: tex, roughness: 0.58 }))
    }
    case "salon": {
      const tex = kit.recurso("tex-marmol", () => porMetro(texturaMarmol(), 2))
      return kit.recurso("mat-piso-salon", () => std({ map: tex, roughness: 0.3, metalness: 0.04 }))
    }
  }
}

function materialPista(kit: Kit, tipo: TipoPiso): THREE.Material {
  if (tipo === "quinta") return kit.recurso("mat-pista-quinta", () => std({ color: "#3b2416", roughness: 0.34, metalness: 0.12 }))
  if (tipo === "salon") return kit.recurso("mat-pista-salon", () => std({ color: "#111113", roughness: 0.16, metalness: 0.3 }))
  return kit.mat.pista
}

function geometriaCamino(): THREE.BufferGeometry {
  // Camino de piedras desde la entrada hasta la pista.
  const a = azar(7)
  const piedras: THREE.BufferGeometry[] = []
  for (let z = 5.75; z > -0.2; z -= 0.42) {
    const g = new THREE.CylinderGeometry(0.2, 0.22, 0.04, 9)
    g.scale(1 + a() * 0.3, 1, 0.8 + a() * 0.25)
    g.rotateY(a() * Math.PI)
    g.translate((a() - 0.5) * 0.18, 0.02, z)
    piedras.push(conColor(g, a() > 0.5 ? "#958c7a" : "#857c6b"))
  }
  return unir(piedras)
}

/**
 * El piso de un lugar, con su pista. Crece desde el centro cuando se cambia de
 * salón (eso lo hace el motor). Lo que sobresale (las piedras del camino) va
 * marcado con `relieve`, para esconderlo apenas empieza a crecer otro piso.
 */
export function crearPiso(kit: Kit, tipo: TipoPiso): THREE.Group {
  const grupo = new THREE.Group()
  const piso = new THREE.Mesh(geometriaPiso(kit), materialPiso(kit, tipo))
  piso.position.y = 0.002
  grupo.add(piso)
  if (tipo !== "plano") {
    const p = LUGARES.pista
    const filo = new THREE.Mesh(kit.geo("pista-filo", () => new THREE.BoxGeometry(p.ancho + 0.08, 0.035, p.fondo + 0.08)), kit.mat.dorado)
    filo.position.set(p.x, 0.0175, p.z)
    const pista = new THREE.Mesh(kit.geo("pista", () => new THREE.BoxGeometry(p.ancho, 0.05, p.fondo)), materialPista(kit, tipo))
    pista.position.set(p.x, 0.025, p.z)
    grupo.add(filo, pista)
  }
  if (tipo === "cesped") {
    const camino = new THREE.Mesh(kit.geo("camino", geometriaCamino), kit.mat.colores)
    camino.userData.relieve = true
    grupo.add(camino)
  }
  return grupo
}

/** Los costados de la isla: tierra en la Casona, madera oscura en los salones
 *  cerrados y verde oscuro en el plano. */
export function materialesBase(kit: Kit, a: Ambiente): { arriba: THREE.Material; costados: THREE.Material } {
  if (a.lugar === "plano") {
    return {
      arriba: kit.recurso("mat-base-plano", () => std({ color: "#13281c", roughness: 0.9 })),
      costados: kit.recurso("mat-base-plano-lado", () => std({ color: "#0f1f17", roughness: 0.9 })),
    }
  }
  if (a.casona || a.lugar === "jardin") return { arriba: kit.mat.cesped, costados: kit.mat.tierra }
  return {
    arriba: kit.recurso("mat-base-sala", () => std({ color: "#2a1d15", roughness: 0.7 })),
    costados: kit.recurso("mat-base-sala-lado", () => std({ color: "#211711", roughness: 0.7 })),
  }
}

// ── El jardín (la Casona, afuera) ───────────────────────────────────────────

const ARBOLES_JARDIN: Array<[number, number, number]> = [
  [7.25, -5.25, 1.15], [-7.35, -5.35, 1.0], [7.35, 5.25, 0.95], [-7.4, 5.35, 0.9],
  [-2.6, -5.55, 0.85], [7.5, -3.9, 0.8], [-6.25, -5.45, 0.72], [-4.1, -5.5, 0.66],
]

/** Un cerco bajo con flores al fondo, a la izquierda. */
function geometriaCerco(): THREE.BufferGeometry {
  const partes: THREE.BufferGeometry[] = []
  const a = azar(61)
  for (let x = -6.9; x <= -3.0; x += 0.42) {
    const mata = new THREE.IcosahedronGeometry(0.3 + a() * 0.06, 1)
    mata.scale(1.1, 0.8, 0.9)
    mata.translate(x, 0.24, -5.62 + (a() - 0.5) * 0.1)
    partes.push(conColor(mata, a() > 0.5 ? "#1f4d31" : "#245a39"))
    for (let k = 0; k < 2; k++) {
      const flor = new THREE.IcosahedronGeometry(0.05, 0)
      flor.translate(x + (a() - 0.5) * 0.4, 0.44 + a() * 0.08, -5.5 + (a() - 0.5) * 0.2)
      partes.push(conColor(flor, a() > 0.5 ? "#f8f2e4" : "#e8a3b5"))
    }
  }
  return unir(partes)
}

/** El jardín: árboles, el cerco y la guirnalda de lamparitas. */
export function crearJardin(kit: Kit, reducido: boolean): Entorno {
  const grupo = new THREE.Group()
  grupo.add(new THREE.Mesh(kit.geo("jardin-verde", () => unir([geometriaArboles(ARBOLES_JARDIN), geometriaCerco()])), kit.mat.colores))
  const guirnalda = new Guirnalda3D(kit, reducido)
  grupo.add(guirnalda.grupo)
  return {
    grupo,
    luces: guirnalda.lamparitas,
    avanzar(dt, t) {
      guirnalda.lamparitas.avanzar(dt, t)
    },
    liberar() {
      guirnalda.liberar()
    },
  }
}

// ── Los salones cerrados ────────────────────────────────────────────────────

/** Dónde están las caras de adentro de las paredes, su alto y su grosor. */
export const SALA = { x: 7.7, z: 5.7, alto: 3.1, grosor: 0.2 }
/** Lo que queda de una pared "cortada" para ver adentro (como en las maquetas). */
const BAJA = 0.11

interface Diseno {
  piso: TipoPiso
  canto: string
  zocalo: string
  cornisa: string
  marco: string
  viga: { color: string; ancho: number; alto: number; filo?: string }
  arana: "edison" | "cristal" | "hierro"
  colorLuz: string
  colorHalo: string
  /** Cálido que se suma a los colores del festejo en las luces de las paredes. */
  calido: string
  maceta: string
  planta: string
  cortinas: string | null
  apliques: boolean
  arcos: boolean
  /** La Casona: ventanales con vidrio claro hacia la pileta (pared izquierda). */
  ventanalPileta: boolean
  letrero: boolean
}

const DISENOS: Record<EstiloSala, Diseno> = {
  // Ladrillo a la vista, piso de madera, vigas oscuras y lamparitas colgando.
  quinta: {
    piso: "quinta",
    canto: "#7a4330",
    zocalo: "#3b2416",
    cornisa: "#4a3020",
    marco: "#1c1c1c",
    viga: { color: "#4a3020", ancho: 0.13, alto: 0.18 },
    arana: "edison",
    colorLuz: "#ffd59a",
    colorHalo: "#ffb760",
    calido: "#ffb45c",
    maceta: "#a5583a",
    planta: "#5f7a4f",
    cortinas: null,
    apliques: false,
    arcos: false,
    ventanalPileta: false,
    letrero: true,
  },
  // Boiserie crema, mármol, cortinados verdes y arañas de cristal.
  salon: {
    piso: "salon",
    canto: "#e7dcc8",
    zocalo: "#d6c8ae",
    cornisa: "#f3ecdf",
    marco: "#f3ecdf",
    viga: { color: "#efe6d4", ancho: 0.11, alto: 0.15, filo: "#c9a227" },
    arana: "cristal",
    colorLuz: "#fff3d6",
    colorHalo: "#ffe0a6",
    calido: "#f3cf7a",
    maceta: "#f2ede2",
    planta: "#2d5a3a",
    cortinas: "#1e4632",
    apliques: true,
    arcos: false,
    ventanalPileta: false,
    letrero: true,
  },
  // La Casona por dentro: paredes a la cal, arcos, terracota y hierro forjado.
  casona: {
    piso: "casona",
    canto: "#ddd2bd",
    zocalo: "#5a3d28",
    cornisa: "#e4d9c4",
    marco: "#3d2a1c",
    viga: { color: "#3d2a1c", ancho: 0.15, alto: 0.2 },
    arana: "hierro",
    colorLuz: "#ffe2b0",
    colorHalo: "#ffc56b",
    calido: "#ffc56b",
    maceta: "#b5653f",
    planta: "#2f6a3f",
    cortinas: null,
    apliques: false,
    arcos: true,
    ventanalPileta: true,
    letrero: false,
  },
}

function materialPared(kit: Kit, estilo: EstiloSala): THREE.Material {
  if (estilo === "quinta") {
    const tex = kit.recurso("tex-ladrillo", () => porMetro(texturaLadrillo(), 2, 1))
    return kit.recurso("mat-pared-quinta", () => std({ map: tex, roughness: 0.92 }))
  }
  if (estilo === "salon") {
    const tex = kit.recurso("tex-boiserie", () => porMetro(texturaBoiserie(), 2, SALA.alto))
    return kit.recurso("mat-pared-salon", () => std({ map: tex, roughness: 0.78 }))
  }
  const tex = kit.recurso("tex-revoque", () => porMetro(texturaRevoque(), 1))
  return kit.recurso("mat-pared-casona", () => std({ map: tex, roughness: 0.94 }))
}

type IdPared = "fondo" | "frente" | "izq" | "der"

/** Las cuatro paredes: dónde está su cara de adentro y hacia dónde mira. */
const PAREDES: Array<{ id: IdPared; x: number; z: number; giro: number; largo: number }> = [
  { id: "fondo", x: 0, z: -SALA.z, giro: 0, largo: 2 * (SALA.x + SALA.grosor) },
  { id: "frente", x: 0, z: SALA.z, giro: Math.PI, largo: 2 * (SALA.x + SALA.grosor) },
  { id: "izq", x: -SALA.x, z: 0, giro: Math.PI / 2, largo: 2 * SALA.z },
  { id: "der", x: SALA.x, z: 0, giro: -Math.PI / 2, largo: 2 * SALA.z },
]

/** De dónde (z del mundo) a dónde (x a lo largo de la pared) en las paredes de los costados. */
function xDeZ(id: IdPared, z: number) {
  return id === "izq" ? -z : z
}

/** Una ventana o una puerta (si arranca en el piso), medida sobre la pared. */
interface Abertura {
  x: number
  ancho: number
  abajo: number
  arriba: number
  arco: boolean
  /** Vidrio claro (se ve lo de afuera) en vez de vidrio de noche. */
  claro?: boolean
  /** Sin vidrio: la entrada. */
  libre?: boolean
}

const VENTANAS_COSTADO = [-3.9, -0.2, 3.5]

function aberturasDe(id: IdPared, d: Diseno): Abertura[] {
  if (id === "fondo") return []
  if (id === "frente") {
    return [
      { x: 0, ancho: 2.1, abajo: 0, arriba: 2.5, arco: d.arcos, libre: true },
      { x: -4.6, ancho: 1.3, abajo: 0.8, arriba: 2.5, arco: d.arcos },
      { x: 4.6, ancho: 1.3, abajo: 0.8, arriba: 2.5, arco: d.arcos },
    ]
  }
  if (id === "izq" && d.ventanalPileta) {
    // La Casona: ventanales con arco, de piso a techo, que dan a la pileta.
    return [-3.6, 0, 3.6].map((z) => ({ x: xDeZ(id, z), ancho: 1.7, abajo: 0, arriba: 2.6, arco: true, claro: true }))
  }
  return VENTANAS_COSTADO.map((z) => ({ x: xDeZ(id, z), ancho: 1.3, abajo: 0.8, arriba: 2.55, arco: d.arcos }))
}

/** Dibuja el contorno de una abertura (rectangular o con arco arriba). */
function trazarAbertura<T extends THREE.Path>(p: T, v: Abertura): T {
  const x0 = v.x - v.ancho / 2
  const x1 = v.x + v.ancho / 2
  p.moveTo(x0, v.abajo)
  p.lineTo(x1, v.abajo)
  if (v.arco) {
    const r = v.ancho / 2
    p.lineTo(x1, v.arriba - r)
    p.absarc(v.x, v.arriba - r, r, 0, Math.PI, false)
  } else {
    p.lineTo(x1, v.arriba)
    p.lineTo(x0, v.arriba)
  }
  p.lineTo(x0, v.abajo)
  return p
}

/** La pared con sus huecos: las puertas son muescas en el borde de abajo y
 *  las ventanas, agujeros. La cara de adentro queda en z = 0. */
function geometriaPared(largo: number, aberturas: Abertura[]): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(-largo / 2, 0)
  for (const p of aberturas.filter((a) => a.abajo <= 0).sort((a, b) => a.x - b.x)) {
    const x0 = p.x - p.ancho / 2
    const x1 = p.x + p.ancho / 2
    s.lineTo(x0, 0)
    if (p.arco) {
      const r = p.ancho / 2
      s.lineTo(x0, p.arriba - r)
      s.absarc(p.x, p.arriba - r, r, Math.PI, 0, true)
    } else {
      s.lineTo(x0, p.arriba)
      s.lineTo(x1, p.arriba)
    }
    s.lineTo(x1, 0)
  }
  s.lineTo(largo / 2, 0)
  s.lineTo(largo / 2, SALA.alto)
  s.lineTo(-largo / 2, SALA.alto)
  s.lineTo(-largo / 2, 0)
  for (const v of aberturas.filter((a) => a.abajo > 0)) s.holes.push(trazarAbertura(new THREE.Path(), v))
  const g = new THREE.ExtrudeGeometry(s, { depth: SALA.grosor, bevelEnabled: false, curveSegments: 12 })
  g.translate(0, 0, -SALA.grosor)
  return g
}

/** Marco, travesaños y alféizar de una abertura (con el color del estilo). */
function marcoDe(ab: Abertura, d: Diseno, partes: THREE.BufferGeometry[]) {
  const t = 0.05
  const z = 0.012
  const r = ab.ancho / 2
  const hasta = ab.arco ? ab.arriba - r : ab.arriba
  for (const lado of [-1, 1]) {
    const jamba = new THREE.BoxGeometry(t, hasta - ab.abajo, 0.03)
    jamba.translate(ab.x + lado * (r + t / 2), (ab.abajo + hasta) / 2, z)
    partes.push(conColor(jamba, d.marco))
  }
  if (ab.arco) {
    const arco = new THREE.TorusGeometry(r + t / 2, t / 2, 4, 20, Math.PI)
    arco.translate(ab.x, hasta, z)
    partes.push(conColor(arco, d.marco))
  } else {
    const dintel = new THREE.BoxGeometry(ab.ancho + 2 * t, t, 0.03)
    dintel.translate(ab.x, ab.arriba + t / 2, z)
    partes.push(conColor(dintel, d.marco))
  }
  if (ab.abajo > 0) {
    const alfeizar = new THREE.BoxGeometry(ab.ancho + 0.16, 0.05, 0.1)
    alfeizar.translate(ab.x, ab.abajo - 0.025, 0.04)
    partes.push(conColor(alfeizar, d.marco))
  }
  if (ab.libre) return
  // Travesaños, en el plano del vidrio.
  const zv = -SALA.grosor / 2 + 0.01
  const barra = (ancho: number, alto: number, x: number, y: number) => {
    const b = new THREE.BoxGeometry(ancho, alto, 0.02)
    b.translate(x, y, zv)
    partes.push(conColor(b, d.marco))
  }
  if (d.arana === "edison") {
    // Ventanal de hierro, en cuadrícula.
    for (const k of [1, 2]) barra(0.022, hasta - ab.abajo, ab.x - r + (ab.ancho * k) / 3, (ab.abajo + hasta) / 2)
    for (const k of [1, 2, 3]) barra(ab.ancho, 0.022, ab.x, ab.abajo + ((hasta - ab.abajo) * k) / 4)
  } else {
    barra(0.03, hasta - ab.abajo + (ab.arco ? r : 0), ab.x, (ab.abajo + hasta + (ab.arco ? r : 0)) / 2)
    barra(ab.ancho, 0.03, ab.x, ab.arco ? hasta : ab.abajo + (hasta - ab.abajo) * 0.72)
    if (ab.abajo <= 0) barra(ab.ancho, 0.03, ab.x, 1.0)
  }
}

/** Cortinados con galería y lazos dorados, a los lados de una ventana. */
function cortinasDe(ab: Abertura, color: string, partes: THREE.BufferGeometry[]) {
  const alto = SALA.alto - 0.16
  for (const lado of [-1, 1]) {
    const tela = new THREE.BoxGeometry(0.38, alto, 0.05, 8, 1, 1)
    const p = tela.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + Math.sin((p.getX(i) / 0.38 + 0.5) * Math.PI * 4) * 0.035)
    tela.computeVertexNormals()
    const x = ab.x + lado * (ab.ancho / 2 + 0.2)
    tela.translate(x, alto / 2, 0.09)
    partes.push(conColor(tela, color))
    const lazo = new THREE.BoxGeometry(0.42, 0.05, 0.1)
    lazo.translate(x, 1.05, 0.12)
    partes.push(conColor(lazo, "#c9a227"))
  }
  const galeria = new THREE.BoxGeometry(ab.ancho + 0.95, 0.28, 0.1)
  galeria.translate(ab.x, SALA.alto - 0.3, 0.1)
  partes.push(conColor(galeria, color))
  const filo = new THREE.BoxGeometry(ab.ancho + 0.95, 0.025, 0.11)
  filo.translate(ab.x, SALA.alto - 0.43, 0.105)
  partes.push(conColor(filo, "#c9a227"))
}

/** Dónde van las luces de color de cada pared (x a lo largo de la pared). */
function lavadosDe(id: IdPared): number[] {
  if (id === "fondo") return [-6.6, -3.7, 3.7, 6.6]
  if (id === "frente") return []
  return [-5.0, -2.05, 1.65, 4.7].map((z) => xDeZ(id, z))
}

/** Dónde van los apliques (salón elegante): entre las ventanas de los costados. */
function apliquesDe(id: IdPared): number[] {
  return id === "izq" || id === "der" ? [-2.05, 1.65].map((z) => xDeZ(id, z)) : []
}

function decoracionPared(id: IdPared, largo: number, aberturas: Abertura[], d: Diseno): THREE.BufferGeometry {
  const partes: THREE.BufferGeometry[] = []
  // Zócalo por tramos: no cruza las puertas.
  let desde = -largo / 2
  for (const p of [...aberturas.filter((a) => a.abajo <= 0).sort((a, b) => a.x - b.x), null]) {
    const hasta = p ? p.x - p.ancho / 2 : largo / 2
    if (hasta - desde > 0.05) {
      const z = new THREE.BoxGeometry(hasta - desde, 0.16, 0.03)
      z.translate((desde + hasta) / 2, 0.08, 0.015)
      partes.push(conColor(z, d.zocalo))
    }
    if (p) desde = p.x + p.ancho / 2
  }
  const cornisa = new THREE.BoxGeometry(largo, 0.12, 0.07)
  cornisa.translate(0, SALA.alto - 0.06, 0.035)
  partes.push(conColor(cornisa, d.cornisa))
  for (const ab of aberturas) marcoDe(ab, d, partes)
  if (d.cortinas) for (const ab of aberturas.filter((a) => a.abajo > 0)) cortinasDe(ab, d.cortinas, partes)
  if (d.apliques) {
    for (const x of apliquesDe(id)) {
      const placa = new THREE.BoxGeometry(0.12, 0.2, 0.03)
      placa.translate(x, 2.05, 0.015)
      const brazo = new THREE.BoxGeometry(0.025, 0.025, 0.17)
      brazo.translate(x, 2.0, 0.1)
      const vela = new THREE.CylinderGeometry(0.016, 0.016, 0.09, 8)
      vela.translate(x, 2.1, 0.18)
      partes.push(conColor(placa, "#c9a227"), conColor(brazo, "#c9a227"), conColor(vela, "#fbf6ea"))
    }
  }
  // Los artefactos de las luces de color, en el piso contra la pared.
  for (const x of lavadosDe(id)) {
    const caja = new THREE.BoxGeometry(0.2, 0.09, 0.12)
    caja.translate(x, 0.045, 0.1)
    partes.push(conColor(caja, "#151515"))
  }
  return unir(partes)
}

/** Luces de color que suben por la pared (se suman a lo que hay detrás). Todas
 *  las de una pared van juntas: el color y la fuerza de cada una van en la
 *  geometría (así se dibujan de una vez). */
const VERTICE_LAVADO = /* glsl */ `
  attribute vec3 aColor;
  attribute float aFuerza;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vFuerza;
  void main() {
    vUv = uv;
    vColor = aColor;
    vFuerza = aFuerza;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const FRAGMENTO_LAVADO = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vFuerza;
  void main() {
    float x = (vUv.x - 0.5) * 2.0;
    float abanico = max(0.0, 1.0 - x * x) * pow(1.0 - vUv.y, 1.5);
    float foco = exp(-x * x * 10.0) * exp(-vUv.y * 6.0);
    float a = (abanico * 0.6 + foco * 0.7) * vFuerza;
    gl_FragColor = vec4(vColor, a);
  }
`

/** Colores para las luces de las paredes: los del festejo que no son casi
 *  blancos, más uno cálido del salón. */
function coloresLavado(paleta: string[], calido: string): THREE.Color[] {
  const hsl = { h: 0, s: 0, l: 0 }
  const fuertes = paleta
    .map((c) => new THREE.Color(c))
    .filter((c) => {
      c.getHSL(hsl)
      return hsl.l < 0.82 && hsl.s > 0.2
    })
  return [...fuertes, new THREE.Color(calido)]
}

class Pared {
  readonly grupo = new THREE.Group()
  /** Lo que se achica cuando la pared baja. */
  readonly cuerpo = new THREE.Group()
  /** Lo que se esconde con la pared baja (los brillos, el cartel). */
  readonly sueltos: THREE.Object3D[] = []
  readonly afuera: THREE.Vector3
  readonly punto: THREE.Vector3
  factor = 1

  constructor(x: number, z: number, giro: number) {
    this.grupo.position.set(x, 0, z)
    this.grupo.rotation.y = giro
    this.grupo.add(this.cuerpo)
    // Hacia afuera del salón (la pared mira hacia adentro).
    this.afuera = new THREE.Vector3(-Math.sin(giro), 0, -Math.cos(giro))
    this.punto = new THREE.Vector3(x, 0, z)
  }
}

// ── Arañas ──────────────────────────────────────────────────────────────────

/** Dónde cuelga cada araña (de las tres vigas: z = −2, 0,6 y 3,2). */
const ARANAS: Array<{ x: number; z: number; grande?: boolean }> = [
  { x: 0, z: -2.0, grande: true },
  { x: -4.6, z: -2.0 },
  { x: 4.6, z: -2.0 },
  { x: -3.6, z: 0.6 },
  { x: 3.6, z: 0.6 },
  { x: -2.7, z: 3.2 },
  { x: 2.7, z: 3.2 },
]
const VIGAS_Z = [-2.0, 0.6, 3.2]

interface FormaArana {
  partes: THREE.BufferGeometry[]
  /** Lamparitas, relativas al punto de donde cuelga. */
  focos: THREE.Vector3[]
  /** Brillitos de cristal (solo las de cristal). */
  destellos: THREE.Vector3[]
}

/** Una araña: dónde van sus lamparitas y, si `conPartes`, sus formas (si ya
 *  están guardadas en el Kit no hace falta armarlas otra vez). */
function formaArana(tipo: Diseno["arana"], grande: boolean, semilla: number, conPartes: boolean): FormaArana {
  const s = grande ? 1.3 : 1
  const partes: THREE.BufferGeometry[] = []
  const focos: THREE.Vector3[] = []
  const destellos: THREE.Vector3[] = []
  const a = azar(semilla)
  const pieza = (crear: THREE.BufferGeometry | (() => THREE.BufferGeometry), color: string) => {
    if (conPartes) partes.push(conColor(typeof crear === "function" ? crear() : crear, color))
  }
  if (tipo === "edison") {
    // Un aro de hierro con lamparitas colgando de cables, a distintas alturas.
    const largo = grande ? 0.5 : 0.42
    pieza(() => new THREE.CylinderGeometry(0.012, 0.012, largo, 6).translate(0, -largo / 2, 0), "#1c1c1c")
    pieza(() => new THREE.TorusGeometry(0.42 * s, 0.02, 6, 36).rotateX(Math.PI / 2).translate(0, -largo, 0), "#1c1c1c")
    for (const ang of [0, Math.PI / 2]) {
      pieza(() => new THREE.BoxGeometry(0.84 * s, 0.018, 0.018).rotateY(ang).translate(0, -largo, 0), "#1c1c1c")
    }
    const n = grande ? 12 : 8
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2
      const px = Math.cos(ang) * 0.42 * s
      const pz = Math.sin(ang) * 0.42 * s
      const caida = 0.16 + (i % 3) * 0.08
      pieza(() => new THREE.CylinderGeometry(0.004, 0.004, caida, 4).translate(px, -largo - caida / 2, pz), "#222")
      pieza(() => new THREE.CylinderGeometry(0.018, 0.018, 0.04, 6).translate(px, -largo - caida - 0.02, pz), "#2a2a2a")
      focos.push(new THREE.Vector3(px, -largo - caida - 0.075, pz))
    }
  } else if (tipo === "cristal") {
    // Dos pisos de velitas sobre aros dorados y un cristal abajo.
    const largo = grande ? 0.45 : 0.36
    pieza(() => new THREE.CylinderGeometry(0.01, 0.01, largo, 6).translate(0, -largo / 2, 0), "#c9a227")
    pieza(() => new THREE.CylinderGeometry(0.025, 0.045, 0.42 * s, 10).translate(0, -largo - 0.21 * s, 0), "#c9a227")
    pieza(() => new THREE.OctahedronGeometry(0.06 * s).scale(1, 1.6, 1).translate(0, -largo - 0.48 * s, 0), "#dff0ff")
    for (const [radio, alto, n] of [[0.26, 0.12, 6], [0.44, 0.3, 10]] as Array<[number, number, number]>) {
      const y = -largo - alto * s
      pieza(() => new THREE.TorusGeometry(radio * s, 0.014, 6, 36).rotateX(Math.PI / 2).translate(0, y, 0), "#c9a227")
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + (n === 6 ? 0.3 : 0)
        const px = Math.cos(ang) * radio * s
        const pz = Math.sin(ang) * radio * s
        pieza(() => new THREE.CylinderGeometry(0.016, 0.016, 0.08, 6).translate(px, y + 0.05, pz), "#fbf6ea")
        focos.push(new THREE.Vector3(px, y + 0.115, pz))
      }
    }
    for (let i = 0; i < 26; i++) {
      const ang = a() * Math.PI * 2
      const r = (0.12 + a() * 0.34) * s
      destellos.push(new THREE.Vector3(Math.cos(ang) * r, -largo - (0.16 + a() * 0.3) * s, Math.sin(ang) * r))
    }
  } else {
    // Hierro forjado: una cadena, un aro con brazos y velas encima.
    const largo = grande ? 0.55 : 0.45
    for (let k = 0; k < 5; k++) {
      pieza(() => {
        const eslabon = new THREE.TorusGeometry(0.03, 0.007, 4, 10)
        if (k % 2) eslabon.rotateY(Math.PI / 2)
        return eslabon.translate(0, -0.04 - k * 0.075, 0)
      }, "#2a2522")
    }
    pieza(() => new THREE.CylinderGeometry(0.012, 0.012, largo - 0.38, 6).translate(0, -0.38 - (largo - 0.38) / 2, 0), "#2a2522")
    const y = -largo - 0.18 * s
    pieza(() => new THREE.TorusGeometry(0.44 * s, 0.022, 6, 36).rotateX(Math.PI / 2).translate(0, y, 0), "#2a2522")
    pieza(() => new THREE.ConeGeometry(0.07 * s, 0.34 * s, 10).rotateX(Math.PI).translate(0, y - 0.08 * s, 0), "#2a2522")
    const n = grande ? 10 : 8
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2
      const px = Math.cos(ang) * 0.44 * s
      const pz = Math.sin(ang) * 0.44 * s
      pieza(() => new THREE.BoxGeometry(0.44 * s, 0.016, 0.016).translate(0.22 * s, 0, 0).rotateY(-ang).translate(0, y, 0), "#2a2522")
      pieza(() => new THREE.CylinderGeometry(0.035, 0.022, 0.035, 8).translate(px, y + 0.03, pz), "#2a2522")
      pieza(() => new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8).translate(px, y + 0.105, pz), "#f4ead6")
      focos.push(new THREE.Vector3(px, y + 0.19, pz))
    }
  }
  return { partes, focos, destellos }
}

// ── Plantas ─────────────────────────────────────────────────────────────────

const MACETAS: Array<[number, number]> = [[-7.12, -5.12], [7.12, -5.12], [-7.12, 5.12], [7.12, 5.12]]

function geometriaMacetas(estilo: EstiloSala, d: Diseno): THREE.BufferGeometry {
  const partes: THREE.BufferGeometry[] = []
  const a = azar(71)
  for (const [x, z] of MACETAS) {
    if (estilo === "salon") {
      // Urna blanca con un árbol podado en bola.
      const perfil = [[0, 0], [0.14, 0.02], [0.17, 0.08], [0.12, 0.2], [0.2, 0.42], [0.22, 0.48], [0, 0.48]].map(([r, y]) => new THREE.Vector2(r, y))
      partes.push(conColor(new THREE.LatheGeometry(perfil, 18).translate(x, 0, z), d.maceta))
      partes.push(conColor(new THREE.CylinderGeometry(0.025, 0.03, 0.45, 6).translate(x, 0.68, z), "#4a3424"))
      partes.push(conColor(new THREE.IcosahedronGeometry(0.34, 1).translate(x, 1.12, z), d.planta))
    } else {
      partes.push(conColor(new THREE.CylinderGeometry(0.25, 0.19, 0.44, 14).translate(x, 0.22, z), d.maceta))
      partes.push(conColor(new THREE.CylinderGeometry(0.035, 0.05, 0.7, 6).translate(x, 0.75, z), "#4a3424"))
      for (let k = 0; k < 5; k++) {
        const hoja = new THREE.IcosahedronGeometry(0.22 + a() * 0.08, 1)
        hoja.translate(x + (a() - 0.5) * 0.36, 1.05 + a() * 0.4, z + (a() - 0.5) * 0.36)
        partes.push(conColor(hoja, k % 2 ? d.planta : "#2a4a32"))
      }
      if (estilo === "casona") {
        // Un limonero.
        for (let k = 0; k < 8; k++) {
          const limon = new THREE.SphereGeometry(0.04, 6, 4)
          limon.translate(x + (a() - 0.5) * 0.5, 1.0 + a() * 0.45, z + (a() - 0.5) * 0.5)
          partes.push(conColor(limon, "#e7c94a"))
        }
      }
    }
  }
  return unir(partes)
}

/** Las vigas de arriba (de donde cuelgan las arañas). */
function geometriaVigas(d: Diseno): THREE.BufferGeometry {
  const partes: THREE.BufferGeometry[] = []
  const v = d.viga
  for (const z of VIGAS_Z) {
    const viga = new THREE.BoxGeometry(2 * SALA.x, v.alto, v.ancho)
    viga.translate(0, SALA.alto - 0.02 - v.alto / 2, z)
    partes.push(conColor(viga, v.color))
    if (v.filo) {
      const filo = new THREE.BoxGeometry(2 * SALA.x, 0.022, v.ancho + 0.006)
      filo.translate(0, SALA.alto - 0.02 - v.alto + 0.011, z)
      partes.push(conColor(filo, v.filo))
    }
  }
  return unir(partes)
}

/**
 * Un salón cerrado, con el estilo de cada salón. Las paredes bajan solas
 * cuando tapan la vista (`cortar`), las arañas se prenden con los pasos y las
 * luces de color de las paredes toman los colores del festejo.
 */
export function crearInterior(kit: Kit, estilo: EstiloSala, reducido: boolean): Entorno {
  const d = DISENOS[estilo]
  const grupo = new THREE.Group()
  const matPared = materialPared(kit, estilo)
  const matCanto = kit.recurso(`mat-canto-${estilo}`, () => std({ color: d.canto, roughness: 0.9 }))
  const matVidrio = kit.recurso("mat-vidrio-noche", () =>
    std({ color: "#1b2a3f", emissive: "#13223a", emissiveIntensity: 0.9, roughness: 0.12, metalness: 0.45 }),
  )
  const matVidrioClaro = kit.recurso("mat-vidrio-claro", () =>
    std({ color: "#a9cfe0", transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, depthWrite: false }),
  )
  const paredes: Pared[] = []
  const matLavado = new THREE.ShaderMaterial({
    vertexShader: VERTICE_LAVADO,
    fragmentShader: FRAGMENTO_LAVADO,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  /** Las luces de color de cada pared: desde qué número y cuántas. */
  const lavados: Array<{ geo: THREE.BufferGeometry; desde: number; n: number }> = []
  let cantidadLavados = 0
  const brillosPiso: THREE.Points[] = []
  const brillosApliques: THREE.Points[] = []
  const propios: Array<{ dispose(): void }> = [matLavado]
  let letrero: Letrero | null = null

  for (const def of PAREDES) {
    const p = new Pared(def.x, def.z, def.giro)
    const aberturas = aberturasDe(def.id, d)
    p.cuerpo.add(new THREE.Mesh(kit.geo(`pared-${estilo}-${def.id}`, () => geometriaPared(def.largo, aberturas)), [matPared, matCanto]))
    p.cuerpo.add(new THREE.Mesh(kit.geo(`deco-${estilo}-${def.id}`, () => decoracionPared(def.id, def.largo, aberturas, d)), kit.mat.colores))
    for (const claro of [false, true]) {
      const conVidrio = aberturas.filter((a) => !a.libre && !!a.claro === claro)
      if (!conVidrio.length) continue
      const vidrio = new THREE.Mesh(
        kit.geo(`vidrio-${estilo}-${def.id}-${claro}`, () =>
          unir(conVidrio.map((a) => new THREE.ShapeGeometry(trazarAbertura(new THREE.Shape(), a), 12).translate(0, 0, -SALA.grosor / 2))),
        ),
        claro ? matVidrioClaro : matVidrio,
      )
      if (claro) vidrio.renderOrder = 2
      p.cuerpo.add(vidrio)
    }
    // Luces de color sobre la pared y su brillo en el piso.
    const xs = lavadosDe(def.id)
    if (xs.length) {
      // Cuatro vértices por luz (planos unidos en orden).
      const geo = unir(xs.map((x) => new THREE.PlaneGeometry(1.25, 2.85).translate(x, 1.475, 0.03)))
      const n = geo.attributes.position.count
      geo.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(n * 3), 3))
      geo.setAttribute("aFuerza", new THREE.BufferAttribute(new Float32Array(n), 1))
      propios.push(geo)
      const malla = new THREE.Mesh(geo, matLavado)
      malla.renderOrder = 3
      malla.frustumCulled = false
      p.cuerpo.add(malla)
      p.sueltos.push(malla)
      lavados.push({ geo, desde: cantidadLavados, n: xs.length })
      cantidadLavados += xs.length
      const brillo = kit.halos(xs.map((x) => new THREE.Vector3(x, 0.06, 0.26)), d.calido, 0.8, 0, true)
      propios.push(brillo.geometry)
      p.cuerpo.add(brillo)
      brillosPiso.push(brillo)
    }
    if (d.apliques) {
      const xsA = apliquesDe(def.id)
      if (xsA.length) {
        const brillo = kit.halos(xsA.map((x) => new THREE.Vector3(x, 2.2, 0.18)), d.colorHalo, 0.55, 0)
        propios.push(brillo.geometry)
        p.cuerpo.add(brillo)
        p.sueltos.push(brillo)
        brillosApliques.push(brillo)
      }
    }
    if (def.id === "fondo" && d.letrero) {
      letrero = new Letrero(kit, 2.2, true)
      letrero.grupo.position.set(-4.6, 2.42, 0.02)
      p.cuerpo.add(letrero.grupo)
      p.sueltos.push(letrero.grupo)
    }
    paredes.push(p)
    grupo.add(p.grupo)
  }

  // Vigas, arañas y plantas. Las vigas y las arañas se desvanecen cuando la
  // cámara baja a mostrar algo de cerca (si no, tapan lo que se muestra).
  const matVigas = kit.mat.colores.clone()
  const matAranas = kit.mat.coloresBrillo.clone()
  for (const m of [matVigas, matAranas]) {
    m.transparent = true
    propios.push(m)
  }
  const techo = new THREE.Group()
  grupo.add(techo)
  techo.add(new THREE.Mesh(kit.geo(`vigas-${estilo}`, () => geometriaVigas(d)), matVigas))
  const yColgado = SALA.alto - 0.02 - d.viga.alto
  const aranas = ARANAS.map((ar, i) => ({ ...ar, semilla: 80 + i, forma: formaArana(d.arana, !!ar.grande, 80 + i, false) }))
  techo.add(
    new THREE.Mesh(
      kit.geo(`aranas-${estilo}`, () =>
        unir(
          aranas.flatMap((ar) =>
            formaArana(d.arana, !!ar.grande, ar.semilla, true).partes.map((g) => g.translate(ar.x, yColgado, ar.z)),
          ),
        ),
      ),
      matAranas,
    ),
  )
  // Se prenden de adelante hacia atrás, una araña por vez.
  const puntos: THREE.Vector3[] = []
  const orden: number[] = []
  const porAdelante = aranas.map((_, i) => i).sort((i, j) => aranas[j].z - aranas[i].z || aranas[i].x - aranas[j].x)
  const inicio: number[] = []
  for (const ar of aranas) {
    inicio.push(puntos.length)
    for (const f of ar.forma.focos) puntos.push(new THREE.Vector3(ar.x + f.x, yColgado + f.y, ar.z + f.z))
  }
  for (const i of porAdelante) for (let k = 0; k < aranas[i].forma.focos.length; k++) orden.push(inicio[i] + k)
  const luces = new Lamparitas(kit, puntos, reducido, {
    orden,
    colorPrendido: d.colorLuz,
    colorHalo: d.colorHalo,
    tamHalo: d.arana === "edison" ? 0.34 : 0.26,
    escala: d.arana === "edison" ? 0.8 : 0.55,
  })
  grupo.add(luces.grupo)
  const destellos = aranas.flatMap((ar) => ar.forma.destellos.map((v) => new THREE.Vector3(ar.x + v.x, yColgado + v.y, ar.z + v.z)))
  const cristales = destellos.length ? kit.halos(destellos, ["#ffffff", "#e6f3ff", "#fff4dc"], 0.12, 0) : null
  if (cristales) {
    propios.push(cristales.geometry)
    grupo.add(cristales)
  }
  grupo.add(new THREE.Mesh(kit.geo(`macetas-${estilo}`, () => geometriaMacetas(estilo, d)), kit.mat.colores))

  // ── Estado ──
  let alTecho = 1
  let nivelMeta = 0
  let nivel = 0
  let festejo = false
  let colores = coloresLavado([], d.calido)
  let clavePaleta = ""
  const tmp = new THREE.Vector3()
  const pintarColores = () => {
    let i = 0
    for (const b of brillosPiso) {
      const c = b.geometry.getAttribute("aColor") as THREE.BufferAttribute
      for (let k = 0; k < c.count; k++, i++) {
        const col = colores[i % colores.length]
        c.setXYZ(k, col.r, col.g, col.b)
      }
      c.needsUpdate = true
    }
  }

  return {
    grupo,
    luces,
    cortar(camara, dt, inmediato) {
      let cambio = false
      for (const p of paredes) {
        // Positivo: la cámara está del lado de afuera de esa pared (la tapa).
        const s = tmp.copy(camara).sub(p.punto).dot(p.afuera)
        const k = THREE.MathUtils.smoothstep(s, -0.4, 1.2)
        const meta = 1 - k * (1 - BAJA)
        let f = inmediato ? meta : p.factor + (meta - p.factor) * Math.min(1, dt * 5)
        if (Math.abs(meta - f) < 1e-3) f = meta
        if (f !== p.factor) {
          p.factor = f
          p.cuerpo.scale.y = f
          const ver = f > 0.55
          for (const o of p.sueltos) o.visible = ver
          cambio = true
        }
      }
      // El techo (vigas y arañas): se ve desde lejos y se va al acercarse.
      const metaTecho = THREE.MathUtils.smoothstep(camara.y, 7.5, 10.0)
      let ft = inmediato ? metaTecho : alTecho + (metaTecho - alTecho) * Math.min(1, dt * 4)
      if (Math.abs(metaTecho - ft) < 1e-3) ft = metaTecho
      if (ft !== alTecho) {
        alTecho = ft
        matVigas.opacity = ft
        matAranas.opacity = ft
        techo.visible = ft > 0.01
        luces.opacidad = ft
        cambio = true
      }
      return cambio
    },
    setNombre(nombre) {
      letrero?.setNombre(nombre)
    },
    setPaleta(paleta) {
      const clave = paleta.join(",")
      if (clave === clavePaleta) return
      clavePaleta = clave
      colores = coloresLavado(paleta, d.calido)
      pintarColores()
    },
    setNivel(n, f) {
      nivelMeta = Math.max(0, Math.min(1, n))
      festejo = f
    },
    avanzar(dt, t) {
      luces.festejo = festejo
      luces.avanzar(dt, t)
      nivel = reducido ? nivelMeta : nivel + (nivelMeta - nivel) * Math.min(1, dt * 1.6)
      for (const l of lavados) {
        const col = l.geo.getAttribute("aColor") as THREE.BufferAttribute
        const fu = l.geo.getAttribute("aFuerza") as THREE.BufferAttribute
        for (let j = 0; j < l.n; j++) {
          const i = l.desde + j
          let fuerza = 0.05 + 0.42 * nivel
          let c = colores[i % colores.length]
          if (festejo && !reducido) {
            // En el festejo, las luces laten y van cambiando de color.
            fuerza *= 0.7 + 0.5 * Math.max(0, Math.sin(t * 3.1 + i * 0.9))
            c = colores[(i + Math.floor(t * 1.3)) % colores.length]
          }
          for (let v = 0; v < 4; v++) {
            col.setXYZ(j * 4 + v, c.r, c.g, c.b)
            fu.setX(j * 4 + v, fuerza)
          }
        }
        col.needsUpdate = true
        fu.needsUpdate = true
      }
      for (const b of brillosPiso) {
        const br = b.geometry.getAttribute("aBrillo") as THREE.BufferAttribute
        for (let k = 0; k < br.count; k++) br.setX(k, 0.06 + 0.3 * nivel)
        br.needsUpdate = true
      }
      for (const b of brillosApliques) {
        const br = b.geometry.getAttribute("aBrillo") as THREE.BufferAttribute
        for (let k = 0; k < br.count; k++) br.setX(k, 0.25 + 0.7 * nivel)
        br.needsUpdate = true
      }
      if (cristales) {
        const br = cristales.geometry.getAttribute("aBrillo") as THREE.BufferAttribute
        for (let k = 0; k < br.count; k++) {
          const titila = reducido ? 0.4 : Math.pow(Math.max(0, Math.sin(t * 2.6 + k * 1.93)), 10)
          br.setX(k, titila * 1.4 * nivel * alTecho)
        }
        br.needsUpdate = true
      }
    },
    liberar() {
      luces.liberar()
      letrero?.liberar()
      for (const r of propios) r.dispose()
    },
  }
}

// ── El terreno de la Casona: la casa para quedarse y la pileta ──────────────

/** El terreno de la Casona va pegado a la izquierda del jardín. */
export const TERRENO = { x0: -14.7, x1: -7.4, z0: -6, z1: 6 }
const CASA = { x: -11.45, z: -3.75, ancho: 5.0, fondo: 2.4, planta: 1.5, alta: 1.3 }
const PILETA = { x: -12.15, z: 1.5, ancho: 2.6, largo: 3.8 }

/** Techo a cuatro aguas (la cumbrera va a lo largo de x). */
function techoCuatroAguas(ancho: number, fondo: number, alto: number, vuelo: number): THREE.BufferGeometry {
  const a = ancho / 2 + vuelo
  const f = fondo / 2 + vuelo
  const r = Math.max(0, a - f)
  const FI = [-a, 0, f]
  const FD = [a, 0, f]
  const AD = [a, 0, -f]
  const AI = [-a, 0, -f]
  const CI = [-r, alto, 0]
  const CD = [r, alto, 0]
  const caras = [FI, FD, CD, FI, CD, CI, AD, AI, CI, AD, CI, CD, AI, FI, CI, FD, AD, CD]
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(caras.flat(), 3))
  g.computeVertexNormals()
  const col = new Float32Array(caras.length * 3)
  const frente = new THREE.Color("#a9573b")
  const lado = new THREE.Color("#9a4e34")
  for (let i = 0; i < caras.length; i++) {
    const c = i < 12 ? frente : lado
    col.set([c.r, c.g, c.b], i * 3)
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3))
  g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(caras.length * 2), 2))
  return g
}

interface FormaCasa {
  cuerpo: THREE.BufferGeometry
  prendidas: THREE.BufferGeometry
  apagadas: THREE.BufferGeometry
}

/** Los faroles a los lados de la puerta (relativos al centro de la casa). */
const FAROLES = [-0.72, 0.72].map((x) => new THREE.Vector3(x, 1.12, CASA.fondo / 2 + 0.14))

/** La casa de dos plantas, con galería de columnas, balcón y postigos verdes.
 *  Medidas relativas a su centro; el frente mira hacia +z. */
function formaCasa(): FormaCasa {
  const { ancho: W, fondo: D, planta, alta } = CASA
  const H = planta + alta
  const frente = D / 2
  const partes: THREE.BufferGeometry[] = []
  const caja = (w: number, h: number, d: number, x: number, y: number, z: number, color: string) =>
    partes.push(conColor(new THREE.BoxGeometry(w, h, d).translate(x, y, z), color))
  caja(W + 0.06, 0.22, D + 0.06, 0, 0.11, 0, "#9b9282")
  caja(W, H, D, 0, H / 2, 0, "#ece2cf")
  caja(W + 0.05, 0.07, D + 0.05, 0, planta + 0.02, 0, "#d9ccb2")
  caja(W + 0.16, 0.1, D + 0.16, 0, H + 0.02, 0, "#d9ccb2")
  partes.push(techoCuatroAguas(W, D, 0.95, 0.22).translate(0, H + 0.07, 0))
  caja(W - D + 0.1, 0.06, 0.12, 0, H + 1.02, 0, "#8f4530")
  caja(0.32, 0.55, 0.32, 1.35, H + 0.7, -0.35, "#cdbfa6")
  caja(0.4, 0.06, 0.4, 1.35, H + 1.0, -0.35, "#8d8574")
  // Galería: piso, columnas, el techo (que es el piso del balcón) y la baranda.
  caja(W + 0.1, 0.1, 1.0, 0, 0.05, frente + 0.5, "#b8ab94")
  for (const x of [-2.4, -1.2, 1.2, 2.4]) {
    partes.push(conColor(new THREE.CylinderGeometry(0.065, 0.075, planta - 0.08, 10).translate(x, (planta - 0.08) / 2 + 0.06, frente + 0.9), "#f1e9d8"))
    caja(0.18, 0.06, 0.18, x, planta - 0.05, frente + 0.9, "#e4d9c4")
  }
  caja(W + 0.1, 0.1, 1.05, 0, planta + 0.03, frente + 0.525, "#e4d9c4")
  caja(W + 0.1, 0.24, 0.06, 0, planta - 0.1, frente + 1.03, "#e4d9c4")
  const hierro = "#2a2826"
  caja(W + 0.1, 0.035, 0.035, 0, planta + 0.56, frente + 1.03, hierro)
  for (let x = -W / 2; x <= W / 2 + 0.01; x += 0.14) caja(0.018, 0.48, 0.018, x, planta + 0.32, frente + 1.03, hierro)
  for (const x of [-W / 2 - 0.03, W / 2 + 0.03]) {
    caja(0.035, 0.035, 1.03, x, planta + 0.56, frente + 0.52, hierro)
    for (let z = frente + 0.1; z < frente + 1.0; z += 0.14) caja(0.018, 0.48, 0.018, x, planta + 0.32, z, hierro)
  }
  // Puerta de madera con un medio punto de vidrio arriba.
  caja(1.02, 1.36, 0.05, 0, 0.78, frente + 0.01, "#d9ccb2")
  caja(0.9, 1.25, 0.06, 0, 0.73, frente + 0.02, "#4a3223")
  caja(0.02, 1.2, 0.07, 0, 0.73, frente + 0.03, "#2f2016")
  const prendidas: THREE.BufferGeometry[] = []
  const apagadas: THREE.BufferGeometry[] = []
  const vidrio = (lista: THREE.BufferGeometry[], w: number, h: number, x: number, y: number, z: number, giro = 0) =>
    lista.push(new THREE.PlaneGeometry(w, h).rotateY(giro).translate(x, y, z))
  prendidas.push(new THREE.CircleGeometry(0.45, 16, 0, Math.PI).translate(0, 1.36, frente + 0.03))
  const ventana = (x: number, y: number, w: number, h: number, prendida: boolean, postigos: boolean) => {
    caja(w + 0.08, h + 0.08, 0.04, x, y, frente + 0.01, "#d9ccb2")
    vidrio(prendida ? prendidas : apagadas, w, h, x, y, frente + 0.035)
    caja(0.02, h, 0.05, x, y, frente + 0.04, "#3a2a1e")
    caja(w, 0.02, 0.05, x, y + h * 0.18, frente + 0.04, "#3a2a1e")
    if (postigos) for (const lado of [-1, 1]) caja(0.18, h, 0.03, x + lado * (w / 2 + 0.13), y, frente + 0.02, "#3f6a55")
  }
  // Planta baja: dos ventanas grandes. Planta alta: cuatro ventanas y la puerta del balcón.
  ventana(-1.8, 0.82, 0.66, 1.0, true, false)
  ventana(1.8, 0.82, 0.66, 1.0, true, false)
  ventana(-2.0, planta + 0.68, 0.5, 0.78, true, true)
  ventana(-1.0, planta + 0.68, 0.5, 0.78, false, true)
  ventana(1.0, planta + 0.68, 0.5, 0.78, true, true)
  ventana(2.0, planta + 0.68, 0.5, 0.78, false, true)
  ventana(0, planta + 0.6, 0.62, 0.98, true, false)
  // Ventanas de los costados.
  for (const lado of [-1, 1]) {
    for (const [y, prendida] of [[0.82, lado > 0], [planta + 0.68, lado < 0]] as Array<[number, boolean]>) {
      vidrio(prendida ? prendidas : apagadas, 0.5, 0.78, lado * (W / 2 + 0.006), y, 0, lado * (Math.PI / 2))
      partes.push(conColor(new THREE.BoxGeometry(0.03, 0.86, 0.58).translate(lado * (W / 2 + 0.002), y, 0), "#d9ccb2"))
    }
  }
  // Faroles a los lados de la puerta y canteros con flores.
  for (const x of [-0.72, 0.72]) caja(0.09, 0.16, 0.09, x, 1.12, frente + 0.07, hierro)
  const a = azar(91)
  for (const x of [-2.1, -1.45, -0.85, 0.85, 1.45, 2.1]) {
    const mata = new THREE.IcosahedronGeometry(0.24 + a() * 0.05, 1)
    mata.scale(1, 0.85, 0.9)
    partes.push(conColor(mata.translate(x, 0.22, frente + 1.3), a() > 0.5 ? "#2a5a3a" : "#245033"))
    for (let k = 0; k < 3; k++) {
      const flor = new THREE.IcosahedronGeometry(0.045, 0)
      partes.push(conColor(flor.translate(x + (a() - 0.5) * 0.3, 0.38 + a() * 0.06, frente + 1.3 + (a() - 0.5) * 0.24), a() > 0.5 ? "#f8f2e4" : "#e8a3b5"))
    }
  }
  return { cuerpo: unir(partes), prendidas: unir(prendidas), apagadas: unir(apagadas) }
}

/** El agua de la pileta, iluminada de noche: celeste que brilla y reflejos que se mueven. */
const VERTICE_AGUA = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const FRAGMENTO_AGUA = /* glsl */ `
  uniform float uTiempo;
  uniform vec2 uTam;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv * uTam * 2.3;
    float t = uTiempo;
    float w = sin(p.x * 2.1 + t * 0.9 + sin(p.y * 1.7 - t * 0.6) * 1.6)
            + sin(p.y * 2.6 - t * 1.1 + sin(p.x * 1.3 + t * 0.7) * 1.4);
    float reflejo = pow(max(0.0, 1.0 - abs(w) * 0.55), 7.0);
    vec2 b = min(vUv, 1.0 - vUv) * uTam;
    float borde = smoothstep(0.0, 0.55, min(b.x, b.y));
    vec3 hondo = vec3(0.02, 0.26, 0.34);
    vec3 claro = vec3(0.12, 0.66, 0.74);
    vec3 col = mix(hondo, claro, 0.25 + 0.75 * borde);
    col += vec3(0.6, 0.95, 1.0) * reflejo * 0.34;
    gl_FragColor = vec4(col, 1.0);
  }
`

/** Una palmera: tronco que se curva un poco y hojas que caen. */
function geometriaPalmera(x: number, z: number, alto: number): THREE.BufferGeometry {
  const partes: THREE.BufferGeometry[] = []
  const tramos = 7
  let px = x
  let py = 0
  for (let i = 0; i < tramos; i++) {
    const h = alto / tramos
    const r0 = 0.09 - i * 0.004
    const g = new THREE.CylinderGeometry(r0 - 0.004, r0, h, 8)
    g.translate(px, py + h / 2, z)
    partes.push(conColor(g, i % 2 ? "#7a5a3c" : "#6b4d33"))
    px += 0.035 + i * 0.008
    py += h
  }
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * Math.PI * 2
    const hoja = new THREE.SphereGeometry(1, 8, 4)
    hoja.scale(0.13, 0.03, 0.78)
    hoja.translate(0, 0, 0.62)
    hoja.rotateX(0.42 + (i % 3) * 0.1)
    hoja.rotateY(ang)
    hoja.translate(px, py + 0.04, z)
    partes.push(conColor(hoja, i % 2 ? "#2f7040" : "#3c8048"))
  }
  return unir(partes)
}

function formaPileta(): THREE.BufferGeometry {
  const { ancho, largo } = PILETA
  const partes: THREE.BufferGeometry[] = []
  const caja = (w: number, h: number, d: number, x: number, y: number, z: number, color: string) =>
    partes.push(conColor(new THREE.BoxGeometry(w, h, d).translate(x, y, z), color))
  // Borde de piedra clara.
  const b = 0.2
  caja(ancho + 2 * b, 0.06, b, 0, 0.07, -largo / 2 - b / 2, "#ece3d0")
  caja(ancho + 2 * b, 0.06, b, 0, 0.07, largo / 2 + b / 2, "#ece3d0")
  caja(b, 0.06, largo, -ancho / 2 - b / 2, 0.07, 0, "#ece3d0")
  caja(b, 0.06, largo, ancho / 2 + b / 2, 0.07, 0, "#ece3d0")
  // Dos reposeras con toallas y una sombrilla.
  for (const [z, toalla] of [[-1.15, "#2f8f5b"], [0.75, "#f3cf7a"]] as Array<[number, string]>) {
    const x = 2.3
    caja(0.6, 0.06, 1.7, x, 0.24, z, "#f4efe4")
    for (const [dx, dz] of [[-0.25, -0.75], [0.25, -0.75], [-0.25, 0.75], [0.25, 0.75]]) caja(0.04, 0.22, 0.04, x + dx, 0.11, z + dz, "#d8d1c3")
    caja(0.54, 0.06, 1.15, x, 0.3, z + 0.22, "#f7f1e6")
    partes.push(conColor(new THREE.BoxGeometry(0.54, 0.06, 0.56).rotateX(0.95).translate(x, 0.47, z - 0.6), "#f7f1e6"))
    caja(0.48, 0.012, 0.62, x, 0.34, z + 0.3, toalla)
  }
  partes.push(conColor(new THREE.CylinderGeometry(0.025, 0.025, 2.1, 6).translate(2.95, 1.05, -0.2), "#d8d1c3"))
  partes.push(conColor(new THREE.ConeGeometry(0.9, 0.36, 10).translate(2.95, 2.18, -0.2), "#f3ead8"))
  return unir(partes)
}

/**
 * El terreno de la Casona: un bloque de pasto pegado al jardín, con la casa
 * para quedarse y la pileta. `casa`, `pileta` y `verde` crecen aparte (las
 * anima el motor cuando el terreno sube).
 */
export class TerrenoCasona implements Pieza3D {
  grupo = new THREE.Group()
  readonly casa = new THREE.Group()
  readonly pileta = new THREE.Group()
  readonly verde = new THREE.Group()
  private agua: THREE.ShaderMaterial
  private letrero: Letrero
  private velas: THREE.InstancedMesh
  private llamas: THREE.Points
  private datosVelas: Array<{ x: number; z: number; fase: number; radio: number }> = []
  private propios: Array<{ dispose(): void }> = []
  private m = new THREE.Matrix4()

  constructor(
    kit: Kit,
    private reducido: boolean,
  ) {
    const { x0, x1, z0, z1 } = TERRENO
    const bloque = new THREE.Mesh(kit.geo("terreno-casona", () => geometriaBloque(x0, z0, x1 - x0, z1 - z0)), [kit.mat.cesped, kit.mat.tierra])
    // Apenas más bajo que el jardín: donde se pisan, se ve el jardín.
    bloque.position.y = -0.121
    this.grupo.add(bloque)

    // La casa (se arma una sola vez y queda guardada en el Kit).
    let forma: FormaCasa | null = null
    const armada = () => (forma ??= formaCasa())
    this.casa.add(new THREE.Mesh(kit.geo("casa-cuerpo", () => armada().cuerpo), kit.mat.colores))
    this.casa.add(new THREE.Mesh(kit.geo("casa-prendidas", () => armada().prendidas), kit.mat.ventana))
    this.casa.add(
      new THREE.Mesh(
        kit.geo("casa-apagadas", () => armada().apagadas),
        kit.recurso("mat-vidrio-apagado", () => std({ color: "#1d2633", emissive: "#0f1724", emissiveIntensity: 0.7, roughness: 0.2, metalness: 0.3 })),
      ),
    )
    const faroles = kit.halos(FAROLES, "#ffcf7d", 0.5, 0.9)
    this.propios.push(faroles.geometry)
    this.casa.add(faroles)
    this.letrero = new Letrero(kit, 1.9, true)
    this.letrero.grupo.position.set(0, CASA.planta - 0.1, CASA.fondo / 2 + 1.07)
    this.casa.add(this.letrero.grupo)
    this.casa.add(kit.sombraBajo(6.2, 4.2).translateZ(0.4))
    this.casa.position.set(CASA.x, 0, CASA.z)
    this.grupo.add(this.casa)

    // La pileta: el deck de madera, el agua, el borde, las reposeras y las velas.
    const { ancho, largo } = PILETA
    const madera = kit.recurso("tex-deck", () => {
      const t = kit.recurso("tex-madera", () => porMetro(texturaMadera(), 2)).clone()
      t.repeat.set(4.7 / 2, 4.75 / 2)
      t.needsUpdate = true
      return t
    })
    const deck = new THREE.Mesh(
      kit.geo("deck", () => new THREE.BoxGeometry(4.7, 0.04, 4.75)),
      kit.recurso("mat-deck", () => std({ map: madera, roughness: 0.7 })),
    )
    deck.position.set(0.6, 0.02, 0.025)
    this.pileta.add(deck)
    this.agua = new THREE.ShaderMaterial({
      uniforms: { uTiempo: { value: 0 }, uTam: { value: new THREE.Vector2(ancho, largo) } },
      vertexShader: VERTICE_AGUA,
      fragmentShader: FRAGMENTO_AGUA,
    })
    this.propios.push(this.agua)
    const agua = new THREE.Mesh(kit.geo("agua", () => new THREE.PlaneGeometry(ancho, largo).rotateX(-Math.PI / 2)), this.agua)
    agua.position.y = 0.045
    this.pileta.add(agua)
    this.pileta.add(new THREE.Mesh(kit.geo("pileta", formaPileta), kit.mat.colores))
    // Luces bajo el agua y un resplandor celeste.
    const luces = kit.halos(
      [-1.2, 0, 1.2].flatMap((z) => [new THREE.Vector3(-0.85, 0.07, z), new THREE.Vector3(0.85, 0.07, z)]),
      "#5fe0ff",
      0.95,
      0.3,
      true,
    )
    const resplandor = kit.halos([new THREE.Vector3(0, 0.3, 0)], "#38c8e8", 3.2, 0.07, true)
    this.propios.push(luces.geometry, resplandor.geometry)
    this.pileta.add(luces, resplandor)
    // Velas flotando.
    const a = azar(97)
    for (let i = 0; i < 7; i++) this.datosVelas.push({ x: (a() - 0.5) * 1.7, z: (a() - 0.5) * 2.9, fase: a() * 6, radio: 0.08 + a() * 0.14 })
    this.velas = new THREE.InstancedMesh(kit.geo("vela-flotante", () => new THREE.CylinderGeometry(0.045, 0.045, 0.045, 10)), kit.mat.crema, this.datosVelas.length)
    this.llamas = kit.halos(this.datosVelas.map((v) => new THREE.Vector3(v.x, 0.12, v.z)), "#ffc56b", 0.24, 0.95)
    this.propios.push(this.llamas.geometry)
    this.pileta.add(this.velas, this.llamas)
    this.pileta.position.set(PILETA.x, 0, PILETA.z)
    this.grupo.add(this.pileta)

    // Árboles, una palmera y piedras del camino.
    this.verde.add(
      new THREE.Mesh(
        kit.geo("terreno-verde", () => {
          const piedras: THREE.BufferGeometry[] = []
          const r = azar(13)
          for (const [x, z] of [[-11.45, -1.15], [-9.05, 3.25], [-8.55, 3.15]]) {
            const g = new THREE.CylinderGeometry(0.2, 0.22, 0.04, 9)
            g.scale(1 + r() * 0.3, 1, 0.8 + r() * 0.2)
            piedras.push(conColor(g.translate(x, 0.02, z), "#958c7a"))
          }
          return unir([
            geometriaArboles([[-14.25, -5.6, 1.0], [-8.75, -5.5, 0.85], [-8.7, 5.3, 0.75]], 33),
            geometriaPalmera(-14.1, 4.75, 2.5),
            ...piedras,
          ])
        }),
        kit.mat.colores,
      ),
    )
    this.grupo.add(this.verde)
    this.avanzar(0, 0)
  }

  setNombre(nombre: string | null) {
    this.letrero.setNombre(nombre)
  }

  avanzar(_dt: number, t: number) {
    this.agua.uniforms.uTiempo.value = this.reducido ? 0 : t
    const pos = this.llamas.geometry.getAttribute("position") as THREE.BufferAttribute
    this.datosVelas.forEach((v, i) => {
      const ang = this.reducido ? v.fase : v.fase + t * 0.12
      const x = v.x + Math.cos(ang) * v.radio
      const z = v.z + Math.sin(ang) * v.radio
      const y = 0.06 + (this.reducido ? 0 : Math.sin(t * 1.3 + v.fase) * 0.008)
      this.m.makeTranslation(x, y, z)
      this.velas.setMatrixAt(i, this.m)
      pos.setXYZ(i, x, y + 0.055, z)
    })
    this.velas.instanceMatrix.needsUpdate = true
    pos.needsUpdate = true
  }

  liberar() {
    this.letrero.liberar()
    this.velas.dispose()
    for (const r of this.propios) r.dispose()
  }
}

// ── El frente: el patio chico de la Quinta y el estacionamiento ─────────────

/** La franja del frente va pegada adelante de la isla (y del terreno de la Casona). */
export const FRENTE = { z0: 5.9, z1: 9.6 }
/** Dónde van los autos (a la derecha del camino de entrada). */
const PLAYA = { x0: 1.5, x1: 7.5, z0: 6.55, z1: 9.25 }
const COLORES_AUTOS = ["#e9e1d0", "#2f5f48", "#7c2f2c", "#5b6470"]

/** Un auto chico y redondeado (no a escala: es una maqueta). La trompa mira a la isla (−z). */
function geometriaAuto(x: number, z: number, color: string): THREE.BufferGeometry {
  const partes: THREE.BufferGeometry[] = []
  const caja = (w: number, h: number, d: number, px: number, py: number, pz: number, c: string) =>
    partes.push(conColor(new THREE.BoxGeometry(w, h, d).translate(x + px, py, z + pz), c))
  caja(0.98, 0.3, 2.05, 0, 0.3, 0, color)
  caja(0.84, 0.27, 1.08, 0, 0.585, 0.12, color)
  // Vidrios: adelante, atrás y a los costados.
  caja(0.78, 0.2, 0.02, 0, 0.6, -0.43, "#1f2a36")
  caja(0.78, 0.2, 0.02, 0, 0.6, 0.67, "#1f2a36")
  caja(0.86, 0.17, 0.9, 0, 0.6, 0.12, "#1f2a36")
  // Faros y luces de atrás.
  caja(0.2, 0.07, 0.02, -0.3, 0.36, -1.03, "#fff4d6")
  caja(0.2, 0.07, 0.02, 0.3, 0.36, -1.03, "#fff4d6")
  caja(0.2, 0.06, 0.02, -0.3, 0.38, 1.03, "#b8322b")
  caja(0.2, 0.06, 0.02, 0.3, 0.38, 1.03, "#b8322b")
  for (const [dx, dz] of [[-0.48, -0.66], [0.48, -0.66], [-0.48, 0.66], [0.48, 0.66]]) {
    partes.push(conColor(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 12).rotateZ(Math.PI / 2).translate(x + dx, 0.16, z + dz), "#161616"))
  }
  return unir(partes)
}

/** La playa de estacionamiento: el piso, las líneas, los autos y un farol. */
function geometriaPlaya(): THREE.BufferGeometry {
  const { x0, x1, z0, z1 } = PLAYA
  const partes: THREE.BufferGeometry[] = []
  partes.push(conColor(new THREE.BoxGeometry(x1 - x0, 0.03, z1 - z0).translate((x0 + x1) / 2, 0.015, (z0 + z1) / 2), "#2c3034"))
  const lugares = 4
  const ancho = (x1 - x0) / lugares
  for (let i = 0; i <= lugares; i++) {
    partes.push(conColor(new THREE.BoxGeometry(0.06, 0.01, 2.3).translate(x0 + i * ancho, 0.035, z0 + 1.25), "#e9e4d6"))
  }
  // Tres autos, uno de los lugares queda libre.
  ;[0, 1, 3].forEach((i, k) => partes.push(geometriaAuto(x0 + (i + 0.5) * ancho, z0 + 1.3, COLORES_AUTOS[k % COLORES_AUTOS.length])))
  // El farol de la esquina.
  partes.push(conColor(new THREE.CylinderGeometry(0.035, 0.05, 2.0, 8).translate(x1 + 0.25, 1.0, z1 - 0.2), "#2a2826"))
  partes.push(conColor(new THREE.BoxGeometry(0.42, 0.05, 0.12).translate(x1 + 0.1, 2.0, z1 - 0.2), "#2a2826"))
  return unir(partes)
}

/** El camino de entrada: lajas desde el frente hasta la puerta de la isla. */
function geometriaCaminoFrente(): THREE.BufferGeometry {
  const partes: THREE.BufferGeometry[] = []
  const a = azar(71)
  for (let z = FRENTE.z0 + 0.45; z < FRENTE.z1 - 0.2; z += 0.62) {
    const g = new THREE.CylinderGeometry(0.34, 0.36, 0.04, 9)
    g.scale(1.25 + a() * 0.2, 1, 0.8)
    partes.push(conColor(g.translate((a() - 0.5) * 0.12, 0.02, z), "#958c7a"))
  }
  return unir(partes)
}

/** El patio chico de la Quinta: canteros, dos bancos, árboles y unas lucecitas. */
function geometriaPatio(): THREE.BufferGeometry {
  const partes: THREE.BufferGeometry[] = []
  const a = azar(83)
  // Piso de baldosas claras.
  partes.push(conColor(new THREE.BoxGeometry(4.6, 0.025, 2.3).translate(-4.3, 0.013, 7.75), "#b9ab90"))
  for (let x = -6.6; x <= -2.0; x += 0.575) partes.push(conColor(new THREE.BoxGeometry(0.02, 0.01, 2.3).translate(x, 0.028, 7.75), "#9d8f75"))
  // Dos bancos de madera.
  for (const x of [-5.4, -3.2]) {
    partes.push(conColor(new THREE.BoxGeometry(1.1, 0.06, 0.38).translate(x, 0.34, 8.45), "#7a5a3c"))
    partes.push(conColor(new THREE.BoxGeometry(1.1, 0.3, 0.05).translate(x, 0.52, 8.62), "#6b4d33"))
    for (const dx of [-0.48, 0.48]) partes.push(conColor(new THREE.BoxGeometry(0.06, 0.32, 0.36).translate(x + dx, 0.16, 8.45), "#2a2826"))
  }
  // Una mesa redonda con dos sillas en el medio.
  partes.push(conColor(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 16).translate(-4.3, 0.62, 7.35), "#e9e1d0"))
  partes.push(conColor(new THREE.CylinderGeometry(0.04, 0.06, 0.6, 8).translate(-4.3, 0.3, 7.35), "#2a2826"))
  // Canteros con flores a los costados y un cerco bajo al frente.
  for (let x = -7.3; x <= -1.4; x += 0.45) {
    const mata = new THREE.IcosahedronGeometry(0.24 + a() * 0.05, 1)
    mata.scale(1.1, 0.75, 0.9)
    partes.push(conColor(mata.translate(x, 0.2, 9.25), a() > 0.5 ? "#1f4d31" : "#245a39"))
    if (a() > 0.4) partes.push(conColor(new THREE.IcosahedronGeometry(0.045, 0).translate(x + (a() - 0.5) * 0.3, 0.38, 9.2), a() > 0.5 ? "#f8f2e4" : "#e8a3b5"))
  }
  // Los dos postes de las lucecitas.
  for (const x of [-6.75, -1.85]) partes.push(conColor(new THREE.CylinderGeometry(0.035, 0.045, 1.9, 8).translate(x, 0.95, 6.75), "#2a2826"))
  partes.push(geometriaArboles([[-7.35, 6.65, 0.62], [-1.3, 8.6, 0.55]], 47))
  return unir(partes)
}

/** Las lucecitas del patio: cuelgan entre los dos postes. */
function lucesPatio(): THREE.Vector3[] {
  const puntos: THREE.Vector3[] = []
  for (let i = 0; i <= 8; i++) {
    const t = i / 8
    puntos.push(new THREE.Vector3(-6.75 + t * 4.9, 1.85 - Math.sin(Math.PI * t) * 0.35, 6.75))
  }
  return puntos
}

/**
 * El frente del salón: una franja de pasto adelante de la isla con el camino
 * de entrada, el patio chico (la Quinta) y el estacionamiento (la Quinta y la
 * Casona). `cosas` crece aparte (la anima el motor cuando el frente sube).
 */
export class FrenteSalon implements Pieza3D {
  grupo = new THREE.Group()
  readonly cosas = new THREE.Group()
  private propios: Array<{ dispose(): void }> = []

  constructor(kit: Kit, a: Ambiente) {
    const x0 = a.casona ? TERRENO.x0 : -ISLA.ancho / 2
    const x1 = ISLA.ancho / 2
    const clave = `frente-${x0}`
    const bloque = new THREE.Mesh(kit.geo(clave, () => geometriaBloque(x0, FRENTE.z0, x1 - x0, FRENTE.z1 - FRENTE.z0)), [kit.mat.cesped, kit.mat.tierra])
    bloque.position.y = -0.121
    this.grupo.add(bloque)

    const partes = [kit.geo("frente-camino", geometriaCaminoFrente)]
    if (a.estacionamiento) partes.push(kit.geo("frente-playa", geometriaPlaya))
    if (a.exterior === "chico") partes.push(kit.geo("frente-patio", geometriaPatio))
    // La Casona: un cerco con árboles delante de la casa y la pileta.
    if (a.casona) partes.push(kit.geo("frente-casona", () => unir([geometriaArboles([[-13.6, 8.7, 0.7], [-10.2, 9.0, 0.6], [-4.6, 8.9, 0.62]], 59)])))
    for (const g of partes) this.cosas.add(new THREE.Mesh(g, kit.mat.colores))
    const brillos: THREE.Vector3[] = []
    if (a.estacionamiento) brillos.push(new THREE.Vector3(PLAYA.x1 - 0.05, 1.93, PLAYA.z1 - 0.2))
    if (a.exterior === "chico") brillos.push(...lucesPatio())
    if (brillos.length) {
      const h = kit.halos(brillos, "#ffcf7d", 0.42, 0.85)
      this.propios.push(h.geometry)
      this.cosas.add(h)
    }
    this.grupo.add(this.cosas)
  }

  liberar() {
    for (const r of this.propios) r.dispose()
  }
}
