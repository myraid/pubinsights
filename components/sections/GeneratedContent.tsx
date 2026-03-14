'use client'

import { Card, Title } from '@tremor/react'

interface ContentItem {
  type: 'post' | 'ad'
  platform: string
  content: string
}

interface GeneratedContentProps {
  items: ContentItem[]
}

export default function GeneratedContent({ items }: GeneratedContentProps) {
  if (!items.length) {
    return null
  }

  return (
    <div className="mt-6 space-y-6">
      <Title>Generated Content</Title>

      {items.map((item, index) => (
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

          <div className="prose max-w-none whitespace-pre-wrap">
            {item.content}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={() => navigator.clipboard.writeText(item.content)}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
            >
              Copy Text
            </button>
          </div>
        </Card>
      ))}
    </div>
  )
}
