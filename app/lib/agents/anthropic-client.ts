import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const SONNET_MODEL = 'claude-sonnet-4-6'
export const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

export default anthropic

/**
 * Extract a JSON object from a Claude text response.
 *
 * Claude does not natively guarantee JSON output (unlike OpenAI's
 * response_format). It will sometimes wrap JSON in markdown code
 * fences, prepend prose like "Here's the JSON:", or append a
 * trailing explanation. This helper strips those wrappers and parses
 * whatever JSON object is present.
 *
 * Note: assistant-turn prefill (sending `{` as the last message) is
 * not supported on Sonnet 4.6 / Haiku 4.5, so we rely on the system
 * prompt instructing JSON-only output plus this lenient extractor.
 */
export function extractJson<T = unknown>(rawText: string): T {
  const text = rawText.trim()

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : text

  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      `Could not locate JSON object in model response. Raw text: ${rawText.slice(0, 500)}`
    )
  }

  const json = candidate.slice(start, end + 1)
  try {
    return JSON.parse(json) as T
  } catch (err) {
    throw new Error(
      `Failed to parse JSON from model response: ${err instanceof Error ? err.message : String(err)}. Extracted: ${json.slice(0, 500)}`
    )
  }
}
