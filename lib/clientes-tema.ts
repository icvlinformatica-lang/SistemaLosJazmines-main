// El estilo del simulador "Armá tu fiesta" según lo que se festeja (vista de
// Clientes). Pedido de Rodri del 19/10/2026: "para un 15 más femenino, para un
// casamiento más formal, para un evento empresarial más sobrio".
//
// La pantalla es la misma para todos (los pasos, la maqueta arriba, lo que se
// elige abajo); lo que cambia es el ánimo: los colores, la letra de los
// títulos, las esquinas y el brillo. Apenas se toca un festejo, la pantalla se
// viste con su estilo. Es solo dibujo: no cambia ningún precio.
//
// Todo es de noche (como la maqueta): los colores claros van en el papel del
// presupuesto. scripts/test-clientes-tema.cjs controla que en cada estilo el
// texto se lea (contraste AA).

export type IdTema = "jardin" | "casamiento" | "quince" | "empresarial" | "bautismo"

export interface TemaCliente {
  id: IdTema
  colores: {
    /** Fondo de la página. */
    fondo: string
    /** Tarjetas y cajas. */
    superficie: string
    /** Tarjeta elegida. */
    elegido: string
    /** Borde de lo elegido y adornos finos. */
    bordeElegido: string
    /** Lo que se toca: botones, el total, el "+ $" y las lamparitas. */
    acento: string
    /** Texto sobre el acento (el de los botones). */
    sobreAcento: string
    texto: string
    /** Títulos, un poco más claros que el texto. */
    titulo: string
    /** Avisos de que algo falta o no se puede (fecha reservada…). */
    alerta: string
    /** Centro del degradé detrás de la maqueta. */
    halo: string
    /** El papel del presupuesto y de la hoja de datos, su tinta y su dorado. */
    papel: string
    tinta: string
    oro: string
  }
  /** Letra de títulos y montos: la didona de la marca, su cursiva o la sans del sistema. */
  letra: "fiesta" | "fiesta-italica" | "sans"
  /** Esquinas, en px: tarjetas, cajas chicas (filas, calendario) y botones (999 = píldora). */
  radios: { tarjeta: number; chica: number; boton: number }
  /** Cuánto brilla lo elegido (0 = nada, para lo sobrio). */
  brillo: number
  /** Una línea fina bajo cada título, como en una invitación formal. */
  lineaBajoTitulo: boolean
}

export const TEMAS: Record<IdTema, TemaCliente> = {
  // El de la marca: el jardín de noche con guirnaldas.
  jardin: {
    id: "jardin",
    colores: {
      fondo: "#0d1d14",
      superficie: "#12261a",
      elegido: "#1a3a2a",
      bordeElegido: "#c9a227",
      acento: "#f3cf7a",
      sobreAcento: "#0d1d14",
      texto: "#f5f0e8",
      titulo: "#f8f2e4",
      alerta: "#e8a39b",
      halo: "#15301f",
      papel: "#f8f2e4",
      tinta: "#1a3a2a",
      oro: "#b08d2a",
    },
    letra: "fiesta",
    radios: { tarjeta: 20, chica: 12, boton: 999 },
    brillo: 0.75,
    lineaBajoTitulo: false,
  },
  // Formal: etiqueta de noche. Negro cálido, marfil y champagne; esquinas
  // justas y una línea fina bajo los títulos.
  casamiento: {
    id: "casamiento",
    colores: {
      fondo: "#121110",
      superficie: "#1b1a17",
      elegido: "#27241f",
      bordeElegido: "#c9ad74",
      acento: "#e6cf9e",
      sobreAcento: "#121110",
      texto: "#f4efe6",
      titulo: "#faf6ee",
      alerta: "#eba59c",
      halo: "#24211b",
      papel: "#fbf8f1",
      tinta: "#1d1b18",
      oro: "#9c7d43",
    },
    letra: "fiesta",
    radios: { tarjeta: 8, chica: 6, boton: 999 },
    brillo: 0.35,
    lineaBajoTitulo: true,
  },
  // Femenino: ciruela de noche y rosa, la didona en cursiva y todo más redondo.
  quince: {
    id: "quince",
    colores: {
      fondo: "#1d0f1b",
      superficie: "#291523",
      elegido: "#3d1e35",
      bordeElegido: "#e89ab9",
      acento: "#f6b8cf",
      sobreAcento: "#2a0f20",
      texto: "#fcedf3",
      titulo: "#fff4f8",
      alerta: "#ffb3a6",
      halo: "#33172c",
      papel: "#fdf1f5",
      tinta: "#5b1f40",
      oro: "#b5577f",
    },
    letra: "fiesta-italica",
    radios: { tarjeta: 26, chica: 16, boton: 999 },
    brillo: 0.7,
    lineaBajoTitulo: false,
  },
  // Sobrio: grafito y plata, letra sans, esquinas apenas redondeadas y sin brillo.
  empresarial: {
    id: "empresarial",
    colores: {
      fondo: "#0f1317",
      superficie: "#161c22",
      elegido: "#1f2730",
      bordeElegido: "#8ea6bd",
      acento: "#c8d5e2",
      sobreAcento: "#0f1317",
      texto: "#edf1f5",
      titulo: "#f5f8fb",
      alerta: "#f0a89e",
      halo: "#19212b",
      papel: "#f6f8fa",
      tinta: "#16212c",
      oro: "#4d6681",
    },
    letra: "sans",
    radios: { tarjeta: 10, chica: 8, boton: 10 },
    brillo: 0,
    lineaBajoTitulo: false,
  },
  // Suave: azul de noche y celeste.
  bautismo: {
    id: "bautismo",
    colores: {
      fondo: "#0e1724",
      superficie: "#142033",
      elegido: "#1c2d44",
      bordeElegido: "#9fc3e2",
      acento: "#bfdaf0",
      sobreAcento: "#0e1724",
      texto: "#f1f6fb",
      titulo: "#f8fbfe",
      alerta: "#f2ada3",
      halo: "#192a40",
      papel: "#f4f8fc",
      tinta: "#1b3450",
      oro: "#5f8fb8",
    },
    letra: "fiesta",
    radios: { tarjeta: 22, chica: 14, boton: 999 },
    brillo: 0.5,
    lineaBajoTitulo: false,
  },
}

