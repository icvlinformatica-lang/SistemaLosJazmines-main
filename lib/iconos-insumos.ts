/**
 * Silueta que acompaña a cada insumo en Almacén y en Barra.
 *
 * Es una ayuda visual para reconocer de un vistazo qué es cada cosa en una
 * lista larga (182 insumos de cocina, 94 de barra). Se elige por el nombre
 * del insumo, y si no se reconoce, queda un ícono neutro: nunca se rompe ni
 * queda un hueco.
 *
 * El orden de las reglas importa: la primera que coincide gana. Por eso las
 * más específicas van antes ("leche de coco" es coco, no lácteo).
 */

import {
  Apple,
  Banana,
  Beef,
  Beer,
  Cake,
  Candy,
  Carrot,
  Cherry,
  Citrus,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Dessert,
  Drumstick,
  Droplet,
  Egg,
  Fish,
  Flame,
  Grape,
  Ham,
  IceCream,
  LeafyGreen,
  Martini,
  Milk,
  Nut,
  Package,
  Pizza,
  Salad,
  Sandwich,
  Soup,
  Wheat,
  Wine,
  type LucideIcon,
} from "lucide-react"

/** Cada regla: si alguna de estas palabras está en el nombre, va ese ícono. */
const REGLAS: Array<{ palabras: string[]; icono: LucideIcon }> = [
  // ── Bebidas ────────────────────────────────────────────────────────────
  { palabras: ["cerveza", "birra", "ipa", "lager", "porron"], icono: Beer },
  { palabras: ["vino", "malbec", "cabernet", "chardonay", "chardonnay", "bonarda", "rose", "espumante", "champagne", "champan", "champán", "sidra", "tardio", "tardía"], icono: Wine },
  { palabras: ["gin", "vodka", "ron", "whisky", "whiskey", "tequila", "fernet", "campari", "aperol", "vermut", "cinzano", "gancia", "licor", "cachaza", "pisco", "bourbon", "baileys", "triple seco", "amargo", "cynar", "skyy", "curaçao", "curacao"], icono: Martini },
  { palabras: ["coca", "sprite", "tonica", "tónica", "soda", "pomelo", "citric", "levite", "monster", "gaseosa", "cunnington", "frezze"], icono: CupSoda },
  { palabras: ["jugo", "naranja exprimid", "baggio", "pulpa", "arandano", "lima", "limon", "limón", "piña", "pina", "ananá", "anana", "maracuya", "durazno", "frutilla"], icono: Citrus },
  { palabras: ["cafe", "café"], icono: Coffee },
  { palabras: ["agua", "hielo", "almibar", "granadina", "jarabe"], icono: Droplet },

  // ── Cocina: lo específico primero ──────────────────────────────────────
  { palabras: ["helado", "casata", "almendrado"], icono: IceCream },
  { palabras: ["torta", "tarta", "lemon pie", "chesecake", "cheesecake", "streusel", "brownie", "budin", "budín"], icono: Cake },
  { palabras: ["dulce", "azucar", "azúcar", "chocolate", "caramelo", "miel", "merengue"], icono: Candy },

  { palabras: ["galleta", "bizcocho", "vainilla"], icono: Cookie },
  { palabras: ["factura", "medialuna", "croissant", "hojaldre", "tapas", "masa"], icono: Croissant },
  { palabras: ["pizza", "muzza", "fugazz"], icono: Pizza },
  { palabras: ["pan", "figaza", "mignon", "baguette", "pebete", "tostada"], icono: Sandwich },
  { palabras: ["harina", "rebozador", "pan rallado", "levadura", "fideo", "pasta", "ñoqui", "noqui", "arroz", "polenta", "avena"], icono: Wheat },

  { palabras: ["pollo", "suprema", "pata", "muslo", "milanesita"], icono: Drumstick },
  { palabras: ["carne", "vacio", "vacío", "asado", "bife", "lomo", "matambre", "costilla", "chorizo", "morcilla", "hamburguesa", "milanesa", "ternera", "bondiola", "cerdo", "pernil", "peceto"], icono: Beef },
  { palabras: ["jamon", "jamón", "panceta", "salame", "fiambre", "crudo", "serrano", "salchicha", "mortadela"], icono: Ham },
  { palabras: ["pescado", "salmon", "salmón", "atun", "atún", "merluza", "langostino", "camaron", "camarón", "marisco"], icono: Fish },
  { palabras: ["huevo"], icono: Egg },

  { palabras: ["queso", "muzarella", "mozzarella", "roquefort", "brie", "leche", "manteca", "yogur", "ricota", "crema de leche", "crema de coco"], icono: Milk },
  // Va DESPUÉS de los lácteos a propósito: "crema de leche" es lácteo, no postre.
  { palabras: ["postre", "flan", "mousse", "crema"], icono: Dessert },
  { palabras: ["lechuga", "rucula", "rúcula", "espinaca", "acelga", "repollo", "verdura", "ensalada", "brocoli", "brócoli"], icono: Salad },
  { palabras: ["zanahoria", "papa", "batata", "cebolla", "morron", "morrón", "tomate", "choclo", "arveja", "arverja", "zapallo", "berenjena", "calabaza", "remolacha", "puerro", "apio", "champiñon", "champiñón", "hongo"], icono: Carrot },
  { palabras: ["albahaca", "perejil", "oregano", "orégano", "menta", "romero", "tomillo", "laurel", "hierba", "ciboulette", "verdeo", "ajo"], icono: LeafyGreen },
  { palabras: ["manzana"], icono: Apple },
  { palabras: ["banana", "platano", "plátano"], icono: Banana },
  { palabras: ["uva", "pasa"], icono: Grape },
  { palabras: ["cereza", "guinda", "aceituna"], icono: Cherry },
  { palabras: ["sopa", "caldo", "cazuela", "guiso", "risotto", "salsa", "pure", "puré"], icono: Soup },
  { palabras: ["carbon", "carbón", "leña", "lena", "fuego"], icono: Flame },
  // Condimentos y secos: van al final para no ganarle a nada más específico
  // ("sal" está dentro de "ensalada" y de "salsa").
  { palabras: ["sal ", "sal fina", "pimienta", "condimento", "especia", "vinagre", "aceite", "aceto", "mostaza", "ketchup", "soja"], icono: Nut },
]

