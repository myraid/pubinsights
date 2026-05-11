import openai from './openai-client';

const WRITER_MODEL = 'gpt-4o';

export interface ChapterDraftParams {
  bookTitle: string;
  chapterNumber: number;
  chapterTitle: string;
  summary: string;
  keyTopics: string[];
  previousChapterSummary?: string;
  totalChapters: number;
}

export interface ChapterDraft {
  content: string;
  wordCount: number;
}

const SYSTEM_PROMPT = `You are a professional non-fiction book author. Your task is to write a detailed, engaging book chapter in HTML format.

Guidelines:
- Write between 2000 and 3000 words of substantive content
- Use the chapter title as the opening heading wrapped in <h2>
- Structure the chapter with clear sections using <h3> for subheadings
- Wrap all body text in <p> tags
- Follow the provided chapter summary and cover every key topic listed
- If a previous chapter summary is provided, maintain narrative and thematic continuity with it
- Write in a professional, authoritative yet accessible style suited for non-fiction publishing
- Avoid filler phrases, padding, or repetition — every paragraph should add value
- Do not include any preamble, commentary, or meta-text outside the HTML content itself — output only the chapter HTML`;

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export async function generateChapterDraft(
  params: ChapterDraftParams
): Promise<ChapterDraft> {
  const {
    bookTitle,
    chapterNumber,
    chapterTitle,
    summary,
    keyTopics,
    previousChapterSummary,
    totalChapters,
  } = params;

  const userMessage = [
    `Book Title: "${bookTitle}"`,
    `Chapter ${chapterNumber} of ${totalChapters}: "${chapterTitle}"`,
    ``,
    `Chapter Summary:`,
    summary,
    ``,
    `Key Topics to Cover:`,
    keyTopics.map((t, i) => `${i + 1}. ${t}`).join('\n'),
    previousChapterSummary
      ? `\nPrevious Chapter Summary (for continuity):\n${previousChapterSummary}`
      : '',
    ``,
    `Write the full chapter now.`,
  ]
    .filter((line) => line !== undefined)
    .join('\n');

  const response = await openai.chat.completions.create({
    model: WRITER_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  const wordCount = countWords(stripHtml(content));

  return { content, wordCount };
}
