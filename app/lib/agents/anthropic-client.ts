import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const SONNET_MODEL = 'claude-sonnet-4-6'
export const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

export default anthropic
