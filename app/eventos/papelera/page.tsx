import { redirect } from "next/navigation"

// La papelera de eventos se unió con el Archivo en Eventos → Finalizados
// (pestaña "Eliminados", 27/10/2026). Esta dirección queda para los enlaces
// y favoritos viejos.
export default function PapeleraPage() {
  redirect("/eventos/finalizados?ver=eliminados")
}
