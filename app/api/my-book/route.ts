import { NextResponse } from 'next/server';
import { getProductDetails } from '@/app/lib/services/amazon-scraper';

export async function POST(request: Request) {
  try {
    const { bookUrl, userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!bookUrl) {
      return NextResponse.json(
        { error: 'Book URL is required' },
        { status: 400 }
      );
    }

    const asinMatch = bookUrl.match(/\/dp\/([A-Z0-9]{10})/);
    if (!asinMatch) {
      return NextResponse.json(
        { error: 'Invalid Amazon book URL' },
        { status: 400 }
      );
    }

    const asin = asinMatch[1];
    const bookData = await getProductDetails(asin);

    if (!bookData || !Object.keys(bookData).length) {
      throw new Error('Book data not found');
    }

    return NextResponse.json(bookData);
  } catch (error) {
    console.error('Error in my-book API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch book data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
