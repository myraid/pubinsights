"use client"

import { Card, Title, Grid, Metric, Text } from "@tremor/react"

export default function Analytics() {
  // In a real app, these would be fetched from an API
  const stats = {
    activeProjects: 3,
    generatedOutlines: 2,
    trendReports: 5,
    socialPosts: 4,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Title>Analytics Dashboard</Title>
      </div>

      <Grid numItems={1} numItemsSm={2} className="gap-6">
        <Card className="bg-white shadow-sm">
          <Text className="text-secondary">Active Projects</Text>
          <Metric className="text-primary">{stats.activeProjects}</Metric>
        </Card>
        <Card className="bg-white shadow-sm">
          <Text className="text-secondary">Generated Outlines</Text>
          <Metric className="text-primary">{stats.generatedOutlines}</Metric>
        </Card>
        <Card className="bg-white shadow-sm">
          <Text className="text-secondary">Trend Reports</Text>
          <Metric className="text-primary">{stats.trendReports}</Metric>
        </Card>
        <Card className="bg-white shadow-sm">
          <Text className="text-secondary">Social Posts</Text>
          <Metric className="text-primary">{stats.socialPosts}</Metric>
        </Card>
      </Grid>
    </div>
  )
}

