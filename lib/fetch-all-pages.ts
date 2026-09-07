interface PageResult<T> {
  data: T[] | null
  error: unknown
  count: number | null
}

export async function fetchAllPages<T extends { id: string }>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const rows = new Map<string, T>()
  let offset = 0
  let expectedCount: number | null = null
  while (true) {
    const { data, error, count } = await fetchPage(offset, offset + 499)
    if (error) throw error
    if (!Array.isArray(data) || count === null) throw new Error("Respuesta paginada incompleta")
    if (expectedCount !== null && expectedCount !== count) {
      throw new Error("Los registros cambiaron durante la lectura; se reintentará la sincronización")
    }
    expectedCount = count
    for (const row of data) rows.set(row.id, row)
    offset += data.length
    if (offset >= count) {
      if (rows.size !== count) throw new Error("La lectura contiene registros duplicados o faltantes")
      return [...rows.values()]
    }
    if (data.length === 0) throw new Error("Faltan registros por recuperar")
  }
}
