# Guía de diseño — Sistema Los Jazmines

Reglas cortas para mantener consistencia entre pantallas. Se basan en lo ya
aplicado en `app/login/page.tsx` (rediseño de perfiles) y
`app/eventos/lista/page.tsx` (rediseño de la lista). No es un documento de
componentes ni de código — son criterios para decidir cómo resolver la
próxima pantalla sin tener que discutirlo de cero cada vez.

## 1. Íconos

- Siempre `lucide-react`. Nada de emojis, nada de otra librería de íconos
  (no hay ningún otro paquete de íconos instalado en el proyecto).
- Mismo grosor y tamaño dentro de un mismo contexto — no mezclar `h-4 w-4`
  con `h-5 w-5` para íconos que cumplen el mismo rol en la misma pantalla.
- Ejemplos reales: íconos de perfil en el login (`w-7 h-7` dentro de un
  círculo `w-16 h-16`, todos iguales); íconos de acción en Lista de Eventos
  (`h-4 w-4` en los botones de la fila/tarjeta).

## 2. Color

Nunca color random por elemento individual. Se agrupa por categoría o
función, y esa categoría tiene un único color fijo.

- **Login**: perfiles de "gestión" (Administración, Cobrar cuota,
  Coordinación, Soporte) → dorado `#c9a227`. Perfiles de "evento" (Cocina,
  Barra, DJ, Fotógrafo, Vestido, Pantalla) → verde `#2f8f5b`.
  **Excepción reservada**: Cobrar cuota, además de compartir el dorado de su
  categoría, tiene su propio tratamiento especial de tarjeta (fondo degradé
  blanco→dorado + borde `#d4af37`) por ser el acceso más usado. Ese
  tratamiento especial NO se repite en otros perfiles de gestión, aunque
  compartan la categoría — queda reservado para ese único acceso.
- **Lista de Eventos**: el estado del evento (`borrador` / `pendiente` /
  `en_preparación` / `confirmado` / `completado` / `cancelado`) tiene un
  color fijo por estado vía `estadoConfig` (slate / amber / sky / emerald /
  red) — un color por estado, nunca por evento individual.
- Todavía no hay color por tipo de evento aplicado en ningún lado (ver
  pendientes al final si se quiere agregar).

## 3. Texto sobre fondos fotográficos

Nunca texto chico suelto directo sobre una foto o fondo oscuro sin
contraste garantizado. Usar un chip: fondo sólido (blanco, o un color
sólido de la paleta de marca), esquinas redondeadas, padding chico.

Ejemplo real: el tooltip de nombre de cada tile en el login (fondo sólido
`#1a3a2a`, texto blanco, `rounded-lg`, `px-2.5 py-1`) — nunca texto blanco
suelto sin fondo propio sobre la foto.

## 4. Plegar vs. scrollear

- Contenido secundario que se puede ocultar sin perder contexto →
  **plegado**, con `ChevronDown`/`ChevronUp` de lucide-react. Ejemplos
  reales: sección "Evento" en el login, panel "Dashboard" en Lista de
  Eventos — mismo patrón de ícono en los dos lugares.
- Contenido necesario que no entra en el alto disponible → **scroll
  interno**, acotado a esa sección nada más, nunca de la página completa y
  nunca horizontal. Ejemplo real: la columna de tiles de perfil en el login
  (`overflow-y-auto` acotado a esa columna; el resto de la pantalla —
  header, panel de PIN — no se mueve).
- Sin scrollbars nativas visibles en contenedores internos — usar
  controles propios. Clase reusable `.no-scrollbar` en `app/globals.css`
  (oculta la nativa manteniendo el scroll funcional) + flechas propias
  (`ChevronUp`/`ChevronDown`) que solo aparecen cuando hay contenido oculto
  en esa dirección. Ejemplo real: la columna de tiles del login.

## 5. Tamaños fijos vs. proporcionales

Elementos repetidos en grilla (tiles, íconos de tipo) van con tamaño FIJO
en px, nunca proporcional al contenedor (nada de `1fr`/`w-full` para un
elemento que se repite en grilla, porque en pantallas anchas se estira y
pierde el ícono en el medio).

Ejemplos reales: tiles de perfil en el login (`w-[88px] h-[88px]` fijos,
grid `repeat(auto-fill, minmax(88px, 88px))`); íconos de cobertura de pago
en Lista de Eventos (`h-7 w-7` fijos por ícono, sin importar cuántos
apliquen en la fila).

