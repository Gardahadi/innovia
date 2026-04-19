import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    const supabase = createServerClient();

    // Upload PDF to Supabase Storage bucket 'decks'
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("decks")
      .upload(fileName, arrayBuffer, { contentType: "application/pdf" });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("decks")
      .getPublicUrl(fileName);

    const pdf_url = urlData.publicUrl;

    // Insert new deal row
    const { data: deal, error: insertError } = await supabase
      .from("deals")
      .insert({
        company: file.name.replace(/\.pdf$/i, ""),
        pdf_url,
        status: "in_review",
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Trigger analysis pipeline in the background — do not await
    const origin = request.nextUrl.origin;
    fetch(`${origin}/api/analyze/${deal.id}`, { method: "POST" }).catch(
      () => {
        // Fire-and-forget: errors are handled within the analyze route
      }
    );

    return Response.json(deal, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
