import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase";

/**
 * GET /api/observations/[id]
 * Treats [id] as a deal ID. Returns all observations for that deal ordered by sort_order.
 *
 * PATCH /api/observations/[id]
 * Treats [id] as an observation ID. Auto-save endpoint for investor_rating and/or
 * investor_reply fields. Returns the updated observation.
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("observations")
      .select("*")
      .eq("deal_id", id)
      .order("sort_order", { ascending: true });

    if (error) throw error;

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

    // Only allow updating these two fields
    const { investor_rating, investor_reply } = body;
    const update: Record<string, unknown> = {};
    if (investor_rating !== undefined) update.investor_rating = investor_rating;
    if (investor_reply !== undefined) update.investor_reply = investor_reply;

    if (Object.keys(update).length === 0) {
      return Response.json(
        { error: "No updatable fields provided" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("observations")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return Response.json({ error: "Observation not found" }, { status: 404 });
    }

    return Response.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