## 6. Acciones en listas/tablas

Solo 1-2 acciones visibles por fila/tarjeta. El resto va a un
`DropdownMenu` (de `components/ui/dropdown-menu`).

Ejemplo real: `AccionesEvento` en Lista de Eventos — Imprimir y Ver/Editar
quedan siempre visibles; Cobrar cuota, Marcar como finalizado y Eliminar se
movieron a un menú desplegable. Mismo componente reusado entre la tabla de
desktop y las tarjetas de mobile.

## 7. Vista de Clientes (/clientes)

Es lo único que mira un cliente, no el equipo: tiene su propio lenguaje,
tomado de la foto del jardín de noche con guirnaldas (`public/clientes/`).
Las reglas 1 a 6 siguen valiendo (íconos de `lucide-react`, nada de emojis,
probar a 390 px sin scroll horizontal).

- **Color**: noche `#0d1d14` de fondo, superficies `#12261a`, elegido
  `#1a3a2a` (el verde de la marca) con borde dorado `#c9a227`, luz
  `#f3cf7a` para lo que se puede tocar y para el total, crema `#f5f0e8` para
  el texto. El presupuesto va en papel `#f8f2e4` con tinta `#1a3a2a`, como
  una invitación. Ese es el estilo de la marca ("jardín"); cada festejo tiene
  el suyo (abajo). Los colores nunca van fijos en la pantalla: son variables
  `--lj-…` que salen de `lib/clientes-tema.ts`.
- **Letra**: Bodoni Moda (`app/clientes/fuentes`, licencia OFL) solo para
  títulos y montos; el resto, la letra del sistema.
- **Un estilo por festejo** (`lib/clientes-tema.ts`, pedido del 19/10/2026):
  la pantalla es la misma, cambia el ánimo, apenas se toca el festejo y con un
  pasaje suave de colores.
  - **Cumpleaños de 15, femenino**: ciruela de noche y rosa, los títulos en la
    cursiva de Bodoni Moda (baja solo con ese festejo) y todo más redondo.
  - **Casamiento, formal**: negro cálido, marfil y champagne, esquinas justas
    y una línea fina bajo cada título, como una invitación.
  - **Empresarial, sobrio**: grafito y plata, títulos y montos en la letra del
    sistema (Geist), esquinas apenas redondeadas y nada que brille.
  - **Bautismo, suave**: azul de noche y celeste.
  - Cumpleaños, Otro y antes de elegir: el de la marca.
  Todo es de noche, como la maqueta; el papel del presupuesto también cambia.
  `test-clientes-tema` controla que en cada estilo el texto se lea (AA), y por
  eso el texto apagado nunca baja de 60 %.
- **Poco texto**: cada paso tiene su título y, como mucho, una línea. Lo que
  se puede decir con un ícono va con ícono; lo que es igual para todos los
  salones se dice una sola vez; lo secundario se pliega.
- **Lo memorable es una sola cosa**: la maqueta 3D de la fiesta de noche
  (`components/clientes/maqueta/`), que se arma sola con cada elección. Es
  el juego: la persona ve crecer su fiesta. La guirnalda de luces sigue siendo
  el indicador de pasos (`components/clientes/guirnalda.tsx`), apoyada arriba
  de la maqueta; cada lamparita es un paso y al final se prenden todas. El
  resto de la pantalla queda sobrio: lo único que se mueve fuera de la
  maqueta es lo que responde a un toque (el total que corre, el aviso
  "Sumaste…", el presupuesto que llega girando como una invitación).
- **La maqueta**: formas simples hechas en código (sin modelos que bajar),
  con los colores de arriba más madera; los globos y detalles toman el color
  del festejo. Es ilustración: nunca lleva precios ni datos de nadie. Cada
  pieza nueva cae con un rebote y la cámara va a mostrarla. Con "reducir
  movimiento" queda quieta (sin vaivén, sin vuelta de cámara ni papelitos).
  three.js se baja aparte y solo en `/clientes`; sin WebGL, la pantalla queda
  como antes, sin maqueta.
