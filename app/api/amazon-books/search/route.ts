import { NextResponse } from 'next/server';

const RAPIDAPI_KEY = process.env.RAPID_API_KEY;
const RAPIDAPI_HOST = 'amazon-product-info2.p.rapidapi.com';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keywords = searchParams.get('keywords');

  if (!keywords) {
    return NextResponse.json({ error: 'Keywords are required' }, { status: 400 });
  }

  if (!RAPIDAPI_KEY) {
    console.error('RapidAPI key is missing from environment variables');
    return NextResponse.json({ error: 'RapidAPI key is not configured' }, { status: 500 });
  }

  try {
    console.log('Making request to my API with keywords:', keywords);


    const response = await fetch(`http://127.0.0.1:8000/search?keywords=${keywords}`,
      {
        headers: {
          'Content-Type': 'application/json', 
          //add api key for our API
        },
        method: "POST",
        body: JSON.stringify({
          "keyword": keywords,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('RapidAPI response error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Failed to fetch from RapidAPI: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching Amazon books:', error);
    return NextResponse.json(
      { error: 'Failed to fetch books from Amazon', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 