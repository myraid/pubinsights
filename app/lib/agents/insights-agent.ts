import openai from './openai-client';

const INSIGHTS_MODEL = 'gpt-4o';

export interface InsightsResult {
  rating: number;
  insights: string[];
  pros: string[];
  cons: string[];
  title_suggestion: string;
}

const SYSTEM_PROMPT = `You are a senior book market analyst and publishing strategist. Given a keyword, detailed book data (including descriptions, reader reviews, ratings distributions, and categories), and Google/YouTube search trend data, produce a thorough market opportunity analysis.

You will receive:
- A keyword/niche
- Data on top competing books including: title, price, rating, review count, BSR, publisher, categories, description, AI review summary, star distribution, and top reader reviews
- Google Web Search and YouTube Search trend timelines (0-100 interest scale, past 6 months)

When analyzing, go deep:
- Mine the reader reviews for recurring complaints, unmet needs, and praise patterns
- Use descriptions to understand positioning and content gaps in the niche
- Factor in trend momentum — rising trends signal growing demand, declining trends signal risk
- Compare web search vs YouTube interest for content format opportunities
- Analyze pricing distribution and identify the sweet spot
- Note which publishers dominate (traditional vs indie) and what that signals
- Look at rating distributions — are readers generally satisfied or frustrated?

Return a JSON object with exactly these fields:
- "rating": a number from 0 to 10 indicating the overall market opportunity (10 = excellent). Weight demand signals (BSR, review velocity, trend direction) against competition density and quality.
- "insights": an array of exactly 3-5 crisp, high-signal market insights. Each should be one concise sentence that reveals a non-obvious pattern or actionable finding. Synthesize across all books — do NOT mention specific book titles. Focus on niche-level patterns: pricing sweet spots, content gaps from reviews, demand trends, audience behavior, and competitive density.
- "pros": an array of 3-5 market opportunity/advantage strings. Describe underserved angles, pricing gaps, review-identified content gaps, and trend-based timing advantages. Do NOT name specific books.
- "cons": an array of 3-5 market risk/challenge strings. Cover competitive saturation, declining trends, high reader expectations, and barriers to entry. Do NOT name specific books.
- "title_suggestion": a single keyword-optimized, compelling book title suggestion for this niche.

IMPORTANT: Never mention specific book titles in insights, pros, or cons. Speak about the niche, the market, and the patterns — not individual products. Be crisp and actionable — every point should deliver a clear takeaway in one sentence.`;

export async function generateInsights(
  keyword: string,
  books?: Record<string, unknown>[],
  trendData?: unknown
): Promise<InsightsResult> {
  const userParts: string[] = [`Keyword/Niche: "${keyword}"`];

  if (books && books.length > 0) {
    userParts.push(
      `\nTop competing books (${books.length} total):\n${JSON.stringify(books.slice(0, 15), null, 2)}`
    );
  }

  if (trendData && typeof trendData === 'object') {
    const td = trendData as { webSearch?: { timelineData?: { time: string; value: number[] }[] }; youtube?: { timelineData?: { time: string; value: number[] }[] } };
    const formatTimeline = (points: { time: string; value: number[] }[]) =>
      points.map(p => {
        const d = new Date(parseInt(p.time) * 1000);
        return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${p.value[0]}`;
      }).join(', ');

    const webPoints = td.webSearch?.timelineData ?? [];
    const ytPoints = td.youtube?.timelineData ?? [];
    const trendSummary: string[] = [];
    if (webPoints.length > 0) {
      trendSummary.push(`Google Web Search interest (0-100 scale, past 6 months): ${formatTimeline(webPoints)}`);
    }
    if (ytPoints.length > 0) {
      trendSummary.push(`YouTube Search interest (0-100 scale, past 6 months): ${formatTimeline(ytPoints)}`);
    }
    if (trendSummary.length > 0) {
      userParts.push(`\nSearch Trends:\n${trendSummary.join('\n')}`);
    }
  }

  const response = await openai.chat.completions.create({
    model: INSIGHTS_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userParts.join('\n') },
    ],
    temperature: 0.7,
    max_tokens: 3000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  const parsed = JSON.parse(content) as InsightsResult;

  return {
    rating: parsed.rating ?? 0,
    insights: parsed.insights ?? [],
    pros: parsed.pros ?? [],
    cons: parsed.cons ?? [],
    title_suggestion: parsed.title_suggestion ?? '',
  };
}
