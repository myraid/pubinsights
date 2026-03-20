import openai from './openai-client';
import fs from 'fs';
import path from 'path';

const INSIGHTS_MODEL     = 'gpt-4o';
const INSIGHTS_MODEL_B   = 'gpt-4o-mini';

export interface InsightsResult {
  rating: number;
  insights: string[];
  pros: string[];
  cons: string[];
  verdict: 'Explore' | 'Proceed with Caution' | 'Avoid';
  verdict_reason: string;
  keyword_suggestions: string[];
  title_suggestion?: string;
  subtitle_suggestion?: string;
  _variant?: 'A' | 'B';      // which prompt variant was used
  _tokens?: number;           // total tokens consumed
}

// ─── Prompt Variants ──────────────────────────────────────────────────────────

/** Variant A — verbose, gpt-4o, deep analysis (current behaviour) */
const SYSTEM_PROMPT_A = `You are a senior book market analyst and publishing strategist. Given a keyword, detailed book data (including BSR, descriptions, reviews, rating distributions, and publisher info), and Google/YouTube search trend data, produce a thorough market opportunity analysis.

You will receive:
- A keyword/niche
- Data on top competing books including: title, price, rating, review count, BSR, publisher, manufacturer (often the author name for indie books), is_indie flag, categories, description, AI review summary, star distribution, and top reader reviews
- Google Web Search and YouTube Search trend timelines (0–100 interest scale, past 6 months)

Analysis methodology — go deep on each of these:

BOOK BSR ANALYSIS:
- BSR (Best Seller Rank) is the strongest demand signal. Lower = higher sales. Multiple books with BSR under 50,000 means real demand exists.
- Calculate estimated monthly sales from BSR. A niche where the top 5 books average under 20,000 BSR is lucrative.
- Look at BSR spread: if only 1–2 books have strong BSR, the niche may be dominated. If 5+ do, demand is broad.

INDIE AUTHOR WEIGHTING:
- Books marked is_indie: true are published by independent authors, not traditional publishers.
- If indie authors hold top BSR positions in this niche, that is a STRONG signal: the niche is accessible, profitable without gatekeepers, and you can compete without a traditional publisher.
- If traditional publishers dominate and indie authors are absent or ranked low, the niche is harder to enter.
- Note the indie/traditional split explicitly.

REVIEW DEEP DIVE:
- Mine the top_reviews for unmet needs, recurring complaints, and what readers praise.
- Low-rated reviews reveal content gaps a new book could fill.
- Review velocity (reviews_count relative to BSR) shows whether interest is sustained or fading.
- High review counts with a mix of 1–3 star reviews signals a frustrated audience and an opportunity.

TREND ANALYSIS:
- Rising trend = growing demand; declining = fading interest; flat = stable niche.
- Compare web search vs YouTube: high YouTube relative to web search means visual/video-first audience who may prefer video over books — risk factor.
- Trend spikes suggest seasonal demand, not sustained interest.

TITLE & SUBTITLE SUGGESTIONS:
- Only suggest a title and subtitle if the niche data strongly supports a compelling, differentiated angle.
- The title should be keyword-rich, benefit-focused, and stand out from existing titles.
- The subtitle should elaborate on the audience and transformation promise.
- If there is no clearly differentiated angle, omit title_suggestion and subtitle_suggestion entirely.

KEYWORD SUGGESTIONS:
- Suggest 4–6 refined keyword variations that would help narrow or expand this niche.
- Think: sub-niches, audience-specific angles, problem-specific framings, adjacent topics.
- These should be actionable search keywords a publisher would actually use.

Return a JSON object with EXACTLY these fields:
{
  "rating": <0–10 float — overall market opportunity score. Weight: BSR demand (30%), trend momentum (20%), indie accessibility (20%), review sentiment gap (15%), pricing headroom (15%)>,
  "insights": <array of exactly 4–5 crisp one-sentence insights. No book titles. Focus on niche-level patterns: BSR trends, indie presence, review gaps, pricing, trend momentum.>,
  "pros": <array of exactly 3–5 specific opportunities. No book titles. Include: BSR evidence, indie success signals, content gaps from reviews, trend support, pricing headroom.>,
  "cons": <array of exactly 3–5 specific risks. No book titles. Include: market saturation signals, declining trends, high competition density, challenging review expectations.>,
  "verdict": <one of exactly: "Explore", "Proceed with Caution", or "Avoid">,
  "verdict_reason": <one crisp sentence explaining the verdict — the single most important factor>,
  "keyword_suggestions": <array of 4–6 keyword strings to explore related niches>,
  "title_suggestion": <optional — only include if a compelling differentiated title is warranted>,
  "subtitle_suggestion": <optional — only include alongside title_suggestion>
}

CRITICAL RULES:
- Never mention specific book titles in insights, pros, cons, verdict_reason, or keyword_suggestions.
- Every insight and pro/con must be actionable and evidence-based from the data provided.
- Be direct and opinionated. Vague observations are useless to a publisher making a real investment decision.`;

