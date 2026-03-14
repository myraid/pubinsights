import { NextResponse } from 'next/server';
import { generateInsights } from '@/app/lib/agents/insights-agent';
import { logGeneration } from '@/app/lib/agents/generation-logger';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { userId, keyword, books, trendData } = data;

    console.log('Received insights request:', { userId, keyword, booksCount: books?.length });

    if (!userId || !keyword) {
      console.error('Missing required fields:', { userId, keyword });
      return NextResponse.json(
        { error: 'Missing required fields: userId and keyword are required' },
        { status: 400 }
      );
    }

    const enrichedBooks = books?.length
      ? (books as Array<Record<string, unknown>>).map((book) => {
          const desc = typeof book.description === 'string' ? book.description.slice(0, 500) : null;
          const reviews = Array.isArray(book.reviews)
            ? book.reviews.slice(0, 5).map((r: Record<string, unknown>) => ({
                title: r.title,
                rating: r.rating,
                content: typeof r.content === 'string' ? r.content.slice(0, 300) : '',
                is_verified: r.is_verified,
              }))
            : [];
          return {
            title: book.title,
            asin: book.asin,
            price: book.price,
            rating: book.rating,
            reviews_count: book.reviews_count,
            bsr: book.bsr,
            publisher: book.publisher,
            manufacturer: book.manufacturer,
            publication_date: book.publication_date,
            categories: book.categories,
            is_prime: book.is_prime,
            description: desc,
            review_ai_summary: book.review_ai_summary || null,
            rating_stars_distribution: book.rating_stars_distribution || [],
            top_reviews: reviews,
          };
        })
      : [];

    const result = await generateInsights(keyword, enrichedBooks, trendData);

    logGeneration(userId, 'insights', { keyword, booksCount: enrichedBooks.length }, result as unknown as Record<string, unknown>, 'gpt-4o');

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in insights API:', error);
    return NextResponse.json(
      { error: 'Failed to process insights', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
