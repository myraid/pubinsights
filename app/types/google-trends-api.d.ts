declare module 'google-trends-api' {
  interface TrendOptions {
    keyword: string
    startTime?: Date
    endTime?: Date
    geo?: string
    hl?: string
    timezone?: number
    property?: string
  }

  interface TimelineData {
    time: string
    value: number
    formattedTime: string
    formattedValue: string[]
  }

  interface TrendResponse {
    default: {
      timelineData: TimelineData[]
    }
  }

  function interestOverTime(options: TrendOptions): Promise<string>

  export interface TrendData {
    webSearch: {
      timelineData: Array<{
        time: string;
        value: number[];
      }>;
    };
    youtube: {
      timelineData: Array<{
        time: string;
        value: number[];
      }>;
    };
  }

  export {
    interestOverTime,
    TrendOptions,
    TrendResponse,
    TimelineData
  }
} 