"use client"

import { Card, Title } from "@tremor/react"
import Logo from "./Logo"
import { Info } from "lucide-react"

export default function SocialMedia() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Title>AD Creative</Title>
        <Logo />
      </div>

      <Card className="p-6">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-sm text-purple-700">
            <Info className="w-4 h-4" />
            Coming soon
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Social Media Ad Studio</h2>
          <p className="text-gray-600 max-w-xl mx-auto">
            We are polishing the ad builder experience. Soon you will be able to paste an Amazon
            link, pick an ad style, and generate creative in seconds.
          </p>
          <div className="text-sm text-gray-500">
            Want early access? Email us and we will enable your account.
          </div>
        </div>
      </Card>
    </div>
  )
}

