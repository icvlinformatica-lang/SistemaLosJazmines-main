// Ambientes de la maqueta 3D (vista de Clientes): dónde es la fiesta según el
// salón elegido (Ambiente, de lib/clientes-maqueta.ts).
// - El plano: antes de elegir salón, la isla es un plano con la grilla y, en
//   punteado, dónde van a ir la pista, las mesas y las barras.
// - El jardín (solo la Casona): pasto, árboles y la guirnalda de lamparitas.
//   Al costado, el terreno de la Casona con la casa colonial para quedarse y
//   la pileta, que se ve también cuando la fiesta es adentro.
// - Los salones cerrados (Quinta, Salón y la Casona por dentro): piso, paredes
//   con ventanas, vigas, arañas que se prenden con los pasos y luces de color
//   en las paredes. La pared que tapa la vista (según desde dónde mira la
//   cámara) baja, como en las maquetas de verdad. La Casona y la Quinta tienen
//   techo de madera (listones arriba de las vigas).
// - Al frente (la Quinta y la Casona): el camino de entrada, el estacionamiento
//   y, en la Quinta, la entrada con mucho verde y la pérgola.
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
import {
  texturaBoiserie,
  texturaFrisoMadera,
  texturaGrava,
  texturaMadera,
  texturaMarmol,
  texturaParquet,
  texturaPlano,
  texturaRevoque,
  texturaTerracota,
} from "./texturas"

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
  /** El techo de madera se ve en los planos de lejos y se va en los de cerca
   *  (si no, tapa las mesas). Lo decide el motor según el plano. */
  verTecho?(si: boolean): void
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
      const tex = kit.recurso("tex-parquet", () => porMetro(texturaParquet(), 2))
      return kit.recurso("mat-piso-quinta", () => std({ map: tex, roughness: 0.5 }))
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
  /** El techo de madera (la Casona y la Quinta): listones de adelante hacia
   *  atrás cada `paso` metros, apoyados arriba de las vigas; con `cruce`,
   *  también a lo ancho cada tantos metros (la cuadrícula fina de la Quinta y
   *  los casetones de la Casona). */
  techo: { color: string; ancho: number; alto: number; paso: number; cruce: number | null } | null
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
  // Todo el salón en madera (dicho por el dueño el 19/10/2026, con fotos):
  // paredes blancas con friso de tablas, parquet, un techo de listones en
  // cuadrícula, ventanas con marcos de madera, cortinas blancas con dorado y
  // lamparitas colgando.
  quinta: {
    piso: "quinta",
    canto: "#e6dfd3",
    zocalo: "#4a3020",
    cornisa: "#7a5234",
    marco: "#5e3f27",
    viga: { color: "#6b4a30", ancho: 0.12, alto: 0.17 },
    techo: { color: "#b08458", ancho: 0.05, alto: 0.11, paso: 0.44, cruce: 1.3 },
    arana: "edison",
    colorLuz: "#ffd59a",
    colorHalo: "#ffb760",
    calido: "#ffb45c",
    maceta: "#7a5234",
    planta: "#5f7a4f",
    cortinas: "#f1ebdf",
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
    techo: null,
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
  // La Casona por dentro: paredes a la cal, arcos, terracota, hierro forjado
  // y el techo de madera (dicho por el dueño el 19/10/2026: la fiesta es en
  // un espacio con techo de madera): vigas gruesas y casetones a la vista.
  casona: {
    piso: "casona",
    canto: "#ddd2bd",
    zocalo: "#5a3d28",
    cornisa: "#e4d9c4",
    marco: "#3d2a1c",
    viga: { color: "#3d2a1c", ancho: 0.17, alto: 0.22 },
    techo: { color: "#5c3d26", ancho: 0.12, alto: 0.14, paso: 1.3, cruce: 1.3 },
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
    const tex = kit.recurso("tex-friso-madera", () => porMetro(texturaFrisoMadera(SALA.alto), 2, SALA.alto))
    return kit.recurso("mat-pared-quinta", () => std({ map: tex, roughness: 0.86 }))
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
 * El techo de madera de la Casona y la Quinta: listones de pared a pared (de
 * adelante hacia atrás) apoyados arriba de las vigas y otros a lo ancho,
 * alineados con las vigas (los finos de la Quinta forman una cuadrícula; los
 * gruesos de la Casona, casetones). Es una maqueta: las tablas de arriba no se
 * dibujan, para que la fiesta se vea entre los listones.
 */
function geometriaTechoMadera(t: NonNullable<Diseno["techo"]>): THREE.BufferGeometry {
  const partes: THREE.BufferGeometry[] = []
  const y = SALA.alto - 0.02 + t.alto / 2
  const n = Math.floor((2 * SALA.x) / t.paso)
  const a = azar(29)
  const tono = new THREE.Color()
  for (let i = 0; i < n; i++) {
    const liston = new THREE.BoxGeometry(t.ancho, t.alto, 2 * SALA.z)
    liston.translate((i - (n - 1) / 2) * t.paso, y, 0)
    // Cada tabla apenas distinta, como la madera de verdad.
    partes.push(conColor(liston, tono.set(t.color).offsetHSL(0, 0, (a() - 0.5) * 0.06)))
  }
  if (t.cruce) {
    // Desde la viga del medio, para que los cruces caigan sobre las vigas.
    const origen = VIGAS_Z[1]
    for (let k = -Math.floor((SALA.z + origen) / t.cruce); origen + k * t.cruce < SALA.z - 0.3; k++) {
      const z = origen + k * t.cruce
      if (z < -SALA.z + 0.3) continue
      const cruce = new THREE.BoxGeometry(2 * SALA.x, t.alto, t.ancho)
      cruce.translate(0, y, z)
      partes.push(conColor(cruce, t.color))
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
  // cámara baja a mostrar algo de cerca (si no, tapan lo que se muestra). El
  // techo de madera se ve solo en los planos de lejos (verTecho): el salón
  // entero, la casa y la entrada; en los de cerca taparía las mesas.
  const matVigas = kit.mat.colores.clone()
  const matAranas = kit.mat.coloresBrillo.clone()
  const matTablas = kit.mat.colores.clone()
  for (const m of [matVigas, matAranas, matTablas]) {
    m.transparent = true
    propios.push(m)
  }
  const techo = new THREE.Group()
  grupo.add(techo)
  techo.add(new THREE.Mesh(kit.geo(`vigas-${estilo}`, () => geometriaVigas(d)), matVigas))
  const techoMadera = d.techo ? new THREE.Mesh(kit.geo(`techo-madera-${estilo}`, () => geometriaTechoMadera(d.techo!)), matTablas) : null
  if (techoMadera) grupo.add(techoMadera)
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
  let alTablas = 1
  let conTablas = true
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
      if (techoMadera) {
        const metaTablas = conTablas ? 1 : 0
        let fm = inmediato ? metaTablas : alTablas + (metaTablas - alTablas) * Math.min(1, dt * 4)
        if (Math.abs(metaTablas - fm) < 1e-3) fm = metaTablas
        if (fm !== alTablas) {
          alTablas = fm
          matTablas.opacity = fm
          techoMadera.visible = fm > 0.01
          cambio = true
        }
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
    verTecho(si) {
      conTablas = si
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

// ── El terreno de la Casona: la casa colonial para quedarse y la pileta ─────

/** El terreno de la Casona va pegado a la izquierda del jardín. */
export const TERRENO = { x0: -14.7, x1: -7.4, z0: -6, z1: 6 }
/** La casa colonial para quedarse: una planta, `alto` hasta la cornisa, con la
 *  galería de `galeria` metros al frente. */
const CASA = { x: -11.45, z: -3.75, ancho: 5.0, fondo: 2.4, alto: 2.15, galeria: 1.1 }
const PILETA = { x: -12.15, z: 1.5, ancho: 2.6, largo: 3.8 }

/** Colores de la casa colonial (las fotos del 19/10/2026): blanca, tejas de
 *  terracota, madera oscura y hierro. */
const COLONIAL = {
  pared: "#f2ede3",
  moldura: "#e6dfd2",
  zocalo: "#bdb3a2",
  azotea: "#b9ae9c",
  madera: "#5c3b25",
  maderaOscura: "#3b2618",
  hierro: "#25211e",
  piso: "#a45d3f",
  tejas: ["#b5603d", "#a85536", "#bf6a45", "#9e4f33", "#b05a39"],
}

/**
 * Un alero de tejas coloniales: canales y cobijas de terracota (ondas) sobre
 * un entablonado de madera. Arriba de todo queda en (y = 0, z = 0) y baja
 * hacia +z: `largo` más adelante está `caida` más abajo.
 */
function techoTejas(ancho: number, largo: number, caida: number): THREE.BufferGeometry {
  const onda = 0.21
  const alto = 0.035
  /** Cada hilada de tejas (de arriba hacia abajo), con su sombra donde la tapa la de arriba. */
  const hilada = 0.3
  const ang = Math.atan2(caida, largo)
  const pendiente = Math.hypot(largo, caida)
  const enPendiente = (g: THREE.BufferGeometry) => g.rotateX(ang).translate(0, -caida / 2, largo / 2)
  const tejas = new THREE.PlaneGeometry(ancho, pendiente, Math.round(ancho / onda) * 6, Math.ceil(pendiente / hilada) * 4)
  const p = tejas.attributes.position as THREE.BufferAttribute
  const col = new Float32Array(p.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < p.count; i++) {
    const u = (p.getX(i) + ancho / 2) / onda
    const s = 0.5 + 0.5 * Math.sin(u * Math.PI * 2)
    // Desde arriba (y = pendiente/2 es la punta contra la pared).
    const desde = (pendiente / 2 - p.getY(i)) / hilada
    const fila = Math.floor(desde)
    const v = desde - fila
    p.setZ(i, s * alto + v * 0.012)
    // Un tono por teja, más oscuro en el fondo de cada canal y arriba de cada
    // hilada (la sombra de la de arriba).
    const h = Math.sin((Math.floor(u) + 1) * 91.7 + fila * 13.1) * 4375.85
    const sombra = 0.78 + 0.22 * THREE.MathUtils.smoothstep(v, 0, 0.35)
    c.set(COLONIAL.tejas[Math.floor((h - Math.floor(h)) * COLONIAL.tejas.length)]).multiplyScalar((0.72 + 0.28 * s) * sombra)
    col.set([c.r, c.g, c.b], i * 3)
  }
  tejas.setAttribute("color", new THREE.BufferAttribute(col, 3))
  tejas.computeVertexNormals()
  // El plano está parado (mira a +z): se acuesta y se inclina.
  tejas.rotateX(-Math.PI / 2)
  const partes = [enPendiente(tejas)]
  partes.push(enPendiente(conColor(new THREE.BoxGeometry(ancho, 0.04, pendiente).translate(0, -0.02, 0), COLONIAL.madera)))
  for (const lado of [-1, 1]) {
    partes.push(enPendiente(conColor(new THREE.BoxGeometry(0.05, 0.08, pendiente).translate(lado * (ancho / 2 - 0.025), 0, 0), COLONIAL.moldura)))
  }
  // La teja de arriba, contra la pared.
  partes.push(conColor(new THREE.BoxGeometry(ancho, 0.06, 0.1).translate(0, 0.03, 0.04), "#8f4a30"))
  return unir(partes)
}

/** Un copón (el jarrón de remate de los pilares). */
function geometriaCopon(): THREE.BufferGeometry {
  const perfil = [
    [0, 0], [0.075, 0], [0.075, 0.025], [0.045, 0.045], [0.05, 0.07], [0.095, 0.13],
    [0.085, 0.17], [0.05, 0.2], [0.068, 0.222], [0.055, 0.24], [0, 0.245],
  ].map(([r, y]) => new THREE.Vector2(r, y))
  const copon = new THREE.LatheGeometry(perfil, 12)
  const remate = new THREE.SphereGeometry(0.032, 8, 6).translate(0, 0.27, 0)
  return unir([conColor(copon, COLONIAL.moldura), conColor(remate, COLONIAL.moldura)])
}

interface FormaCasa {
  cuerpo: THREE.BufferGeometry
  prendidas: THREE.BufferGeometry
  apagadas: THREE.BufferGeometry
}

/** Las farolas de hierro a los lados de la escalinata (relativas al centro de la casa). */
const FAROLES = [-1.35, 1.35].map((x) => new THREE.Vector3(x, 1.53, CASA.fondo / 2 + CASA.galeria + 0.3))
/** La luz de las ventanas que cae en el piso de la galería. */
const LUZ_GALERIA = [-1.55, 1.55].map((x) => new THREE.Vector3(x, 0.4, CASA.fondo / 2 + 0.35))
/** Dónde va el cartel (y su ancho): en el copete, arriba de la puerta. */
const CARTEL_CASA = { ancho: 1.4, pos: new THREE.Vector3(0, CASA.alto + 0.1 + 0.29, CASA.fondo / 2 + 0.075) }

/**
 * La casa colonial para quedarse (fotos del 19/10/2026): blanca, de una
 * planta, con una galería de columnas y techo de tejas, y una azotea con
 * pretil, pilares con copones y un copete con el cartel. Ventanas con postigos
 * de madera y rejas, una puerta de dos hojas, farolas y una santa rita.
 * Medidas relativas a su centro; el frente mira hacia +z.
 */
function formaCasa(): FormaCasa {
  const { ancho: W, fondo: D, alto: H, galeria: G } = CASA
  const frente = D / 2
  const C = COLONIAL
  const partes: THREE.BufferGeometry[] = []
  const prendidas: THREE.BufferGeometry[] = []
  const apagadas: THREE.BufferGeometry[] = []
  const caja = (w: number, h: number, d: number, x: number, y: number, z: number, color: string) =>
    partes.push(conColor(new THREE.BoxGeometry(w, h, d).translate(x, y, z), color))

  // El cuerpo: zócalo, paredes, la cornisa y la azotea.
  caja(W + 0.05, 0.3, D + 0.05, 0, 0.15, 0, C.zocalo)
  caja(W, H, D, 0, H / 2, 0, C.pared)
  caja(W + 0.08, 0.05, D + 0.08, 0, H - 0.02, 0, C.moldura)
  caja(W + 0.16, 0.1, D + 0.16, 0, H + 0.05, 0, C.moldura)
  caja(W - 0.12, 0.012, D - 0.12, 0, H + 0.106, 0, C.azotea)

  // El pretil de la azotea, con su coronamiento.
  const base = H + 0.1
  const pretil = 0.32
  const t = 0.1
  for (const z of [-1, 1]) {
    caja(W + 0.12, pretil, t, 0, base + pretil / 2, z * (frente + 0.01), C.pared)
    caja(W + 0.16, 0.035, t + 0.04, 0, base + pretil + 0.0175, z * (frente + 0.01), C.moldura)
  }
  for (const x of [-1, 1]) {
    caja(t, pretil, D, x * (W / 2 + 0.01), base + pretil / 2, 0, C.pared)
    caja(t + 0.04, 0.035, D, x * (W / 2 + 0.01), base + pretil + 0.0175, 0, C.moldura)
  }
  // Pilares con copones: en las esquinas, a los lados del copete y en el medio de los costados.
  const copon = geometriaCopon()
  const pilares: Array<[number, number]> = [
    [-W / 2, frente], [W / 2, frente], [-W / 2, -frente], [W / 2, -frente],
    [-1.05, frente], [1.05, frente], [-W / 2, 0], [W / 2, 0],
  ]
  for (const [x, z] of pilares) {
    const px = x + Math.sign(x) * 0.01
    const pz = z === 0 ? 0 : z + Math.sign(z) * 0.01
    caja(0.2, pretil + 0.1, 0.2, px, base + (pretil + 0.1) / 2, pz, C.pared)
    caja(0.25, 0.04, 0.25, px, base + pretil + 0.12, pz, C.moldura)
    partes.push(copon.clone().translate(px, base + pretil + 0.14, pz))
  }
  copon.dispose()
  // El copete: el pretil sube en curva arriba de la puerta (ahí va el cartel).
  const copete = new THREE.Shape()
  copete.moveTo(-0.95, 0)
  copete.lineTo(0.95, 0)
  copete.lineTo(0.95, pretil + 0.1)
  copete.quadraticCurveTo(0, 1.0, -0.95, pretil + 0.1)
  copete.lineTo(-0.95, 0)
  const gCopete = new THREE.ExtrudeGeometry(copete, { depth: t, bevelEnabled: false, curveSegments: 10 })
  partes.push(conColor(gCopete.translate(0, base, frente + 0.06 - t), C.pared))

  // Una chimenea con su sombrerete de tejas.
  caja(0.36, 0.62, 0.32, 1.55, base + 0.31, -0.5, C.pared)
  caja(0.44, 0.05, 0.4, 1.55, base + 0.645, -0.5, C.moldura)
  for (const lado of [-1, 1]) {
    partes.push(conColor(new THREE.BoxGeometry(0.28, 0.04, 0.46).rotateZ(lado * -0.5).translate(1.55 + lado * 0.11, base + 0.73, -0.5), C.tejas[0]))
  }

  // La galería: piso de terracota, columnas, la viga y el techo de tejas.
  const linea = frente + G - 0.12
  caja(W + 0.1, 0.12, G, 0, 0.06, frente + G / 2, C.piso)
  caja(W + 0.1, 0.03, 0.06, 0, 0.12, frente + G - 0.03, C.zocalo)
  caja(1.3, 0.06, 0.24, 0, 0.03, frente + G + 0.12, C.zocalo)
  const arriba = H - 0.1
  const caidaPorMetro = Math.tan(0.35)
  const yViga = arriba - (linea - frente) * caidaPorMetro - 0.06
  for (const x of [-2.42, -1.65, -0.85, 0.85, 1.65, 2.42]) {
    caja(0.17, 0.06, 0.17, x, 0.15, linea, C.moldura)
    partes.push(conColor(new THREE.CylinderGeometry(0.06, 0.07, yViga - 0.32, 12).translate(x, 0.18 + (yViga - 0.32) / 2, linea), "#f6f2ea"))
    caja(0.18, 0.06, 0.18, x, yViga - 0.17, linea, C.moldura)
  }
  caja(W + 0.1, 0.14, 0.17, 0, yViga - 0.07, linea, C.moldura)
  const largo = G + 0.05
  partes.push(techoTejas(W + 0.3, largo, largo * caidaPorMetro).translate(0, arriba, frente))

  // La puerta de dos hojas, de madera, con su moldura.
  caja(1.2, 0.08, 0.05, 0, 1.88, frente + 0.02, C.moldura)
  for (const lado of [-1, 1]) caja(0.09, 1.76, 0.05, lado * 0.555, 0.12 + 0.88, frente + 0.02, C.moldura)
  caja(1.02, 1.72, 0.04, 0, 0.12 + 0.86, frente + 0.01, C.madera)
  caja(0.018, 1.66, 0.05, 0, 0.12 + 0.86, frente + 0.02, C.maderaOscura)
  for (const lado of [-1, 1]) {
    for (const y of [0.55, 1.3]) caja(0.34, 0.5, 0.05, lado * 0.255, y, frente + 0.02, C.maderaOscura)
    caja(0.04, 0.04, 0.06, lado * 0.06, 1.0, frente + 0.04, "#c9a227")
  }

  // Las ventanas: moldura, vidrio con travesaños, postigos abiertos y reja.
  // Se arman en la cara de adelante y se giran a su pared.
  const ventana = (cara: "frente" | "izq" | "der", u: number, prendida: boolean) => {
    const w = 0.62
    const h = 1.1
    const y0 = 0.58
    const yc = y0 + h / 2
    const piezas: THREE.BufferGeometry[] = []
    const pz = (w2: number, h2: number, d2: number, x: number, y: number, z: number, color: string) =>
      piezas.push(conColor(new THREE.BoxGeometry(w2, h2, d2).translate(u + x, y, z), color))
    for (const lado of [-1, 1]) pz(0.06, h + 0.12, 0.03, lado * (w / 2 + 0.03), yc, 0.015, C.moldura)
    pz(w + 0.2, 0.06, 0.05, 0, y0 + h + 0.06, 0.025, C.moldura)
    pz(w + 0.16, 0.04, 0.09, 0, y0 - 0.02, 0.045, C.moldura)
    // Travesaños de madera: seis vidrios.
    pz(0.025, h, 0.03, 0, yc, 0.012, C.maderaOscura)
    for (const k of [1, 2]) pz(w, 0.025, 0.03, 0, y0 + (h * k) / 3, 0.012, C.maderaOscura)
    // Postigos abiertos contra la pared.
    for (const lado of [-1, 1]) {
      pz(w / 2, h, 0.025, lado * (w * 0.75 + 0.07), yc, 0.014, C.madera)
      for (const k of [0.25, 0.75]) pz(w / 2 - 0.06, 0.02, 0.03, lado * (w * 0.75 + 0.07), y0 + h * k, 0.02, C.maderaOscura)
    }
    // La reja, apenas salida de la pared.
    for (const k of [0, 1, 2, 3, 4]) pz(0.016, h + 0.04, 0.016, -w / 2 + 0.06 + (k * (w - 0.12)) / 4, yc, 0.07, C.hierro)
    for (const y of [y0 + 0.02, y0 + h - 0.02, yc]) pz(w + 0.02, 0.018, 0.018, 0, y, 0.07, C.hierro)
    const vid = new THREE.PlaneGeometry(w, h).translate(u, yc, 0.004)
    const giro = cara === "der" ? Math.PI / 2 : cara === "izq" ? -Math.PI / 2 : 0
    const ubicar = (g: THREE.BufferGeometry) =>
      cara === "frente" ? g.translate(0, 0, frente) : g.rotateY(giro).translate((cara === "der" ? 1 : -1) * (W / 2), 0, 0)
    for (const g of piezas) partes.push(ubicar(g))
    ;(prendida ? prendidas : apagadas).push(ubicar(vid))
  }
  ventana("frente", -1.55, true)
  ventana("frente", 1.55, true)
  // Una en cada costado, en el medio (debajo del pilar del pretil).
  ventana("izq", 0, true)
  ventana("der", 0, false)

  // Farolas de hierro a los lados de la escalinata.
  for (const f of FAROLES) {
    caja(0.12, 0.08, 0.12, f.x, 0.04, f.z, C.hierro)
    partes.push(conColor(new THREE.CylinderGeometry(0.028, 0.04, 1.36, 8).translate(f.x, 0.72, f.z), C.hierro))
    caja(0.15, 0.03, 0.15, f.x, 1.415, f.z, C.hierro)
    // El vidrio del farol va con las ventanas prendidas (brilla).
    prendidas.push(new THREE.BoxGeometry(0.11, 0.17, 0.11).translate(f.x, 1.52, f.z))
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) caja(0.014, 0.18, 0.014, f.x + dx * 0.058, 1.52, f.z + dz * 0.058, C.hierro)
    partes.push(conColor(new THREE.ConeGeometry(0.11, 0.11, 4).rotateY(Math.PI / 4).translate(f.x, 1.665, f.z), C.hierro))
  }

  // Canteros con flores al frente de la galería (jazmines y rosas).
  const a = azar(91)
  for (const x of [-2.35, -1.9, 1.9, 2.35]) {
    const mata = new THREE.IcosahedronGeometry(0.22 + a() * 0.05, 1)
    mata.scale(1, 0.85, 0.9)
    partes.push(conColor(mata.translate(x, 0.2, frente + G + 0.3), a() > 0.5 ? "#2a5a3a" : "#245033"))
    for (let k = 0; k < 3; k++) {
      const flor = new THREE.IcosahedronGeometry(0.042, 0)
      partes.push(conColor(flor.translate(x + (a() - 0.5) * 0.28, 0.35 + a() * 0.06, frente + G + 0.3 + (a() - 0.5) * 0.22), a() > 0.5 ? "#f8f2e4" : "#e8a3b5"))
    }
  }
  // Una santa rita que sube por la columna de la esquina y se apoya en las tejas.
  const enTejas = (z: number) => arriba - (z - frente) * caidaPorMetro + 0.05
  for (let k = 0; k < 16; k++) {
    const sobreTecho = k >= 11
    const z = sobreTecho ? linea - 0.05 - a() * 0.55 : linea + (a() - 0.5) * 0.18
    const x = sobreTecho ? -2.55 + a() * 0.55 : -2.42 + (a() - 0.5) * 0.2
    const y = sobreTecho ? enTejas(z) + 0.04 : 0.3 + k * 0.13
    const hojas = new THREE.IcosahedronGeometry(0.11 + a() * 0.05, 0)
    partes.push(conColor(hojas.translate(x, y, z), a() > 0.5 ? "#2d5e35" : "#24502f"))
  }
  for (let k = 0; k < 24; k++) {
    const flor = new THREE.IcosahedronGeometry(0.04, 0)
    const sobreTecho = k >= 15
    const z = sobreTecho ? linea - 0.05 - a() * 0.55 : linea + (a() - 0.5) * 0.26
    const x = sobreTecho ? -2.6 + a() * 0.65 : -2.42 + (a() - 0.5) * 0.3
    const y = sobreTecho ? enTejas(z) + 0.1 : 0.35 + a() * (yViga - 0.3)
    partes.push(conColor(flor.translate(x, y, z), a() > 0.5 ? "#c8357d" : "#d9488f"))
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
    const faroles = kit.halos(FAROLES, "#ffcf7d", 0.55, 0.95)
    // La luz de las ventanas en el piso de la galería (se ve debajo del alero).
    const galeria = kit.halos(LUZ_GALERIA, "#ffc56b", 1.5, 0.32, true)
    this.propios.push(faroles.geometry, galeria.geometry)
    this.casa.add(faroles, galeria)
    this.letrero = new Letrero(kit, CARTEL_CASA.ancho, true)
    this.letrero.grupo.position.copy(CARTEL_CASA.pos)
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
          for (const [x, z] of [[-11.45, -1.05], [-9.05, 3.25], [-8.55, 3.15]]) {
            const g = new THREE.CylinderGeometry(0.2, 0.22, 0.04, 9)
            g.scale(1 + r() * 0.3, 1, 0.8 + r() * 0.2)
            piedras.push(conColor(g.translate(x, 0.02, z), "#958c7a"))
          }
          return unir([
            geometriaArboles([[-14.25, -5.6, 1.0], [-8.75, -5.5, 0.85], [-8.7, 5.3, 0.75]], 33),
            geometriaPalmera(-14.1, 4.75, 3.3),
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

// ── El frente: la entrada de la Quinta y el estacionamiento ─────────────────

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

// La entrada de la Quinta (fotos del 19/10/2026): mucho verde, piedra blanca
// y una pérgola de madera con un jazmín sobre el camino, frente a la puerta.

/** La pérgola: dos pares de postes a los lados del camino. */
const PERGOLA = { x: 0.95, z0: 6.3, z1: 7.75, alto: 2.0 }
/** Dónde va la piedra blanca: el camino y la franja contra la fachada. */
const GRAVA: Array<[number, number, number, number]> = [
  [-1.2, 1.2, 5.95, 9.45],
  [-7.65, -1.2, 5.95, 6.65],
  [1.2, 7.65, 5.95, 6.45],
]

/** Una mata redonda (x, z, radio) apoyada a la altura `y0`, con flores si
 *  `flores` trae colores. */
function mata(partes: THREE.BufferGeometry[], a: () => number, x: number, z: number, r: number, verde: string, flores: string[] = [], y0 = 0) {
  const g = new THREE.IcosahedronGeometry(r, 1)
  g.scale(1.05, 0.85, 1)
  partes.push(conColor(g.translate(x, y0 + r * 0.8, z), verde))
  for (let k = 0; k < flores.length * 2; k++) {
    const ang = a() * Math.PI * 2
    const flor = new THREE.IcosahedronGeometry(0.04, 0)
    partes.push(conColor(flor.translate(x + Math.cos(ang) * r * 0.7, y0 + r * (1.1 + a() * 0.45), z + Math.sin(ang) * r * 0.7), flores[k % flores.length]))
  }
}

const VERDES = ["#1f4d31", "#245a39", "#2b6a3f", "#2f6a3f", "#1d4a2e"]
const JAZMIN = "#fbf7ee"

/** La pérgola de madera con el jazmín que la cubre y sube por los postes. */
function geometriaPergola(): THREE.BufferGeometry {
  const { x, z0, z1, alto } = PERGOLA
  const partes: THREE.BufferGeometry[] = []
  const a = azar(83)
  const caja = (w: number, h: number, d: number, px: number, py: number, pz: number, color: string) =>
    partes.push(conColor(new THREE.BoxGeometry(w, h, d).translate(px, py, pz), color))
  for (const px of [-x, x]) {
    for (const pz of [z0, z1]) {
      caja(0.17, 0.06, 0.17, px, 0.03, pz, "#9a948a")
      caja(0.11, alto, 0.11, px, alto / 2, pz, "#6b4a30")
    }
    caja(0.08, 0.15, z1 - z0 + 0.7, px, alto + 0.075, (z0 + z1) / 2, "#5e3f27")
  }
  for (let z = z0 - 0.3; z <= z1 + 0.31; z += 0.25) caja(2 * x + 0.45, 0.06, 0.05, 0, alto + 0.18, z, "#8c6242")
  // El jazmín: arriba de las vigas, colgando adelante y atrás, y subiendo por los postes.
  const hojas = (px: number, py: number, pz: number, r: number) => {
    const g = new THREE.IcosahedronGeometry(r, 0)
    partes.push(conColor(g.translate(px, py, pz), VERDES[Math.floor(a() * VERDES.length)]))
  }
  for (const px of [-x, x]) {
    for (let z = z0 - 0.25; z <= z1 + 0.26; z += 0.24) hojas(px + (a() - 0.5) * 0.25, alto + 0.28 + a() * 0.08, z, 0.14 + a() * 0.06)
    for (const pz of [z0, z1]) for (let y = 0.35; y < alto; y += 0.3) hojas(px + (a() - 0.5) * 0.12, y, pz + (a() - 0.5) * 0.12, 0.09 + a() * 0.04)
  }
  for (let k = 0; k < 5; k++) hojas(-0.45 + a() * 0.9, alto + 0.26, z0 + a() * (z1 - z0), 0.13 + a() * 0.05)
  for (const pz of [z0 - 0.3, z1 + 0.3]) for (const px of [-0.7, -0.15, 0.35, 0.8]) hojas(px + (a() - 0.5) * 0.15, alto + 0.02 - a() * 0.18, pz, 0.1 + a() * 0.04)
  for (let k = 0; k < 46; k++) {
    const flor = new THREE.IcosahedronGeometry(0.035, 0)
    const enPoste = k % 4 === 0
    const px = enPoste ? (k % 8 === 0 ? -x : x) + (a() - 0.5) * 0.2 : (a() - 0.5) * 2 * (x + 0.2)
    const pz = enPoste ? (a() > 0.5 ? z0 : z1) + (a() - 0.5) * 0.2 : z0 - 0.3 + a() * (z1 - z0 + 0.6)
    const py = enPoste ? 0.4 + a() * (alto - 0.4) : alto + 0.3 + a() * 0.14
    partes.push(conColor(flor.translate(px, py, pz), JAZMIN))
  }
  return unir(partes)
}

/** Todo el verde de la entrada: cercos, matas con flores, dos árboles, cipreses
 *  en las esquinas, maceteros de madera junto a la puerta y balizas en el camino. */
function geometriaVerdeEntrada(): THREE.BufferGeometry {
  const partes: THREE.BufferGeometry[] = []
  const a = azar(87)
  // El cerco del frente, a la izquierda del camino.
  for (let x = -7.45; x <= -1.7; x += 0.36) {
    const g = new THREE.IcosahedronGeometry(0.28 + a() * 0.05, 1)
    g.scale(1.15, 0.9, 0.9)
    partes.push(conColor(g.translate(x, 0.26, 9.2 + (a() - 0.5) * 0.08), a() > 0.5 ? "#1f4d31" : "#245a39"))
  }
  // El jardín de la izquierda: dos árboles y matas de todos los verdes.
  partes.push(geometriaArboles([[-6.2, 7.75, 0.66], [-3.25, 8.3, 0.56]], 47))
  const matas: Array<[number, number, number, string[]]> = [
    [-7.2, 7.1, 0.34, [JAZMIN]], [-5.25, 7.2, 0.3, ["#e8a3b5"]], [-4.35, 7.55, 0.36, []],
    [-2.45, 7.35, 0.32, [JAZMIN]], [-1.75, 8.05, 0.28, ["#b9a3d6"]], [-5.0, 8.5, 0.3, [JAZMIN, "#e8a3b5"]],
    [-6.85, 8.55, 0.27, []], [-2.3, 8.75, 0.26, ["#e8a3b5"]], [-4.15, 8.85, 0.24, [JAZMIN]],
    // Contra la fachada, bajas (no tapan las ventanas).
    [-6.4, 6.3, 0.22, []], [-5.6, 6.32, 0.2, [JAZMIN]], [-3.7, 6.3, 0.22, []], [-2.7, 6.3, 0.2, ["#e8a3b5"]],
    [2.7, 6.22, 0.2, [JAZMIN]], [3.7, 6.2, 0.22, []], [5.6, 6.22, 0.2, []], [6.4, 6.2, 0.22, [JAZMIN]],
    // Entre el camino y el estacionamiento, y al principio del camino.
    [1.38, 8.05, 0.22, []], [1.35, 8.6, 0.2, [JAZMIN]], [1.38, 9.15, 0.24, []],
    [-1.12, 9.2, 0.26, []], [1.0, 9.32, 0.22, []],
  ]
  for (const [x, z, r, flores] of matas) mata(partes, a, x, z, r, VERDES[Math.floor(a() * VERDES.length)], flores)
  // Cipreses en las esquinas de la fachada.
  for (const x of [-7.3, 7.3]) {
    partes.push(conColor(new THREE.CylinderGeometry(0.05, 0.07, 0.3, 6).translate(x, 0.15, 6.25), "#4a3424"))
    partes.push(conColor(new THREE.ConeGeometry(0.3, 1.9, 9).translate(x, 1.2, 6.25), "#1d4a2e"))
  }
  // Maceteros de madera a los lados de la puerta.
  for (const lado of [-1, 1]) {
    const x = lado * 1.5
    partes.push(conColor(new THREE.BoxGeometry(0.42, 0.38, 0.42).translate(x, 0.19, 6.2), "#7a5234"))
    partes.push(conColor(new THREE.BoxGeometry(0.46, 0.04, 0.46).translate(x, 0.38, 6.2), "#5e3f27"))
    mata(partes, a, x, 6.2, 0.2, "#2b6a3f", [JAZMIN], 0.36)
  }
  // Balizas bajas a los lados del camino.
  for (const z of [8.25, 8.85]) {
    for (const lado of [-1, 1]) {
      partes.push(conColor(new THREE.CylinderGeometry(0.025, 0.03, 0.22, 6).translate(lado * 0.78, 0.11, z), "#2a2826"))
      partes.push(conColor(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 8).translate(lado * 0.78, 0.235, z), "#2a2826"))
    }
  }
  return unir(partes)
}

/** Las luces de la entrada: las lamparitas bajo la pérgola y las balizas. */
const LUCES_PERGOLA = [-0.5, 0, 0.5].flatMap((x) => [6.55, 7.5].map((z) => new THREE.Vector3(x, PERGOLA.alto + 0.04, z)))
const BALIZAS = [8.25, 8.85].flatMap((z) => [-0.78, 0.78].map((x) => new THREE.Vector3(x, 0.2, z)))

/** La piedra blanca, con la textura en metros. */
function geometriaGrava(): THREE.BufferGeometry {
  const g = unir(GRAVA.map(([x0, x1, z0, z1]) => new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0.006, (z0 + z1) / 2)))
  uvEnMetros(g)
  return g
}

/**
 * El frente del salón: una franja de pasto adelante de la isla con el camino
 * de entrada, la entrada con mucho verde y la pérgola (la Quinta) y el
 * estacionamiento (la Quinta y la Casona). `cosas` crece aparte (la anima el
 * motor cuando el frente sube).
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

    const verde = a.exterior === "chico"
    if (verde) {
      const tex = kit.recurso("tex-grava", () => porMetro(texturaGrava(), 1))
      const grava = new THREE.Mesh(kit.geo("frente-grava", geometriaGrava), kit.recurso("mat-grava", () => std({ map: tex, roughness: 1 })))
      grava.renderOrder = 1
      this.cosas.add(grava)
    }
    const partes = [kit.geo("frente-camino", geometriaCaminoFrente)]
    if (a.estacionamiento) partes.push(kit.geo("frente-playa", geometriaPlaya))
    if (verde) partes.push(kit.geo("frente-verde", geometriaVerdeEntrada), kit.geo("frente-pergola", geometriaPergola))
    // La Casona: un cerco con árboles delante de la casa y la pileta.
    if (a.casona) partes.push(kit.geo("frente-casona", () => unir([geometriaArboles([[-13.6, 8.7, 0.7], [-10.2, 9.0, 0.6], [-4.6, 8.9, 0.62]], 59)])))
    for (const g of partes) this.cosas.add(new THREE.Mesh(g, kit.mat.colores))
    const brillos: THREE.Vector3[] = []
    if (a.estacionamiento) brillos.push(new THREE.Vector3(PLAYA.x1 - 0.05, 1.93, PLAYA.z1 - 0.2))
    if (verde) brillos.push(...LUCES_PERGOLA)
    if (brillos.length) {
      const h = kit.halos(brillos, "#ffcf7d", 0.42, 0.85)
      this.propios.push(h.geometry)
      this.cosas.add(h)
    }
    if (verde) {
      const b = kit.halos(BALIZAS, "#ffe2a6", 0.26, 0.85)
      this.propios.push(b.geometry)
      this.cosas.add(b)
    }
    this.grupo.add(this.cosas)
  }

  liberar() {
    for (const r of this.propios) r.dispose()
  }
}
