import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("deals")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return Response.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { company, sector, stage, pdf_url } = body;

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("deals")
      .insert({
        company,
        sector,
        stage,
        pdf_url,
        status: "in_review",
      })
      .select()
      .single();

    if (error) throw error;

    return Response.json(data, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
