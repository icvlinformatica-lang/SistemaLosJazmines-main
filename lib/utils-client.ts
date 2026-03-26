// Pure client-safe utilities — no Node.js or server-only dependencies.

export function generateId(): string {
  return crypto.randomUUID()
}
