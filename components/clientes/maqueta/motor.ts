// Motor de la maqueta 3D del simulador (vista de Clientes).
//
// Dibuja con three.js el jardín de Los Jazmines de noche y lo va armando con
// lo que elige la persona (EstadoMaqueta, de lib/clientes-maqueta.ts): cada
// cosa nueva cae con un rebote, la cámara va a mostrar lo de cada paso y al
// final hay festejo. Se carga aparte (import dinámico), solo en /clientes.
//
// Es uno solo para toda la página: el lienzo se muda de lugar entre la
// portada, los pasos y "Tu fiesta está lista" (montar/desmontar), así no se
// crea un WebGL nuevo cada vez.
//
// Cuidados:
// - Si el navegador no tiene WebGL, crearMotor devuelve null y la pantalla
//   sigue como siempre, sin maqueta.
// - "Reducir movimiento": sin vaivén, sin vuelta de cámara ni papelitos, y
//   solo se dibuja cuando algo cambia.
// - Si va lento, baja la resolución.

import * as THREE from "three"
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js"
import { palabraFestejo, type EstadoMaqueta, type Pieza } from "@/lib/clientes-maqueta"
import {
  Cartel,
  Casa,
  Festejo,
  Globos,
  Guirnalda3D,
  Kit,
  LUGARES,
  LUGARES_MESAS,
  LUGARES_MESAS_NINOS,
  Mesa,
  crearAltar,
  crearBarra,
  crearDJ,
  crearFotografo,
  crearInvitacion,
  crearIsla,
  crearLetra,
  crearMaquillaje,
  crearMesaDulce,
  crearNeon,
  crearPantallaLed,
  crearPistaLed,
  crearPlataforma360,
  crearShimmer,
  crearVestido,
  posicionesLetras,
  type Pieza3D,
} from "./piezas"

interface Encuadre {
  objetivo: [number, number, number]
  distancia: number
  /** Ángulo sobre el horizonte (radianes). */
  elevacion: number
  /** Desde dónde se mira (0 = de frente). */
  giro: number
  /** Proporción de pantalla para la que está pensada la distancia. */
  aspecto: number
}

/** Adónde mira la cámara: un plano por paso y uno por cada pieza que se suma. */
const ENCUADRES = {
  portada: { objetivo: [0, 0.2, 0.3], distancia: 22.5, elevacion: 0.6, giro: -0.38, aspecto: 1.5 },
  isla: { objetivo: [0, 0.3, 0.3], distancia: 20.5, elevacion: 0.7, giro: 0, aspecto: 1.85 },
  entrada: { objetivo: [0.1, 0.8, 4.0], distancia: 9.2, elevacion: 0.44, giro: -0.12, aspecto: 1.85 },
  cartel: { objetivo: [1.45, 0.95, 4.85], distancia: 5.2, elevacion: 0.24, giro: -0.24, aspecto: 1.85 },
  mesas: { objetivo: [0, 0.45, 1.3], distancia: 14, elevacion: 0.8, giro: 0, aspecto: 1.85 },
  mesa: { objetivo: [1.85, 0.8, 0.85], distancia: 5.4, elevacion: 0.8, giro: -0.32, aspecto: 1.85 },
  barra: { objetivo: [-6.3, 0.95, -1.1], distancia: 7.4, elevacion: 0.42, giro: 0.72, aspecto: 1.85 },
  barra2: { objetivo: [6.3, 0.95, -1.1], distancia: 7.4, elevacion: 0.42, giro: -0.72, aspecto: 1.85 },
  fiesta: { objetivo: [0, 0.4, -0.2], distancia: 19, elevacion: 0.56, giro: 0, aspecto: 1.45 },
  letras: { objetivo: [-4.4, 0.6, 4.95], distancia: 6.8, elevacion: 0.3, giro: 0.12, aspecto: 1.85 },
  plataforma360: { objetivo: [5.45, 0.75, 4.65], distancia: 5.6, elevacion: 0.34, giro: -0.22, aspecto: 1.85 },
  shimmer: { objetivo: [5.3, 1.1, -4.95], distancia: 6.6, elevacion: 0.24, giro: -0.12, aspecto: 1.85 },
  fotografia: { objetivo: [1.55, 0.9, -0.85], distancia: 5.6, elevacion: 0.42, giro: -0.5, aspecto: 1.85 },
  mesaDulce: { objetivo: [6.95, 0.9, 2.2], distancia: 5.6, elevacion: 0.36, giro: -0.95, aspecto: 1.85 },
  neon: { objetivo: [-2.75, 1.3, -4.9], distancia: 5.6, elevacion: 0.22, giro: 0.1, aspecto: 1.85 },
  pistaLed: { objetivo: [0, 0.3, -2.0], distancia: 9.5, elevacion: 0.78, giro: 0, aspecto: 1.85 },
  pantallaLed: { objetivo: [0, 1.4, -4.6], distancia: 8.2, elevacion: 0.2, giro: 0, aspecto: 1.85 },
  altar: { objetivo: [3.0, 1.0, -4.5], distancia: 6.6, elevacion: 0.28, giro: -0.16, aspecto: 1.85 },
  maquillaje: { objetivo: [-6.75, 1.0, -3.2], distancia: 5.4, elevacion: 0.3, giro: 0.28, aspecto: 1.85 },
  vestido: { objetivo: [-5.45, 0.9, -3.25], distancia: 5.4, elevacion: 0.3, giro: 0.16, aspecto: 1.85 },
  invitacion: { objetivo: [0, 2.0, 4.2], distancia: 5.6, elevacion: 0.2, giro: -0.1, aspecto: 1.85 },
  dj: { objetivo: [0, 1.0, -4.0], distancia: 8.2, elevacion: 0.3, giro: 0, aspecto: 1.85 },
  decoracion: { objetivo: [1.85, 0.8, 0.85], distancia: 5.4, elevacion: 0.8, giro: -0.32, aspecto: 1.85 },
} satisfies Record<string, Encuadre>

