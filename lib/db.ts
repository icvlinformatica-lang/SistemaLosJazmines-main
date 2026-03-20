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

// sql is a tagged-template proxy that lazily initialises the client
export const sql: ReturnType<typeof postgres> = new Proxy(
  (function placeholder() {}) as unknown as ReturnType<typeof postgres>,
  {
    apply(_t, _this, args) {
      const client = getDb()
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
