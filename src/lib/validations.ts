/**
 * validations.ts
 * Shared Zod schemas for API request validation.
 */

import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long'),
  name: z.string().max(100, 'Name too long').optional(),
})

export const createAgentSchema = z.object({
  name: z.string().min(1, 'Agent name is required').max(100, 'Name too long').trim(),
  description: z.string().max(500, 'Description too long').optional(),
  systemPrompt: z.string().max(10000, 'System prompt too long').optional(),
  model: z.string().max(100).optional(),
  temperature: z.number().min(0).max(2).optional(),
  tools: z.array(z.string()).optional(),
  avatar: z.string().max(500).optional(),
})

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).optional(),
  systemPrompt: z.string().max(10000).optional(),
  model: z.string().max(100).optional(),
  temperature: z.number().min(0).max(2).optional(),
  tools: z.array(z.string()).optional(),
  avatar: z.string().max(500).nullable().optional(),
})

export const chatSchema = z.object({
  agentId: z.string().min(1, 'agentId is required'),
  message: z.string().min(1, 'message is required').max(10000, 'Message too long').trim(),
  conversationId: z.string().nullable().optional(),
})

export const knowledgeSchema = z.object({
  agentId: z.string().min(1, 'agentId is required'),
  fileName: z.string().min(1, 'fileName is required').max(255, 'File name too long'),
  fileType: z.string().max(50).optional(),
  content: z.string().min(1, 'content is required').max(500_000, 'File content too large (max 500KB)'),
})

export const widgetChatSchema = z.object({
  message: z.string().min(1, 'message is required').max(10000).trim(),
  conversationId: z.string().nullable().optional(),
  userId: z.string().max(200).optional(),
})