export type Foco = keyof typeof ENCUADRES

/** Si un texto es un plano conocido (para los focos que vienen de lib). */
export function esFoco(x: string): x is Foco {
  return Object.prototype.hasOwnProperty.call(ENCUADRES, x)
}

/** Lo que tiene que entrar entero en cuadro, para los planos generales. */
const CAJAS: Partial<Record<Foco, { min: [number, number, number]; max: [number, number, number] }>> = {
  portada: { min: [-8.1, -1.0, -6.1], max: [8.1, 2.95, 6.1] },
  isla: { min: [-8.1, -0.6, -6.1], max: [8.1, 2.95, 6.1] },
  fiesta: { min: [-8.1, -0.6, -6.1], max: [8.1, 2.95, 6.1] },
  mesas: { min: [-6.2, 0, -3.6], max: [6.2, 1.2, 4.8] },
}

interface Animacion {
  obj: THREE.Object3D
  t: number
  dur: number
  tipo: "entra" | "sale"
  escala: THREE.Vector3
  y: number
  caida: number
  alTerminar?: () => void
}

const NOCHE = new THREE.Color("#0d1d14")

function rebote(u: number) {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2)
}

export interface OpcionesMotor {
  reducido: boolean
  familia: string
}

export class MotorMaqueta {
  readonly lienzo: HTMLCanvasElement
  onFalla?: () => void

  private renderer: THREE.WebGLRenderer
  private escena = new THREE.Scene()
  private camara = new THREE.PerspectiveCamera(30, 1.8, 0.1, 140)
  private kit: Kit
  private raiz = new THREE.Group()
  private contenedor: HTMLElement | null = null
  private alCambiarTamano: ResizeObserver | null = null
  private alVerse: IntersectionObserver | null = null
  private raf = 0
  private corriendo = false
  private enPantalla = true
  private ultimo = 0
  private t = 0
  private reducido: boolean
  private sucio = true
  private calidad = { pr: 1, medidos: 0, suma: 0, listo: false, ahorro: false, salteo: 0 }

  private estado: EstadoMaqueta | null = null
  private foco: Foco = "portada"
  private cam = { objetivo: new THREE.Vector3(0, 0.2, 0.3), distancia: 22.5, elevacion: 0.6, giro: -0.38 }
  private camLista = false
  private giroUsuario = 0
  private giroOrbita = 0
  private orbitaPendiente = 0
  private arrastre: { x: number; giro: number; id: number } | null = null

  private casa: Casa
  private guirnalda: Guirnalda3D
  private calidas: THREE.PointLight[] = []
  private lucesActual = 0
  private lucesObjetivo = 0
  private mesas: Mesa[] = []
  private mesasNinos: Mesa[] = []
  private barras: Pieza3D[] = []
  private piezas = new Map<string, { pieza: Pieza3D; version: string }>()
  private letras: Array<{ letra: string; pieza: Pieza3D }> = []
  private globos: { pieza: Globos; paleta: string } | null = null
  private cartel: Cartel | null = null
  private festejo: Festejo | null = null
  private animaciones: Animacion[] = []

