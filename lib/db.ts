import postgres from 'postgres'

// Use POSTGRES_URL for direct database connection
// This bypasses PostgREST and connects directly to PostgreSQL
const connectionString = process.env.POSTGRES_URL

if (!connectionString) {
  throw new Error('POSTGRES_URL environment variable is not set')
}

// Create a postgres client for server-side use
export const sql = postgres(connectionString, {
  ssl: 'require',
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
})

// Helper to generate UUIDs
export function generateId(): string {
  return crypto.randomUUID()
}
