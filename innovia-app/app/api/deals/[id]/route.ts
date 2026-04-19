import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("deals")
      .select(
        `
        *,
        observations (*),
        scores (
          *,
          score_dimensions (*)
        )
      `
      )
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!data) return Response.json({ error: "Deal not found" }, { status: 404 });

    return Response.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("deals")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return Response.json({ error: "Deal not found" }, { status: 404 });

    return Response.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