  constructor(op: OpcionesMotor) {
    this.reducido = op.reducido
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" })
    this.lienzo = this.renderer.domElement
    this.lienzo.style.display = "block"
    this.lienzo.style.width = "100%"
    this.lienzo.style.height = "100%"
    this.lienzo.style.touchAction = "pan-y"
    this.lienzo.style.cursor = "grab"
    this.renderer.setClearColor(NOCHE, 0)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.12
    this.calidad.pr = Math.min(2, window.devicePixelRatio || 1)
    this.renderer.setPixelRatio(this.calidad.pr)

    this.kit = new Kit(op.familia)
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const ambiente = new RoomEnvironment()
    this.escena.environment = pmrem.fromScene(ambiente, 0.04).texture
    this.escena.environmentIntensity = 0.2
    ambiente.dispose()
    pmrem.dispose()
    this.escena.fog = new THREE.Fog(NOCHE, 30, 70)

    // Noche: luz de luna fría y, a medida que se prende la guirnalda, luz cálida.
    this.escena.add(new THREE.HemisphereLight("#55739f", "#0d1d14", 1.15))
    const luna = new THREE.DirectionalLight("#bccbff", 0.95)
    luna.position.set(-8, 14, 7)
    this.escena.add(luna)
    for (const [x, y, z, base] of [
      [-4.2, 2.5, 1.0, 26],
      [4.2, 2.5, 1.0, 26],
      [0, 2.6, -2.2, 30],
      [0, 2.4, 4.2, 18],
    ]) {
      const l = new THREE.PointLight("#ffc06a", 0, 0, 2)
      l.position.set(x, y, z)
      l.userData.base = base
      this.calidas.push(l)
      this.escena.add(l)
    }

    this.escena.add(this.raiz)
    this.raiz.add(crearIsla(this.kit))
    this.casa = new Casa(this.kit)
    this.raiz.add(this.casa.grupo)
    this.guirnalda = new Guirnalda3D(this.kit, this.reducido)
    this.raiz.add(this.guirnalda.grupo)

    this.lienzo.addEventListener("webglcontextlost", this.alPerderContexto, false)
    this.lienzo.addEventListener("pointerdown", this.alApretar)
    this.lienzo.addEventListener("pointermove", this.alMover)
    this.lienzo.addEventListener("pointerup", this.alSoltar)
    this.lienzo.addEventListener("pointercancel", this.alSoltar)
  }

  // ── Dónde se ve ───────────────────────────────────────────────────────────

  montar(contenedor: HTMLElement) {
    if (this.contenedor === contenedor) return
    this.desmontar()
    this.contenedor = contenedor
    contenedor.appendChild(this.lienzo)
    this.alCambiarTamano = new ResizeObserver(() => this.ajustarTamano())
    this.alCambiarTamano.observe(contenedor)
    this.alVerse = new IntersectionObserver((e) => {
      this.enPantalla = e.some((x) => x.isIntersecting)
    })
    this.alVerse.observe(contenedor)
    this.ajustarTamano()
    this.sucio = true
    if (!this.corriendo) {
      this.corriendo = true
      this.ultimo = performance.now()
      this.raf = requestAnimationFrame(this.cuadro)
    }
  }

  /** Saca el lienzo de `contenedor` (si está ahí) y deja de dibujar. */
  desmontar(contenedor?: HTMLElement | null) {
    if (contenedor && contenedor !== this.contenedor) return
    this.alCambiarTamano?.disconnect()
    this.alVerse?.disconnect()
    this.alCambiarTamano = null
    this.alVerse = null
    this.lienzo.parentElement?.removeChild(this.lienzo)
    this.contenedor = null
    this.corriendo = false
    cancelAnimationFrame(this.raf)
  }

  private ajustarTamano() {
    if (!this.contenedor) return
    const ancho = Math.max(1, this.contenedor.clientWidth)
    const alto = Math.max(1, this.contenedor.clientHeight)
    this.renderer.setSize(ancho, alto, false)
    this.camara.aspect = ancho / alto
    this.camara.updateProjectionMatrix()
    const pr = this.renderer.getPixelRatio()
    this.kit.matHalo.uniforms.uEscala.value = (alto * pr) / 2 / Math.tan(THREE.MathUtils.degToRad(this.camara.fov / 2))
    this.kit.matHalo.uniforms.uMaximo.value = 22 * pr
    this.kit.matHaloGrande.uniforms.uEscala.value = this.kit.matHalo.uniforms.uEscala.value
    this.sucio = true
  }

