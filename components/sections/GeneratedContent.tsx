'use client'

import { useEffect, useState } from 'react'
import { Card, Title } from '@tremor/react'
import { Loader2 } from 'lucide-react'

interface GeneratedContentProps {
  requestId: string
}

interface ContentItem {
  type: 'post' | 'infographic' | 'reel'
  platform: string
  content: string
  mediaUrl?: string
}

interface ContentStatus {
  status: 'processing' | 'completed' | 'failed'
  timestamp: string
  generatedContent?: ContentItem[]
}

export default function GeneratedContent({ requestId }: GeneratedContentProps) {
  const [contentStatus, setContentStatus] = useState<ContentStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/social-media?requestId=${requestId}`)
        const data = await response.json()

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch content status')
        }

        setContentStatus(data.data)

        // If still processing, check again in 5 seconds
        if (data.data.status === 'processing') {
          setTimeout(checkStatus, 5000)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      }
    }

    checkStatus()
  }, [requestId])

  if (error) {
    return (
      <Card className="mt-6 p-6">
        <div className="text-red-500">Error: {error}</div>
      </Card>
    )
  }

  if (!contentStatus) {
    return (
      <Card className="mt-6 p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading...</span>
        </div>
      </Card>
    )
  }

  if (contentStatus.status === 'processing') {
    return (
      <Card className="mt-6 p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Generating content...</span>
        </div>
      </Card>
    )
  }

  if (contentStatus.status === 'failed') {
    return (
      <Card className="mt-6 p-6">
        <div className="text-red-500">Content generation failed</div>
      </Card>
    )
  }

  return (
    <div className="mt-6 space-y-6">
      <Title>Generated Content</Title>
      
      {contentStatus.generatedContent?.map((item, index) => (
        <Card key={index} className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <span className="px-2 py-1 bg-primary/10 text-primary rounded text-sm">
                {item.platform}
              </span>
              <span className="ml-2 px-2 py-1 bg-gray-100 rounded text-sm">
                {item.type}
              </span>
            </div>
          </div>

          <div className="prose max-w-none">
            {item.content}
          </div>

          {item.mediaUrl && (
            <div className="mt-4">
              {item.type === 'infographic' && (
                <img 
                  src={item.mediaUrl} 
                  alt="Generated infographic" 
                  className="max-w-full rounded-lg"
                />
              )}
              {item.type === 'reel' && (
                <video 
                  src={item.mediaUrl} 
                  controls 
                  className="max-w-full rounded-lg"
                />
              )}
            </div>
          )}

          <div className="mt-4 flex justify-end space-x-2">
            <button
              onClick={() => navigator.clipboard.writeText(item.content)}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
            >
              Copy Text
            </button>
            {item.mediaUrl && (
              <a
                href={item.mediaUrl}
                download
                className="px-3 py-1 text-sm bg-primary text-white hover:bg-primary/90 rounded"
              >
                Download Media
              </a>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
} 