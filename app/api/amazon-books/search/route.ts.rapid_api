import { NextResponse } from 'next/server';

const RAPIDAPI_KEY = process.env.RAPID_API_KEY;
const RAPIDAPI_HOST = 'amazon-product-info2.p.rapidapi.com';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keywords = searchParams.get('keywords');
  const page = searchParams.get('page');

  if (!keywords) {
    return NextResponse.json({ error: 'Keywords are required' }, { status: 400 });
  }

  if (!RAPIDAPI_KEY) {
    return NextResponse.json({ error: 'RapidAPI key is not configured' }, { status: 500 });
  }

  try {
    const response = await fetch(
      `https://${RAPIDAPI_HOST}/Amazon/search.php?keywords=${encodeURIComponent(keywords)}&sortBy=Relevance&itemPage=${page}&searchIndex=Books`,
      {
        headers: {
          'x-rapidapi-host': RAPIDAPI_HOST,
          'x-rapidapi-key': RAPIDAPI_KEY,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch from RapidAPI');
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching Amazon books:', error);
    return NextResponse.json(
      { error: 'Failed to fetch books from Amazon' },
      { status: 500 }
    );
  }
} 