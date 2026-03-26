import postgres from 'postgres'

// Lazy singleton — client is created on first request, not at module load.
// This prevents Next.js build failures when POSTGRES_URL is not available at build time.
let _client: ReturnType<typeof postgres> | null = null

export function getDb(): ReturnType<typeof postgres> {
  if (!_client) {
    const connectionString = process.env.POSTGRES_URL
    if (!connectionString) {
      throw new Error('POSTGRES_URL environment variable is not set')
    }
    _client = postgres(connectionString, {
      ssl: 'require',
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    })
  }
  return _client
}

// sql is a tagged-template proxy that lazily initialises the client.
// It also supports the legacy sql(queryString, params[]) call style so that
// routes written before the postgres migration keep working without changes.
export const sql: ReturnType<typeof postgres> = new Proxy(
  (function placeholder() {}) as unknown as ReturnType<typeof postgres>,
  {
    apply(_t, _this, args) {
      const client = getDb()

      // Detect legacy call style: sql("SELECT ...", [p1, p2, ...])
      // A tagged-template call receives an array-like object with a `raw` property as first arg.
      const firstArg = args[0]
      const isTaggedTemplate =
        firstArg != null &&
        typeof firstArg === 'object' &&
        ('raw' in firstArg || Array.isArray(firstArg))

      if (!isTaggedTemplate && typeof firstArg === 'string') {
        // Legacy style: convert positional $1..$N placeholders to a tagged template
        const query: string = firstArg
        const params: unknown[] = Array.isArray(args[1]) ? args[1] : args.slice(1)

        // Build a fake TemplateStringsArray by splitting on each $N placeholder
        const parts = query.split(/\$\d+/)
        const raw = parts as unknown as TemplateStringsArray
        ;(raw as unknown as { raw: string[] }).raw = parts

        return (client as unknown as (...a: unknown[]) => unknown)(raw, ...params)
      }

      return (client as unknown as (...a: unknown[]) => unknown)(...args)
    },
    get(_t, prop) {
      const client = getDb()
      const val = (client as Record<string | symbol, unknown>)[prop]
      return typeof val === 'function' ? (val as Function).bind(client) : val
    },
  }
)

// Helper to generate UUIDs
export function generateId(): string {
  return crypto.randomUUID()
}
