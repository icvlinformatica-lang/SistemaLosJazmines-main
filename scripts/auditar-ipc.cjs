const fs = require("node:fs")
const ts = require("typescript")
require.extensions[".ts"] = (mod, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  mod._compile(result.outputText, filename)
}
const { calcularIPCPeriodo, numerosPagados, fechaNegocio } = require("../lib/ipc-cuotas.ts")
const postgres = require("postgres")
const db = postgres(process.env.POSTGRES_URL, { ssl: "require", max: 1 })
const parse = (value) => typeof value === "string" ? JSON.parse(value) : value
async function main() {
  const fecha = fechaNegocio()
  const resultado = await db.begin("read only", async (tx) => {
    const historial = (await tx`SELECT mes, anio, porcentaje FROM historial_ipc`).map(h => ({ ...h, porcentaje: Number(h.porcentaje) }))
    const rows = await tx`SELECT id, nombre, plan_de_cuotas, pagos, estado, md5(plan_de_cuotas::text) AS plan_hash, md5(pagos::text) AS pagos_hash FROM eventos WHERE deleted_at IS NULL AND estado IS DISTINCT FROM 'completado'`
    const revisados = []
    for (const row of rows) {
      const evento = { estado: row.estado, planDeCuotas: parse(row.plan_de_cuotas), pagos: parse(row.pagos) ?? [] }
      const resultado = calcularIPCPeriodo(evento, historial, fecha)
      if (resultado.estado === "no_aplica") continue
      const pagadas = numerosPagados(evento)
      const pendientes = (evento.planDeCuotas.cuotas ?? []).filter(c => !pagadas.includes(c.numero))
      if (!pendientes.length) continue
      revisados.push({ id: row.id, nombre: row.nombre, pendientes: pendientes.length, estado: resultado.estado,
        ...(resultado.estado === "pendiente" ? { motivo: resultado.motivo } : {
          calculo: resultado.calculo, anteriores: [...new Set(pendientes.map(c => c.montoCuota))],
          cambia: pendientes.some(c => c.montoCuota !== resultado.calculo.monto), planHash: row.plan_hash, pagosHash: row.pagos_hash,
        }),
      })
    }
    return revisados
  })
  console.log(JSON.stringify({ fecha, total: resultado.length, conCambio: resultado.filter(r => r.cambia).length,
    ambiguos: resultado.filter(r => r.estado === "pendiente").length, eventos: resultado }, null, 2))
}
main().catch(() => { console.error("No se pudo completar la auditoría de solo lectura."); process.exitCode = 1 }).finally(() => db.end())