/** Variant B — lean, gpt-4o-mini, signal-focused */
const SYSTEM_PROMPT_B = `You are a book market analyst. Analyze the given keyword, book BSR/review data, and search trends. Return a JSON market opportunity report.

Key signals to weigh:
- BSR (lower = more sales). Top 5 avg BSR under 20k = strong demand.
- Indie authors in top positions = accessible niche (no publisher required).
- Review gaps (low-star complaints) = content opportunities.
- Trend direction: rising/flat/falling.

JSON output — use EXACTLY these fields:
{
  "rating": <0–10 float. Weights: BSR demand 30%, trends 20%, indie access 20%, review gaps 15%, pricing 15%>,
  "insights": <4–5 one-sentence niche-level findings. No book titles.>,
  "pros": <3–5 specific opportunities. Evidence-based. No book titles.>,
  "cons": <3–5 specific risks. No book titles.>,
  "verdict": <"Explore" | "Proceed with Caution" | "Avoid">,
  "verdict_reason": <one sentence — single most important factor>,
  "keyword_suggestions": <4–6 related search keywords>,
  "title_suggestion": <optional — only if a strong differentiated angle exists>,
  "subtitle_suggestion": <optional — only with title_suggestion>
}

Be direct and data-driven. No vague observations.`;

// ─── Book data compressor ─────────────────────────────────────────────────────

type BookRecord = Record<string, unknown>;

/**
 * Strips heavy fields from book objects before sending to OpenAI.
 * Keeps only what the model actually needs for analysis.
 */
function compressBook(book: BookRecord): BookRecord {
  const desc = typeof book.description === 'string'
    ? book.description.slice(0, 250)
    : undefined;

  // Keep top 3 reviews, each truncated to 150 chars
  const reviews = Array.isArray(book.top_reviews)
    ? (book.top_reviews as BookRecord[]).slice(0, 3).map(r => ({
        rating: r.rating,
        text: typeof r.text === 'string' ? r.text.slice(0, 150) : r.text,
      }))
    : undefined;

  return {
    title:          book.title,
    price:          book.price,
    bsr:            book.bsr,
    rating:         book.rating,
    reviews_count:  book.reviews_count,
    publisher:      book.publisher,
    manufacturer:   book.manufacturer,
    is_indie:       book.is_indie,
    categories:     book.categories,
    description:    desc,
    top_reviews:    reviews,
    star_ratings:   book.star_ratings,
  };
}

// ─── Logger ───────────────────────────────────────────────────────────────────

function writeLog(variant: 'A' | 'B', keyword: string, payload: object): void {
  try {
    const logsDir = path.join(process.cwd(), 'logs', 'openai');
    fs.mkdirSync(logsDir, { recursive: true });

    const ts   = new Date().toISOString().replace(/[:.]/g, '-');
    const safe = keyword.replace(/[^a-z0-9]/gi, '_').slice(0, 40);
    const file = path.join(logsDir, `${ts}_${safe}_variant-${variant}.json`);

    fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf-8');
    console.log(`[insights-agent] logged → logs/openai/${path.basename(file)}`);
  } catch (e) {
    console.warn('[insights-agent] log write failed (non-blocking):', e);
  }
}

// ─── Trend formatter (shared) ─────────────────────────────────────────────────

