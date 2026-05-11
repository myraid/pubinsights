import { NextResponse } from 'next/server'
import googleTrends from 'google-trends-api'

interface TimelinePoint {
  time: string;
  value: number[];
}

function smoothData(timelineData: TimelinePoint[], windowSize: number = 7) {
  const result: TimelinePoint[] = [];

  for (let i = 0; i < timelineData.length; i++) {
    const windowStart = Math.max(0, i - Math.floor(windowSize / 2));
    const windowEnd = Math.min(timelineData.length - 1, i + Math.floor(windowSize / 2));

    let sum = 0;
    let count = 0;

    for (let j = windowStart; j <= windowEnd; j++) {
      sum += timelineData[j].value[0];
      count++;
    }

    result.push({
      time: timelineData[i].time,
      value: [sum / count]
    });
  }

  return result;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const searchKeyword = searchParams.get('keyword')
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  if (!searchKeyword) {
    return NextResponse.json({ error: 'Keyword is required' }, { status: 400 })
  }

  try {
    const endTime = new Date()
    const startTime = new Date()
    startTime.setMonth(startTime.getMonth() - 6)

    const options = {
      keyword: searchKeyword,
      startTime,
      endTime,
      geo: 'US',
      hl: 'en-US',
      timezone: 480
    }

    // Get web search trends
    const webSearchData = await googleTrends.interestOverTime(options)
      .then(res => {
        try {
          const parsed = JSON.parse(res);
          const smoothedData = {
            ...parsed.default,
            timelineData: smoothData(parsed.default.timelineData)
          };
          return { default: smoothedData };
        } catch (e) {
          console.error('Error parsing web search data:', e)
          throw new Error('Invalid web search response')
        }
      })

    // Wait before making YouTube API call
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get YouTube trends
    const youtubeOptions = {
      ...options,
      property: 'youtube'
    }

    const youtubeData = await googleTrends.interestOverTime(youtubeOptions)
      .then(res => {
        try {
          const parsed = JSON.parse(res);
          const smoothedData = {
            ...parsed.default,
            timelineData: smoothData(parsed.default.timelineData)
          };
          return { default: smoothedData };
        } catch (e) {
          console.error('Error parsing YouTube data:', e)
          throw new Error('Invalid YouTube response')
        }
      })

    if (!webSearchData?.default?.timelineData || !youtubeData?.default?.timelineData) {
      throw new Error('Invalid response structure from Google Trends')
    }

    return NextResponse.json({
      webSearch: webSearchData.default,
      youtube: youtubeData.default
    })

  } catch (error) {
    console.error('Error fetching trends:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch trends data'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