  // ── Lo que se dibuja ──────────────────────────────────────────────────────

  actualizar(e: EstadoMaqueta, foco: Foco) {
    this.estado = e
    if (foco !== this.foco) {
      this.foco = foco
      // Al cambiar de paso, la cámara vuelve a su lugar de a poco.
      this.giroUsuario *= 0.5
    }
    this.guirnalda.prender(e.luces)
    this.guirnalda.festejo = e.completa
    this.lucesObjetivo = e.luces
    this.casa.setNombre(e.salon)

    const clavePaleta = e.paleta.join(",")
    if (e.globos && (!this.globos || this.globos.paleta !== clavePaleta)) {
      if (this.globos) this.quitar(this.globos.pieza)
      const g = new Globos(this.kit, e.paleta, this.reducido)
      this.raiz.add(g.grupo)
      this.globos = { pieza: g, paleta: clavePaleta }
    } else if (!e.globos && this.globos) {
      this.quitar(this.globos.pieza)
      this.globos = null
    }

    if (e.cartel) {
      if (!this.cartel) {
        this.cartel = new Cartel(this.kit)
        this.raiz.add(this.cartel.grupo)
        this.entrar(this.cartel.grupo)
      }
      this.cartel.setTexto(e.cartel.titulo, e.cartel.fecha)
    } else if (this.cartel) {
      this.quitar(this.cartel)
      this.cartel = null
    }

    this.sincronizarMesas(this.mesas, e.mesas, LUGARES_MESAS, false, e)
    this.sincronizarMesas(this.mesasNinos, e.mesasNinos, LUGARES_MESAS_NINOS, true, e)

    while (this.barras.length < e.barras && this.barras.length < LUGARES.barras.length) {
      const lugar = LUGARES.barras[this.barras.length]
      const b = crearBarra(this.kit, lugar.giro)
      b.grupo.position.set(lugar.x, 0, lugar.z)
      this.raiz.add(b.grupo)
      this.entrar(b.grupo)
      this.barras.push(b)
    }
    while (this.barras.length > e.barras) {
      const b = this.barras.pop()
      if (b) this.quitar(b)
    }

    const p = e.piezas
    const fest = e.festejo
    const quince = fest === "Cumpleaños de 15"
    const boda = fest === "Casamiento"
    this.pieza("dj", !!p.dj, "", () => crearDJ(this.kit, this.reducido))
    this.pieza("pantallaLed", !!p.pantallaLed, "", () => crearPantallaLed(this.kit, palabraFestejo(fest), e.paleta))
    const pantalla = this.piezas.get("pantallaLed")?.pieza as ReturnType<typeof crearPantallaLed> | undefined
    pantalla?.setContenido(palabraFestejo(fest), e.paleta)
    this.pieza("pistaLed", !!p.pistaLed, "", () => crearPistaLed(this.kit, e.paleta, this.reducido))
    const pista = this.piezas.get("pistaLed")?.pieza as ReturnType<typeof crearPistaLed> | undefined
    pista?.setPaleta(e.paleta)
    this.pieza("shimmer", !!p.shimmer, "", () => crearShimmer(this.kit, this.reducido))
    this.pieza("plataforma360", !!p.plataforma360, clavePaleta, () => crearPlataforma360(this.kit, e.paleta, this.reducido))
    this.pieza("fotografia", !!p.fotografia, "", () => crearFotografo(this.kit, this.reducido))
    this.pieza("mesaDulce", !!p.mesaDulce, clavePaleta, () => crearMesaDulce(this.kit, e.paleta))
    const neon = quince ? "#ff7fc0" : boda ? "#ffd27a" : "#ff8fcf"
    this.pieza("neon", !!p.neon, neon, () => crearNeon(this.kit, neon))
    this.pieza("altar", !!p.altar, clavePaleta, () => crearAltar(this.kit, e.paleta))
    this.pieza("maquillaje", !!p.maquillaje, "", () => crearMaquillaje(this.kit))
    const vestido = quince ? "#e8a3b5" : boda ? "#fbf7ee" : (e.paleta[0] ?? "#f3cf7a")
    this.pieza("vestido", !!p.vestido, vestido, () => crearVestido(this.kit, vestido))
    this.pieza("invitacion", !!p.invitacion, "", () => crearInvitacion(this.kit, this.reducido))
    this.sincronizarLetras(e.letras)

    // Con "reducir movimiento" el final es solo la guirnalda entera prendida.
    if (e.completa && !this.festejo && !this.reducido) {
      this.festejo = new Festejo(this.kit, e.paleta)
      this.raiz.add(this.festejo.grupo)
      this.orbitaPendiente = Math.PI * 2
    } else if (!e.completa && this.festejo) {
      this.raiz.remove(this.festejo.grupo)
      this.festejo.liberar?.()
      this.festejo = null
      this.orbitaPendiente = 0
    }
    this.sucio = true
  }

