// Lo que el staff externo (DJ, Fotógrafo, Vestido, Pantalla, Coordinación)
// necesita de cada evento: dónde y a qué hora es, qué servicio le toca, las
// notas que le dejan a su oficio y el cronograma de la noche.
//
// Funciones puras: las usan la pantalla del staff (/eventos/staff), la de
// Cobrar cuota (donde Administración escribe las notas y el cronograma) y la
// ruta del servidor que guarda el cronograma. Test: scripts/test-staff-evento.cjs

export const PERFILES_STAFF = ["coordinacion", "dj", "fotografo", "vestido", "pantalla"] as const
export type PerfilStaff = (typeof PERFILES_STAFF)[number]

export const NOMBRE_PERFIL_STAFF: Record<PerfilStaff, string> = {
  coordinacion: "Coordinación",
  dj: "DJ",
  fotografo: "Fotógrafo",
  vestido: "Vestido",
  pantalla: "Pantalla",
}

export function esPerfilStaff(perfilId: string | null | undefined): perfilId is PerfilStaff {
  return (PERFILES_STAFF as readonly string[]).includes(perfilId ?? "")
}

// ---------------------------------------------------------------------------
// Horario
// ---------------------------------------------------------------------------

/** "HH:MM" válido (00:00 a 23:59), o null. Acepta "9:30" y lo lleva a "09:30". */
export function horaValida(hora: unknown): string | null {
  if (typeof hora !== "string") return null
  const m = hora.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, "0")}:${m[2]}`
}

/**
 * "de 21:00 a 05:00", "desde las 21:00", "hasta las 05:00" o "" si no hay
 * ninguna hora cargada. Las horas mal escritas se muestran tal cual: mejor
 * ver "21hs" que no ver nada.
 */
export function textoHorario(inicio: string | null | undefined, fin: string | null | undefined): string {
  const a = (inicio ?? "").trim()
  const b = (fin ?? "").trim()
  if (a && b) return `de ${a} a ${b}`
  if (a) return `desde las ${a}`
  if (b) return `hasta las ${b}`
  return ""
}

// ---------------------------------------------------------------------------
// Servicio resaltado
// ---------------------------------------------------------------------------

/**
 * El catálogo real tiene variantes por año ("FOTOGRAFIA 2027", "VESTIDO
 * 2028") y algo de inconsistencia de formato ("FOTO  + VIDEO" con doble
 * espacio, "FOTO-VIDEO 2027" con guion). Por eso se normalizan espacios,
 * guiones y "+" antes de comparar, y se usa "empieza con".
 */
export function normalizarNombreServicio(s: string): string {
  return (s || "").trim().toUpperCase().replace(/[+\-,]/g, " ").replace(/\s+/g, " ")
}

/**
 * Servicio a resaltar según el perfil. El del DJ en el catálogo es "DJ,
 * SONIDO, LUCES Y HUMO". Coordinación los coordina a todos: los ve todos
 * resaltados.
 */
export function esServicioDestacado(perfilId: string | null | undefined, nombreServicio: string): boolean {
  const n = normalizarNombreServicio(nombreServicio)
  switch (perfilId) {
    case "fotografo":
      return n.startsWith("FOTOGRAFIA") || n.startsWith("FOTO VIDEO")
    case "vestido":
      return n.startsWith("VESTIDO")
    case "pantalla":
      return n.startsWith("PANTALLA LED")
    case "dj":
      return n === "DJ" || n.startsWith("DJ ")
    case "coordinacion":
      return true
    default:
      return false
  }
}

// ---------------------------------------------------------------------------
// Notas por oficio
// ---------------------------------------------------------------------------

export type NotasStaffPerfil = Partial<Record<PerfilStaff, string>>

const LARGO_MAXIMO_NOTA = 2000

/** Solo oficios conocidos, sin vacías y con un largo máximo. Tolera null, texto JSON o basura. */
export function normalizarNotasStaffPerfil(raw: unknown): NotasStaffPerfil {
  let obj = raw
  if (typeof obj === "string") {
    try {
      obj = JSON.parse(obj)
    } catch {
      return {}
    }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {}
  const out: NotasStaffPerfil = {}
  for (const perfil of PERFILES_STAFF) {
    const valor = (obj as Record<string, unknown>)[perfil]
    if (typeof valor !== "string") continue
    const texto = valor.trim().slice(0, LARGO_MAXIMO_NOTA)
    if (texto) out[perfil] = texto
  }
  return out
}

export interface NotaVisible {
  /** "Para todos" o el nombre del oficio. */
  titulo: string
  texto: string
  /** Es la nota escrita para el perfil que está mirando. */
  propia: boolean
}

/**
 * Qué notas ve cada perfil: la general (para todos) y la de su oficio.
 * Coordinación ve además las de todos los oficios, para saber qué se le pidió
 * a cada uno. Barra y el resto ven solo la general.
 */
export function notasParaPerfil(
  perfilId: string | null | undefined,
  notaGeneral: string | null | undefined,
  notasPerfil: NotasStaffPerfil | null | undefined,
): NotaVisible[] {
  const out: NotaVisible[] = []
  const general = (notaGeneral ?? "").trim()
  if (general) out.push({ titulo: "Para todos", texto: general, propia: false })
  const notas = normalizarNotasStaffPerfil(notasPerfil)
  for (const perfil of PERFILES_STAFF) {
    const texto = notas[perfil]
    if (!texto) continue
    const propia = perfil === perfilId
    if (propia || perfilId === "coordinacion") {
      out.push({ titulo: `Para ${NOMBRE_PERFIL_STAFF[perfil]}`, texto, propia })
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Cronograma de la noche
// ---------------------------------------------------------------------------

export interface MomentoCronograma {
  id: string
  /** "HH:MM" */
  hora: string
  /** "Entrada de los novios", "Vals", "Torta"... */
  momento: string
  /** A quién le toca (se le resalta la línea). */
  perfiles: PerfilStaff[]
  nota?: string
}

const MAX_MOMENTOS = 40

function minutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number)
  return h * 60 + m
}

/**
 * Orden de la noche, no del reloj: con un evento que arranca 21:00, las 02:00
 * van después de las 23:00. Lo que está hasta 4 horas antes del inicio (la
 * llegada del staff, por ejemplo) sigue yendo antes.
 */
export function ordenarCronograma<T extends { hora: string }>(items: T[], horarioInicio?: string | null): T[] {
  const inicio = horaValida(horarioInicio)
  const base = inicio ? minutos(inicio) : null
  const clave = (hora: string) => {
    const m = minutos(hora)
    return base !== null && m < base - 240 ? m + 1440 : m
  }
  return [...items].sort((a, b) => clave(a.hora) - clave(b.hora))
}

/**
 * Valida lo que llega del navegador antes de guardarlo: hora válida, momento
 * con texto, solo oficios conocidos, sin duplicar ids y un máximo de líneas.
 * Lo que no sirve se descarta en silencio (no se rechaza todo el cronograma
 * por una línea a medio escribir).
 */
export function normalizarCronograma(raw: unknown, horarioInicio?: string | null): MomentoCronograma[] {
  let lista = raw
  if (typeof lista === "string") {
    try {
      lista = JSON.parse(lista)
    } catch {
      return []
    }
  }
  if (!Array.isArray(lista)) return []
  const ids = new Set<string>()
  const out: MomentoCronograma[] = []
  for (const item of lista) {
    if (!item || typeof item !== "object") continue
    const it = item as Record<string, unknown>
    const hora = horaValida(it.hora)
    const momento = typeof it.momento === "string" ? it.momento.trim().slice(0, 120) : ""
    if (!hora || !momento) continue
    let id = typeof it.id === "string" && it.id.trim() ? it.id.trim().slice(0, 80) : ""
    if (!id || ids.has(id)) id = `m-${out.length + 1}-${hora.replace(":", "")}`
    ids.add(id)
    const perfiles = Array.isArray(it.perfiles)
      ? PERFILES_STAFF.filter((p) => (it.perfiles as unknown[]).includes(p))
      : []
    const nota = typeof it.nota === "string" && it.nota.trim() ? it.nota.trim().slice(0, 300) : undefined
    out.push({ id, hora, momento, perfiles, ...(nota ? { nota } : {}) })
    if (out.length >= MAX_MOMENTOS) break
  }
  return ordenarCronograma(out, horarioInicio)
}

export function esMomentoDelPerfil(m: MomentoCronograma, perfilId: string | null | undefined): boolean {
  return esPerfilStaff(perfilId) && m.perfiles.includes(perfilId)
}

/** Sin acentos ni eñe: en la base el tipo está guardado como "Cumpleanos de 15". */
function normalizarTipo(tipo: string | null | undefined): string {
  return (tipo || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
}

type Plantilla = Array<[minutosDesdeElInicio: number, momento: string, perfiles: PerfilStaff[]]>

const RECEPCION: Plantilla[number] = [0, "Recepción de invitados", ["coordinacion", "fotografo", "dj"]]

const PLANTILLAS: Array<{ prefijo: string; momentos: Plantilla }> = [
  {
    prefijo: "cumpleanos de 15",
    momentos: [
      RECEPCION,
      [60, "Entrada de la quinceañera", ["coordinacion", "dj", "fotografo", "pantalla"]],
      [75, "Plato principal", ["coordinacion"]],
      [120, "Vals", ["dj", "fotografo", "pantalla"]],
      [135, "Ceremonia de las velas", ["coordinacion", "dj", "fotografo"]],
      [150, "Tanda de baile", ["dj"]],
      [225, "Brindis y torta", ["coordinacion", "dj", "fotografo"]],
      [270, "Carioca", ["dj"]],
      [300, "Fin de la fiesta", ["coordinacion"]],
    ],
  },
  {
    prefijo: "casamiento",
    momentos: [
      RECEPCION,
      [60, "Entrada de los novios", ["coordinacion", "dj", "fotografo", "pantalla"]],
      [75, "Plato principal", ["coordinacion"]],
      [120, "Vals", ["dj", "fotografo", "pantalla"]],
      [135, "Tanda de baile", ["dj"]],
      [210, "Brindis y torta", ["coordinacion", "dj", "fotografo"]],
      [240, "Ramo", ["dj", "fotografo"]],
      [270, "Carioca", ["dj"]],
      [300, "Fin de la fiesta", ["coordinacion"]],
    ],
  },
  {
    prefijo: "",
    momentos: [
      RECEPCION,
      [45, "Bienvenida", ["coordinacion", "dj", "fotografo", "pantalla"]],
      [60, "Plato principal", ["coordinacion"]],
      [120, "Tanda de baile", ["dj"]],
      [180, "Brindis y torta", ["coordinacion", "dj", "fotografo"]],
      [240, "Fin de la fiesta", ["coordinacion"]],
    ],
  },
]

function sumarMinutos(hora: string, delta: number): string {
  const total = (((minutos(hora) + delta) % 1440) + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

/**
 * Cronograma propuesto según el tipo de evento, a partir de la hora de inicio
 * (21:00 si no está cargada). Es un punto de partida: se ajusta a mano.
 */
export function cronogramaSugerido(
  tipoEvento: string | null | undefined,
  horarioInicio: string | null | undefined,
  nuevoId: () => string = () => Math.random().toString(36).slice(2, 10),
): MomentoCronograma[] {
  const tipo = normalizarTipo(tipoEvento)
  const plantilla = PLANTILLAS.find((p) => tipo.startsWith(p.prefijo))!.momentos
  const inicio = horaValida(horarioInicio) ?? "21:00"
  return plantilla.map(([delta, momento, perfiles]) => ({
    id: nuevoId(),
    hora: sumarMinutos(inicio, delta),
    momento,
    perfiles: [...perfiles],
  }))
}

/** Quién puede guardar el cronograma (lo controla la ruta del servidor). */
export const PERFILES_EDITAN_CRONOGRAMA = ["administracion", "soporte", "coordinacion"]
