import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { bookUrl } = await request.json();

    if (!bookUrl) {
      return NextResponse.json(
        { error: 'Book URL is required' },
        { status: 400 }
      );
    }

    // Extract ASIN from Amazon URL
    const asinMatch = bookUrl.match(/\/dp\/([A-Z0-9]{10})/);
    if (!asinMatch) {
      return NextResponse.json(
        { error: 'Invalid Amazon book URL' },
        { status: 400 }
      );
    }

    const asin = asinMatch[1];
    const product_info_url = "https://scraper-api.decodo.com/v2/scrape";
    const product_payload = {
      "target": "amazon_product",
      "query": asin,
      "parse": true,
      "autoselect_variant": false
    };

    const response = await fetch(product_info_url, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'authorization': process.env.SCRAPPER_AUTHORIZATION_KEY || ''
      },
      body: JSON.stringify(product_payload)
    });

    if (!response.ok) {
      throw new Error('Failed to fetch book data');
    }

    const data = await response.json();
    if (!data?.results?.[0]?.content?.results) {
      throw new Error('Book data not found');
    }
    const bookData = data.results[0].content.results;
    console.log("json for book details", bookData)
  
    return NextResponse.json(bookData);
  } catch (error) {
    console.error('Error in my-book API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch book data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 