  /** Pone o saca una pieza; si cambió su versión (por ejemplo el color), la reemplaza. */
  private pieza(clave: Pieza, presente: boolean, version: string, crear: () => Pieza3D) {
    const actual = this.piezas.get(clave)
    if (actual && (!presente || actual.version !== version)) {
      this.quitar(actual.pieza)
      this.piezas.delete(clave)
    }
    if (presente && !this.piezas.get(clave)) {
      const nueva = crear()
      this.raiz.add(nueva.grupo)
      this.entrar(nueva.grupo)
      this.piezas.set(clave, { pieza: nueva, version })
    }
  }

  private sincronizarMesas(lista: Mesa[], personas: number[], lugares: Array<[number, number]>, ninos: boolean, e: EstadoMaqueta) {
    const cuantas = Math.min(personas.length, lugares.length)
    const antes = lista.length
    for (let i = lista.length; i < cuantas; i++) {
      const m = new Mesa(this.kit, ninos, i + (ninos ? 50 : 0))
      m.grupo.position.set(lugares[i][0], 0, lugares[i][1])
      m.grupo.rotation.y = (i * 0.73) % (Math.PI * 2)
      this.raiz.add(m.grupo)
      this.entrar(m.grupo, (i - antes) * 0.06)
      lista.push(m)
    }
    while (lista.length > cuantas) {
      const m = lista.pop()
      if (m) this.quitar(m)
    }
    lista.forEach((m, i) => {
      const gente = m.setPersonas(personas[i], e.conInvitados)
      if (gente) this.entrar(gente, i * 0.04, 0.15)
      const nuevos = m.setMesa({
        platos: e.platos,
        botellas: e.bebidaDeMesa,
        flores: !!e.piezas.decoracion,
        candelabro: !!e.piezas.candelabros,
        paleta: e.paleta,
      })
      for (const o of nuevos) this.entrar(o, i * 0.035, 0.2)
    })
  }

  private sincronizarLetras(letras: string[]) {
    let iguales = 0
    while (iguales < this.letras.length && iguales < letras.length && this.letras[iguales].letra === letras[iguales]) iguales++
    for (let i = this.letras.length - 1; i >= iguales; i--) {
      this.quitar(this.letras[i].pieza)
      this.letras.splice(i, 1)
    }
    // Con muchas letras se achican todas: las que ya estaban se acomodan.
    const { xs, escala } = posicionesLetras(letras)
    for (let i = 0; i < iguales; i++) {
      const g = this.letras[i].pieza.grupo
      g.position.x = xs[i]
      const enCurso = this.animaciones.find((a) => a.obj === g)
      if (enCurso) enCurso.escala.setScalar(escala)
      else g.scale.setScalar(escala)
    }
    for (let i = iguales; i < letras.length; i++) {
      const p = crearLetra(this.kit, letras[i])
      p.grupo.position.set(xs[i], 0, LUGARES.letras.z)
      p.grupo.scale.setScalar(escala)
      this.raiz.add(p.grupo)
      this.entrar(p.grupo, (i - iguales) * 0.09)
      this.letras.push({ letra: letras[i], pieza: p })
    }
  }

  // ── Animaciones de entrada y salida ───────────────────────────────────────

  private entrar(obj: THREE.Object3D, demora = 0, caida = 0.55) {
    if (this.reducido) return
    const previa = this.animaciones.find((a) => a.obj === obj)
    const escala = previa ? previa.escala : obj.scale.clone()
    const y = previa ? previa.y : obj.position.y
    this.animaciones = this.animaciones.filter((a) => a.obj !== obj)
    obj.scale.copy(escala).multiplyScalar(0.0001)
    this.animaciones.push({ obj, t: -demora, dur: 0.55, tipo: "entra", escala, y, caida })
  }

