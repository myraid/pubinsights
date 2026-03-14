import openai, { MODEL } from './openai-client';

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

export async function generateOutline(title: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Create a detailed book outline for: "${title}"` },
    ],
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  return content;
}
