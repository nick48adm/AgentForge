import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { proxyChatToSandbox } from '@/lib/sandbox'
import { chatLimit } from '@/lib/rate-limit'
import { chatCompletion } from '@/lib/llm'

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.response) return auth.response

  // Rate limit per user
  const limit = chatLimit(auth.user.id)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } }
    )
  }

  try {
    const { agentId, message, conversationId } = await req.json()

    if (!agentId || !message?.trim()) {
      return NextResponse.json({ error: 'agentId and message are required' }, { status: 400 })
    }

    const agent = await db.agent.findUnique({ where: { id: agentId } })
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

    if (agent.userId !== auth.user.id && agent.status !== 'published') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get or create conversation
    let conversation = conversationId
      ? await db.conversation.findUnique({ where: { id: conversationId } })
      : null

    if (!conversation) {
      conversation = await db.conversation.create({
        data: { agentId, userId: auth.user.id, title: message.slice(0, 50), messages: JSON.stringify([]) },
      })
    }

    const messages = JSON.parse(conversation.messages || '[]')
    messages.push({ role: 'user', content: message, timestamp: new Date().toISOString() })

    let assistantContent: string
    let tokensIn = 0
    let tokensOut = 0

    // Route to sandbox if published and healthy
    if (agent.status === 'published' && agent.sandboxUrl) {
      try {
        const result = await proxyChatToSandbox(agent.sandboxUrl, {
          message,
          conversationHistory: messages.slice(-20),
          userId: auth.user.id,
        })
        assistantContent = result.content
        tokensIn = result.tokensIn
        tokensOut = result.tokensOut
      } catch (e: any) {
        console.error('[chat] sandbox error, falling back:', e.message)
        assistantContent = await directLLM(agent, messages)
      }
    } else {
      // Draft / preview
      assistantContent = await directLLM(agent, messages)
    }

    const assistantMessage = { role: 'assistant', content: assistantContent, timestamp: new Date().toISOString() }
    messages.push(assistantMessage)

    await db.conversation.update({ where: { id: conversation.id }, data: { messages: JSON.stringify(messages) } })

    const cost = tokensIn * 0.00003 + tokensOut * 0.00006
    await db.usageLog.create({ data: { userId: auth.user.id, agentId, tokensIn, tokensOut, cost, model: agent.model } })

    return NextResponse.json({ conversationId: conversation.id, message: assistantMessage, usage: { tokensIn, tokensOut } })
  } catch (error: any) {
    console.error('[chat]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function directLLM(agent: any, messages: any[]): Promise<string> {
  try {
    const llmMessages: any[] = []
    if (agent.systemPrompt) llmMessages.push({ role: 'system', content: agent.systemPrompt })
    for (const m of messages.slice(-20)) {
      if (m.role === 'user' || m.role === 'assistant') llmMessages.push({ role: m.role, content: m.content })
    }
    const result = await chatCompletion(agent.model, llmMessages, agent.temperature)
    return result.content || 'Unable to generate a response.'
  } catch (e: any) {
    console.error('[chat] LLM error:', e)
    return 'I encountered an error. Please try again.'
  }
}
