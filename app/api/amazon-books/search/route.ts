import { NextResponse } from 'next/server';
import { searchAmazonBooks } from '@/app/lib/services/amazon-scraper';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keywords = searchParams.get('keywords');

  if (!keywords) {
    return NextResponse.json({ error: 'Keywords are required' }, { status: 400 });
  }

  try {
    const books = await searchAmazonBooks(keywords);
    return NextResponse.json(books);
  } catch (error) {
    console.error('Error fetching Amazon books:', error);
    return NextResponse.json(
      { error: 'Failed to fetch books from Amazon', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
