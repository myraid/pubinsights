"use client"

import type React from "react"
import { useState } from "react"
import { PlusCircle, Book, Trash2, FileText, Share2, TrendingUp, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import type { TrendData, AmazonBook } from "../types"

interface BookContent {
  research: {
    trendData: TrendData | null
    amazonBooks: AmazonBook[]
  } | null
  outline: any | null // Replace 'any' with a more specific type if available
  socialMedia: any | null // Replace 'any' with a more specific type if available
}

interface Book {
  id: string
  title: string
  content: BookContent
}

const MyProjects: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([
    {
      id: "1",
      title: "The Future of AI",
      content: {
        research: null,
        outline: null,
        socialMedia: null,
      },
    },
    {
      id: "2",
      title: "Mindful Living",
      content: {
        research: null,
        outline: null,
        socialMedia: null,
      },
    },
  ])
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [newBookTitle, setNewBookTitle] = useState("")

  const addBook = () => {
    if (newBookTitle.trim()) {
      const newBook: Book = {
        id: Date.now().toString(),
        title: newBookTitle.trim(),
        content: { research: null, outline: null, socialMedia: null },
      }
      setBooks([...books, newBook])
      setNewBookTitle("")
    }
  }

  const deleteBook = (bookId: string) => {
    setBooks(books.filter((book) => book.id !== bookId))
    if (selectedBook?.id === bookId) {
      setSelectedBook(null)
    }
  }

  const getOverallBSR = (book: AmazonBook) => {
    return Math.min(...book.bsr.map((rank) => rank.rank))
  }

  return (
    <div className="flex h-[calc(100vh-200px)]">
      {/* Left Pane (Book List) */}
      <div className="w-1/4 p-4 border-r border-purple-200 overflow-y-auto">
        <h2 className="text-lg font-semibold text-purple-800 mb-4">My Books</h2>
        <div className="flex mb-4">
          <Input
            type="text"
            placeholder="New book title"
            value={newBookTitle}
            onChange={(e) => setNewBookTitle(e.target.value)}
            className="mr-2 bg-white text-purple-800"
          />
          <Button onClick={addBook} size="sm" className="bg-purple-600 text-white hover:bg-purple-700">
            <PlusCircle className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
        <ul className="space-y-2">
          {books.map((book) => (
            <li
              key={book.id}
              className={`flex items-center justify-between p-2 rounded cursor-pointer ${
                selectedBook?.id === book.id ? "bg-purple-100 text-purple-800" : "text-purple-800 hover:bg-purple-50"
              }`}
              onClick={() => setSelectedBook(book)}
            >
              <div className="flex items-center">
                <Book className="w-4 h-4 mr-2" />
                <span>{book.title}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteBook(book.id)
                }}
                className="text-purple-800 hover:bg-purple-200"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </li>
          ))}
        </ul>
      </div>

      {/* Right Pane (Book Details) */}
      <div className="w-3/4 p-4 overflow-y-auto">
        {selectedBook ? (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-purple-800 mb-4">{selectedBook.title}</h2>

            {selectedBook.content.research && (
              <Card className="p-4">
                <h3 className="text-lg font-semibold text-purple-800 mb-2 flex items-center">
                  <FileText className="w-5 h-5 mr-2" /> Book Research
                </h3>
                <div className="space-y-4">
                  {selectedBook.content.research.trendData && (
                    <div>
                      <h4 className="text-md font-semibold text-purple-600 mb-2 flex items-center">
                        <TrendingUp className="w-4 h-4 mr-2" /> Trend Analysis
                      </h4>
                      <pre className="whitespace-pre-wrap text-sm bg-gray-100 p-2 rounded">
                        {JSON.stringify(selectedBook.content.research.trendData, null, 2)}
                      </pre>
                    </div>
                  )}
                  {selectedBook.content.research.amazonBooks.length > 0 && (
                    <div>
                      <h4 className="text-md font-semibold text-purple-600 mb-2 flex items-center">
                        <ShoppingCart className="w-4 h-4 mr-2" /> Amazon Book Analysis
                      </h4>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="px-2 py-1 text-left">Title</th>
                            <th className="px-2 py-1 text-left">Author</th>
                            <th className="px-2 py-1 text-left">BSR</th>
                            <th className="px-2 py-1 text-left">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedBook.content.research.amazonBooks.map((book) => (
                            <tr key={book.id} className="border-b">
                              <td className="px-2 py-1">{book.title}</td>
                              <td className="px-2 py-1">{book.author}</td>
                              <td className="px-2 py-1">#{getOverallBSR(book).toLocaleString()}</td>
                              <td className="px-2 py-1">${book.price.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {selectedBook.content.outline && (
              <Card className="p-4">
                <h3 className="text-lg font-semibold text-purple-800 mb-2 flex items-center">
                  <FileText className="w-5 h-5 mr-2" /> Book Outline
                </h3>
                {/* Display book outline content here */}
                <pre className="whitespace-pre-wrap text-sm bg-gray-100 p-2 rounded">
                  {JSON.stringify(selectedBook.content.outline, null, 2)}
                </pre>
              </Card>
            )}

            {selectedBook.content.socialMedia && (
              <Card className="p-4">
                <h3 className="text-lg font-semibold text-purple-800 mb-2 flex items-center">
                  <Share2 className="w-5 h-5 mr-2" /> Social Media Content
                </h3>
                {/* Display social media content here */}
                <pre className="whitespace-pre-wrap text-sm bg-gray-100 p-2 rounded">
                  {JSON.stringify(selectedBook.content.socialMedia, null, 2)}
                </pre>
              </Card>
            )}

            {!selectedBook.content.research && !selectedBook.content.outline && !selectedBook.content.socialMedia && (
              <p className="text-gray-600">
                No content has been added to this book yet. Use the Book Research, Book Outline, or Social Media tabs to
                add content.
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-purple-800">Select a book to view details</div>
        )}
      </div>
    </div>
  )
}

export default MyProjects

