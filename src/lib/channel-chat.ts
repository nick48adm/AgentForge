/**
 * channel-chat.ts
 * Shared logic for routing a message from any channel (Telegram, WhatsApp, Discord, Widget)
 * through the agent's sandbox and logging usage.
 */

import { db } from './db'
import { proxyChatToSandbox } from './sandbox'
import { chatCompletion, type LLMMessage } from './llm'
import type { Agent } from '@prisma/client'

export interface ChannelMessage {
  agentId: string
  userId: string       // external user identifier (Telegram ID, phone, Discord ID, etc.)
  text: string
  channel: string      // 'telegram' | 'whatsapp' | 'discord' | 'widget'
  conversationKey?: string  // optional unique key for conversation persistence
}

export interface ChannelResponse {
  content: string
  tokensIn: number
  tokensOut: number
}

/**
 * Model-specific cost multipliers (USD per 1K tokens).
 * These are approximate and should be updated as providers change pricing.
 */
const MODEL_COSTS: Record<string, { inputPer1K: number; outputPer1K: number }> = {
  // Groq models (free tier)
  'llama-3.3-70b-versatile': { inputPer1K: 0.00003, outputPer1K: 0.00006 },
  'mixtral-8x7b-32768': { inputPer1K: 0.00003, outputPer1K: 0.00006 },
  // OpenAI models
  'gpt-4o': { inputPer1K: 0.0025, outputPer1K: 0.01 },
  'gpt-4o-mini': { inputPer1K: 0.00015, outputPer1K: 0.0006 },
  'o4-mini': { inputPer1K: 0.0015, outputPer1K: 0.006 },
  // Anthropic models
  'claude-sonnet-4-5': { inputPer1K: 0.003, outputPer1K: 0.015 },
  'claude-opus-4-5': { inputPer1K: 0.015, outputPer1K: 0.075 },
  // NVIDIA NIM models
  'moonshotai/kimi-k2.6': { inputPer1K: 0.0006, outputPer1K: 0.002 },
  'deepseek-ai/deepseek-v4-pro': { inputPer1K: 0.0006, outputPer1K: 0.002 },
  'deepseek-ai/deepseek-v4-flash': { inputPer1K: 0.0001, outputPer1K: 0.0004 },
}

function calculateCost(model: string, tokensIn: number, tokensOut: number): number {
  const costs = MODEL_COSTS[model] || MODEL_COSTS['llama-3.3-70b-versatile']!
  return (tokensIn / 1000) * costs.inputPer1K + (tokensOut / 1000) * costs.outputPer1K
}

export async function routeChannelMessage(msg: ChannelMessage): Promise<ChannelResponse> {
  const agent = await db.agent.findUnique({ where: { id: msg.agentId } })
  if (!agent) throw new Error('Agent not found')

  let content: string
  let tokensIn = 0
  let tokensOut = 0

  if (agent.status === 'published' && agent.sandboxUrl) {
    try {
      const result = await proxyChatToSandbox(agent.sandboxUrl, {
        message: msg.text,
        conversationHistory: [],
        userId: msg.userId,
      }, agent.sandboxSecret ?? undefined)
      content = result.content
      tokensIn = result.tokensIn
      tokensOut = result.tokensOut
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      console.error(`[${msg.channel}] sandbox error:`, message)
      const result = await directLLM(agent, msg.text)
      content = result.content
      tokensIn = result.tokensIn
      tokensOut = result.tokensOut
    }
  } else {
    const result = await directLLM(agent, msg.text)
    content = result.content
    tokensIn = result.tokensIn
    tokensOut = result.tokensOut
  }

  // Log usage with channel tag and model-specific cost
  const cost = calculateCost(agent.model, tokensIn, tokensOut)
  await db.usageLog.create({
    data: { userId: agent.userId, agentId: msg.agentId, tokensIn, tokensOut, cost, model: agent.model, channel: msg.channel },
  }).catch(err => console.error('[channel-chat] Failed to log usage:', err))

  return { content, tokensIn, tokensOut }
}

async function directLLM(agent: Agent, text: string): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  try {
    const messages: LLMMessage[] = []
    if (agent.systemPrompt) messages.push({ role: 'system', content: agent.systemPrompt })
    messages.push({ role: 'user', content: text })
    const result = await chatCompletion(agent.model, messages, agent.temperature)
    return {
      content: result.content || 'Sorry, I could not generate a response.',
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error('[directLLM]', message)
    return { content: 'I encountered an error. Please try again.', tokensIn: 0, tokensOut: 0 }
  }
}
