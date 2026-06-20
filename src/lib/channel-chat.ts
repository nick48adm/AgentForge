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
  // NVIDIA NIM models (server-key)
  'moonshotai/kimi-k2.6': { inputPer1K: 0.0006, outputPer1K: 0.002 },
  'z-ai/glm-5.1': { inputPer1K: 0.0003, outputPer1K: 0.001 },
  'deepseek-ai/deepseek-v4-pro': { inputPer1K: 0.0006, outputPer1K: 0.002 },
  'deepseek-ai/deepseek-v4-flash': { inputPer1K: 0.0001, outputPer1K: 0.0004 },
  'meta/llama-3.3-70b-instruct': { inputPer1K: 0.0003, outputPer1K: 0.001 },
  'nvidia/llama-3.1-nemotron-ultra-253b-v1': { inputPer1K: 0.001, outputPer1K: 0.004 },
  // BYOK OpenRouter models (approximate)
  'google/gemini-2.5-pro-preview': { inputPer1K: 0.00125, outputPer1K: 0.01 },
  'google/gemini-2.5-flash-preview': { inputPer1K: 0.00015, outputPer1K: 0.0006 },
  'anthropic/claude-sonnet-4': { inputPer1K: 0.003, outputPer1K: 0.015 },
  'anthropic/claude-opus-4': { inputPer1K: 0.015, outputPer1K: 0.075 },
  'openai/gpt-4o': { inputPer1K: 0.0025, outputPer1K: 0.01 },
  'openai/o4-mini': { inputPer1K: 0.0015, outputPer1K: 0.006 },
  'deepseek/deepseek-r1': { inputPer1K: 0.0006, outputPer1K: 0.002 },
  'meta-llama/llama-4-maverick': { inputPer1K: 0.0005, outputPer1K: 0.002 },
  // BYOK Groq models (approximate — Groq charges for compute)
  'llama-3.3-70b-versatile': { inputPer1K: 0.00006, outputPer1K: 0.00006 },
  'llama-3.1-8b-instant': { inputPer1K: 0.00001, outputPer1K: 0.00001 },
  'mixtral-8x7b-32768': { inputPer1K: 0.00003, outputPer1K: 0.00006 },
  'gemma2-9b-it': { inputPer1K: 0.00002, outputPer1K: 0.00002 },
  'deepseek-r1-distill-llama-70b': { inputPer1K: 0.0001, outputPer1K: 0.0001 },
  'qwen-qwq-32b': { inputPer1K: 0.00003, outputPer1K: 0.00003 },
}

export function calculateCost(model: string, tokensIn: number, tokensOut: number): number {
  const costs = MODEL_COSTS[model] || MODEL_COSTS['deepseek-ai/deepseek-v4-flash']!
  return (tokensIn / 1000) * costs.inputPer1K + (tokensOut / 1000) * costs.outputPer1K
}

export async function routeChannelMessage(msg: ChannelMessage): Promise<ChannelResponse> {
  const agent = await db.agent.findUnique({
    where: { id: msg.agentId },
    include: { knowledgeBases: { select: { fileName: true, content: true } } },
  })
  if (!agent) throw new Error('Agent not found')

  // Build knowledge base context for system prompt
  let knowledgeContext = ''
  if (agent.knowledgeBases && agent.knowledgeBases.length > 0) {
    const knowledgeSections = agent.knowledgeBases.map((kb) => {
      const maxLen = 4000
      const truncated = kb.content.length > maxLen ? kb.content.slice(0, maxLen) + '\n[...truncated]' : kb.content
      return `--- ${kb.fileName} ---\n${truncated}`
    })
    knowledgeContext = `\n\n<knowledge-base>\n${knowledgeSections.join('\n\n')}\n</knowledge-base>\n\nWhen answering questions, reference the knowledge base above when relevant. If the answer is in the knowledge base, use that information preferentially.`
  }

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
      const result = await directLLM(agent, msg.text, knowledgeContext)
      content = result.content
      tokensIn = result.tokensIn
      tokensOut = result.tokensOut
    }
  } else {
    const result = await directLLM(agent, msg.text, knowledgeContext)
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

async function directLLM(agent: Agent, text: string, knowledgeContext: string = ''): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  try {
    const messages: LLMMessage[] = []
    if (agent.systemPrompt || knowledgeContext) {
      messages.push({ role: 'system', content: (agent.systemPrompt || '') + knowledgeContext })
    }
    messages.push({ role: 'user', content: text })
    const result = await chatCompletion(agent.model, messages, agent.temperature, undefined, agent.byokProvider, agent.byokApiKey)
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
