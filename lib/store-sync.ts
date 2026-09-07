import type { AppState } from "./store"

export type RemoteStoreData = Partial<Pick<AppState,
  "eventos" | "movimientosCaja" | "pagosPersonal" | "servicios" |
  "insumos" | "insumosBarra" | "recetas" | "cocteles"
>>

export class StoreSyncGuard {
  private revision = 0
  private pending = 0

  snapshot() {
    return this.pending === 0 ? this.revision : null
  }

  isCurrent(revision: number | null) {
    return revision !== null && this.pending === 0 && revision === this.revision
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    this.pending++
    this.revision++
    try {
      return await operation()
    } finally {
      this.pending--
      this.revision++
    }
  }
}

export function mergeRemoteStore(current: AppState, baseline: AppState, updates: RemoteStoreData): AppState {
  const keys = Object.keys(updates) as (keyof RemoteStoreData)[]
  // Una lectura iniciada antes de un cambio local no puede deshacerlo,
  // incluso si React todavía tenía pendiente aplicar el setState local.
  if (keys.some((key) => current[key] !== baseline[key])) return current
  return { ...current, ...updates }
}