/** Ícono neutro para lo que no se reconoce: una caja. */
export const ICONO_INSUMO_POR_DEFECTO = Package

/**
 * Silueta para un insumo de cocina, elegida por su nombre.
 * Nunca devuelve null: si no reconoce nada, devuelve la caja.
 */
export function iconoDeInsumo(descripcion: string): LucideIcon {
  const texto = (descripcion || "").toLowerCase()
  for (const regla of REGLAS) {
    if (regla.palabras.some((p) => texto.includes(p))) return regla.icono
  }
  return ICONO_INSUMO_POR_DEFECTO
}

/**
 * Silueta para un insumo de barra. Se intenta primero por el nombre (para
 * distinguir un vino de una cerveza), y si no se reconoce se cae a la
 * categoría, que en barra siempre está cargada. Última opción: una botella.
 */
export function iconoDeInsumoBarra(descripcion: string, categoria?: string): LucideIcon {
  const texto = (descripcion || "").toLowerCase()
  for (const regla of REGLAS) {
    if (regla.palabras.some((p) => texto.includes(p))) return regla.icono
  }

  switch ((categoria || "").toLowerCase()) {
    case "alcoholes":
      return Wine
    case "licores":
      return Martini
    case "mixers":
    case "jugos":
      return CupSoda
    case "garnish":
      return LeafyGreen
    default:
      // En barra, lo que no se reconoce es casi siempre una botella.
      return Wine
  }
}
