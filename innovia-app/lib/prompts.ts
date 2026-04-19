export const INNOVIA_SYSTEM_PROMPT = `\
You are Innovia, an expert investment analyst at Innovius Capital.

## Firm Thesis
Innovius Capital invests in Series A and Series B vertical SaaS companies with the following characteristics:

- **Revenue**: $4–12M ARR at entry, with strong net revenue retention (>110%) and low churn
- **Go-to-market**: Sales-led growth (SLG) preferred over product-led growth (PLG); we value deliberate, relationship-driven sales in complex enterprise verticals
- **Data authority**: Companies that own or aggregate proprietary datasets that create durable defensibility — becoming the system of record in their vertical
- **Fundamentals over hype**: We weight proven unit economics, customer concentration risk, and capital efficiency over narrative momentum or TAM storytelling
- **Market focus**: Niche, underserved verticals where legacy software is entrenched and modern SaaS has a structural advantage

## Your Role
Analyze pitch decks rigorously through this lens. Be direct, specific, and honest. Surface both genuine strengths and material risks. Avoid generic VC platitudes. Every claim should be grounded in evidence from the deck.
`;

// ---------------------------------------------------------------------------
// Prompt templates
// ---------------------------------------------------------------------------

/**
 * Classify each slide into a named section (e.g. "Team", "Market Size", "Product").
 * Input: array of raw text extracted from each slide.
 */
export function classifySlides(slidesText: string[]): string {
  const numbered = slidesText
    .map((text, i) => `Slide ${i + 1}:\n${text.trim()}`)
    .join("\n\n---\n\n");

  return `\
You are classifying the sections of a startup pitch deck.

For each slide below, output a JSON array where each element has:
- "index": the slide number (1-based)
- "label": a short section name (e.g. "Cover", "Problem", "Solution", "Product", "Market Size", "Business Model", "Traction", "Team", "Financials", "Ask", "Appendix", "Other")

Return ONLY the JSON array, no prose.

${numbered}`;
}

/**
 * Deep analysis of a named section of the deck.
 * Input: section label, concatenated text of the relevant slides.
 */
export function analyzeSection(label: string, content: string): string {
  return `\
Analyze the following "${label}" section from a Series A/B vertical SaaS pitch deck.

Identify:
1. Key claims or data points
2. Strengths relative to the Innovius thesis
3. Concerns or red flags relative to the Innovius thesis
4. Questions you would want answered in diligence

Be specific. Reference actual numbers and statements from the content. Do not pad with generic commentary.

---
${content}
---

Respond in JSON with this shape:
{
  "observations": [
    { "category": "strength" | "concern" | "question" | "neutral", "content": "..." }
  ]
}`;
}

/**
 * Generate a structured score across the Innovius scoring dimensions.
 * Input: full synthesized analysis text (concatenation of all section analyses).
 */
export function generateScore(fullAnalysis: string): string {
  return `\
Based on the analysis below, score this company across each dimension on a scale of 1–10.

Scoring dimensions:
- market_size: Size, growth rate, and addressability of the vertical
- revenue_quality: ARR, NRR, churn, customer concentration, contract structure
- go_to_market: Sales motion fit (SLG preference), CAC, sales cycle, channel strategy
- product_differentiation: Uniqueness, switching costs, workflow depth
- team: Domain expertise, execution track record, relevant operator experience
- financials: Burn rate, runway, path to profitability, unit economics
- competitive_moat: Data ownership, network effects, proprietary integrations

For each dimension provide:
- "value": integer 1–10
- "rationale": 1–2 sentences grounded in the deck evidence

Then provide:
- "overall_score": weighted average (use equal weights)
- "summary": 3–5 sentence investment thesis summary for this company

Respond in JSON with this shape:
{
  "scores": [
    { "dimension": "market_size", "value": 7, "rationale": "..." },
    ...
  ],
  "overall_score": 6.8,
  "summary": "..."
}

---
${fullAnalysis}
---`;
}
