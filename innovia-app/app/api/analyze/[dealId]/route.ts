import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { callClaude } from "@/lib/claude";
import { INNOVIA_SYSTEM_PROMPT, classifySlides, analyzeSection } from "@/lib/prompts";
import { extractTextFromPDF, convertPDFToImages } from "@/lib/pdf";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const { dealId } = await params;
  const supabase = createServerClient();

  try {
    // Mark deal as analyzing
    await supabase
      .from("deals")
      .update({ status: "analyzing" })
      .eq("id", dealId);

    // --- Step 1: Fetch PDF and extract content ---

    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select("pdf_url")
      .eq("id", dealId)
      .single();

    if (dealError || !deal?.pdf_url) {
      throw new Error("Deal or PDF URL not found");
    }

    const pdfResponse = await fetch(deal.pdf_url);
    if (!pdfResponse.ok) throw new Error("Failed to fetch PDF from storage");

    // Convert to Buffer — required by extractTextFromPDF and convertPDFToImages
    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

    const [slideTexts, slideImages] = await Promise.all([
      extractTextFromPDF(pdfBuffer),
      convertPDFToImages(pdfBuffer, dealId),
    ]);

    // Build a lookup: pageNumber → imageUrl
    const imageByPage = new Map(slideImages.map((s) => [s.pageNumber, s.imageUrl]));

    // Insert slide rows (one per page, 0-indexed in DB, 1-indexed from extractTextFromPDF)
    const slideInserts = slideTexts.map(({ pageNumber, text }) => ({
      deal_id: dealId,
      index: pageNumber - 1,
      text_content: text,
      image_path: imageByPage.get(pageNumber) ?? null,
      label: null,
    }));

    const { data: insertedSlides, error: slidesError } = await supabase
      .from("slides")
      .insert(slideInserts)
      .select();

    if (slidesError) throw slidesError;

    // --- Step 2: Classify slides ---

    // classifySlides expects plain strings, ordered by page
    const orderedTexts = slideTexts
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .map(({ text }) => text);

    const classifyPrompt = classifySlides(orderedTexts);
    const classifyRaw = await callClaude(
      [{ role: "user", content: classifyPrompt }],
      { system: INNOVIA_SYSTEM_PROMPT }
    );

    let classifications: { index: number; label: string }[] = [];
    try {
      classifications = JSON.parse(classifyRaw);
    } catch {
      throw new Error("Failed to parse slide classifications from Claude");
    }

    // Update each slide with its classified label (Claude returns 1-based index)
    await Promise.all(
      classifications.map(({ index, label }) =>
        supabase
          .from("slides")
          .update({ label })
          .eq("deal_id", dealId)
          .eq("index", index - 1)
      )
    );

    // --- Step 3: Group slides by label and analyze each section in parallel ---

    const groups = new Map<string, { text: string; slideIds: string[] }>();
    for (const slide of insertedSlides ?? []) {
      const classification = classifications.find((c) => c.index === slide.index + 1);
      const label = classification?.label ?? "Other";
      if (!groups.has(label)) {
        groups.set(label, { text: "", slideIds: [] });
      }
      const group = groups.get(label)!;
      group.text += `\n\n${slide.text_content ?? ""}`;
      group.slideIds.push(slide.id);
    }

    await Promise.all(
      Array.from(groups.entries()).map(async ([label, { text, slideIds }], groupIndex) => {
        const analyzePrompt = analyzeSection(label, text);
        const analyzeRaw = await callClaude(
          [{ role: "user", content: analyzePrompt }],
          { system: INNOVIA_SYSTEM_PROMPT }
        );

        let parsed: { observations: { category: string; content: string }[] };
        try {
          parsed = JSON.parse(analyzeRaw);
        } catch {
          throw new Error(`Failed to parse analysis for section "${label}"`);
        }

        const observationInserts = parsed.observations.map((obs, obsIndex) => ({
          deal_id: dealId,
          slide_ref: slideIds[0] ?? null,
          type: label,
          component: obs.category,
          text: obs.content,
          sort_order: groupIndex * 100 + obsIndex,
        }));

        if (observationInserts.length > 0) {
          const { error } = await supabase
            .from("observations")
            .insert(observationInserts);
          if (error) throw error;
        }
      })
    );

    // Mark deal as analysis complete
    await supabase
      .from("deals")
      .update({ status: "analysis_complete" })
      .eq("id", dealId);

    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Mark deal as error so the UI can surface it
    await supabase
      .from("deals")
      .update({ status: "error" })
      .eq("id", dealId);
    return Response.json({ error: message }, { status: 500 });
  }
}
