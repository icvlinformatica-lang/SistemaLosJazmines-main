import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET single barra template
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from("barra_templates")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      console.error("[API] Error fetching barra_template:", error)
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    const template = {
      id: data.id,
      nombre: data.nombre,
      coctelesIncluidos: data.cocteles || [],
    }

    return NextResponse.json(template)
  } catch (err) {
    console.error("[API] Unexpected error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT update barra template
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    const { data, error } = await supabase
      .from("barra_templates")
      .update({
        nombre: body.nombre,
        descripcion: body.descripcion || null,
        cocteles: body.coctelesIncluidos || [],
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[API] Error updating barra_template:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const template = {
      id: data.id,
      nombre: data.nombre,
      coctelesIncluidos: data.cocteles || [],
    }

    return NextResponse.json(template)
  } catch (err) {
    console.error("[API] Unexpected error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE barra template
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { error } = await supabase
      .from("barra_templates")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("[API] Error deleting barra_template:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[API] Unexpected error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
