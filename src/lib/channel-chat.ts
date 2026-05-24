/**
 * channel-chat.ts
 * Shared logic for routing a message from any channel (Telegram, WhatsApp, Discord, Widget)
 * through the agent's sandbox and logging usage.
 */

import { db } from './db'
import { proxyChatToSandbox } from './sandbox'
import { chatCompletion } from './llm'

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
      })
      content = result.content
      tokensIn = result.tokensIn
      tokensOut = result.tokensOut
    } catch (e: any) {
      console.error(`[${msg.channel}] sandbox error:`, e.message)
      content = await directLLM(agent, msg.text)
    }
  } else {
    content = await directLLM(agent, msg.text)
  }

  // Log usage with channel tag
  const cost = tokensIn * 0.00003 + tokensOut * 0.00006
  await db.usageLog.create({
    data: { userId: agent.userId, agentId: msg.agentId, tokensIn, tokensOut, cost, model: agent.model, channel: msg.channel },
  }).catch(console.error)

  return { content, tokensIn, tokensOut }
}

async function directLLM(agent: any, text: string): Promise<string> {
  try {
    const messages: any[] = []
    if (agent.systemPrompt) messages.push({ role: 'system', content: agent.systemPrompt })
    messages.push({ role: 'user', content: text })
    const result = await chatCompletion(agent.model, messages, agent.temperature)
    return result.content || 'Sorry, I could not generate a response.'
  } catch (e: any) {
    console.error('[directLLM]', e.message)
    return 'I encountered an error. Please try again.'
  }
}
