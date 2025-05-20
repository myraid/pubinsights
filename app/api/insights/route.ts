import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { userId, keyword, books, trendData,  timestamp} = data;

    console.log('Received insights request:', { userId, keyword, booksCount: books?.length });  

    // Validate required fields
    if (!userId || !keyword || !trendData || !books) {
      console.error('Missing required fields:', { userId, keyword, hasTrendData: !!trendData, booksCount: books?.length });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    // Create a copy of books without description and reviews fields
    const books_stripped = books.map((books: any) => {
      const { description, reviews, ...bookWithoutDescriptionAndReviews } = books;
      return bookWithoutDescriptionAndReviews;
    });



    const webhookUrl = 'https://hook.us2.make.com/qpajwk8cez0x1isu4issavnrg7lwpd97';
    if (!webhookUrl) {
      console.error('Webhook URL not configured');
      return NextResponse.json(
        { error: 'Webhook URL not configured' },
        { status: 500 }
      );
    }

    // Call the webhook with the raw data
    console.log('Calling webhook with data...');
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        keyword,
        timestamp,
        trendData,
        books: books_stripped  
      }),
    });

    if (!response.ok) {
      console.error('Webhook call failed:', response.status, response.statusText);
      throw new Error('Failed to call webhook');
    }

    const webhookData = await response.json();
    console.log('Raw webhook response:', JSON.stringify(webhookData, null, 2));

    // Process the webhook response to ensure we have the required fields
    const processedData = {
      ...webhookData,
      insights: webhookData.insights || webhookData.key_insights || [],
      title_suggestion: webhookData.title_suggestion || webhookData.keyword_optimized_title_suggestion || webhookData.suggested_title || '',
      rating: webhookData.rating || 0,
      analysis: webhookData.analysis || '',
      pros: webhookData.pros || [],
      cons: webhookData.cons || []
    };

    return NextResponse.json(processedData);
  } catch (error) {
    console.error('Error in insights API:', error);
    return NextResponse.json(
      { error: 'Failed to process insights', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 