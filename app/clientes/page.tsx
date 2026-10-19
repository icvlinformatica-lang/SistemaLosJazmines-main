"use client"

// Vista de Clientes — prototipo del simulador "Armá tu fiesta".
//
// Es lo que va a ver un cliente que llega desde Instagram: arma su fiesta en
// 7 pasos (festejo, salón, fecha, invitados, menú, barra y detalles; 8 con la
// Casona, que suma "¿Adentro o al aire libre?" después del salón) y ve el
// total en vivo. Al final, para ver el detalle y congelar el precio 7 días,
// deja nombre, WhatsApp y mail ("el peaje").
//
// - El total en vivo sale de armarCotizacion con los precios del catálogo
//   (/api/clientes/catalogo), igual que en /vendedor/cotizar. El presupuesto
//   final lo recalcula el servidor con costos reales (/api/clientes/simular).
// - PROTOTIPO: los datos del peaje no se guardan ni se mandan. No hay tabla de
//   leads todavía (plan en el proyecto: claude/simulador-publico-plan.md).
// - Las fechas ocupadas se ven tachadas antes del peaje (decisión del
//   18/10/2026), solo la fecha (/api/clientes/ocupadas).
// - Va a pantalla completa, sin el menú del sistema (components/app-shell.tsx).
// - Arriba de cada paso va la maqueta 3D (components/clientes/maqueta-3d.tsx),
//   que se arma sola con cada elección: es el juego. El lugar es el del salón
//   elegido (la Casona: jardín, pileta y casa, o su salón de adentro, según
//   el paso "Lugar"; los demás, salones cerrados). Es solo una ilustración
//   (lib/clientes-maqueta.ts): los montos salen de la cuenta de siempre.
//   Sobre la maqueta no va ningún botón para elegir (arriba no llega el
//   dedo): todas las elecciones están abajo, en el paso.
// - La maqueta se ve a pantalla completa tocándola (o con el botón de su
//   esquina) y sola al girar el celular. En Android, además, la pantalla
//   completa es la del sistema y gira a horizontal; en iPhone, que no deja,
//   ocupa toda la página y pide girar el celular. Sin WebGL, la pantalla queda
//   como antes.

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Baby,
  Briefcase,
  Cake,
  ChevronLeft,
  Crown,
  Gem,
  Loader2,
  House,
  LogOut,
  Maximize2,
  MessageCircle,
  Minimize2,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  Smartphone,
  Sparkles,
  Trees,
  Users,
  type LucideIcon,
} from "lucide-react"
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer"
import { useProfile } from "@/lib/profile-context"
import {
  UNIDADES_CON_CANTIDAD,
  barrasAlEmpezarMenu,
  hoyArgentina,
  pasosMenuFaltantes,
  textoPasosFaltantes,
} from "@/lib/cotizador-salon"
import {
  DIAS_PRECIO_CONGELADO,
  MAX_BARRAS,
  TIPOS_EVENTO_CLIENTE,
  cotizarCliente,
  elegirBarra,
  elegirPlato,
  fechaLarga,
  indicePaso,
  pasoDespuesDe,
  pasosCliente,
  formatoPesos,
  linkWhatsApp,
  nombreEnFrase,
  nombreParaCliente,
  pasosDelMenu,
  platosEnOrden,
  rangoCalendario,
  salonesLibresEseDia,
  servicioConCantidad,
  serviciosParaFecha,
  sumarDias,
  textoWhatsAppCliente,
  type CatalogoClientes,
  type IdPasoCliente,
  type ResumenSimulacion,
  type SeleccionCliente,
} from "@/lib/clientes-simulador"
import {
  avisoLugar,
  descripcionMaqueta,
  estadoMaqueta,
  estadoMuestra,
  novedades,
  rasgosSalon,
  INCLUIDO_EN_TODOS,
  TEXTO_INCLUIDO_EN_TODOS,
  yaIncluidoEnTodos,
  salonConAireLibre,
  TEXTO_LUGAR,
  textoSumaste,
  type EstadoMaqueta,
  type VistaCasona,
} from "@/lib/clientes-maqueta"
import { numeroWhatsApp } from "@/lib/telefono-whatsapp"
import { fuenteFiesta } from "./fuente-fiesta"
import { Maqueta3D, type ManejoMaqueta } from "@/components/clientes/maqueta-3d"
import { Guirnalda } from "@/components/clientes/guirnalda"
import { TotalAnimado } from "@/components/clientes/total-animado"
import { CalendarioFiesta } from "@/components/clientes/calendario-fiesta"
import { Opcion } from "@/components/clientes/opcion"
import { PresupuestoCliente } from "@/components/clientes/presupuesto-cliente"

type IdPaso = IdPasoCliente

const ICONO_FESTEJO: Record<string, LucideIcon> = {
  Casamiento: Gem,
  "Cumpleaños de 15": Crown,
  Empresarial: Briefcase,
  Cumpleaños: Cake,
  Bautismo: Baby,
  Otro: Sparkles,
}

const NOMBRE_CATEGORIA: Record<string, string> = {
  Decoracion: "Decoración",
  "Salon y Espacio": "Salón y espacio",
  Pasteleria: "Pastelería",
  Otros: "Otros",
}

const ATAJOS_INVITADOS = [50, 80, 100, 120]
const MINIMO_ADULTOS = 10
const serif = "font-[family-name:var(--font-fiesta)]"

/** Qué muestra la maqueta en cada paso (planos de components/clientes/maqueta/motor.ts). */
const FOCO_PASO: Record<IdPaso, string> = {
  festejo: "entrada",
  salon: "isla",
  lugar: "isla",
  fecha: "cartel",
  invitados: "mesas",
  menu: "mesa",
  barra: "barra",
  detalles: "isla",
}
/** Cuánto se queda la cámara mostrando lo que se acaba de sumar. */
const MS_MOSTRAR_SUMADO = 2600
/** Y el lugar al elegir el salón: la casa y la pileta de la Casona, o el frente de la Quinta (vuela más lejos). */
const MS_MOSTRAR_LUGAR = 3600

/** "+ $ 120.000" / "− $ 30.000" / "sin costo extra". */
function diferencia(d: number): string {
  if (Math.abs(d) < 1) return "sin costo extra"
  return `${d > 0 ? "+" : "−"} ${formatoPesos(Math.abs(d))}`
}

type Vista = "portada" | "pasos" | "lista" | "presupuesto"