  private quitar(pieza: Pieza3D) {
    const obj = pieza.grupo
    const fin = () => {
      obj.parent?.remove(obj)
      pieza.liberar?.()
    }
    if (this.reducido) return fin()
    const previa = this.animaciones.find((a) => a.obj === obj)
    this.animaciones = this.animaciones.filter((a) => a.obj !== obj)
    this.animaciones.push({ obj, t: 0, dur: 0.26, tipo: "sale", escala: previa ? previa.escala : obj.scale.clone(), y: previa ? previa.y : obj.position.y, caida: 0, alTerminar: fin })
  }

  private animar(dt: number) {
    if (!this.animaciones.length) return
    const seguir: Animacion[] = []
    for (const a of this.animaciones) {
      a.t += dt
      const u = Math.max(0, Math.min(1, a.t / a.dur))
      if (a.tipo === "entra") {
        const e = a.t < 0 ? 0.0001 : Math.max(0.0001, rebote(u))
        a.obj.scale.copy(a.escala).multiplyScalar(e)
        a.obj.position.y = a.y + a.caida * (1 - Math.min(1, u * 1.25)) ** 2
      } else {
        const e = Math.max(0.0001, 1 - u * u)
        a.obj.scale.copy(a.escala).multiplyScalar(e)
      }
      if (u < 1) {
        seguir.push(a)
      } else if (a.tipo === "entra") {
        a.obj.scale.copy(a.escala)
        a.obj.position.y = a.y
      } else {
        a.alTerminar?.()
      }
    }
    this.animaciones = seguir
    this.sucio = true
  }

  // ── Cámara ────────────────────────────────────────────────────────────────

  private camPrueba = new THREE.PerspectiveCamera()
  private ajuste = { clave: "", distancia: 0 }

  /** La distancia más corta a la que la caja entra entera en pantalla (con
   *  aire a los costados para el vaivén). Se calcula una vez por paso y tamaño. */
  private distanciaQueEntra(enc: Encuadre, caja: { min: [number, number, number]; max: [number, number, number] }, nombre: string) {
    const clave = `${nombre}|${this.camara.aspect.toFixed(3)}`
    if (this.ajuste.clave === clave) return this.ajuste.distancia
    const c = this.camPrueba
    c.fov = this.camara.fov
    c.aspect = this.camara.aspect
    c.near = 0.1
    c.far = 300
    c.updateProjectionMatrix()
    const esquinas: THREE.Vector3[] = []
    for (const x of [caja.min[0], caja.max[0]]) for (const y of [caja.min[1], caja.max[1]]) for (const z of [caja.min[2], caja.max[2]]) esquinas.push(new THREE.Vector3(x, y, z))
    const obj = new THREE.Vector3(...enc.objetivo)
    const v = new THREE.Vector3()
    const entra = (d: number) => {
      c.position.set(
        obj.x + Math.sin(enc.giro) * Math.cos(enc.elevacion) * d,
        obj.y + Math.sin(enc.elevacion) * d,
        obj.z + Math.cos(enc.giro) * Math.cos(enc.elevacion) * d,
      )
      c.lookAt(obj)
      c.updateMatrixWorld()
      return esquinas.every((p) => {
        v.copy(p).project(c)
        return Math.abs(v.x) <= 0.9 && Math.abs(v.y) <= 0.9 && v.z < 1
      })
    }
    let lo = 3
    let hi = 160
    for (let i = 0; i < 20; i++) {
      const medio = (lo + hi) / 2
      if (entra(medio)) hi = medio
      else lo = medio
    }
    this.ajuste = { clave, distancia: hi }
    return hi
  }