- **Cada salón es como es** (`components/clientes/maqueta/ambientes.ts`):
  antes de elegir salón la maqueta es un plano (verde con grilla dorada y lo
  que va a ir en punteado). Solo la Casona tiene aire libre: su jardín con
  guirnalda, y al costado la casa colonial para quedarse y la pileta. La casa
  sale de las fotos del dueño (19/10/2026): blanca, de una planta, con galería
  de columnas y techo de tejas, azotea con pretil y copones, y el cartel en el
  copete arriba de la puerta. Con la Casona se suma el paso 3, "¿Adentro o al
  aire libre?", y con "Adentro" se ve la fiesta en su salón interior (no
  cambia el precio). Sobre la maqueta no va ningún botón para elegir, porque
  arriba no llega el dedo: todas las elecciones van abajo. Lo único encima es
  el botón de pantalla completa, en su esquina de abajo (también se abre
  tocando la maqueta o girando el celular); a pantalla completa, el total y
  "Seguir eligiendo" van abajo.
  Adelante de la isla, la Quinta tiene su entrada con mucho verde (una
  pérgola de madera con jazmín sobre el camino, piedra blanca, matas y
  cercos) y la playa de estacionamiento; la Casona, la playa. El Salón no
  tiene exterior. Quinta, Salón y cualquier salón nuevo son salones cerrados
  vistos como una maqueta: la pared que tapa la vista baja y, de cerca, el
  techo (vigas y arañas) se desvanece. Cada uno tiene su estilo: la Quinta,
  todo en madera (paredes blancas con friso de tablas, parquet, techo de
  listones en cuadrícula y cortinas blancas con dorado); el Salón, boiserie,
  mármol y cortinados verdes; la Casona por dentro, cal, arcos, terracota y
  su techo de madera (vigas y casetones). El techo de madera se ve en los
  planos de lejos y se va apenas la cámara se acerca, para no tapar las
  mesas. Si hay más fotos de los salones, se ajustan los colores y las
  texturas de cada estilo (`DISENOS`).
- **Las tarjetas de los salones**: el nombre comercial (Jazmines Salón,
  Jazmines Casona, Jazmines Quinta, en ese orden) va solo en su renglón y
  abajo la capacidad, con el ícono de personas, porque es lo primero que se
  compara; después, lo que tiene en pocas palabras y con su ícono (aire libre,
  pileta, casa colonial, estacionamiento, todo en madera, entrada con mucho
  verde, salón cerrado). Lo que incluyen todos va una sola vez,
  debajo de las tarjetas; en cada una, solo lo que trae de más.
- **Solo el total** (pedido de Rodri del 19/10/2026): ninguna opción muestra
  su precio ni cuánto suma, y el presupuesto no tiene desglose por rubro ni
  "por invitado". El total de abajo es el único monto, y cambia en vivo con
  cada toque. Lo de cada cosa está escondido con `MOSTRAR_DESGLOSE = false`
  en `app/clientes/page.tsx`: con `true` vuelve a la derecha de cada opción
  (en dorado lo que se puede sumar, "+ $ 120.000", y en crema lo que ya suma).
- **El final lleva directo al salón** (pedido de Rodri del 19/10/2026): "Tu
  fiesta está lista" termina con el botón "Solicitar presupuesto", que abre
  la hoja con nombre, WhatsApp y mail. La hoja tiene el mismo botón, con el
  ícono de WhatsApp: al tocarlo se abre el chat de Los Jazmines con el
  mensaje ya escrito, y la letra chica lo avisa ("Se abre WhatsApp con lo que
  armaste"). Detrás queda el presupuesto, con un solo botón principal,
  "Escribinos por WhatsApp" (corto, para que entre en un renglón en el
  celular), por si el chat no se abrió.

---

## Pendientes / inconsistencias detectadas (no corregidas todavía)

Quedan para decidir juntos si se corrigen en otro pedido:

1. **Color por tipo de evento**: no existe todavía en Lista de Eventos
   (regla 2). Si se agrega en el futuro, debería seguir el mismo criterio
   de "un color fijo por categoría, nunca random por evento."
2. **Token `--surface-2`**: la regla de chips (regla 3) menciona
   `var(--surface-2)` como alternativa al blanco, pero ese token no existe
   todavía en `app/globals.css` (el proyecto define `--primary`,
   `--background`, etc. en formato `oklch`, sin una escala de superficies
   nombrada). Si se quiere usar ese nombre de variable de verdad, hay que
   definirla primero.
