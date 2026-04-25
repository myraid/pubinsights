import openai from './openai-client';
import fs from 'fs';
import path from 'path';

const INSIGHTS_MODEL     = 'gpt-4o';
const INSIGHTS_MODEL_B   = 'gpt-4o-mini';

export interface InsightsResult {
  rating: number;
  insights: string[];
  content_gaps: string[];
  verdict: 'Explore' | 'Proceed with Caution' | 'Avoid';
  verdict_reason: string;
  keyword_suggestions: string[];
  title_suggestion?: string;
  subtitle_suggestion?: string;
  cover_quality_score?: number;
  cover_quality_summary?: string;
  _variant?: 'A' | 'B';
  _tokens?: number;
  _cover_tokens?: number;
  _total_tokens?: number;
  _model?: string;
  _duration_ms?: number;
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

RATING SCALE — be generous and accurate, not conservative:
- 8–10: Strong demand (avg BSR < 30k), rising or stable trends, indie authors succeeding, clear content gaps. These opportunities are real — score them highly.
- 6–7: Solid demand with moderate competition or some trend softness. Still a good opportunity worth pursuing.
- 4–5: Mixed signals — either weak demand, heavily dominated by big publishers, or declining trends.
- 0–3: Reserve for genuinely saturated or dying niches with no entry point.
Most niches with active buyers and any indie presence deserve a 6 or higher. Do not default to the middle of the scale out of caution.

VERDICT THRESHOLDS — follow these strictly:
- "Explore": rating ≥ 6.5 OR strong indie presence with decent BSR OR clear content gap with growing trends. This is the default for any niche with real buyers.
- "Proceed with Caution": rating 4–6.4 AND specific, concrete risk (e.g. top 3 books all from Big 5 publishers with no indie presence, or clearly declining trend).
- "Avoid": rating < 4 OR niche is demonstrably saturated with zero differentiation opportunity AND declining trends. Reserve this for genuinely bad bets.
The goal is to give authors actionable, encouraging guidance. If the data shows buyers exist, say "Explore".

COVER QUALITY CONTEXT:
- Cover quality data will be included in the user message if available.
- Factor the average cover quality score into your rating and insights. A niche with low-quality covers (score < 6) is a visual differentiation opportunity — a new book with great design can stand out immediately.
- Mention cover quality in insights if it's a meaningful signal.

CONTENT GAP ANALYSIS:
- Mine the top_reviews carefully for what readers wish the books covered but don't.
- Look for: recurring complaints, feature requests, missing perspectives, underserved audiences.
- Each content_gap should be a specific, actionable angle a new author can own — not generic ("needs more depth") but targeted ("no book covers this topic for complete beginners with zero prior knowledge").

Return a JSON object with EXACTLY these fields:
{
  "rating": <0–10 float — overall market opportunity score. Weight: BSR demand (30%), trend momentum (20%), indie accessibility (20%), cover quality gap (15%), pricing headroom (15%)>,
  "insights": <array of exactly 4–5 insights. Each insight must be 10 words or fewer — a tight, punchy fact. No book titles. Cover quality, BSR trends, indie presence, review gaps, trend momentum.>,
  "content_gaps": <array of exactly 3–5 specific content gaps from review analysis. Each is a concrete angle or topic that readers want but existing books don't deliver. No book titles. Specific and actionable.>,
  "verdict": <one of exactly: "Explore", "Proceed with Caution", or "Avoid">,
  "verdict_reason": <one crisp, encouraging sentence explaining the verdict — focus on the biggest opportunity or the single most important factor>,
  "keyword_suggestions": <array of 4–6 keyword strings to explore related niches>,
  "title_suggestion": <optional — only include if a compelling differentiated title is warranted>,
  "subtitle_suggestion": <optional — only include alongside title_suggestion>
}

CRITICAL RULES:
- Never mention specific book titles in insights, content_gaps, verdict_reason, or keyword_suggestions.
- Every insight and content_gap must be actionable and evidence-based from the data provided.
- Be balanced and constructive. Authors need encouragement and honest guidance — not excessive caution.
- Insights must be punchy and scannable — 10 words max each. Cut filler words ruthlessly.
- content_gaps should be specific and actionable — what a new author can actually write about.
- If the data shows real buyers and any opening for a new book, default toward "Explore".`;

/** Variant B — lean, gpt-4o-mini, signal-focused */
const SYSTEM_PROMPT_B = `You are a book market analyst. Analyze the given keyword, book BSR/review data, and search trends. Return a JSON market opportunity report.

Key signals to weigh:
- BSR (lower = more sales). Top 5 avg BSR under 20k = strong demand.
- Indie authors in top positions = accessible niche (no publisher required).
- Review gaps (low-star complaints) = content opportunities.
- Trend direction: rising/flat/falling.

RATING SCALE — be generous and accurate, not conservative:
- 8–10: Strong demand (avg BSR < 30k), rising/stable trends, indie presence, content gaps. Score these opportunities highly.
- 6–7: Solid demand with some competition or slight trend softness. Still a worthy opportunity.
- 4–5: Mixed signals — weak demand or declining trends or big-publisher lock-in.
- 0–3: Reserve for genuinely dead or saturated niches only.
Most niches with active buyers deserve 6+. Do not default to the middle of the scale.

VERDICT THRESHOLDS — follow these strictly:
- "Explore": rating ≥ 6.5 OR any niche with real buyers and an opening. Default toward this.
- "Proceed with Caution": rating 4–6.4 AND a specific concrete risk (e.g. Big 5 domination, declining trend).
- "Avoid": rating < 4 AND demonstrably saturated with zero differentiation opportunity.
If buyers exist and there's any opening, say "Explore".

Cover quality context (if provided): Factor the avg cover score into the rating. Low cover quality (< 6) = visual differentiation opportunity.
Content gap analysis: Mine top_reviews for what readers want but don't get — specific topics, missing perspectives, underserved audiences. Make each content_gap concrete and actionable.

JSON output — use EXACTLY these fields:
{
  "rating": <0–10 float. Weights: BSR demand 30%, trends 20%, indie access 20%, cover quality gap 15%, pricing 15%>,
  "insights": <4–5 niche-level findings. Max 10 words each — punchy and scannable. No book titles. Include cover quality if notable.>,
  "content_gaps": <3–5 specific content gaps from reviews — what readers want but don't have. Concrete and actionable. No book titles.>,
  "verdict": <"Explore" | "Proceed with Caution" | "Avoid">,
  "verdict_reason": <one encouraging sentence — focus on the biggest opportunity or most important factor>,
  "keyword_suggestions": <4–6 related search keywords>,
  "title_suggestion": <optional — only if a strong differentiated angle exists>,
  "subtitle_suggestion": <optional — only with title_suggestion>
}

Be encouraging and constructive — lead with opportunities. Be direct and data-driven. Authors need honest guidance that motivates action, not excessive caution. Insights must be 10 words max.`;

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

  // Keep top 3 reviews, truncated to 150 chars — field is `content` not `text`
  const reviews = Array.isArray(book.top_reviews)
    ? (book.top_reviews as BookRecord[]).slice(0, 3).map(r => ({
        rating: r.rating,
        text: typeof r.content === 'string'
          ? r.content.slice(0, 150)
          : (typeof r.text === 'string' ? r.text.slice(0, 150) : undefined),
      }))
    : undefined;

  return {
    title:                    book.title,
    price:                    book.price,
    bsr:                      book.bsr,
    rating:                   book.rating,
    reviews_count:            book.reviews_count,
    publisher:                book.publisher,
    manufacturer:             book.manufacturer,
    is_indie:                 book.is_indie,
    categories:               book.categories,
    description:              desc,
    top_reviews:              reviews,
    rating_stars_distribution: book.rating_stars_distribution,
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

// ─── Cover quality analysis ───────────────────────────────────────────────────

interface CoverAnalysis {
  score: number;
  summary: string;
  opportunity: string;
  tokens?: number;
}

async function analyzeCovers(books: BookRecord[]): Promise<CoverAnalysis | null> {
  // Prioritise indie author covers — that's the audience we're analysing for.
  // Falls back to any book with an image if there aren't enough indie covers.
  const hasImage = (b: BookRecord) => typeof b.image_url === 'string' && b.image_url;
  const indieCovers = books.filter(b => b.is_indie === true && hasImage(b));
  const otherCovers = books.filter(b => b.is_indie !== true && hasImage(b));

  // Take up to 10 covers: indie first, pad with traditional if needed
  const selected = [...indieCovers, ...otherCovers].slice(0, 10);
  const indieCount = Math.min(indieCovers.length, 10);

  if (selected.length === 0) return null;

  try {
    const imageContent = selected.map(b => ({
      type: 'image_url' as const,
      image_url: { url: b.image_url as string, detail: 'low' as const },
    }));

    const contextNote = indieCount > 0
      ? `The first ${indieCount} cover(s) are from indie/self-published authors; the rest (if any) are from traditional publishers. Focus your analysis and scoring on the indie covers — these represent the competitive landscape for new indie authors entering this niche.`
      : 'Analyse all covers as a benchmark for the niche.';

    const res = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyze these ${selected.length} Amazon book covers from the same niche. ${contextNote} Rate each cover 1–10 on: professionalism, visual appeal, genre clarity, and typography. Return JSON with exactly: avg_score (number 1–10, averaged across indie covers only if present), summary (1 sentence on the overall design quality of indie covers in this niche), opportunity (1 sentence on the single biggest visual gap a new indie book could exploit to instantly stand out).`,
          },
          ...imageContent,
        ],
      }],
      response_format: { type: 'json_object' },
      max_tokens: 250,
      temperature: 0.2,
    });

    const parsed = JSON.parse(res.choices[0]?.message?.content ?? '{}');
    const coverTokens = res.usage?.total_tokens;
    console.log(`[insights-agent] cover analysis tokens=${coverTokens}`);
    return {
      score:       parsed.avg_score   ?? 0,
      summary:     parsed.summary     ?? '',
      opportunity: parsed.opportunity ?? '',
      tokens:      coverTokens,
    };
  } catch (e) {
    console.warn('[insights-agent] cover analysis failed (non-blocking):', e);
    return null;
  }
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

  // ── Cover quality analysis (parallel — non-blocking) ─────────────────────

  const coverAnalysis = await analyzeCovers(books ?? []);

  // ── Build user message ────────────────────────────────────────────────────

  const bookSlice = (books ?? []).slice(0, 15).map(compressBook);
  const trendText = formatTrends(trendData);

  const indieCoverCount = (books ?? []).filter(b => b.is_indie === true && b.image_url).length;
  const totalCoverCount = (books ?? []).filter(b => b.image_url).length;
  const coverText = coverAnalysis
    ? `\nIndie Cover Quality Analysis (${indieCoverCount} indie + ${totalCoverCount - indieCoverCount} traditional covers reviewed, up to 10 total): avg indie score ${coverAnalysis.score.toFixed(1)}/10. ${coverAnalysis.summary} Design opportunity for new indie authors: ${coverAnalysis.opportunity}`
    : '';

  const userMessage = [
    `Keyword/Niche: "${keyword}"`,
    bookSlice.length > 0
      ? `\nTop competing books (${bookSlice.length}):\n${JSON.stringify(bookSlice, null, 2)}`
      : '',
    trendText  ? `\nSearch Trends:\n${trendText}`   : '',
    coverText  ? `\n${coverText}`                   : '',
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

  // Programmatic verdict correction — prevent the model from being overly conservative.
  // If the rating says the niche is good, the verdict must reflect that.
  const rating = parsed.rating ?? 0;
  if (rating >= 6.5 && parsed.verdict !== 'Explore') {
    parsed.verdict = 'Explore';
  } else if (rating < 4 && parsed.verdict === 'Explore') {
    parsed.verdict = 'Proceed with Caution';
  }

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

  const insightTokens = usage?.total_tokens ?? 0;
  const coverTokens   = coverAnalysis?.tokens ?? 0;

  return {
    rating:                parsed.rating              ?? 0,
    insights:              parsed.insights            ?? [],
    content_gaps:          parsed.content_gaps        ?? [],
    verdict:               parsed.verdict             ?? 'Proceed with Caution',
    verdict_reason:        parsed.verdict_reason      ?? '',
    keyword_suggestions:   parsed.keyword_suggestions ?? [],
    title_suggestion:      parsed.title_suggestion,
    subtitle_suggestion:   parsed.subtitle_suggestion,
    cover_quality_score:   coverAnalysis?.score,
    cover_quality_summary: coverAnalysis
      ? `${coverAnalysis.summary} ${coverAnalysis.opportunity}`.trim()
      : undefined,
    _variant:              resolvedVariant,
    _tokens:               insightTokens,
    _cover_tokens:         coverTokens,
    _total_tokens:         insightTokens + coverTokens,
    _model:                model,
    _duration_ms:          durationMs,
  };
}