  private moverCamara(dt: number) {
    const enc = ENCUADRES[this.foco]
    const aspecto = this.camara.aspect || 1.8
    const caja = CAJAS[this.foco]
    const distancia = caja ? this.distanciaQueEntra(enc, caja, this.foco) : enc.distancia * Math.pow(Math.max(1, enc.aspecto / aspecto), 0.92)
    const k = this.reducido || !this.camLista ? 1 : 1 - Math.exp(-dt * 2.2)
    const antes = this.cam.objetivo.clone()
    this.cam.objetivo.lerp(new THREE.Vector3(...enc.objetivo), k)
    const dD = (distancia - this.cam.distancia) * k
    const dE = (enc.elevacion - this.cam.elevacion) * k
    const dG = (enc.giro - this.cam.giro) * k
    this.cam.distancia += dD
    this.cam.elevacion += dE
    this.cam.giro += dG
    this.camLista = true
    if (this.orbitaPendiente > 0) {
      const paso = Math.min(this.orbitaPendiente, dt * ((Math.PI * 2) / 9))
      this.orbitaPendiente -= paso
      this.giroOrbita += paso
    } else if (this.foco !== "fiesta") {
      this.giroOrbita = 0
    }
    const vaiven = this.reducido ? 0 : Math.sin(this.t * 0.21) * (this.foco === "cartel" || this.foco === "mesa" ? 0.06 : 0.14)
    const giro = this.cam.giro + this.giroUsuario + vaiven + this.giroOrbita
    const { objetivo, distancia: d, elevacion } = this.cam
    this.camara.position.set(
      objetivo.x + Math.sin(giro) * Math.cos(elevacion) * d,
      objetivo.y + Math.sin(elevacion) * d,
      objetivo.z + Math.cos(giro) * Math.cos(elevacion) * d,
    )
    this.camara.lookAt(objetivo)
    const fog = this.escena.fog as THREE.Fog
    fog.near = d * 1.05
    fog.far = d * 2.6
    const quieta = antes.distanceToSquared(this.cam.objetivo) < 1e-8 && Math.abs(dD) + Math.abs(dE) + Math.abs(dG) < 1e-5
    if (!quieta || !this.reducido) this.sucio = true
  }