function formatTrends(trendData: unknown): string {
  if (!trendData || typeof trendData !== 'object') return '';
  const td = trendData as {
    webSearch?: { timelineData?: { time: string; value: number[] }[] };
    youtube?:   { timelineData?: { time: string; value: number[] }[] };
  };
  const fmt = (pts: { time: string; value: number[] }[]) =>
    pts.map(p => {
      const d = new Date(parseInt(p.time) * 1000);
      return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${p.value[0]}`;
    }).join(', ');

  const parts: string[] = [];
  const web = td.webSearch?.timelineData ?? [];
  const yt  = td.youtube?.timelineData ?? [];
  if (web.length) parts.push(`Google Web (0–100, 6mo): ${fmt(web)}`);
  if (yt.length)  parts.push(`YouTube (0–100, 6mo): ${fmt(yt)}`);
  return parts.join('\n');
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateInsights(
  keyword: string,
  books?: BookRecord[],
  trendData?: unknown,
  variant?: 'A' | 'B',
): Promise<InsightsResult> {

  // Determine variant — accepts explicit override, env var, or random 50/50
  const resolvedVariant: 'A' | 'B' =
    variant ??
    (process.env.INSIGHTS_VARIANT as 'A' | 'B' | undefined) ??
    'B';

  const isVariantA  = resolvedVariant === 'A';
  const systemPrompt = isVariantA ? SYSTEM_PROMPT_A : SYSTEM_PROMPT_B;
  const model        = isVariantA ? INSIGHTS_MODEL : INSIGHTS_MODEL_B;

  // ── Build user message ────────────────────────────────────────────────────

  const bookSlice = (books ?? []).slice(0, 15).map(compressBook);
  const trendText = formatTrends(trendData);

  const userMessage = [
    `Keyword/Niche: "${keyword}"`,
    bookSlice.length > 0
      ? `\nTop competing books (${bookSlice.length}):\n${JSON.stringify(bookSlice, null, 2)}`
      : '',
    trendText ? `\nSearch Trends:\n${trendText}` : '',
  ].join('\n').trim();

  // ── Estimate tokens (rough: 1 token ≈ 4 chars) ──────────────────────────
  const estimatedInputTokens = Math.round(
    (systemPrompt.length + userMessage.length) / 4
  );

  // ── Log request ──────────────────────────────────────────────────────────
  const startMs = Date.now();
  writeLog(resolvedVariant, keyword, {
    variant:               resolvedVariant,
    model,
    keyword,
    estimated_input_tokens: estimatedInputTokens,
    system_prompt_chars:   systemPrompt.length,
    user_message_chars:    userMessage.length,
    books_sent:            bookSlice.length,
    system_prompt:         systemPrompt,
    user_message:          userMessage,
  });

  // ── Call OpenAI ───────────────────────────────────────────────────────────
  const response = await openai.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ],
    temperature: 0.7,
    max_tokens: isVariantA ? 1200 : 800,
  });

  const durationMs = Date.now() - startMs;
  const content    = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from OpenAI');

  const usage  = response.usage;
  const parsed = JSON.parse(content) as InsightsResult;

  // ── Log response ──────────────────────────────────────────────────────────
  writeLog(resolvedVariant, keyword, {
    variant:          resolvedVariant,
    model,
    keyword,
    duration_ms:      durationMs,
    usage: {
      prompt_tokens:     usage?.prompt_tokens,
      completion_tokens: usage?.completion_tokens,
      total_tokens:      usage?.total_tokens,
    },
    response: parsed,
  });

  console.log(
    `[insights-agent] variant=${resolvedVariant} model=${model}`,
    `tokens=${usage?.total_tokens} (${usage?.prompt_tokens}+${usage?.completion_tokens})`,
    `duration=${durationMs}ms`,
  );

  return {
    rating:              parsed.rating              ?? 0,
    insights:            parsed.insights            ?? [],
    pros:                parsed.pros                ?? [],
    cons:                parsed.cons                ?? [],
    verdict:             parsed.verdict             ?? 'Proceed with Caution',
    verdict_reason:      parsed.verdict_reason      ?? '',
    keyword_suggestions: parsed.keyword_suggestions ?? [],
    title_suggestion:    parsed.title_suggestion,
    subtitle_suggestion: parsed.subtitle_suggestion,
    _variant:            resolvedVariant,
    _tokens:             usage?.total_tokens,
  };
}
