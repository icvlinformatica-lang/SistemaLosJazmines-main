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