  private alApretar = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return
    this.arrastre = { x: e.clientX, giro: this.giroUsuario, id: e.pointerId }
    this.lienzo.style.cursor = "grabbing"
    try {
      this.lienzo.setPointerCapture(e.pointerId)
    } catch {
      // Sin captura igual se puede girar.
    }
  }

  private alMover = (e: PointerEvent) => {
    if (!this.arrastre || e.pointerId !== this.arrastre.id) return
    const dx = e.clientX - this.arrastre.x
    this.giroUsuario = Math.max(-1.15, Math.min(1.15, this.arrastre.giro - dx * 0.0085))
    this.sucio = true
  }

  private alSoltar = (e: PointerEvent) => {
    if (!this.arrastre || e.pointerId !== this.arrastre.id) return
    this.arrastre = null
    this.lienzo.style.cursor = "grab"
  }

  // ── Cada cuadro ───────────────────────────────────────────────────────────

  private cuadro = (ahora: number) => {
    if (!this.corriendo) return
    this.raf = requestAnimationFrame(this.cuadro)
    // En "ahorro" se dibuja un cuadro sí y otro no (el tiempo igual avanza entero).
    if (this.calidad.ahorro && ++this.calidad.salteo % 2 === 1) return
    const dt = Math.min(0.05, Math.max(0.001, (ahora - this.ultimo) / 1000))
    this.ultimo = ahora
    if (!this.enPantalla || document.hidden) return
    this.t += dt
    this.animar(dt)
    this.guirnalda.avanzar(dt, this.t)
    for (const { pieza } of this.piezas.values()) pieza.avanzar?.(dt, this.t)
    for (const b of this.barras) b.avanzar?.(dt, this.t)
    for (const l of this.letras) l.pieza.avanzar?.(dt, this.t)
    this.globos?.pieza.avanzar(dt)
    this.festejo?.avanzar(dt)
    this.moverCamara(dt)
    const antes = this.lucesActual
    this.lucesActual = this.reducido ? this.lucesObjetivo : this.lucesActual + (this.lucesObjetivo - this.lucesActual) * Math.min(1, dt * 1.8)
    for (const l of this.calidas) l.intensity = (l.userData.base as number) * (0.12 + 0.88 * this.lucesActual) * (this.estado ? 1 : 0.6)
    if (Math.abs(antes - this.lucesActual) > 1e-4) this.sucio = true
    if (this.reducido && !this.sucio) return
    this.sucio = false
    this.renderer.render(this.escena, this.camara)
    this.medir(dt)
  }

  /** Si los primeros cuadros van lentos, primero se baja la resolución y, si
   *  igual no alcanza, se dibuja a la mitad de cuadros por segundo. */
  private medir(dt: number) {
    const c = this.calidad
    if (c.listo || this.reducido) return
    c.medidos++
    if (c.medidos < 20) return
    c.suma += dt
    if (c.medidos < 110) return
    const promedio = c.suma / (c.medidos - 19)
    if (promedio > 1 / 32 && c.pr > 1) {
      c.pr = 1
      this.renderer.setPixelRatio(1)
      this.ajustarTamano()
      // Se vuelve a medir con la resolución nueva.
      c.medidos = 0
      c.suma = 0
      return
    }
    if (promedio > 1 / 24) c.ahorro = true
    c.listo = true
  }

  // ── Foto y cierre ─────────────────────────────────────────────────────────

  /** Para las pruebas: cuántas veces dibuja por cuadro y cuántos triángulos. */
  diagnostico() {
    const r = this.renderer.info.render
    return { llamadas: r.calls, triangulos: r.triangles, pr: this.renderer.getPixelRatio() }
  }

  private camFoto = new THREE.PerspectiveCamera()

  /** Una foto de la maqueta (JPG) para el presupuesto: siempre desde el mismo
   *  ángulo lindo, de tres cuartos, con la isla entera (no en medio del giro). */
  foto(): string | null {
    try {
      const enc: Encuadre = { objetivo: [0, 0.3, 0.2], distancia: 20, elevacion: 0.64, giro: -0.42, aspecto: 1.4 }
      const caja = CAJAS.isla
      if (!caja) return null
      const d = this.distanciaQueEntra(enc, caja, "foto")
      const c = this.camFoto
      c.fov = this.camara.fov
      c.aspect = this.camara.aspect
      c.near = 0.1
      c.far = 140
      c.updateProjectionMatrix()
      const o = new THREE.Vector3(...enc.objetivo)
      c.position.set(
        o.x + Math.sin(enc.giro) * Math.cos(enc.elevacion) * d,
        o.y + Math.sin(enc.elevacion) * d,
        o.z + Math.cos(enc.giro) * Math.cos(enc.elevacion) * d,
      )
      c.lookAt(o)
      const fog = this.escena.fog as THREE.Fog
      const [cerca, lejos] = [fog.near, fog.far]
      fog.near = d * 1.05
      fog.far = d * 2.6
      const color = this.renderer.getClearColor(new THREE.Color())
      const alfa = this.renderer.getClearAlpha()
      this.renderer.setClearColor(NOCHE, 1)
      this.renderer.render(this.escena, c)
      const url = this.lienzo.toDataURL("image/jpeg", 0.88)
      this.renderer.setClearColor(color, alfa)
      fog.near = cerca
      fog.far = lejos
      this.sucio = true
      return url.startsWith("data:image/jpeg") ? url : null
    } catch {
      return null
    }
  }

  private alPerderContexto = (e: Event) => {
    e.preventDefault()
    this.corriendo = false
    cancelAnimationFrame(this.raf)
    this.onFalla?.()
  }

  destruir() {
    this.desmontar()
    this.lienzo.removeEventListener("webglcontextlost", this.alPerderContexto)
    this.lienzo.removeEventListener("pointerdown", this.alApretar)
    this.lienzo.removeEventListener("pointermove", this.alMover)
    this.lienzo.removeEventListener("pointerup", this.alSoltar)
    this.lienzo.removeEventListener("pointercancel", this.alSoltar)
    for (const { pieza } of this.piezas.values()) pieza.liberar?.()
    for (const b of this.barras) b.liberar?.()
    for (const l of this.letras) l.pieza.liberar?.()
    for (const m of [...this.mesas, ...this.mesasNinos]) m.liberar()
    this.globos?.pieza.liberar()
    this.cartel?.liberar()
    this.festejo?.liberar()
    this.casa.liberar()
    this.guirnalda.liberar()
    // Lo que queda (la isla, la casa…). Liberar dos veces lo mismo no hace daño.
    this.escena.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Line || o instanceof THREE.Points) {
        o.geometry.dispose()
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        for (const m of mats) m.dispose()
      }
    })
    this.escena.environment?.dispose()
    this.kit.liberar()
    this.renderer.dispose()
  }
}

/** Crea el motor, o null si el navegador no puede dibujar 3D. */
export function crearMotor(op: OpcionesMotor): MotorMaqueta | null {
  try {
    // Primero se pregunta si hay WebGL 2 (three.js ya no usa el 1), para no
    // llenar la consola de errores.
    const prueba = document.createElement("canvas")
    const gl = prueba.getContext("webgl2")
    if (!gl) return null
    gl.getExtension("WEBGL_lose_context")?.loseContext()
    return new MotorMaqueta(op)
  } catch {
    return null
  }
}
