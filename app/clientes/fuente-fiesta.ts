import localFont from "next/font/local"

// Bodoni Moda (licencia SIL OFL, ver fuentes/OFL.txt): una didona, de la
// misma familia que el "EVENTOS" del logo. Va dentro del repo (no por Google
// Fonts) para que se vea igual en todos lados. Solo para títulos y montos; el
// resto del texto sigue con la letra del sistema.
//
// Vive en su propio archivo porque la usan el layout (la vista entera) y la
// hoja del peaje, que se dibuja afuera del layout (en un portal).
export const fuenteFiesta = localFont({
  src: "./fuentes/bodoni-moda-latin.woff2",
  variable: "--font-fiesta",
  weight: "400 900",
  display: "swap",
})

// La cursiva de la misma letra, para los títulos del 15 (lib/clientes-tema.ts:
// "más femenino"). No se precarga: baja solo cuando se elige ese festejo.
export const fuenteFiestaItalica = localFont({
  src: "./fuentes/bodoni-moda-latin-italic.woff2",
  variable: "--font-fiesta-italica",
  weight: "400 900",
  style: "italic",
  display: "swap",
  preload: false,
})
