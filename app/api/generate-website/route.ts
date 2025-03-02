import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const { bookTitle, authorName, content } = await request.json()

  // In a real application, this is where you would generate the static website
  // For this example, we'll just return a success message
  const websiteUrl = `https://example.com/books/${bookTitle.toLowerCase().replace(/ /g, "-")}`

  return NextResponse.json({
    success: true,
    message: `Website for "${bookTitle}" by ${authorName} has been generated.`,
    websiteUrl,
  })
}

