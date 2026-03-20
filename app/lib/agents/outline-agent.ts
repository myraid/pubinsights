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
      "KeyTopics": ["topic1", "topic2", "topic3"]
    }
  ]
}

Create 8-12 chapters. Each chapter must have a "Chapter" number and "Title" at minimum. Include "Summary" and "KeyTopics" for each chapter to make the outline actionable.`;

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

export async function generateOutline(title: string): Promise<string> {
  const userMessage = `Create a detailed book outline for: "${title}"`;
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
