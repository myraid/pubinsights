import openai, { MODEL } from './openai-client';
import fs from 'fs';
import path from 'path';

const SYSTEM_PROMPT = `You are a book outline architect. Given a book title, create a detailed chapter-by-chapter outline.

Return a JSON object with exactly this structure:
{
  "Title": "<the book title>",
  "Chapters": [
    {
      "Chapter": 1,
      "Title": "<chapter title>",
      "Summary": "<2-3 sentence chapter summary>",
      "KeyTopics": ["topic1", "topic2", "topic3"],
      "Subsections": [
        { "title": "<subsection title>", "description": "<1 sentence description>" },
        { "title": "<subsection title>", "description": "<1 sentence description>" },
        { "title": "<subsection title>", "description": "<1 sentence description>" }
      ]
    }
  ]
}

Create 8-12 chapters. Each chapter must have exactly 3 Subsections that break the chapter into logical parts. Include "Summary" and "KeyTopics" for each chapter to make the outline actionable.`;

// ─── Logger ───────────────────────────────────────────────────────────────────

function writeLog(title: string, payload: object): void {
  try {
    const logsDir = path.join(process.cwd(), 'logs', 'openai');
    fs.mkdirSync(logsDir, { recursive: true });

    const ts   = new Date().toISOString().replace(/[:.]/g, '-');
    const safe = title.replace(/[^a-z0-9]/gi, '_').slice(0, 40);
    const file = path.join(logsDir, `${ts}_outline_${safe}.json`);

    fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf-8');
    console.log(`[outline-agent] logged → logs/openai/${path.basename(file)}`);
  } catch (e) {
    console.warn('[outline-agent] log write failed (non-blocking):', e);
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateOutline(title: string, ageGroup?: string, context?: string, regeneratePrompt?: string): Promise<string> {
  const audienceClause = ageGroup ? ` The target audience is ${ageGroup}.` : ""
  const contextClause = context ? ` Additional context: ${context}` : ""
  const regenClause = regeneratePrompt ? ` The user wants the outline regenerated with this guidance: ${regeneratePrompt}` : ""
  const userMessage = `Create a detailed book outline for: "${title}".${audienceClause}${contextClause}${regenClause}`;
  const estimatedInputTokens = Math.round((SYSTEM_PROMPT.length + userMessage.length) / 4);

  // Log request
  writeLog(title, {
    type:                   'request',
    model:                  MODEL,
    title,
    estimated_input_tokens: estimatedInputTokens,
    system_prompt:          SYSTEM_PROMPT,
    user_message:           userMessage,
  });

  const startMs = Date.now();

  const response = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userMessage   },
    ],
    temperature: 0.7,
  });

  const durationMs = Date.now() - startMs;
  const content    = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from OpenAI');

  const usage = response.usage;

  // Log response
  writeLog(title, {
    type:        'response',
    model:       MODEL,
    title,
    duration_ms: durationMs,
    usage: {
      prompt_tokens:     usage?.prompt_tokens,
      completion_tokens: usage?.completion_tokens,
      total_tokens:      usage?.total_tokens,
    },
    response: JSON.parse(content),
  });

  console.log(
    `[outline-agent] model=${MODEL}`,
    `tokens=${usage?.total_tokens} (${usage?.prompt_tokens}+${usage?.completion_tokens})`,
    `duration=${durationMs}ms`,
  );

  return content;
}

// ─── Validate outline ────────────────────────────────────────────────────────

const VALIDATE_SYSTEM_PROMPT = `You are a book outline reviewer. Given a book outline (title + chapters), review it for structural quality and coherence.

Return a JSON object with exactly this structure:
{
  "valid": true/false,
  "score": <1-10 quality score>,
  "feedback": "<1-2 sentence overall assessment>",
  "issues": [
    {
      "chapter": <chapter number or null for book-level>,
      "type": "gap" | "overlap" | "flow" | "scope" | "clarity",
      "message": "<specific actionable feedback>"
    }
  ],
  "suggestions": ["<suggestion 1>", "<suggestion 2>"],
  "revisedOutline": {
    "Title": "<the book title — keep or improve>",
    "Chapters": [
      {
        "Chapter": 1,
        "Title": "<chapter title>",
        "Summary": "<2-3 sentence chapter summary>",
        "KeyTopics": ["topic1", "topic2", "topic3"],
        "Subsections": [
          { "title": "<subsection title>", "description": "<1 sentence description>" },
          { "title": "<subsection title>", "description": "<1 sentence description>" },
          { "title": "<subsection title>", "description": "<1 sentence description>" }
        ]
      }
    ]
  }
}

Review criteria:
- Logical flow between chapters (does each chapter build on the previous?)
- Content gaps (missing essential topics for the subject matter?)
- Overlapping coverage (do chapters repeat the same ground?)
- Scope balance (are chapters roughly equal in scope?)
- Subsection quality (does each chapter have exactly 3 meaningful subsections?)
- Summary and KeyTopics clarity (are they specific and actionable?)

The "revisedOutline" should incorporate your suggested improvements while respecting the author's intent. Keep changes minimal — fix issues but preserve the author's vision.`;

export async function validateOutline(outline: { Title: string; Chapters: Array<{ Chapter: number; Title: string; Summary?: string; KeyTopics?: string[] }> }): Promise<string> {
  const userMessage = `Review and validate this book outline:\n\n${JSON.stringify(outline, null, 2)}`;
  const estimatedInputTokens = Math.round((VALIDATE_SYSTEM_PROMPT.length + userMessage.length) / 4);

  writeLog(outline.Title, {
    type:                   'request',
    model:                  MODEL,
    title:                  outline.Title,
    estimated_input_tokens: estimatedInputTokens,
    action:                 'validate',
  });

  const startMs = Date.now();

  const response = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: VALIDATE_SYSTEM_PROMPT },
      { role: 'user',   content: userMessage },
    ],
    temperature: 0.4,
  });

  const durationMs = Date.now() - startMs;
  const content    = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from OpenAI');

  const usage = response.usage;

  writeLog(outline.Title, {
    type:        'response',
    model:       MODEL,
    title:       outline.Title,
    action:      'validate',
    duration_ms: durationMs,
    usage: {
      prompt_tokens:     usage?.prompt_tokens,
      completion_tokens: usage?.completion_tokens,
      total_tokens:      usage?.total_tokens,
    },
    response: JSON.parse(content),
  });

  console.log(
    `[outline-agent] validate model=${MODEL}`,
    `tokens=${usage?.total_tokens} (${usage?.prompt_tokens}+${usage?.completion_tokens})`,
    `duration=${durationMs}ms`,
  );

  return content;
}
