import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET all barra templates
export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from("barra_templates")
      .select("*")
      .order("nombre", { ascending: true })

    if (error) {
      console.error("[API] Error fetching barra_templates:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform to app format
    const templates = data.map((template) => ({
      id: template.id,
      nombre: template.nombre,
      coctelesIncluidos: template.cocteles || [],
    }))

    return NextResponse.json(templates)
  } catch (err) {
    console.error("[API] Unexpected error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST create new barra template
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { data, error } = await supabase
      .from("barra_templates")
      .insert({
        nombre: body.nombre,
        descripcion: body.descripcion || null,
        cocteles: body.coctelesIncluidos || [],
      })
      .select()
      .single()

    if (error) {
      console.error("[API] Error creating barra_template:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const template = {
      id: data.id,
      nombre: data.nombre,
      coctelesIncluidos: data.cocteles || [],
    }

    return NextResponse.json(template, { status: 201 })
  } catch (err) {
    console.error("[API] Unexpected error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
