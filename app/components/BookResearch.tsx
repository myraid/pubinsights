"use client"

import { useState, useEffect } from "react"
import { Card, TextInput, Button as TremorButton } from "@tremor/react"
import React from "react"
import { Star, ChevronDown, TrendingUp, ShoppingCart } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import googleTrends from 'google-trends-api'
import axios from 'axios'
import dynamic from 'next/dynamic'
import type { TrendData, AmazonBook } from "@/app/types"

// Dynamically import Plotly with no SSR
const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => <div>Loading Plot...</div>
})

const wellKnownPublishers = [
  "Penguin Random House",
  "HarperCollins",
  "Simon & Schuster",
  "Hachette Book Group",
  "Macmillan Publishers",
  "Scholastic",
  "Wiley",
  "Pearson",
  "Oxford University Press",
  "Cambridge University Press",
  "Houghton Mifflin Harcourt",
]

const BookResearch = React.memo(() => {
  const [keyword, setKeyword] = useState("")
  const [data, setData] = useState<TrendData | null>(null)
  const [books, setBooks] = useState<AmazonBook[]>([])
  const [loading, setLoading] = useState(false)
  const [projectBooks, setProjectBooks] = useState<{ id: string; title: string }[]>([])

  useEffect(() => {
    // In a real app, fetch the list of books from your backend or state management
    setProjectBooks([
      { id: "1", title: "The Future of AI" },
      { id: "2", title: "Mindful Living" },
    ])
  }, [])

  const fetchData = async (keyword: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/trends?keyword=${encodeURIComponent(keyword)}`)
      console.log('response : ', response);
      const trendData = await response.json()
      console.log('trendData : ', trendData);
      setData(trendData)
      
      const booksResponse = await fetch(`/api/amazon-books?keyword=${encodeURIComponent(keyword)}`)
      const booksData = await booksResponse.json()
      setBooks(booksData)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const analyzeKeyword = async () => {
    if (!keyword.trim()) return
    await fetchData(keyword)
  }

  const addResearchToBook = async (bookId: string) => {
    // In a real app, you would send this to your backend
    console.log(`Adding research for keyword "${keyword}" to book ${bookId}`)
    console.log("Trend data:", data)
    console.log("Amazon books data:", books)

    // Here you would typically make an API call to save this data
    // For now, we'll just show an alert
    alert(`Research added to book: ${projectBooks.find((b) => b.id === bookId)?.title}`)
  }

  const isIndieAuthor = (book: AmazonBook) => {
    return !wellKnownPublishers.some((publisher) => book.publisher.toLowerCase().includes(publisher.toLowerCase()))
  }

  const getOverallBSR = (book: AmazonBook) => {
    return Math.min(...book.bsr.map((rank) => rank.rank))
  }

  const openAmazonPage = (book: AmazonBook) => {
    // In a real app, you would use the actual Amazon URL for the book
    // For this example, we'll just open a search page
    window.open(`https://www.amazon.com/s?k=${encodeURIComponent(book.title)}`, "_blank")
  }

  const addBookToProject = async (projectId: string, book: AmazonBook) => {
    try {
      const { data, error } = await supabase
        .from('project_books')
        .insert([
          {
            project_id: projectId,
            book_data: book,
            added_at: new Date().toISOString(),
          }
        ])

      if (error) throw error
      
      // Handle success (e.g., show notification)
    } catch (error) {
      console.error('Error adding book to project:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Book Market Research</h1>
      </div>

      <Card className="bg-white shadow-sm p-0">
        <div className="flex gap-4 p-4">
          <TextInput
            placeholder="Enter a topic or keyword for your book..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="flex-grow tr-input"
          />
          <TremorButton
            onClick={analyzeKeyword}
            loading={loading}
            className="bg-primary text-white hover:bg-primary/90 px-8"
          >
            Analyze
          </TremorButton>
        </div>
      </Card>

      {data && (
        <Card className="bg-white shadow-sm p-6">
          <div className="flex items-center mb-6">
            <TrendingUp className="w-6 h-6 text-primary mr-2" />
            <h2 className="text-lg font-semibold text-primary">Interest over time</h2>
          </div>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="w-full">
              {data.webSearch && data.youtube && (
                <Plot
                  data={[
                    {
                      x: data.webSearch.timelineData.map(point => 
                        new Date(parseInt(point.time) * 1000)
                      ),
                      y: data.webSearch.timelineData.map(point => point.value[0]),
                      type: "scatter",
                      mode: "lines",
                      name: "Web Search",
                      line: {
                        shape: "spline",
                        color: '#4285f4',
                        smoothing: 1.3,
                      },
                      hovertemplate: 'Web: %{y:.0f}%<extra></extra>'
                    },
                    {
                      x: data.youtube.timelineData.map(point => 
                        new Date(parseInt(point.time) * 1000)
                      ),
                      y: data.youtube.timelineData.map(point => point.value[0]),
                      type: "scatter",
                      mode: "lines",
                      name: "YouTube Search",
                      line: {
                        shape: "spline",
                        color: '#ff0000',
                        smoothing: 1.3,
                      },
                      hovertemplate: 'YouTube: %{y:.0f}%<extra></extra>'
                    }
                  ]}
                  layout={{
                    height: 400,
                    margin: { t: 10, r: 30, b: 40, l: 40 },
                    xaxis: {
                      title: '',
                      showgrid: false,
                      zeroline: false,
                      tickformat: '%b %Y',
                      dtick: 'M1',
                      tickangle: 0,
                      tickfont: {
                        size: 12,
                        color: '#666'
                      },
                      range: [
                        new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString(),
                        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                      ],
                      automargin: true
                    },
                    yaxis: {
                      title: '',
                      showgrid: true,
                      gridcolor: '#f0f0f0',
                      zeroline: false,
                      range: [0, 100],
                      ticksuffix: '',
                      tickfont: {
                        size: 12,
                        color: '#666'
                      },
                      rangemode: 'tozero',
                      automargin: true
                    },
                    plot_bgcolor: 'white',
                    paper_bgcolor: 'white',
                    showlegend: true,
                    legend: {
                      orientation: 'h',
                      yanchor: 'bottom',
                      y: -0.2,
                      xanchor: 'center',
                      x: 0.5,
                      font: {
                        size: 12,
                        color: '#666'
                      },
                      bgcolor: 'rgba(255,255,255,0.9)',
                      bordercolor: 'rgba(0,0,0,0.1)',
                      borderwidth: 1
                    },
                    hovermode: 'x unified',
                    autosize: true,
                    shapes: [
                      {
                        type: 'rect',
                        xref: 'paper',
                        yref: 'paper',
                        x0: 0,
                        y0: 0,
                        x1: 1,
                        y1: 1,
                        line: {
                          color: 'rgba(0,0,0,0.1)',
                          width: 1,
                        },
                        layer: 'below'
                      }
                    ]
                  }}
                  config={{
                    displayModeBar: false,
                    responsive: true,
                    scrollZoom: false
                  }}
                  style={{
                    width: '100%',
                    minHeight: '400px'
                  }}
                />
              )}
            </div>
          </div>
        </Card>
      )}

      {books.length > 0 && (
        <Card className="bg-white shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <ShoppingCart className="w-6 h-6 text-primary mr-2" />
              <h2 className="text-lg font-semibold text-primary">Amazon Book Analyzer</h2>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="ml-auto">
                  Add to Project <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {projectBooks.map((book) => (
                  <DropdownMenuItem key={book.id} onSelect={() => addResearchToBook(book.id)}>
                    {book.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-2 text-left">Book</th>
                  <th className="px-4 py-2 text-left">Reviews</th>
                  <th className="px-4 py-2 text-left">Overall BSR</th>
                  <th className="px-4 py-2 text-left">Price</th>
                  <th className="px-4 py-2 text-left">Author</th>
                </tr>
              </thead>
              <tbody>
                {books.map((book) => (
                  <tr key={book.id} className="border-b">
                    <td className="px-4 py-2">
                      <div className="flex items-center">
                        <div className="mr-4 cursor-pointer" onClick={() => openAmazonPage(book)}>
                          <Image
                            src={book.image || "/placeholder.svg"}
                            alt={book.title}
                            width={60}
                            height={90}
                            className="object-cover rounded"
                          />
                        </div>
                        <div>
                          <p
                            className="font-semibold text-primary cursor-pointer hover:underline"
                            onClick={() => openAmazonPage(book)}
                          >
                            {book.title}
                          </p>
                          {isIndieAuthor(book) && (
                            <span className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full mt-1">
                              Indie Author
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < Math.floor(book.rating) ? "text-yellow-400 fill-current" : "text-gray-300"
                            }`}
                          />
                        ))}
                        <span className="ml-2 text-sm text-gray-600">({book.reviewCount})</span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span className="font-semibold">#{getOverallBSR(book).toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="font-bold text-primary">${book.price.toFixed(2)}</span>
                    </td>
                    <td className="px-4 py-2">
                      <p className="text-gray-600">{book.author}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {book.categories.map((category, index) => (
                          <span key={index} className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
                            {category}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

    </div>
  )
})

export default BookResearch

