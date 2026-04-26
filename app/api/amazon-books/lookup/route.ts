import { NextResponse } from 'next/server'
import { lookupBookByAsin } from '@/app/lib/services/amazon-scraper'

function extractAsin(input: string): string | null {
  const trimmed = input.trim()
  if (/^[A-Z0-9]{10}$/.test(trimmed)) return trimmed
  const match = trimmed.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/)
  return match?.[1] ?? null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url') || searchParams.get('asin') || ''

    const asin = extractAsin(url)
    if (!asin) {
      return NextResponse.json(
        { error: 'Could not extract ASIN from the provided URL or value' },
        { status: 400 }
      )
    }

    const book = await lookupBookByAsin(asin)
    if (!book) {
      return NextResponse.json(
        { error: 'Book not found for this ASIN' },
        { status: 404 }
      )
    }

    return NextResponse.json(book)
  } catch (error) {
    console.error('Error in amazon-books/lookup:', error)
    return NextResponse.json(
      { error: 'Failed to look up book', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
