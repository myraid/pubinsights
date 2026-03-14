import openai, { MODEL } from './openai-client';

export interface GeneratedContentItem {
  type: 'post' | 'ad';
  platform: string;
  content: string;
}

const AD_SYSTEM_PROMPT = `You are a book marketing copywriter. Given book details and a sale price, generate compelling ad copy for multiple social media platforms.

Return a JSON object with this structure:
{
  "generatedContent": [
    {
      "type": "ad",
      "platform": "Facebook",
      "content": "<ad copy text>"
    },
    {
      "type": "ad",
      "platform": "Instagram",
      "content": "<ad copy text>"
    },
    {
      "type": "ad",
      "platform": "Twitter",
      "content": "<ad copy text>"
    }
  ]
}

Each platform's copy should be tailored to that platform's style and character limits. Include a call-to-action and the sale price. Make the copy engaging and conversion-focused.`;

const POST_SYSTEM_PROMPT = `You are a social media content strategist for book authors. Given book details and additional context, generate engaging social media posts for multiple platforms.

Return a JSON object with this structure:
{
  "generatedContent": [
    {
      "type": "post",
      "platform": "Facebook",
      "content": "<post text>"
    },
    {
      "type": "post",
      "platform": "Instagram",
      "content": "<post text with hashtags>"
    },
    {
      "type": "post",
      "platform": "Twitter",
      "content": "<post text within 280 chars>"
    },
    {
      "type": "post",
      "platform": "LinkedIn",
      "content": "<professional post text>"
    }
  ]
}

Tailor each post to the platform's audience and style. Use relevant hashtags for Instagram. Keep Twitter under 280 characters. Make LinkedIn posts more professional.`;

export async function generateAdCopy(
  bookData: { title: string; price?: string; author?: string; description?: string },
  salePrice: string
): Promise<GeneratedContentItem[]> {
  const userMessage = `Book: "${bookData.title}"
Author: ${bookData.author || 'Unknown'}
Original Price: ${bookData.price || 'N/A'}
Sale Price: $${salePrice}
Description: ${bookData.description || 'N/A'}

Generate compelling ad copy for this book sale.`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: AD_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.8,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  const parsed = JSON.parse(content);
  return parsed.generatedContent ?? [];
}

export async function generateSocialPost(
  title: string,
  bookDescription: string,
  postInfo: string
): Promise<GeneratedContentItem[]> {
  const userMessage = `Book: "${title}"
Description: ${bookDescription}
Additional context from the author: ${postInfo}

Generate engaging social media posts for this book.`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: POST_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.8,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  const parsed = JSON.parse(content);
  return parsed.generatedContent ?? [];
}
