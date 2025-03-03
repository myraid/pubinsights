import { NextResponse } from 'next/server'
import googleTrends from 'google-trends-api'

interface TimelinePoint {
  time: string;
  value: number[];
}

function smoothData(timelineData: TimelinePoint[], windowSize: number = 7) {
  const result: TimelinePoint[] = [];
  
  for (let i = 0; i < timelineData.length; i++) {
    // Calculate the window boundaries
    const windowStart = Math.max(0, i - Math.floor(windowSize / 2));
    const windowEnd = Math.min(timelineData.length - 1, i + Math.floor(windowSize / 2));
    
    // Calculate moving average for this window
    let sum = 0;
    let count = 0;
    
    for (let j = windowStart; j <= windowEnd; j++) {
      sum += timelineData[j].value[0];
      count++;
    }
    
    // Create smoothed data point
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
        console.log('web search res size: ', res.length);
        //console.log('web search res : ', res);
        try {
          const parsed = JSON.parse(res);
          // Apply smoothing to the timeline data
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

    // Wait for 1 seconds before making YouTube API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get YouTube trends
    const youtubeOptions = {
      ...options,
      property: 'youtube' // This tells the API to get YouTube search data
    }

    const youtubeData = await googleTrends.interestOverTime(youtubeOptions)
      .then(res => {
        console.log('youtube res size: ', res.length);
        try {
          const parsed = JSON.parse(res);
          // Apply smoothing to the timeline data
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

