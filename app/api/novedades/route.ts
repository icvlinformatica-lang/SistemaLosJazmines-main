export const dynamic = 'force-dynamic'
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const data = await sql`
      SELECT * FROM novedades
      WHERE activa = true
      ORDER BY orden ASC, created_at DESC
    `
    return NextResponse.json(data)
  } catch (error) {
    console.error("[API] Error fetching novedades:", error)
    return NextResponse.json({ error: "Error fetching novedades" }, { status: 500 })
  }
}
