import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { callClaude } from "@/lib/claude";
import { INNOVIA_SYSTEM_PROMPT, generateScore } from "@/lib/prompts";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("scores")
      .select("*, score_dimensions (*)")
      .eq("deal_id", dealId)
      .maybeSingle();

    if (error) throw error;

    // Return null if no score has been generated yet
    return Response.json(data ?? null);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const { dealId } = await params;
  const supabase = createServerClient();

  try {
    // Fetch all observations including investor annotations
    const { data: observations, error: obsError } = await supabase
      .from("observations")
      .select("*")
      .eq("deal_id", dealId)
      .order("sort_order", { ascending: true });

    if (obsError) throw obsError;

    // Build context string from observations + investor feedback
    const observationContext = (observations ?? [])
      .map((obs) => {
        let entry = `[${obs.type} / ${obs.component}] ${obs.text}`;
        if (obs.investor_rating != null) {
          entry += `\n  Investor rating: ${obs.investor_rating}/5`;
        }
        if (obs.investor_reply) {
          entry += `\n  Investor note: ${obs.investor_reply}`;
        }
        return entry;
      })
      .join("\n\n");

    // Call internal scoring module
    const origin = request.nextUrl.origin;
    const scoringResponse = await fetch(`${origin}/api/scoring-module`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deal_id: dealId, observations }),
    });

    const scoringSignal = scoringResponse.ok
      ? await scoringResponse.json()
      : null;

    const scoringContext = scoringSignal
      ? `\n\nInternal scoring signals:\n${JSON.stringify(scoringSignal, null, 2)}`
      : "";

    // Generate score with Claude
    const scorePrompt = generateScore(observationContext + scoringContext);
    const scoreRaw = await callClaude(
      [{ role: "user", content: scorePrompt }],
      { system: INNOVIA_SYSTEM_PROMPT }
    );

    let parsed: {
      scores: { dimension: string; value: number; rationale: string }[];
      overall_score: number;
      summary: string;
    };

    try {
      parsed = JSON.parse(scoreRaw);
    } catch {
      throw new Error("Failed to parse score response from Claude");
    }

    const overallScore = Math.round(parsed.overall_score);

    // Derive a simple verdict label from the score
    let verdict: string;
    if (overallScore >= 8) verdict = "Strong Pass";
    else if (overallScore >= 6) verdict = "Pass";
    else if (overallScore >= 4) verdict = "Conditional";
    else verdict = "Pass";

    // Insert into scores table
    const { data: scoreRow, error: scoreInsertError } = await supabase
      .from("scores")
      .insert({
        deal_id: dealId,
        overall_score: overallScore,
        verdict,
        summary: parsed.summary,
      })
      .select()
      .single();

    if (scoreInsertError) throw scoreInsertError;

    // Insert score_dimensions
    const dimensionInserts = parsed.scores.map((s) => ({
      score_id: scoreRow.id,
      name: s.dimension,
      ai_score: s.value,
      rationale: s.rationale,
    }));

    const { data: dimensions, error: dimInsertError } = await supabase
      .from("score_dimensions")
      .insert(dimensionInserts)
      .select();

    if (dimInsertError) throw dimInsertError;

    // Update deal status
    await supabase
      .from("deals")
      .update({ status: "score_generated" })
      .eq("id", dealId);

    return Response.json({ ...scoreRow, score_dimensions: dimensions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
