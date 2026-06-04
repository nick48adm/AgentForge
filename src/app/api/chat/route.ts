import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { proxyChatToSandbox } from '@/lib/sandbox'
import { chatLimit } from '@/lib/rate-limit'
import { chatCompletion, type LLMMessage } from '@/lib/llm'
import { chatSchema } from '@/lib/validations'
import { calculateCost } from '@/lib/channel-chat'
import { executeTool, getEnabledToolDefs } from '@/lib/tools'

const MAX_TOOL_ROUNDS = 5

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
    const body = await req.json()
    const parsed = chatSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      )
    }
    const { agentId, message, conversationId } = parsed.data

    const agent = await db.agent.findUnique({
      where: { id: agentId },
      include: { knowledgeBases: { select: { fileName: true, content: true } } },
    })
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
        data: { agentId, userId: auth.user.id, title: message.slice(0, 50), messages: [] },
      })
    }

    const messages: Array<Record<string, unknown>> = Array.isArray(conversation.messages) ? (conversation.messages as Array<Record<string, unknown>>) : []
    messages.push({ role: 'user', content: message, timestamp: new Date().toISOString() })

    // Build knowledge base context for system prompt
    let knowledgeContext = ''
    if (agent.knowledgeBases && agent.knowledgeBases.length > 0) {
      const knowledgeSections = agent.knowledgeBases.map((kb, i) => {
        const maxLen = 4000
        const truncated = kb.content.length > maxLen ? kb.content.slice(0, maxLen) + '\n[...truncated]' : kb.content
        return `--- ${kb.fileName} ---\n${truncated}`
      })
      knowledgeContext = `\n\n<knowledge-base>\n${knowledgeSections.join('\n\n')}\n</knowledge-base>\n\nWhen answering questions, reference the knowledge base above when relevant. If the answer is in the knowledge base, use that information preferentially.`
    }

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
        }, agent.sandboxSecret ?? undefined)
        assistantContent = result.content
        tokensIn = result.tokensIn
        tokensOut = result.tokensOut
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : 'Unknown error'
        console.error('[chat] sandbox error, falling back:', errMsg)
        const result = await directLLMWithTools(agent.systemPrompt, agent.model, agent.temperature, messages, knowledgeContext, agent.tools as string[])
        assistantContent = result.content
        tokensIn = result.tokensIn
        tokensOut = result.tokensOut
      }
    } else {
      // Draft / preview — with tool execution
      const result = await directLLMWithTools(agent.systemPrompt, agent.model, agent.temperature, messages, knowledgeContext, agent.tools as string[])
      assistantContent = result.content
      tokensIn = result.tokensIn
      tokensOut = result.tokensOut
    }

    const assistantMessage = { role: 'assistant', content: assistantContent, timestamp: new Date().toISOString() }
    messages.push(assistantMessage)

    // Cap stored messages at 200 to prevent unbounded growth
    const cappedMessages = messages.length > 200 ? messages.slice(-200) : messages
    await db.conversation.update({ where: { id: conversation.id }, data: { messages: cappedMessages as any } })

    const cost = calculateCost(agent.model, tokensIn, tokensOut)
    await db.usageLog.create({ data: { userId: auth.user.id, agentId, tokensIn, tokensOut, cost, model: agent.model } })

    return NextResponse.json({ conversationId: conversation.id, message: assistantMessage, usage: { tokensIn, tokensOut } })
  } catch (error: unknown) {
    console.error('[chat]', error)
    return NextResponse.json({ error: 'Failed to process chat message' }, { status: 500 })
  }
}


async function directLLMWithTools(
  systemPrompt: string,
  model: string,
  temperature: number,
  messages: Array<Record<string, unknown>>,
  knowledgeContext: string,
  agentTools: unknown,
): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  // Parse enabled tools
  let enabledTools: string[] = []
  try {
    enabledTools = Array.isArray(agentTools) ? agentTools : JSON.parse(String(agentTools || '[]'))
  } catch { enabledTools = [] }

  // If no tools enabled, use the simple direct LLM path
  if (enabledTools.length === 0) {
    return directLLM(systemPrompt, model, temperature, messages, knowledgeContext)
  }

  // Build LLM messages with tool support
  const llmMessages: LLMMessage[] = []
  if (systemPrompt || knowledgeContext) {
    llmMessages.push({ role: 'system', content: (systemPrompt || '') + knowledgeContext })
  }
  for (const m of messages.slice(-20)) {
    const role = String(m.role ?? '')
    const content = String(m.content ?? '')
    if (role === 'user' || role === 'assistant') llmMessages.push({ role, content })
  }

  const toolDefs = getEnabledToolDefs(enabledTools)
  let totalTokensIn = 0
  let totalTokensOut = 0

  // Agentic tool loop — up to MAX_TOOL_ROUNDS rounds
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    try {
      const result = await chatCompletion(model, llmMessages, temperature, toolDefs.length > 0 ? toolDefs : undefined)
      totalTokensIn += result.tokensIn
      totalTokensOut += result.tokensOut

      // If no tool calls, return the response directly
      if (!result.toolCalls || result.toolCalls.length === 0) {
        return {
          content: result.content || 'Unable to generate a response.',
          tokensIn: totalTokensIn,
          tokensOut: totalTokensOut,
        }
      }

      // Process tool calls
      llmMessages.push({
        role: 'assistant',
        content: result.content || '',
        tool_calls: result.toolCalls,
      })

      for (const tc of result.toolCalls) {
        let args: Record<string, unknown> = {}
        try { args = JSON.parse(tc.function.arguments) } catch {}
        const toolResult = await executeTool(tc.function.name, args)

        llmMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(toolResult),
        })
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      console.error('[chat] LLM with tools error:', msg)
      // Fall back to simple LLM call without tools
      return directLLM(systemPrompt, model, temperature, messages, knowledgeContext)
    }
  }

  return { content: 'Maximum tool call rounds reached. Please try a simpler query.', tokensIn: totalTokensIn, tokensOut: totalTokensOut }
}


async function directLLM(
  systemPrompt: string,
  model: string,
  temperature: number,
  messages: Array<Record<string, unknown>>,
  knowledgeContext: string,
): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  try {
    const llmMessages: LLMMessage[] = []
    if (systemPrompt || knowledgeContext) {
      llmMessages.push({ role: 'system', content: (systemPrompt || '') + knowledgeContext })
    }
    for (const m of messages.slice(-20)) {
      const role = String(m.role ?? '')
      const content = String(m.content ?? '')
      if (role === 'user' || role === 'assistant') llmMessages.push({ role, content })
    }
    const result = await chatCompletion(model, llmMessages, temperature)
    return {
      content: result.content || 'Unable to generate a response.',
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error('[chat] LLM error:', message)
    return { content: 'I encountered an error. Please try again.', tokensIn: 0, tokensOut: 0 }
  }
}