const TEMA_DE_FESTEJO: Record<string, IdTema> = {
  Casamiento: "casamiento",
  "Cumpleaños de 15": "quince",
  Empresarial: "empresarial",
  Bautismo: "bautismo",
}

/** El estilo de un festejo. Cumpleaños, Otro y "todavía no eligió" van con
 *  el de la marca (el jardín). */
export function temaDeFestejo(tipoEvento: string | null | undefined): TemaCliente {
  return TEMAS[TEMA_DE_FESTEJO[tipoEvento ?? ""] ?? "jardin"]
}

/** "#rrggbb" → "rgba(r, g, b, a)". */
export function rgba(hex: string, alfa: number): string {
  const h = hex.replace("#", "")
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alfa))})`
}

// `cifras`: la letra de los montos y números grandes, siempre derecha (en el 15
// los títulos van en cursiva, los precios no).
const DIDONA = "var(--font-fiesta), Georgia, serif"
const LETRAS: Record<TemaCliente["letra"], { familia: string; estilo: string; cifras: string }> = {
  fiesta: { familia: DIDONA, estilo: "normal", cifras: DIDONA },
  // Si la cursiva todavía no bajó, se ve la de siempre (no una inclinada falsa).
  "fiesta-italica": { familia: `var(--font-fiesta-italica), ${DIDONA}`, estilo: "italic", cifras: DIDONA },
  // La del sistema (Geist). --font-sans no existe como variable: Tailwind la
  // escribe directo en las clases (@theme inline en app/globals.css).
  sans: { familia: '"Geist", "Geist Fallback", system-ui, sans-serif', estilo: "normal", cifras: '"Geist", "Geist Fallback", system-ui, sans-serif' },
}

/** Las variables CSS que usa la pantalla (--lj-…). */
export function variablesTema(t: TemaCliente): Record<string, string> {
  const c = t.colores
  const letra = LETRAS[t.letra]
  return {
    "--lj-fondo": c.fondo,
    "--lj-superficie": c.superficie,
    "--lj-elegido": c.elegido,
    "--lj-borde-elegido": c.bordeElegido,
    "--lj-acento": c.acento,
    "--lj-sobre-acento": c.sobreAcento,
    "--lj-texto": c.texto,
    "--lj-titulo": c.titulo,
    "--lj-alerta": c.alerta,
    "--lj-halo": c.halo,
    "--lj-papel": c.papel,
    "--lj-tinta": c.tinta,
    "--lj-oro": c.oro,
    // Las líneas finas, del color del texto apenas visible.
    "--lj-linea": rgba(c.texto, 0.12),
    "--lj-linea-fuerte": rgba(c.texto, 0.24),
    // El brillo de lo elegido (en lo sobrio, nada).
    "--lj-brillo": rgba(c.acento, t.brillo),
    "--lj-brillo-suave": rgba(c.acento, t.brillo * 0.6),
    "--lj-letra-titulo": letra.familia,
    "--lj-estilo-titulo": letra.estilo,
    "--lj-letra-cifras": letra.cifras,
    "--lj-radio": `${t.radios.tarjeta}px`,
    "--lj-radio-chico": `${t.radios.chica}px`,
    "--lj-radio-boton": `${t.radios.boton}px`,
  }
}

// ── Para los tests: contraste de WCAG ───────────────────────────────────────

function luminancia(hex: string): number {
  const h = hex.replace("#", "")
  const canal = (i: number) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4)
}

/** Contraste entre dos colores (1 a 21). AA pide 4,5 para texto común. */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

/** El color que se ve al poner `color` con transparencia `alfa` sobre `fondo`. */
export function mezcla(color: string, fondo: string, alfa: number): string {
  const a = color.replace("#", "")
  const b = fondo.replace("#", "")
  return (
    "#" +
    [0, 2, 4]
      .map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * alfa + parseInt(b.slice(i, i + 2), 16) * (1 - alfa)))
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  )
}
