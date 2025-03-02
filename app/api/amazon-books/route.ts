import { NextResponse } from "next/server"
import axios from "axios"  // Keep import for future use
import type { AmazonBook } from "@/app/types"

// Rainforest API configuration - keep for future use
/*
const SCRAPING_API_KEY = process.env.SCRAPING_API_KEY
const SCRAPING_API_URL = 'https://api.rainforestapi.com/request'
*/

// Mock data generator function
function generateMockBooks(keyword: string): AmazonBook[] {
  return [
    {
      id: "1",
      title: `The Complete Guide to ${keyword}`,
      author: "John Smith",
      price: 19.99,
      image: "/images/cover.jpg",
      bsr: [
        { rank: 1250, category: "Self-Help" },
        { rank: 3420, category: "Business & Money" },
      ],
      categories: ["Self-Help", "Business & Money", "Personal Development"],
      rating: 4.5,
      reviewCount: 1250,
      publisher: "Indie Publishing",
      url: "/product/1"
    },
    {
      id: "2",
      title: `${keyword} Mastery`,
      author: "Sarah Johnson",
      price: 24.99,
      image: "/images/cover.jpg",
      bsr: [
        { rank: 2150, category: "Business & Money" },
        { rank: 4560, category: "Self-Help" },
      ],
      categories: ["Business & Money", "Leadership", "Management"],
      rating: 4.7,
      reviewCount: 890,
      publisher: "Penguin Random House",
      url: "/product/2"
    },
    {
      id: "3",
      title: `${keyword} for Beginners`,
      author: "Michael Brown",
      price: 15.99,
      image: "/images/cover.jpg",
      bsr: [
        { rank: 3450, category: "Beginners Guides" },
        { rank: 5670, category: "Self-Help" },
      ],
      categories: ["Beginners Guides", "Self-Help", "How-To"],
      rating: 4.3,
      reviewCount: 675,
      publisher: "Self-Published",
      url: "/product/3"
    },
  ]
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const keyword = searchParams.get("keyword")

  if (!keyword) {
    return NextResponse.json({ error: "Keyword is required" }, { status: 400 })
  }

  /* Rainforest API Implementation - kept for future use
  try {
    // First get search results
    const searchResponse = await axios.get(SCRAPING_API_URL, {
      params: {
        api_key: SCRAPING_API_KEY,
        type: 'search',
        amazon_domain: 'amazon.com',
        search_term: `${keyword} book`,
        category_id: 'books',
        sort_by: 'featured',
        page: '1'
      }
    })

    // Get ASINs from search results
    const asins = searchResponse.data.search_results
      .slice(0, 5) // Get top 5 results
      .map((item: any) => item.asin)

    // Get detailed product data for each ASIN
    const detailedProducts = await Promise.all(
      asins.map(async (asin: string) => {
        const productResponse = await axios.get(SCRAPING_API_URL, {
          params: {
            api_key: SCRAPING_API_KEY,
            type: 'product',
            amazon_domain: 'amazon.com',
            asin: asin
          }
        })
        return productResponse.data.product
      })
    )

    // Transform to our AmazonBook type
    const books: AmazonBook[] = detailedProducts.map(product => ({
      id: product.asin,
      title: product.title,
      author: product.authors?.[0] || 'Unknown Author',
      price: parseFloat(product.buybox_winner?.price?.value || '0'),
      image: product.main_image?.link || '/images/cover.jpg',
      bsr: product.bestsellers_rank?.map((rank: any) => ({
        rank: parseInt(rank.rank),
        category: rank.category
      })) || [],
      categories: product.categories?.map((cat: any) => cat.name) || [],
      rating: parseFloat(product.rating || '0'),
      reviewCount: parseInt(product.ratings_total || '0'),
      publisher: product.specifications?.find((s: any) => s.name === 'Publisher')?.value || 'Unknown Publisher',
      url: product.link
    }))

    return NextResponse.json(books)

  } catch (error) {
    console.error("Error fetching Amazon books:", error)
    return NextResponse.json(generateMockBooks(keyword))
  }
  */

  // Using mock data for now
  return NextResponse.json(generateMockBooks(keyword))
}