export default function ClientesPage() {
  const router = useRouter()
  const { perfilActivo, cerrarSesion } = useProfile()
  const esPerfilClientes = perfilActivo?.id === "clientes"

  // ── Datos ──
  const [catalogo, setCatalogo] = useState<CatalogoClientes | null>(null)
  const [ocupadas, setOcupadas] = useState<Record<string, string[]>>({})
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [intentoCarga, setIntentoCarga] = useState(0)

  useEffect(() => {
    let cancelado = false
    setErrorCarga(null)
    ;(async () => {
      try {
        const [rc, ro] = await Promise.all([fetch("/api/clientes/catalogo"), fetch("/api/clientes/ocupadas")])
        const [dc, dO] = await Promise.all([rc.json().catch(() => null), ro.json().catch(() => null)])
        if (cancelado) return
        if (!rc.ok || !dc?.ok) throw new Error(dc?.error || "catálogo")
        setCatalogo({ salones: dc.salones ?? [], fechasEspeciales: dc.fechasEspeciales ?? [] })
        // Sin fechas ocupadas el simulador sigue: solo no tacha nada.
        if (ro.ok && dO?.ok && dO.ocupadas) setOcupadas(dO.ocupadas)
      } catch {
        if (!cancelado) setErrorCarga("No pudimos cargar los precios. Revisá la conexión y probá de nuevo.")
      }
    })()
    return () => {
      cancelado = true
    }
  }, [intentoCarga])

  // ── Recorrido ──
  const [vista, setVista] = useState<Vista>("portada")
  // Por id y no por número: el paso "lugar" aparece o no según el salón.
  const [pasoId, setPasoId] = useState<IdPaso>("festejo")
  const [alcanzadoId, setAlcanzadoId] = useState<IdPaso>("festejo")
  const [intentoSeguir, setIntentoSeguir] = useState(false)

  // ── Lo que elige ──
  const [tipoEvento, setTipoEvento] = useState<string | null>(null)
  const [salonId, setSalonId] = useState<string | null>(null)
  // Solo la Casona: la fiesta en el jardín o adentro (su propio paso).
  const [lugar, setLugar] = useState<VistaCasona | null>(null)
  const [fecha, setFecha] = useState<string | null>(null)
  const [adultos, setAdultos] = useState(60)
  const [ninos, setNinos] = useState(0)
  const [conCatering, setConCatering] = useState(true)
  const [recetas, setRecetas] = useState<string[]>([])
  const [barraIds, setBarraIds] = useState<string[]>([])
  const [servicios, setServicios] = useState<Record<string, number>>({})
  const [bebidaSumada, setBebidaSumada] = useState(false)

  // ── Peaje y presupuesto ──
  const [peajeAbierto, setPeajeAbierto] = useState(false)
  const [contacto, setContacto] = useState({ nombre: "", whatsapp: "", email: "", acepta: false })
  const [erroresPeaje, setErroresPeaje] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [resumen, setResumen] = useState<ResumenSimulacion | null>(null)
  const [errorServidor, setErrorServidor] = useState<string | null>(null)

  // ── Maqueta 3D ──
  const [conMaqueta, setConMaqueta] = useState(true)
  const maqueta = useRef<ManejoMaqueta>(null)
  const [fotoMaqueta, setFotoMaqueta] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ id: number; texto: string } | null>(null)
  const [focoSumado, setFocoSumado] = useState<{ foco: string; ms: number } | null>(null)
  // Pantalla completa: la pide la persona (tocando la maqueta) o se abre sola
  // al girar el celular. Si la cierra con el celular girado, no se vuelve a
  // abrir hasta que lo ponga derecho.
  const [pantallaCompleta, setPantallaCompleta] = useState(false)
  const [girado, setGirado] = useState(false)
  const [giradoCerrado, setGiradoCerrado] = useState(false)
  const muestra = useMemo(() => estadoMuestra(), [])

  const hoy = useMemo(() => hoyArgentina(), [])
  const rango = useMemo(() => rangoCalendario(hoy), [hoy])

  const salon = useMemo(() => catalogo?.salones.find((s) => s.salon === salonId) ?? null, [catalogo, salonId])
  const salonesListos = useMemo(() => (catalogo?.salones ?? []).map((s) => s.salon), [catalogo])
  const ocupadasSalon = useMemo(() => new Set(salon ? ocupadas[salon.salon] ?? [] : []), [ocupadas, salon])
  const fechaOcupada = !!fecha && ocupadasSalon.has(fecha)
  const serviciosFecha = useMemo(() => (salon ? serviciosParaFecha(salon, fecha) : []), [salon, fecha])

  // ── Los pasos (con "lugar" solo si el salón tiene aire libre) ──
  const conLugar = salonConAireLibre(salon?.salon)
  const PASOS = useMemo(() => pasosCliente(conLugar), [conLugar])
  const paso = indicePaso(PASOS, pasoId)
  const alcanzado = indicePaso(PASOS, alcanzadoId)
  // Si eligió la Casona y todavía no dijo adentro o afuera (por ejemplo, la
  // cambió desde el paso de la fecha), tiene que pasar por ese paso.
  useEffect(() => {
    if (!conLugar || lugar) return
    if (pasoDespuesDe(alcanzadoId, "lugar")) setAlcanzadoId("lugar")
    if (pasoDespuesDe(pasoId, "lugar")) setPasoId("lugar")
  }, [conLugar, lugar, alcanzadoId, pasoId])

  // Al cambiar de salón o de fecha se descarta lo que ya no está disponible
  // (igual que en el cotizador del vendedor).
  useEffect(() => {
    if (!salon) return
    setRecetas((prev) => prev.filter((id) => salon.menu.some((m) => m.recetaId === id)))
    setBarraIds((prev) => prev.filter((id) => salon.barras.some((b) => b.id === id)))
    setAdultos((a) => Math.min(Math.max(a, MINIMO_ADULTOS), salon.capacidadMaxima))
  }, [salon])
  useEffect(() => {
    setServicios((prev) => {
      const sig: Record<string, number> = {}
      for (const [id, cant] of Object.entries(prev)) {
        const s = serviciosFecha.find((x) => x.servicioId === id)
        if (s && !s.incluido) sig[id] = cant
      }
      return Object.keys(sig).length === Object.keys(prev).length ? prev : sig
    })
  }, [serviciosFecha])

  const seleccion: SeleccionCliente = useMemo(
    () => ({ adultos, ninos, recetas: conCatering ? recetas : [], barraIds, servicios }),
    [adultos, ninos, conCatering, recetas, barraIds, servicios],
  )
  const calculo = useMemo(
    () => (salon && catalogo ? cotizarCliente(salon, seleccion, fecha, catalogo.fechasEspeciales) : null),
    [salon, catalogo, seleccion, fecha],
  )
  const total = calculo?.resultado.total ?? 0
  const comensales = adultos + ninos
  const totalCon = (cambio: Partial<SeleccionCliente>) =>
    salon && catalogo ? cotizarCliente(salon, { ...seleccion, ...cambio }, fecha, catalogo.fechasEspeciales).resultado.total : 0

  // ── Qué falta para seguir ──
  const idPaso: IdPaso = PASOS[paso].id
  const pasosMenu = salon ? pasosDelMenu(salon.menu) : []
  const faltaMenu = salon ? pasosMenuFaltantes(salon.menu, salon.menu.filter((m) => recetas.includes(m.recetaId))) : []
  const falta: string | null = (() => {
    if (vista !== "pasos") return null
    switch (idPaso) {
      case "festejo":
        return tipoEvento ? null : "Elegí qué van a festejar."
      case "salon":
        return salon ? null : "Elegí un salón."
      case "lugar":
        return lugar ? null : "Elegí si la fiesta es adentro o al aire libre."
      case "fecha":
        if (!fecha) return "Elegí una fecha."
        return fechaOcupada ? `Ese día ${salon?.nombre} ya está reservado. Elegí otra fecha.` : null
      case "invitados":
        if (comensales <= 0) return "Contanos cuántos van a ser."
        return calculo?.resultado.superaCapacidad ? `En ${salon?.nombre} entran hasta ${salon?.capacidadMaxima} personas.` : null
      case "menu":
        if (!conCatering) return null
        if (recetas.length === 0) return "Elegí los platos, o marcá que es sin catering."
        return faltaMenu.length ? `Falta elegir ${textoPasosFaltantes(faltaMenu)}.` : null
      default:
        return null
    }
  })()

  useEffect(() => {
    setIntentoSeguir(false)
    if (typeof window !== "undefined") window.scrollTo({ top: 0 })
  }, [pasoId, vista])

  // Lo que muestra la maqueta: se arma con lo mismo que el total.
  const estadoMaq = useMemo(
    () =>
      estadoMaqueta({
        tipoEvento,
        salon: salon ? { clave: salon.salon, nombre: salon.nombre, barras: salon.barras } : null,
        vistaCasona: lugar ?? "jardin",
        servicios: serviciosFecha,
        elegidos: servicios,
        fecha,
        adultos,
        ninos,
        conCatering,
        recetas,
        barraIds,
        alcanzado,
        totalPasos: PASOS.length,
        pasoInvitados: indicePaso(PASOS, "invitados"),
        completa: vista === "lista" || vista === "presupuesto",
      }),
    [tipoEvento, salon, lugar, serviciosFecha, servicios, fecha, adultos, ninos, conCatering, recetas, barraIds, alcanzado, PASOS, vista],
  )
  // Cada cosa que se suma: un aviso ("Sumaste la pantalla LED") y la cámara va
  // a mostrarla un momento. Al elegir la Casona, va a mostrar su casa y su pileta.
  const estadoPrevio = useRef<EstadoMaqueta | null>(null)
  useEffect(() => {
    const antes = estadoPrevio.current
    estadoPrevio.current = estadoMaq
    if (vista !== "pasos") return
    const lugar = avisoLugar(antes, estadoMaq)
    if (lugar) {
      setAviso({ id: Date.now(), texto: lugar.texto })
      setFocoSumado({ foco: lugar.foco, ms: lugar.foco === "casona" || lugar.foco === "frente" ? MS_MOSTRAR_LUGAR : MS_MOSTRAR_SUMADO })
      return
    }
    const nuevas = novedades(antes, estadoMaq)
    if (!nuevas.length) return
    setAviso({ id: Date.now(), texto: textoSumaste(nuevas) })
    setFocoSumado({ foco: nuevas[nuevas.length - 1].foco, ms: MS_MOSTRAR_SUMADO })
  }, [estadoMaq, vista])
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 2400)
    return () => clearTimeout(t)
  }, [aviso])
  useEffect(() => {
    if (!focoSumado) return
    const t = setTimeout(() => setFocoSumado(null), focoSumado.ms)
    return () => clearTimeout(t)
  }, [focoSumado])
  useEffect(() => {
    setFocoSumado(null)
    setAviso(null)
  }, [pasoId, vista])
  // Al bajar en la página, la maqueta se achica (para que entre más lista en
  // celulares chicos). Con margen para que no tiemble cerca del borde.
  const [compacta, setCompacta] = useState(false)
  useEffect(() => {
    if (vista !== "pasos") {
      setCompacta(false)
      return
    }
    const alMover = () => {
      const y = window.scrollY
      setCompacta((c) => (c ? y > 8 : y > 56 && document.documentElement.scrollHeight - window.innerHeight > 240))
    }
    alMover()
    window.addEventListener("scroll", alMover, { passive: true })
    return () => window.removeEventListener("scroll", alMover)
  }, [vista])
  const focoMaqueta =
    vista === "lista" || vista === "presupuesto"
      ? "fiesta"
      : (focoSumado?.foco ?? (idPaso === "barra" && estadoMaq.barras >= 2 ? "barra2" : FOCO_PASO[idPaso]))

  const irAlPaso = (id: IdPaso) => {
    setVista("pasos")
    setPasoId(id)
  }
  const irAPaso = (i: number) => irAlPaso(PASOS[i].id)
  const siguiente = () => {
    if (falta) {
      setIntentoSeguir(true)
      return
    }
    if (paso < PASOS.length - 1) {
      const sig = PASOS[paso + 1].id
      setPasoId(sig)
      setAlcanzadoId((a) => (pasoDespuesDe(sig, a) ? sig : a))
    } else {
      setAlcanzadoId(PASOS[PASOS.length - 1].id)
      setVista("lista")
    }
  }
  const anterior = () => {
    if (vista === "lista") return irAPaso(PASOS.length - 1)
    if (paso === 0) return setVista("portada")
    setPasoId(PASOS[paso - 1].id)
  }

  // ── Pantalla completa de la maqueta ──
  const enRecorrido = vista === "pasos" || vista === "lista"
  const verGrande = conMaqueta && enRecorrido && (pantallaCompleta || (girado && !giradoCerrado))
  // Celular acostado: la maqueta ocupa toda la pantalla sola.
  useEffect(() => {
    // Un celular: pantalla táctil (o sin mouse) y poca altura acostado.
    const mq = window.matchMedia?.(
      "(orientation: landscape) and (max-height: 520px) and (pointer: coarse), (orientation: landscape) and (max-height: 520px) and (hover: none)",
    )
    if (!mq) return
    const alCambiar = () => {
      setGirado(mq.matches)
      if (!mq.matches) setGiradoCerrado(false)
    }
    alCambiar()
    mq.addEventListener?.("change", alCambiar)
    return () => mq.removeEventListener?.("change", alCambiar)
  }, [])
  // Si sale de la pantalla completa del sistema (gesto de volver, tecla Esc),
  // la maqueta vuelve a su lugar.
  useEffect(() => {
    const alCambiar = () => {
      if (!document.fullscreenElement) setPantallaCompleta(false)
    }
    document.addEventListener("fullscreenchange", alCambiar)
    return () => document.removeEventListener("fullscreenchange", alCambiar)
  }, [])
  // Con la maqueta grande, la página de atrás no se mueve.
  useEffect(() => {
    if (!verGrande) return
    const antes = document.documentElement.style.overflow
    document.documentElement.style.overflow = "hidden"
    return () => {
      document.documentElement.style.overflow = antes
    }
  }, [verGrande])
  const abrirGrande = () => {
    setPantallaCompleta(true)
    // Android: pantalla completa de verdad y, si deja, gira a horizontal. En
    // iPhone no existe para esto: queda la maqueta ocupando toda la página.
    const el = maqueta.current?.elemento()
    if (el?.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen({ navigationUI: "hide" })
        .then(() => {
          const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
          return o?.lock?.("landscape")
        })
        .catch(() => {
          // Sin permiso para girar o sin pantalla completa: igual se ve grande.
        })
    }
  }
  const cerrarGrande = () => {
    setPantallaCompleta(false)
    if (girado) setGiradoCerrado(true)
    try {
      screen.orientation?.unlock?.()
    } catch {
      // No estaba girada por nosotros.
    }
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }
  // Fuera de los pasos (portada, presupuesto) no queda abierta.
  useEffect(() => {
    if (!enRecorrido && pantallaCompleta) cerrarGrande()
  }, [enRecorrido])

  const salir = () => {
    if (esPerfilClientes) {
      cerrarSesion()
      router.replace("/login")
    } else {
      router.push("/")
    }
  }

  // ── Menú y barra ──
  const bebidaDeMesa = salon?.barras.find((b) => b.bebidaDeMesa) ?? null
  const tocarPlato = (recetaId: string) => {
    if (!salon) return
    const nuevas = elegirPlato(recetas, recetaId, salon.menu)
    // Con el primer plato se suma sola la bebida de mesa, como en el vendedor.
    if (recetas.length === 0 && nuevas.length > 0) {
      const conBebida = barrasAlEmpezarMenu(0, barraIds, bebidaDeMesa?.id ?? null)
      if (conBebida !== barraIds) {
        setBarraIds(conBebida)
        setBebidaSumada(true)
      }
    }
    setRecetas(nuevas)
  }

  // ── Peaje ──
  const validarContacto = () => {
    const e: Record<string, string> = {}
    if (contacto.nombre.trim().length < 2) e.nombre = "Escribí tu nombre."
    if (!numeroWhatsApp(contacto.whatsapp)) e.whatsapp = "Escribí un WhatsApp con código de área, por ejemplo 11 2345 6789."
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contacto.email.trim())) e.email = "Revisá el mail."
    if (!contacto.acepta) e.acepta = "Para mostrarte el presupuesto necesitamos tu permiso para contactarte."
    setErroresPeaje(e)
    return Object.keys(e).length === 0
  }
  const verPresupuesto = async () => {
    if (!salon || !validarContacto()) return
    setEnviando(true)
    setErrorServidor(null)
    try {
      // PROTOTIPO: al servidor va solo la fiesta armada (sin los datos de
      // contacto) y no se guarda nada. La fecha se vuelve a mirar ahora.
      const [rs, ro] = await Promise.all([
        fetch("/api/clientes/simular", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            salon: salon.salon,
            fechaEvento: fecha ?? "",
            adultos,
            ninos,
            recetas: seleccion.recetas,
            barraIds,
            servicios: Object.entries(servicios).map(([servicioId, cantidad]) => ({ servicioId, cantidad })),
          }),
        }),
        fetch("/api/clientes/ocupadas").catch(() => null),
      ])
      const ds = await rs.json().catch(() => null)
      if (!rs.ok || !ds?.ok) {
        setErrorServidor(ds?.error || "No pudimos preparar el presupuesto. Probá de nuevo.")
        return
      }
      const dO = ro && ro.ok ? await ro.json().catch(() => null) : null
      if (dO?.ok && dO.ocupadas) setOcupadas(dO.ocupadas)
      setResumen(ds.resumen)
      // La foto de su maqueta va en el presupuesto (si el navegador la dibujó).
      setFotoMaqueta(maqueta.current?.foto() ?? null)
      setPeajeAbierto(false)
      setVista("presupuesto")
    } catch {
      setErrorServidor("No pudimos preparar el presupuesto. Revisá la conexión y probá de nuevo.")
    } finally {
      setEnviando(false)
    }
  }

  const validoHasta = sumarDias(hoy, DIAS_PRECIO_CONGELADO)
  const platosElegidos = salon ? platosEnOrden(salon.menu, seleccion.recetas).map((m) => m.nombre) : []
  const barrasElegidas = salon ? salon.barras.filter((b) => barraIds.includes(b.id)).map((b) => b.nombre) : []

  // Al elegir una fecha, que se vea el renglón de abajo (qué día es y si tiene
  // otro valor), que en el celular queda tapado por la barra del total.
  const infoFecha = useRef<HTMLDivElement>(null)
  const [fechaTocada, setFechaTocada] = useState(0)
  const elegirFecha = (f: string) => {
    setFecha(f)
    setFechaTocada((n) => n + 1)
  }
  // Después de dibujar (el renglón recién aparece con la primera fecha
  // elegida): si queda tapado por la barra de abajo, se baja lo justo.
  const barraAbajo = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!fechaTocada || !infoFecha.current) return
    const reducir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    const tapado = barraAbajo.current?.getBoundingClientRect().height ?? 0
    const sobra = infoFecha.current.getBoundingClientRect().bottom + tapado + 16 - window.innerHeight
    if (sobra > 0) window.scrollBy({ top: sobra, behavior: reducir ? "auto" : "smooth" })
  }, [fechaTocada])

  // Lo que suma lo que YA está elegido (para mostrarlo junto a la opción).
  const aporte = (sin: Partial<SeleccionCliente>) => total - totalCon(sin)
  const editarContacto = (campo: keyof typeof contacto, valor: string | boolean) => {
    setContacto((c) => ({ ...c, [campo]: valor }))
    // El error de ese campo se borra apenas se corrige.
    setErroresPeaje((e) => {
      if (!e[campo]) return e
      const sig = { ...e }
      delete sig[campo]
      return sig
    })
  }

  // ── Pantallas ──
  const chrome = (
    <div className="flex items-center gap-2 print:hidden">
      <span className="rounded-full border border-[#f3cf7a]/45 px-2.5 py-0.5 text-[11.5px] text-[#f3cf7a]">Prototipo</span>
      <button
        type="button"
        onClick={salir}
        aria-label={esPerfilClientes ? "Salir del perfil Clientes" : "Volver al sistema"}
        title={esPerfilClientes ? "Salir" : "Volver al sistema"}
        className="flex h-9 w-9 items-center justify-center rounded-full text-[#f5f0e8]/80 hover:bg-white/10 hover:text-[#f5f0e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3cf7a]"
      >
        {esPerfilClientes ? <LogOut className="h-4.5 w-4.5" /> : <ArrowLeft className="h-4.5 w-4.5" />}
      </button>
    </div>
  )

  const logo = (
    <span
      role="img"
      aria-label="Los Jazmines"
      className="block h-[26px] w-[82px] bg-[#f5f0e8]"
      style={{
        WebkitMaskImage: "url(/clientes/logo-recorte.png)",
        maskImage: "url(/clientes/logo-recorte.png)",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "left center",
        maskPosition: "left center",
      }}
    />
  )

  return (
    <div className="min-h-svh bg-[#0d1d14] text-[#f5f0e8] antialiased print:min-h-0 print:bg-white">
      <style>{`
        .lj-rango { -webkit-appearance: none; appearance: none; width: 100%; height: 40px; background: transparent; cursor: pointer; }
        .lj-rango::-webkit-slider-runnable-track { height: 6px; border-radius: 999px; background: linear-gradient(to right, #f3cf7a var(--lj-p), rgba(245,240,232,.16) var(--lj-p)); }
        .lj-rango::-webkit-slider-thumb { -webkit-appearance: none; width: 30px; height: 30px; margin-top: -12px; border-radius: 999px; background: #f8f2e4; border: 2px solid #f3cf7a; box-shadow: 0 0 20px rgba(243,207,122,.55); }
        .lj-rango::-moz-range-track { height: 6px; border-radius: 999px; background: rgba(245,240,232,.16); }
        .lj-rango::-moz-range-progress { height: 6px; border-radius: 999px; background: #f3cf7a; }
        .lj-rango::-moz-range-thumb { width: 26px; height: 26px; border-radius: 999px; background: #f8f2e4; border: 2px solid #f3cf7a; }
        .lj-rango:focus-visible { outline: none; }
        .lj-rango:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 5px rgba(243,207,122,.4); }
        @keyframes lj-aviso {
          0% { opacity: 0; transform: translateY(8px) scale(.92); }
          10% { opacity: 1; transform: translateY(0) scale(1.03); }
          16% { transform: scale(1); }
          86% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-6px); }
        }
        .lj-aviso { animation: lj-aviso 2.4s ease-out both; }
        @keyframes lj-invitacion {
          from { opacity: 0; transform: perspective(1400px) rotateY(-78deg) translateY(24px); }
          55% { opacity: 1; }
          to { opacity: 1; transform: perspective(1400px) rotateY(0) translateY(0); }
        }
        .lj-invitacion { animation: lj-invitacion .95s cubic-bezier(.18,.82,.22,1) both; transform-origin: 0% 50%; }
        @media (prefers-reduced-motion: reduce) {
          .lj-aviso { animation: none; }
          .lj-invitacion { animation: none; }
        }
        @media print {
          @page { margin: 12mm; }
          .lj-imprimir { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .lj-invitacion { animation: none; }
        }
      `}</style>

      {/* ── Portada ── */}
      {vista === "portada" && (
        <section className="relative isolate flex min-h-svh flex-col overflow-hidden">
          <picture className="absolute inset-0 -z-10">
            <source media="(min-width: 768px)" srcSet="/clientes/portada.webp" />
            <img
              src="/clientes/portada-movil.webp"
              alt="El jardín de Los Jazmines de noche, con guirnaldas de luces"
              className="h-full w-full object-cover object-bottom md:object-center"
              fetchPriority="high"
            />
          </picture>
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(13,29,20,0.55)_0%,rgba(13,29,20,0.05)_32%,rgba(13,29,20,0.15)_52%,rgba(13,29,20,0.92)_78%,#0d1d14_100%)]" />

          <div className="mx-auto flex w-full max-w-[480px] items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+16px)]">
            {logo}
            {chrome}
          </div>

          <div className="mx-auto w-full max-w-[480px] px-5 pt-14 md:pt-20">
            <h1 className={`${serif} text-[46px] font-medium leading-[0.98] tracking-[-0.015em] text-[#f8f2e4] [text-wrap:balance]`}>
              Diseñá tu evento a medida
            </h1>
          </div>

          {/* Una fiesta armada, en 3D: lo que van a poder hacer. */}
          {conMaqueta && (
            <Maqueta3D
              estado={muestra}
              foco="portada"
              descripcion="Maqueta 3D de una fiesta armada en el jardín de Los Jazmines"
              onFalla={() => setConMaqueta(false)}
              className="relative mx-auto min-h-[230px] w-full max-w-[640px] flex-1"
            />
          )}

          <div className="mx-auto mt-auto w-full max-w-[480px] px-5 pb-[calc(env(safe-area-inset-bottom)+28px)]">
            <p className="max-w-[34ch] text-[16.5px] leading-relaxed text-[#f5f0e8]/85">
              Conocé el valor al instante: elegí la fecha, los invitados, el menú y cada detalle, y mirá cómo se arma el precio.
            </p>
            <button
              type="button"
              onClick={() => irAPaso(0)}
              className="mt-6 flex h-14 w-full items-center justify-center rounded-full bg-[#f3cf7a] text-[16.5px] font-semibold text-[#0d1d14] shadow-[0_0_40px_-8px_rgba(243,207,122,0.75)] transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f3cf7a]/40"
            >
              Empezar a armar
            </button>
            <p className="mt-3 text-center text-[13px] text-[#f5f0e8]/60">Te lleva unos dos minutos y no hace falta registrarse.</p>
          </div>
        </section>
      )}

      {/* ── Pasos y "Tu fiesta está lista" ── */}
      {(vista === "pasos" || vista === "lista") && (
        <>
          {/* Fondo sólido (para que nada se vea a través del texto) y un
              degradé corto debajo, para que el contenido se esconda suave. */}
          {/* En los pasos, la maqueta queda fija arriba (para ver cómo se suma
              cada cosa); en "Tu fiesta está lista" es grande y se va con el scroll. */}
          {/* Con el celular acostado (sin la maqueta grande) la cabecera no
              queda fija: si no, entre ella y la barra de abajo no se ve nada. */}
          <header
            className={`${vista === "pasos" ? "sticky top-0 [@media(orientation:landscape)_and_(max-height:520px)]:relative" : "relative"} ${verGrande ? "z-[60]" : "z-20"} bg-[#0d1d14] pb-3 pt-[calc(env(safe-area-inset-top)+10px)] after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-6 after:bg-gradient-to-b after:from-[#0d1d14] after:to-transparent`}
          >
            <div className="mx-auto max-w-[480px] px-5">
              <div className="flex h-10 items-center justify-between">
                {logo}
                {chrome}
              </div>
            </div>
            {conMaqueta ? (
              <Maqueta3D
                ref={maqueta}
                estado={estadoMaq}
                foco={focoMaqueta}
                descripcion={descripcionMaqueta(estadoMaq)}
                onFalla={() => setConMaqueta(false)}
                onTocar={verGrande ? undefined : abrirGrande}
                className={
                  verGrande
                    ? "fixed inset-0 z-[60] overflow-hidden bg-[radial-gradient(ellipse_at_50%_62%,#15301f_0%,#0d1d14_72%)]"
                    : `relative mx-auto mt-1 max-w-[480px] overflow-hidden bg-[radial-gradient(ellipse_at_50%_62%,#15301f_0%,#0d1d14_72%)] transition-[height] duration-500 ${
                        vista === "lista" ? "h-[clamp(250px,44svh,390px)]" : compacta ? "h-[clamp(120px,19svh,160px)]" : "h-[clamp(150px,27svh,236px)]"
                      }`
                }
              >
                {verGrande ? (
                  <ControlesGrande
                    paso={vista === "lista" ? "Tu fiesta" : `${PASOS[paso].nombre} · ${paso + 1} de ${PASOS.length}`}
                    total={salon ? formatoPesos(total) : null}
                    onCerrar={cerrarGrande}
                  />
                ) : (
                  <>
                    {/* Para que la guirnalda de pasos se lea separada de la maqueta. */}
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#0d1d14] via-[#0d1d14]/55 to-transparent" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#0d1d14] to-transparent" />
                    <div
                      className={`pointer-events-none absolute inset-x-5 top-0 transition-opacity duration-300 ${compacta ? "opacity-0 [&_button]:!pointer-events-none" : "opacity-100"}`}
                    >
                      <Guirnalda
                        pasos={[...PASOS]}
                        actual={vista === "lista" ? PASOS.length : paso}
                        alcanzado={alcanzado}
                        completa={vista === "lista"}
                        onIr={irAPaso}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={abrirGrande}
                      aria-label="Ver la maqueta en pantalla completa"
                      title="Pantalla completa"
                      className="absolute bottom-2 right-3 flex h-10 w-10 items-center justify-center rounded-full border border-[#f3cf7a]/35 bg-[#0d1d14]/75 text-[#f5f0e8]/85 shadow-[0_8px_24px_-10px_rgba(0,0,0,0.8)] backdrop-blur-sm hover:text-[#f5f0e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3cf7a]"
                    >
                      <Maximize2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </>
                )}
                {aviso && <AvisoSumaste key={aviso.id} texto={aviso.texto} grande={verGrande} />}
              </Maqueta3D>
            ) : (
              <div className="mx-auto mt-1 max-w-[480px] px-5">
                <Guirnalda
                  pasos={[...PASOS]}
                  actual={vista === "lista" ? PASOS.length : paso}
                  alcanzado={alcanzado}
                  completa={vista === "lista"}
                  onIr={irAPaso}
                />
              </div>
            )}
            <div className="mx-auto max-w-[480px] px-5">
              <div className="mt-1 flex items-baseline justify-between text-[13px]">
                <span className="text-[#f5f0e8]/85">{vista === "lista" ? "Todo listo" : PASOS[paso].nombre}</span>
                <span className="tabular-nums text-[#f5f0e8]/50">
                  {vista === "lista" ? `${PASOS.length} de ${PASOS.length}` : `${paso + 1} de ${PASOS.length}`}
                </span>
              </div>
            </div>
          </header>

          <main className={`mx-auto max-w-[480px] px-5 pt-2 ${vista === "pasos" ? "pb-48" : "pb-[calc(env(safe-area-inset-bottom)+28px)]"}`}>
            {errorCarga && (
              <div className="rounded-2xl border border-[#e8a39b]/40 bg-[#2a1714] p-4 text-[14.5px] text-[#f6d9d4]">
                <p>{errorCarga}</p>
                <button
                  type="button"
                  onClick={() => setIntentoCarga((n) => n + 1)}
                  className="mt-3 rounded-full bg-[#f6d9d4] px-4 py-2 text-[14px] font-medium text-[#2a1714]"
                >
                  Probar de nuevo
                </button>
              </div>
            )}

            {vista === "pasos" && idPaso === "festejo" && (
              <Paso titulo="¿Qué vamos a festejar?">
                <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Tipo de evento">
                  {TIPOS_EVENTO_CLIENTE.map((t) => {
                    const Icono = ICONO_FESTEJO[t] ?? Sparkles
                    const elegido = tipoEvento === t
                    return (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={elegido}
                        onClick={() => setTipoEvento(t)}
                        className={[
                          "flex h-[112px] flex-col justify-between rounded-2xl border p-4 text-left transition-[background-color,border-color,box-shadow] duration-200",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3cf7a]",
                          elegido
                            ? "border-[#c9a227] bg-[#1a3a2a] shadow-[0_0_30px_-12px_rgba(243,207,122,0.75)]"
                            : "border-[rgba(245,240,232,0.12)] bg-[#12261a] hover:border-[rgba(245,240,232,0.25)]",
                        ].join(" ")}
                      >
                        <Icono className={`h-6 w-6 ${elegido ? "text-[#f3cf7a]" : "text-[#f5f0e8]/70"}`} strokeWidth={1.6} />
                        <span className={`${serif} text-[19px] leading-tight`}>{t}</span>
                      </button>
                    )
                  })}
                </div>
              </Paso>
            )}

            {vista === "pasos" && idPaso === "salon" && (
              <Paso titulo="Elegí el salón" ayuda="Cada uno tiene su capacidad y lo que ya viene incluido.">
                {!catalogo && !errorCarga && <Cargando />}
                {catalogo && catalogo.salones.length === 0 && (
                  <p className="rounded-2xl border border-[rgba(245,240,232,0.12)] bg-[#12261a] p-4 text-[15px] text-[#f5f0e8]/80">
                    Todavía no hay salones listos para cotizar desde acá.
                    {!esPerfilClientes && " Para que aparezca uno, cargale el costo del salón y la capacidad en Cotizaciones > Configuración."}
                  </p>
                )}
                <div className="space-y-3" role="radiogroup" aria-label="Salón">
                  {catalogo?.salones.map((s) => {
                    const elegido = salonId === s.salon
                    const incluidos = serviciosParaFecha(s, fecha).filter((x) => x.incluido && !yaIncluidoEnTodos(x.nombre))
                    const libreEseDia = fecha ? !(ocupadas[s.salon] ?? []).includes(fecha) : null
                    return (
                      <button
                        key={s.salon}
                        type="button"
                        role="radio"
                        aria-checked={elegido}
                        onClick={() => setSalonId(s.salon)}
                        className={[
                          "w-full rounded-[20px] border p-5 text-left transition-[background-color,border-color,box-shadow] duration-200",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3cf7a]",
                          elegido
                            ? "border-[#c9a227] bg-[#1a3a2a] shadow-[0_0_34px_-14px_rgba(243,207,122,0.8)]"
                            : "border-[rgba(245,240,232,0.12)] bg-[#12261a] hover:border-[rgba(245,240,232,0.25)]",
                        ].join(" ")}
                      >
                        {/* El nombre ("Jazmines Casona") va solo en su renglón y abajo
                            la capacidad, que es lo primero que se compara. */}
                        <span className={`${serif} block text-[28px] leading-[1.05]`}>{s.nombre}</span>
                        <span className="mt-2 flex items-center gap-1.5 text-[14px] text-[#f5f0e8]/80">
                          <Users className="h-4 w-4 shrink-0 text-[#f3cf7a]/80" aria-hidden="true" />
                          Hasta {s.capacidadMaxima} invitados
                        </span>
                        {rasgosSalon(s.salon) && (
                          <span className="mt-3 block text-[14.5px] leading-snug text-[#f5f0e8]/90">{rasgosSalon(s.salon)}</span>
                        )}
                        <span className={`${rasgosSalon(s.salon) ? "mt-1.5" : "mt-3"} block text-[14px] leading-relaxed text-[#f5f0e8]/70`}>
                          Incluye {TEXTO_INCLUIDO_EN_TODOS}
                          {incluidos.length > 0 ? `; además, ${incluidos.map((x) => nombreEnFrase(x.nombre)).join("; ")}` : ""}.
                        </span>
                        {libreEseDia === false && (
                          <span className="mt-2 block text-[13px] text-[#e8a39b]">Ese día ya está reservado.</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </Paso>
            )}

            {vista === "pasos" && idPaso === "lugar" && salon && (
              <Paso titulo="¿Adentro o al aire libre?" ayuda={`${salon.nombre} tiene las dos opciones y el precio es el mismo. Arriba ves cómo queda.`}>
                <div className="space-y-3" role="radiogroup" aria-label="Dónde es la fiesta">
                  {(
                    [
                      { valor: "jardin", titulo: "Al aire libre", detalle: "En el jardín, bajo la guirnalda de luces, con la pileta al costado.", Icono: Trees },
                      { valor: "adentro", titulo: "Adentro", detalle: "En el salón de la casa, a resguardo del clima.", Icono: House },
                    ] as Array<{ valor: VistaCasona; titulo: string; detalle: string; Icono: LucideIcon }>
                  ).map(({ valor, titulo, detalle, Icono }) => {
                    const elegido = lugar === valor
                    return (
                      <button
                        key={valor}
                        type="button"
                        role="radio"
                        aria-checked={elegido}
                        onClick={() => setLugar(valor)}
                        className={[
                          "flex w-full items-start gap-4 rounded-[20px] border p-5 text-left transition-[background-color,border-color,box-shadow] duration-200",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3cf7a]",
                          elegido
                            ? "border-[#c9a227] bg-[#1a3a2a] shadow-[0_0_34px_-14px_rgba(243,207,122,0.8)]"
                            : "border-[rgba(245,240,232,0.12)] bg-[#12261a] hover:border-[rgba(245,240,232,0.25)]",
                        ].join(" ")}
                      >
                        <Icono className={`mt-0.5 h-7 w-7 shrink-0 ${elegido ? "text-[#f3cf7a]" : "text-[#f5f0e8]/70"}`} strokeWidth={1.6} />
                        <span className="min-w-0">
                          <span className={`${serif} block text-[26px] leading-none`}>{titulo}</span>
                          <span className="mt-2 block text-[14.5px] leading-snug text-[#f5f0e8]/75">{detalle}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </Paso>
            )}

            {vista === "pasos" && idPaso === "fecha" && salon && (
              <Paso titulo="¿Qué día es?" ayuda="Los días tachados ya están reservados.">
                <CalendarioFiesta
                  valor={fecha}
                  onElegir={elegirFecha}
                  desde={rango.desde}
                  hasta={rango.hasta}
                  ocupadas={ocupadasSalon}
                />
                {fecha && calculo && (
                  <div
                    ref={infoFecha}
                    className="mt-4 rounded-2xl border border-[rgba(245,240,232,0.12)] bg-[#12261a] p-4 text-[14.5px] leading-relaxed"
                  >
                    <p className="first-letter:uppercase">
                      <span className={`${serif} text-[19px]`}>{fechaLarga(fecha)}</span>
                    </p>
                    {fechaOcupada ? (
                      <SugerirSalon
                        fecha={fecha}
                        salonNombre={salon.nombre}
                        libres={salonesLibresEseDia(fecha, salonesListos, ocupadas, salon.salon)
                          .map((id) => catalogo?.salones.find((x) => x.salon === id))
                          .filter((x): x is NonNullable<typeof x> => !!x)}
                        onCambiar={setSalonId}
                      />
                    ) : calculo.resultado.recargo ? (
                      <p className="mt-1 text-[#f5f0e8]/70">
                        {calculo.dia.tipo === "especial"
                          ? `Es ${calculo.dia.etiqueta}: esta fecha tiene otro valor, ya sumado en el total.`
                          : "Los sábados tienen otro valor: ya está sumado en el total."}
                      </p>
                    ) : (
                      <p className="mt-1 text-[#f5f0e8]/70">Libre en {salon.nombre}.</p>
                    )}
                  </div>
                )}
              </Paso>
            )}

            {vista === "pasos" && idPaso === "invitados" && salon && (
              <Paso titulo="¿Cuántos van a ser?" ayuda="Los chicos cuentan para el menú, no para la barra.">
                <div className="rounded-2xl border border-[rgba(245,240,232,0.12)] bg-[#12261a] p-5">
                  <div className="flex items-baseline justify-between">
                    <label htmlFor="lj-adultos" className="text-[14.5px] text-[#f5f0e8]/75">
                      Adultos
                    </label>
                    <span className={`${serif} text-[56px] leading-none tabular-nums`} aria-hidden="true">
                      {adultos}
                    </span>
                  </div>
                  <input
                    id="lj-adultos"
                    type="range"
                    className="lj-rango mt-3"
                    min={MINIMO_ADULTOS}
                    max={salon.capacidadMaxima}
                    step={1}
                    value={Math.min(adultos, salon.capacidadMaxima)}
                    onChange={(e) => setAdultos(Number(e.target.value))}
                    style={
                      {
                        "--lj-p": `${((Math.min(adultos, salon.capacidadMaxima) - MINIMO_ADULTOS) / Math.max(1, salon.capacidadMaxima - MINIMO_ADULTOS)) * 100}%`,
                      } as React.CSSProperties
                    }
                    aria-valuetext={`${adultos} adultos`}
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ATAJOS_INVITADOS.filter((n) => n <= salon.capacidadMaxima).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setAdultos(n)}
                        aria-pressed={adultos === n}
                        className={`rounded-full border px-3.5 py-1.5 text-[13.5px] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3cf7a] ${
                          adultos === n
                            ? "border-[#f3cf7a] bg-[#f3cf7a] text-[#0d1d14]"
                            : "border-[rgba(245,240,232,0.2)] text-[#f5f0e8]/80 hover:border-[rgba(245,240,232,0.4)]"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="mt-6 flex items-center justify-between border-t border-[rgba(245,240,232,0.1)] pt-5">
                    <span className="text-[14.5px] text-[#f5f0e8]/75">Chicos</span>
                    <Contador valor={ninos} onCambiar={setNinos} min={0} etiqueta="chicos" />
                  </div>
                </div>
                <p
                  className={`mt-3 text-[13.5px] ${calculo?.resultado.superaCapacidad ? "text-[#e8a39b]" : "text-[#f5f0e8]/55"}`}
                >
                  En {salon.nombre} entran hasta {salon.capacidadMaxima} personas. Van {comensales}.
                </p>
              </Paso>
            )}

            {vista === "pasos" && idPaso === "menu" && salon && (
              <Paso titulo="El menú" ayuda="Un plato por paso. Podés cambiarlo cuando quieras.">
                <div className="mb-5 grid grid-cols-2 gap-1 rounded-full border border-[rgba(245,240,232,0.14)] bg-[#12261a] p-1" role="radiogroup" aria-label="Catering">
                  {[
                    { valor: true, texto: "Con catering" },
                    { valor: false, texto: "Sin catering" },
                  ].map((o) => (
                    <button
                      key={String(o.valor)}
                      type="button"
                      role="radio"
                      aria-checked={conCatering === o.valor}
                      onClick={() => setConCatering(o.valor)}
                      className={`h-11 rounded-full text-[14.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3cf7a] ${
                        conCatering === o.valor ? "bg-[#f3cf7a] font-semibold text-[#0d1d14]" : "text-[#f5f0e8]/75"
                      }`}
                    >
                      {o.texto}
                    </button>
                  ))}
                </div>
                {conCatering ? (
                  pasosMenu.length === 0 ? (
                    <p className="text-[15px] text-[#f5f0e8]/70">Este salón todavía no tiene platos para elegir.</p>
                  ) : (
                    <div className="space-y-6">
                      {pasosMenu.map((grupo) => (
                        <div key={grupo.categoria} role="radiogroup" aria-label={grupo.titulo}>
                          <h3 className={`${serif} mb-2.5 text-[21px]`}>{grupo.titulo}</h3>
                          <div className="space-y-2">
                            {grupo.platos.map((p) => {
                              const elegido = recetas.includes(p.recetaId)
                              const d = elegido ? 0 : totalCon({ recetas: elegirPlato(recetas, p.recetaId, salon.menu) }) - total
                              return (
                                <Opcion
                                  key={p.recetaId}
                                  tipo="radio"
                                  elegida={elegido}
                                  onElegir={() => tocarPlato(p.recetaId)}
                                  titulo={p.nombre}
                                  detalle={`${formatoPesos(p.precioPorPorcion)} por persona`}
                                  lateral={elegido ? undefined : diferencia(d)}
                                />
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <p className="rounded-2xl border border-[rgba(245,240,232,0.12)] bg-[#12261a] p-4 text-[14.5px] leading-relaxed text-[#f5f0e8]/75">
                    Sin catering no se suma la comida ni el personal de cocina. El salón, la barra y los detalles siguen igual.
                  </p>
                )}
              </Paso>
            )}

            {vista === "pasos" && idPaso === "barra" && salon && (
              <Paso titulo="La barra" ayuda={`Se calcula por adulto. Podés sumar hasta ${MAX_BARRAS === 2 ? "dos" : MAX_BARRAS}.`}>
                {bebidaSumada && bebidaDeMesa && barraIds.includes(bebidaDeMesa.id) && (
                  <p className="mb-4 rounded-xl bg-[#1a3a2a] px-4 py-3 text-[14px] leading-snug text-[#f5f0e8]/85">
                    Sumamos la bebida de mesa porque elegiste menú. Si no la querés, sacala.
                  </p>
                )}
                {salon.barras.length === 0 ? (
                  <p className="text-[15px] text-[#f5f0e8]/70">Este salón todavía no tiene barras para elegir.</p>
                ) : (
                  <div className="space-y-2">
                    {salon.barras.map((b) => {
                      const elegida = barraIds.includes(b.id)
                      const llena = !elegida && barraIds.length >= MAX_BARRAS
                      const d = elegida
                        ? aporte({ barraIds: barraIds.filter((id) => id !== b.id) })
                        : llena
                          ? 0
                          : totalCon({ barraIds: elegirBarra(barraIds, b.id) }) - total
                      const tragos =
                        b.cocteles.length > 5 ? `${b.cocteles.slice(0, 5).join(", ")} y ${b.cocteles.length - 5} más` : b.cocteles.join(", ")
                      return (
                        <Opcion
                          key={b.id}
                          tipo="casilla"
                          elegida={elegida}
                          deshabilitada={llena}
                          onElegir={() => setBarraIds((prev) => elegirBarra(prev, b.id))}
                          titulo={b.nombre}
                          detalle={b.bebidaDeMesa ? "Acompaña el menú." : tragos || undefined}
                          lateral={elegida ? <Aporte monto={d} /> : llena ? "máximo 2" : diferencia(d)}
                        />
                      )
                    })}
                  </div>
                )}
              </Paso>
            )}

            {vista === "pasos" && idPaso === "detalles" && salon && (
              <Paso titulo="Los detalles" ayuda="Lo que ya viene con el salón no se cobra aparte.">
                <div className="mb-6">
                  <h3 className={`${serif} mb-2.5 text-[21px]`}>Ya viene con el salón</h3>
                  <ul className="flex flex-wrap gap-2">
                    {[
                      ...INCLUIDO_EN_TODOS.map((nombre) => ({ clave: `todos-${nombre}`, nombre })),
                      ...serviciosFecha
                        .filter((s) => s.incluido && !yaIncluidoEnTodos(s.nombre))
                        .map((s) => ({ clave: s.servicioId, nombre: nombreParaCliente(s.nombre) })),
                    ].map((x) => (
                      <li
                        key={x.clave}
                        className="rounded-full border border-[#c9a227]/50 px-3 py-1.5 text-[13.5px] text-[#f5f0e8]/85"
                      >
                        {x.nombre}
                      </li>
                    ))}
                  </ul>
                </div>
                {(() => {
                  const extras = serviciosFecha.filter((s) => !s.incluido)
                  if (extras.length === 0) return <p className="text-[15px] text-[#f5f0e8]/70">No hay adicionales para esta fecha.</p>
                  const categorias = [...new Set(extras.map((s) => s.categoria))]
                  return (
                    <div className="space-y-6">
                      {categorias.map((c) => (
                        <div key={c}>
                          <h3 className={`${serif} mb-2.5 text-[21px]`}>{NOMBRE_CATEGORIA[c] ?? nombreParaCliente(c)}</h3>
                          <div className="space-y-2">
                            {extras
                              .filter((s) => s.categoria === c)
                              .map((s) => {
                                const elegido = s.servicioId in servicios
                                const conCantidad = UNIDADES_CON_CANTIDAD.includes(s.unidad)
                                const sinEste = { ...servicios }
                                delete sinEste[s.servicioId]
                                const d = elegido
                                  ? aporte({ servicios: sinEste })
                                  : totalCon({ servicios: { ...servicios, [s.servicioId]: 1 } }) - total
                                return (
                                  <Opcion
                                    key={s.servicioId}
                                    tipo="casilla"
                                    elegida={elegido}
                                    onElegir={() =>
                                      setServicios((prev) => {
                                        const sig = { ...prev }
                                        if (s.servicioId in sig) delete sig[s.servicioId]
                                        else sig[s.servicioId] = 1
                                        return sig
                                      })
                                    }
                                    titulo={nombreParaCliente(s.nombre)}
                                    detalle={
                                      conCantidad
                                        ? `${formatoPesos(s.precio)} ${s.unidad === "Por Hora" ? "por hora" : "cada uno"}`
                                        : undefined
                                    }
                                    lateral={elegido ? <Aporte monto={d} /> : diferencia(d)}
                                  >
                                    {conCantidad && (
                                      <div className="flex items-center justify-between">
                                        <span className="text-[14px] text-[#f5f0e8]/70">
                                          {s.unidad === "Por Hora" ? "Horas" : "Cantidad"}
                                        </span>
                                        <Contador
                                          valor={servicios[s.servicioId] ?? 1}
                                          min={1}
                                          etiqueta={s.unidad === "Por Hora" ? "horas" : "unidades"}
                                          onCambiar={(v) => setServicios((prev) => ({ ...prev, [s.servicioId]: v }))}
                                        />
                                      </div>
                                    )}
                                  </Opcion>
                                )
                              })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </Paso>
            )}

            {vista === "lista" && salon && calculo && (
              <section>
                <h1 className={`${serif} text-[38px] font-medium leading-[1.02] tracking-[-0.01em] text-[#f8f2e4]`}>Tu fiesta está lista</h1>
                <p className="mt-2 text-[15.5px] leading-relaxed text-[#f5f0e8]/75">
                  Este es el valor estimado de lo que armaste. Tocá una línea para cambiarla.
                </p>
                <ul className="mt-6 divide-y divide-[rgba(245,240,232,0.1)] rounded-2xl border border-[rgba(245,240,232,0.12)] bg-[#12261a]">
                  {[
                    { paso: "festejo" as IdPaso, titulo: "Festejo", valor: tipoEvento ?? "—" },
                    { paso: "salon" as IdPaso, titulo: "Salón", valor: salon.nombre },
                    ...(conLugar
                      ? [{ paso: "lugar" as IdPaso, titulo: "Lugar", valor: lugar === "adentro" ? "Adentro" : lugar === "jardin" ? "Al aire libre" : "Sin elegir" }]
                      : []),
                    { paso: "fecha" as IdPaso, titulo: "Fecha", valor: fecha ? fechaLarga(fecha) : "Sin fecha" },
                    { paso: "invitados" as IdPaso, titulo: "Invitados", valor: `${adultos} adultos${ninos ? ` y ${ninos} chicos` : ""}` },
                    { paso: "menu" as IdPaso, titulo: "Menú", valor: platosElegidos.length ? platosElegidos.join(", ") : "Sin catering" },
                    { paso: "barra" as IdPaso, titulo: "Barra", valor: barrasElegidas.length ? barrasElegidas.join(", ") : "Sin barra" },
                    {
                      paso: "detalles" as IdPaso,
                      titulo: "Detalles",
                      valor: Object.keys(servicios).length
                        ? serviciosFecha
                            .filter((s) => s.servicioId in servicios)
                            .map((s) => servicioConCantidad({ ...s, cantidad: servicios[s.servicioId] ?? 1 }))
                            .join(", ")
                        : "Solo lo incluido",
                    },
                  ].map((fila) => (
                    <li key={fila.titulo}>
                      <button
                        type="button"
                        onClick={() => irAlPaso(fila.paso)}
                        aria-label={`${fila.titulo}: ${fila.valor}. Cambiar`}
                        className="flex w-full items-baseline gap-4 px-4 py-3.5 text-left hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#f3cf7a]"
                      >
                        <span className="w-[76px] shrink-0 text-[13px] text-[#f5f0e8]/55">{fila.titulo}</span>
                        <span className="min-w-0 flex-1 text-[15px] leading-snug first-letter:uppercase">{fila.valor}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 rounded-2xl bg-[#1a3a2a] p-5">
                  <p className="text-[13.5px] text-[#f5f0e8]/65">Total estimado</p>
                  <p className={`${serif} mt-1 text-[40px] font-semibold leading-none tabular-nums text-[#f8f2e4]`}>
                    {formatoPesos(total)}
                  </p>
                  {comensales > 0 && (
                    <p className="mt-2 text-[13.5px] tabular-nums text-[#f5f0e8]/60">{formatoPesos(total / comensales)} por invitado</p>
                  )}
                  <p className="mt-4 text-[14.5px] leading-relaxed text-[#f5f0e8]/80">
                    Para ver el detalle completo y congelar este precio por {DIAS_PRECIO_CONGELADO} días, dejanos tus datos.
                  </p>
                  <button
                    type="button"
                    onClick={() => setPeajeAbierto(true)}
                    className="mt-4 flex h-13 w-full items-center justify-center rounded-full bg-[#f3cf7a] py-3.5 text-[16px] font-semibold text-[#0d1d14] shadow-[0_0_36px_-10px_rgba(243,207,122,0.8)] transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f3cf7a]/40"
                  >
                    Ver el detalle y congelar el precio
                  </button>
                </div>
                <button
                  type="button"
                  onClick={anterior}
                  className="mt-6 flex items-center gap-1.5 text-[14px] text-[#f5f0e8]/70 hover:text-[#f5f0e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3cf7a]"
                >
                  <ChevronLeft className="h-4 w-4" /> Volver a los detalles
                </button>
                <p className="mt-6 text-[12.5px] leading-relaxed text-[#f5f0e8]/45">
                  Prototipo: lo que cargues acá no se guarda ni se le manda a nadie.
                </p>
              </section>
            )}
          </main>

          {/* Barra de abajo: total en vivo y navegación */}
          {vista === "pasos" && (
            <div ref={barraAbajo} className="fixed inset-x-0 bottom-0 z-30 print:hidden">
              <div className="mx-auto max-w-[480px] border-t border-[rgba(245,240,232,0.12)] bg-[#0d1d14]/95 px-5 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 backdrop-blur-md md:rounded-t-2xl md:border-x">
                {intentoSeguir && falta && (
                  <p className="mb-2.5 text-[13.5px] leading-snug text-[#e8a39b]" role="alert">
                    {falta}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={anterior}
                    aria-label="Paso anterior"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[rgba(245,240,232,0.18)] text-[#f5f0e8]/85 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3cf7a]"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="min-w-0 flex-1">
                    {salon ? (
                      <>
                        <p className="text-[12px] text-[#f5f0e8]/55">Total estimado</p>
                        <TotalAnimado
                          valor={total}
                          formato={formatoPesos}
                          className={`${serif} block truncate text-[25px] font-semibold leading-tight tabular-nums text-[#f8f2e4]`}
                        />
                      </>
                    ) : (
                      <p className="text-[13px] leading-snug text-[#f5f0e8]/60">El total aparece cuando elijas el salón.</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={siguiente}
                    aria-disabled={!!falta}
                    className={`h-12 shrink-0 rounded-full px-6 text-[15.5px] font-semibold transition-[opacity,transform] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f3cf7a]/40 ${
                      falta ? "bg-[#f3cf7a]/45 text-[#0d1d14]/70" : "bg-[#f3cf7a] text-[#0d1d14]"
                    }`}
                  >
                    {paso === PASOS.length - 1 ? "Ver total" : "Siguiente"}
                  </button>
                </div>
              </div>
            </div>
          )}

        </>
      )}

      {/* ── Presupuesto ── */}
      {vista === "presupuesto" && salon && resumen && (
        <div className="mx-auto max-w-[520px] px-4 pb-[calc(env(safe-area-inset-bottom)+32px)] pt-[calc(env(safe-area-inset-top)+14px)] print:max-w-none print:p-0">
          <div className="flex h-10 items-center justify-between px-1 print:hidden">
            {logo}
            {chrome}
          </div>
          {/* Llega como una invitación: gira y se apoya. */}
          <div className="lj-invitacion mt-4">
            <PresupuestoCliente
              nombre={contacto.nombre.trim()}
              tipoEvento={tipoEvento}
              fecha={fecha}
              salonNombre={salon.nombre}
              lugar={conLugar && lugar ? TEXTO_LUGAR[lugar] : null}
              adultos={adultos}
              ninos={ninos}
              resumen={resumen}
              platos={platosElegidos}
              barras={barrasElegidas}
              validoHasta={validoHasta}
              disponible={fecha ? !(ocupadas[salon.salon] ?? []).includes(fecha) : null}
              ilustracion={fotoMaqueta}
            />
          </div>
          <div className="mt-5 space-y-3 px-1 print:hidden">
            <a
              href={linkWhatsApp(
                textoWhatsAppCliente({
                  nombre: contacto.nombre.trim().split(/\s+/)[0],
                  tipoEvento,
                  fecha,
                  salon: salon.nombre,
                  lugar: conLugar && lugar ? TEXTO_LUGAR[lugar] : null,
                  invitados: comensales,
                  total: resumen.total,
                }),
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-[#f3cf7a] text-[16px] font-semibold text-[#0d1d14] shadow-[0_0_36px_-10px_rgba(243,207,122,0.8)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f3cf7a]/40"
            >
              <MessageCircle className="h-5 w-5" /> Escribir por WhatsApp
            </a>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex h-12 items-center justify-center gap-2 rounded-full border border-[rgba(245,240,232,0.2)] text-[14.5px] text-[#f5f0e8]/90 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3cf7a]"
              >
                <Printer className="h-4 w-4" /> Guardar en PDF
              </button>
              <button
                type="button"
                onClick={() => setVista("lista")}
                className="flex h-12 items-center justify-center gap-2 rounded-full border border-[rgba(245,240,232,0.2)] text-[14.5px] text-[#f5f0e8]/90 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3cf7a]"
              >
                <RotateCcw className="h-4 w-4" /> Cambiar algo
              </button>
            </div>
            <p className="pt-2 text-center text-[12.5px] leading-relaxed text-[#f5f0e8]/45">
              Prototipo: tus datos no se guardaron ni se mandaron. El precio lo calculó el sistema con la misma cuenta que usa un vendedor.
            </p>
          </div>
        </div>
      )}

      {/* ── El peaje: tarjeta de respuesta ── */}
      <Drawer open={peajeAbierto} onOpenChange={setPeajeAbierto}>
        {/* La hoja se dibuja afuera del layout (portal): lleva su propia fuente. */}
        <DrawerContent
          className={`${fuenteFiesta.variable} border-0 bg-[#f8f2e4] text-[#1a3a2a] data-[vaul-drawer-direction=bottom]:max-h-[92svh]`}
        >
          <div className="mx-auto w-full max-w-[480px] overflow-y-auto px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-4">
            <DrawerTitle className={`${serif} text-[28px] font-medium leading-tight text-[#1a3a2a]`}>
              ¿A nombre de quién lo preparamos?
            </DrawerTitle>
            <DrawerDescription className="mt-2 text-[15px] leading-relaxed text-[#1a3a2a]/75">
              Te mostramos el detalle completo y te congelamos este precio por {DIAS_PRECIO_CONGELADO} días.
            </DrawerDescription>
            <form
              className="mt-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                verPresupuesto()
              }}
              noValidate
            >
              <Campo
                id="lj-nombre"
                etiqueta="Nombre y apellido"
                valor={contacto.nombre}
                onCambiar={(v) => editarContacto("nombre", v)}
                error={erroresPeaje.nombre}
                autoComplete="name"
              />
              <Campo
                id="lj-whatsapp"
                etiqueta="WhatsApp"
                tipo="tel"
                valor={contacto.whatsapp}
                onCambiar={(v) => editarContacto("whatsapp", v)}
                error={erroresPeaje.whatsapp}
                autoComplete="tel"
                ejemplo="11 2345 6789"
              />
              <Campo
                id="lj-email"
                etiqueta="Mail"
                tipo="email"
                valor={contacto.email}
                onCambiar={(v) => editarContacto("email", v)}
                error={erroresPeaje.email}
                autoComplete="email"
              />
              <label className="flex items-start gap-3 text-[14px] leading-snug">
                <input
                  type="checkbox"
                  checked={contacto.acepta}
                  onChange={(e) => editarContacto("acepta", e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[#1a3a2a]"
                />
                <span>Acepto que Los Jazmines me contacte por WhatsApp o mail sobre este presupuesto.</span>
              </label>
              {erroresPeaje.acepta && <p className="text-[13px] text-[#9a3428]">{erroresPeaje.acepta}</p>}
              {errorServidor && (
                <p className="rounded-xl bg-[#f6e1dd] px-4 py-3 text-[14px] text-[#7a2e24]" role="alert">
                  {errorServidor}
                </p>
              )}
              <button
                type="submit"
                disabled={enviando}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#1a3a2a] text-[16px] font-semibold text-[#f8f2e4] transition-opacity disabled:opacity-70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1a3a2a]/30"
              >
                {enviando && <Loader2 className="h-5 w-5 animate-spin" />}
                {enviando ? "Preparando tu presupuesto" : "Ver mi presupuesto"}
              </button>
              <p className="text-center text-[12.5px] text-[#1a3a2a]/55">Prototipo: estos datos no se guardan ni se mandan.</p>
            </form>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

function Paso({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <section>
      <h1 className={`${serif} text-[34px] font-medium leading-[1.04] tracking-[-0.01em] text-[#f8f2e4]`}>{titulo}</h1>
      {ayuda && <p className="mt-2 text-[15px] leading-relaxed text-[#f5f0e8]/70">{ayuda}</p>}
      <div className="mt-6">{children}</div>
    </section>
  )
}

/** "Sumaste la pantalla LED": aparece sobre la maqueta cuando algo se suma.
 *  A pantalla completa va más arriba, para no tapar los controles de abajo. */
function AvisoSumaste({ texto, grande }: { texto: string; grande?: boolean }) {
  return (
    <p
      role="status"
      className={`lj-aviso pointer-events-none absolute left-5 flex items-center gap-2 rounded-full bg-[#f8f2e4] px-3.5 py-1.5 text-[13.5px] font-medium text-[#1a3a2a] shadow-[0_10px_28px_-10px_rgba(0,0,0,0.7)] ${
        grande ? "top-[calc(env(safe-area-inset-top)+16px)] max-w-[calc(100%-40px)]" : "bottom-3 max-w-[calc(100%-84px)]"
      }`}
    >
      <Sparkles className="h-4 w-4 shrink-0 text-[#b08d2a]" aria-hidden="true" />
      <span className="truncate">{texto}</span>
    </p>
  )
}

/** Lo que va sobre la maqueta a pantalla completa: en qué paso está, el total
 *  y el botón para volver, todo abajo (donde llega el dedo). Con el celular
 *  derecho, sugiere girarlo para verla más grande. */
function ControlesGrande({ paso, total, onCerrar }: { paso: string; total: string | null; onCerrar: () => void }) {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0d1d14]/90 to-transparent" />
      <p className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+64px)] mx-auto flex w-fit items-center gap-2 rounded-full bg-[#0d1d14]/70 px-3.5 py-1.5 text-[13px] text-[#f5f0e8]/80 backdrop-blur-sm [@media(orientation:landscape)]:hidden">
        <Smartphone className="h-4 w-4 rotate-90" aria-hidden="true" />
        Girá el celular para verla más grande
      </p>
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-[max(20px,env(safe-area-inset-left))] pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <div className="pointer-events-none min-w-0">
          <p className="truncate text-[12.5px] text-[#f5f0e8]/65">{paso}</p>
          {total && <p className={`${serif} truncate text-[22px] font-semibold leading-tight tabular-nums text-[#f8f2e4]`}>{total}</p>}
          <p className="mt-0.5 text-[12px] text-[#f5f0e8]/50">Deslizá para girarla</p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          className="flex h-12 shrink-0 items-center gap-2 rounded-full bg-[#f3cf7a] px-5 text-[15px] font-semibold text-[#0d1d14] shadow-[0_0_30px_-8px_rgba(243,207,122,0.7)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f3cf7a]/40"
        >
          <Minimize2 className="h-4 w-4" aria-hidden="true" /> Seguir eligiendo
        </button>
      </div>
    </>
  )
}

/** Lo que suma algo que ya está elegido: en crema, para no confundirlo con
 *  el "+ $" (dorado) de lo que todavía se puede sumar. */
function Aporte({ monto }: { monto: number }) {
  if (Math.abs(monto) < 1) return null
  return <span className="text-[#f5f0e8]/70">{formatoPesos(monto)}</span>
}

function Cargando() {
  return (
    <div className="flex items-center gap-2.5 py-6 text-[15px] text-[#f5f0e8]/70">
      <Loader2 className="h-5 w-5 animate-spin" /> Cargando los salones…
    </div>
  )
}

function Contador({
  valor,
  onCambiar,
  min,
  etiqueta,
}: {
  valor: number
  onCambiar: (v: number) => void
  min: number
  etiqueta: string
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={etiqueta}>
      <button
        type="button"
        onClick={() => onCambiar(Math.max(min, valor - 1))}
        disabled={valor <= min}
        aria-label={`Uno menos (${etiqueta})`}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(245,240,232,0.22)] text-[#f5f0e8] disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3cf7a]"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-10 text-center text-[19px] tabular-nums" aria-live="polite">
        {valor}
      </span>
      <button
        type="button"
        onClick={() => onCambiar(valor + 1)}
        aria-label={`Uno más (${etiqueta})`}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(245,240,232,0.22)] text-[#f5f0e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3cf7a]"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}

function SugerirSalon({
  fecha,
  salonNombre,
  libres,
  onCambiar,
}: {
  fecha: string
  salonNombre: string
  libres: Array<{ salon: string; nombre: string }>
  onCambiar: (salon: string) => void
}) {
  return (
    <div className="mt-1">
      <p className="text-[#e8a39b]">Ese día {salonNombre} ya está reservado.</p>
      {libres.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {libres.map((s) => (
            <button
              key={s.salon}
              type="button"
              onClick={() => onCambiar(s.salon)}
              className="rounded-full bg-[#f3cf7a] px-4 py-2 text-[14px] font-semibold text-[#0d1d14] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f3cf7a]/40"
              aria-label={`Cambiar a ${s.nombre}, libre el ${fechaLarga(fecha)}`}
            >
              {s.nombre} está libre: cambiar
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Campo({
  id,
  etiqueta,
  valor,
  onCambiar,
  error,
  tipo = "text",
  autoComplete,
  ejemplo,
}: {
  id: string
  etiqueta: string
  valor: string
  onCambiar: (v: string) => void
  error?: string
  tipo?: "text" | "tel" | "email"
  autoComplete?: string
  ejemplo?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[14px] font-medium">
        {etiqueta}
      </label>
      <input
        id={id}
        type={tipo}
        inputMode={tipo === "tel" ? "tel" : tipo === "email" ? "email" : undefined}
        autoComplete={autoComplete}
        placeholder={ejemplo}
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`mt-1.5 h-12 w-full rounded-xl border bg-white/70 px-4 text-[16px] text-[#1a3a2a] placeholder:text-[#1a3a2a]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a3a2a]/40 ${
          error ? "border-[#9a3428]" : "border-[#1a3a2a]/20"
        }`}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-[13px] text-[#9a3428]">
          {error}
        </p>
      )}
    </div>
  )
}
