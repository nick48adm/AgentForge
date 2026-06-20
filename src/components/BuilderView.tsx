'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ModelSelector } from '@/components/shared/ModelSelector'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Bot,
  Send,
  Loader2,
  Rocket,
  Save,
  User,
  Sparkles,
  Settings,
  MessageSquare,
  Send as TelegramIcon,
  X,
  Check,
  AlertCircle,
  Globe,
  Webhook,
  FileText,
  Trash2,
  Upload,
  Gamepad2,
  MessageCircle,
  Code2,
  Copy,
} from 'lucide-react'

interface AgentConfig {
  id: string
  name: string
  description: string
  avatar: string | null
  systemPrompt: string
  model: string
  temperature: number
  tools: string[]
  status: string
  version: number
  byokProvider?: string | null
  byokApiKey?: string | null
  telegramConnection?: {
    botToken: string
    botUsername: string | null
    botName: string | null
    isActive: boolean
  } | null
  knowledgeBases?: { id: string; fileName: string; fileType: string }[]
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

const AVAILABLE_TOOLS = [
  { id: 'web_search', name: 'Web Search', icon: Globe, description: 'Search the internet for information' },
  { id: 'webhook', name: 'Custom Webhook', icon: Webhook, description: 'Send data to external APIs via HTTP' },
]

export function BuilderView() {
  const { user, selectedAgentId, setView } = useAppStore()
  const [agent, setAgent] = useState<AgentConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [deployError, setDeployError] = useState('')
  const deployPollRef = useRef<NodeJS.Timeout | null>(null)

  // Builder form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [model, setModel] = useState('deepseek-ai/deepseek-v4-flash')
  const [temperature, setTemperature] = useState(0.7)
  const [tools, setTools] = useState<string[]>([])
  const [byokProvider, setByokProvider] = useState<string | null>(null)
  const [byokApiKey, setByokApiKey] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'config' | 'knowledge' | 'telegram' | 'discord' | 'whatsapp' | 'widget'>('config')

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Telegram state
  const [telegramToken, setTelegramToken] = useState('')
  const [telegramConnecting, setTelegramConnecting] = useState(false)
  const [telegramError, setTelegramError] = useState('')
  const [telegramSuccess, setTelegramSuccess] = useState('')

  // Discord state
  const [discordBotToken, setDiscordBotToken] = useState('')
  const [discordGuildId, setDiscordGuildId] = useState('')
  const [discordConnecting, setDiscordConnecting] = useState(false)
  const [discordError, setDiscordError] = useState('')
  const [discordSuccess, setDiscordSuccess] = useState('')

  // WhatsApp state
  const [whatsappPhoneNumberId, setWhatsappPhoneNumberId] = useState('')
  const [whatsappAccessToken, setWhatsappAccessToken] = useState('')
  const [whatsappVerifyToken, setWhatsappVerifyToken] = useState('')
  const [whatsappConnecting, setWhatsappConnecting] = useState(false)
  const [whatsappError, setWhatsappError] = useState('')
  const [whatsappSuccess, setWhatsappSuccess] = useState('')

  // Channels state
  const [channels, setChannels] = useState<any[]>([])
  const [widgetEmbedCode, setWidgetEmbedCode] = useState<string>('')
  const [copiedEmbed, setCopiedEmbed] = useState(false)

  // Knowledge state
  const [knowledgeText, setKnowledgeText] = useState('')
  const [knowledgeName, setKnowledgeName] = useState('')
  const [knowledgeLoading, setKnowledgeLoading] = useState(false)

  useEffect(() => {
    return () => {
      if (deployPollRef.current) {
        clearInterval(deployPollRef.current)
        deployPollRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!selectedAgentId || !user?.id) return
    const aid = selectedAgentId
    const load = async () => {
      try {
        const res = await fetch(`/api/agents/${aid}`)
        if (res.ok) {
          const data = await res.json()
          setAgent(data)
          setName(data.name)
          setDescription(data.description || '')
          setSystemPrompt(data.systemPrompt || '')
          setModel(data.model || 'deepseek-ai/deepseek-v4-flash')
          setTemperature(data.temperature ?? 0.7)
          setTools(JSON.parse(data.tools || '[]'))
          setByokProvider(data.byokProvider || null)
          setByokApiKey(data.byokApiKey || null)
        }
      } catch {}
      setLoading(false)
      fetchChannels()
    }
    load()
  }, [selectedAgentId, user?.id])

  const fetchAgent = async () => {
    if (!selectedAgentId || !user?.id) return
    try {
      const res = await fetch(`/api/agents/${selectedAgentId}`)
      if (res.ok) {
        const data = await res.json()
        setAgent(data)
        setName(data.name)
        setDescription(data.description || '')
        setSystemPrompt(data.systemPrompt || '')
        setModel(data.model || 'deepseek-ai/deepseek-v4-flash')
        setTemperature(data.temperature ?? 0.7)
        setTools(JSON.parse(data.tools || '[]'))
        setByokProvider(data.byokProvider || null)
        setByokApiKey(data.byokApiKey || null)
      }
    } catch {}
  }

  const fetchChannels = async () => {
    if (!selectedAgentId) return
    try {
      const res = await fetch(`/api/channels/list/${selectedAgentId}`)
      if (res.ok) {
        const data = await res.json()
        setChannels(data.channels || [])
        if (data.widgetEmbedCode) setWidgetEmbedCode(data.widgetEmbedCode)
      }
    } catch {}
  }

  useEffect(() => {
    // Use instant scroll to avoid jank from smooth scroll on every message
    chatEndRef.current?.scrollIntoView({ behavior: chatMessages.length <= 2 ? 'smooth' : 'instant' })
  }, [chatMessages.length])

  const handleSave = async () => {
    if (!selectedAgentId || !user?.id) return
    setSaving(true)
    try {
      const res = await fetch(`/api/agents/${selectedAgentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          systemPrompt,
          model,
          temperature,
          tools,
          byokProvider,
          byokApiKey,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setAgent(updated)
      }
    } catch {}
    setSaving(false)
  }

  const pollDeployStatus = () => {
    if (deployPollRef.current) clearInterval(deployPollRef.current)
    deployPollRef.current = setInterval(async () => {
      if (!selectedAgentId) {
        if (deployPollRef.current) {
          clearInterval(deployPollRef.current)
          deployPollRef.current = null
        }
        return
      }
      try {
        const res = await fetch(`/api/agents/${selectedAgentId}`)
        if (res.ok) {
          const data = await res.json()
          setAgent(data)
          if (data.status !== 'deploying') {
            if (deployPollRef.current) {
              clearInterval(deployPollRef.current)
              deployPollRef.current = null
            }
            setDeploying(false)
          }
        }
      } catch {}
    }, 2000)
  }

  const handleDeploy = async () => {
    if (!selectedAgentId || !user?.id) return
    setDeployError('')
    setDeploying(true)
    await handleSave()
    try {
      const res = await fetch(`/api/agents/${selectedAgentId}/deploy`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        setDeployError(err.error || 'Deploy failed')
        setDeploying(false)
        return
      }
      fetchAgent()
      pollDeployStatus()
    } catch {
      setDeployError('Network error — could not start deploy')
      setDeploying(false)
    }
  }

  const handleStop = async () => {
    if (!selectedAgentId || !user?.id) return
    try {
      const res = await fetch(`/api/agents/${selectedAgentId}/stop`, { method: 'POST' })
      if (!res.ok) return
      fetchAgent()
    } catch {}
  }

  const handleChat = async () => {
    if (!chatInput.trim() || !selectedAgentId || !user?.id || chatLoading) return
    const userMsg: ChatMessage = {
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date().toISOString(),
    }
    setChatMessages((prev) => [...prev, userMsg])
    setChatInput('')
    setChatLoading(true)

    // Skip pre-save PATCH — the chat API uses the model stored in DB already.
    // Saving on every chat message doubles network requests for no user benefit.

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgentId,
          message: userMsg.content,
          ...(conversationId ? { conversationId } : {}),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.conversationId) setConversationId(data.conversationId)
        setChatMessages((prev) => [...prev, data.message])
      } else {
        setChatMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Sorry, there was an error processing your message. Please try again.',
            timestamp: new Date().toISOString(),
          },
        ])
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Connection error. Please check your network and try again.',
          timestamp: new Date().toISOString(),
        },
      ])
    }
    setChatLoading(false)
  }

  const handleTelegramConnect = async () => {
    if (!telegramToken.trim() || !selectedAgentId || !user?.id) return
    setTelegramConnecting(true)
    setTelegramError('')
    setTelegramSuccess('')

    try {
      const res = await fetch('/api/telegram/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: selectedAgentId, botToken: telegramToken }),
      })
      const data = await res.json()
      if (res.ok) {
        setTelegramSuccess(data.message)
        setTelegramToken('')
        fetchAgent()
        fetchChannels()
      } else {
        setTelegramError(data.error)
      }
    } catch {
      setTelegramError('Failed to connect. Please try again.')
    }
    setTelegramConnecting(false)
  }

  const handleTelegramDisconnect = async () => {
    if (!selectedAgentId || !user?.id) return
    try {
      await fetch('/api/telegram/disconnect', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: selectedAgentId }),
      })
      fetchAgent()
      fetchChannels()
    } catch {}
  }

  const handleDiscordConnect = async () => {
    if (!discordBotToken.trim() || !selectedAgentId || !user?.id) return
    setDiscordConnecting(true)
    setDiscordError('')
    setDiscordSuccess('')

    try {
      const res = await fetch('/api/channels/discord/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: selectedAgentId, botToken: discordBotToken, guildId: discordGuildId || undefined }),
      })
      const data = await res.json()
      if (res.ok) {
        setDiscordSuccess(data.message || 'Discord bot connected successfully')
        setDiscordBotToken('')
        setDiscordGuildId('')
        fetchAgent()
        fetchChannels()
      } else {
        setDiscordError(data.error || 'Failed to connect')
      }
    } catch {
      setDiscordError('Failed to connect. Please try again.')
    }
    setDiscordConnecting(false)
  }

  const handleDiscordDisconnect = async () => {
    if (!selectedAgentId || !user?.id) return
    try {
      await fetch('/api/channels/discord/connect', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: selectedAgentId }),
      })
      fetchAgent()
      fetchChannels()
    } catch {}
  }

  const handleWhatsappConnect = async () => {
    if (!whatsappPhoneNumberId.trim() || !whatsappAccessToken.trim() || !whatsappVerifyToken.trim() || !selectedAgentId || !user?.id) return
    setWhatsappConnecting(true)
    setWhatsappError('')
    setWhatsappSuccess('')

    try {
      const res = await fetch('/api/channels/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgentId,
          phoneNumberId: whatsappPhoneNumberId,
          accessToken: whatsappAccessToken,
          verifyToken: whatsappVerifyToken,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setWhatsappSuccess(data.message || 'WhatsApp connected successfully')
        setWhatsappPhoneNumberId('')
        setWhatsappAccessToken('')
        setWhatsappVerifyToken('')
        fetchAgent()
        fetchChannels()
      } else {
        setWhatsappError(data.error || 'Failed to connect')
      }
    } catch {
      setWhatsappError('Failed to connect. Please try again.')
    }
    setWhatsappConnecting(false)
  }

  const handleWhatsappDisconnect = async () => {
    if (!selectedAgentId || !user?.id) return
    try {
      await fetch('/api/channels/whatsapp/connect', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: selectedAgentId }),
      })
      fetchAgent()
      fetchChannels()
    } catch {}
  }

  const copyEmbedCode = () => {
    navigator.clipboard.writeText(widgetEmbedCode)
    setCopiedEmbed(true)
    setTimeout(() => setCopiedEmbed(false), 2000)
  }

  const discordChannel = channels.find((c: any) => c.type === 'discord' || c.channelType === 'discord')
  const whatsappChannel = channels.find((c: any) => c.type === 'whatsapp' || c.channelType === 'whatsapp')

  const handleKnowledgeUpload = async () => {
    if (!knowledgeText.trim() || !knowledgeName.trim() || !selectedAgentId || !user?.id) return
    setKnowledgeLoading(true)
    try {
      await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgentId,
          fileName: knowledgeName,
          fileType: 'text',
          content: knowledgeText,
        }),
      })
      setKnowledgeText('')
      setKnowledgeName('')
      fetchAgent()
    } catch {}
    setKnowledgeLoading(false)
  }

  const handleKnowledgeDelete = async (id: string) => {
    if (!user?.id) return
    try {
      await fetch(`/api/knowledge/${id}`, { method: 'DELETE' })
      fetchAgent()
    } catch {}
    setKnowledgeLoading(false)
  }

  const toggleTool = useCallback((toolId: string) => {
    setTools((prev) =>
      prev.includes(toolId)
        ? prev.filter((t) => t !== toolId)
        : [...prev, toolId]
    )
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <AlertCircle className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Agent not found</p>
        <Button variant="outline" size="sm" onClick={() => setView('dashboard')} className="text-xs h-8">
          Back to Dashboard
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-52px)]">
      {/* Top Bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/30">
        <Button variant="ghost" size="icon" onClick={() => setView('dashboard')} className="h-7 w-7">
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center text-xs font-semibold">
            {name.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <h2 className="font-medium text-xs">{name || 'Untitled Agent'}</h2>
            <p className="text-[10px] text-muted-foreground font-mono">
              {model} · v{agent.version} ·{' '}
              <span className={
                agent.status === 'published' ? 'text-foreground' :
                agent.status === 'deploying' ? 'text-muted-foreground' :
                agent.status === 'stopped' ? 'text-red-400' : 'text-muted-foreground'
              }>
                {agent.status}
              </span>
            </p>
          </div>
        </div>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={handleSave} disabled={saving} className="h-7 text-[11px]">
          {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
          Save
        </Button>
        {agent.status === 'published' ? (
          <Button variant="outline" size="sm" onClick={handleStop} className="h-7 text-[11px] text-red-400">
            <X className="h-3 w-3 mr-1" />
            Stop
          </Button>
        ) : agent.status === 'deploying' ? (
          <Button size="sm" disabled className="h-7 text-[11px] bg-muted text-muted-foreground cursor-not-allowed">
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
            Deploying...
          </Button>
        ) : (
          <Button
            size="sm"
            className="bg-foreground text-background hover:bg-foreground/90 h-7 text-[11px]"
            onClick={handleDeploy}
            disabled={deploying}
          >
            {deploying ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Rocket className="h-3 w-3 mr-1" />
            )}
            Publish
          </Button>
        )}
        {deployError && (
          <span className="text-[10px] text-red-400 ml-2">{deployError}</span>
        )}
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
        {/* Left Panel — Settings */}
        <div className="w-full lg:w-[400px] border-r overflow-y-auto bg-background">
          {/* Tab Navigation */}
          <div className="flex border-b px-2 pt-1.5">
            {[
              { id: 'config' as const, label: 'Config', icon: Settings },
              { id: 'knowledge' as const, label: 'Knowledge', icon: FileText },
              { id: 'telegram' as const, label: 'Telegram', icon: TelegramIcon },
              { id: 'discord' as const, label: 'Discord', icon: Gamepad2 },
              { id: 'whatsapp' as const, label: 'WhatsApp', icon: MessageCircle },
              { id: 'widget' as const, label: 'Widget', icon: Code2 },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground/70'
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-5">
            {/* Config Tab */}
            {activeTab === 'config' && (
              <>
                {/* Name */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Agent Name</Label>
                  <Input
                    placeholder="e.g., Support Bot"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Description</Label>
                  <Textarea
                    placeholder="What does this agent do?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>

                {/* System Prompt */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">System Prompt / Personality</Label>
                  <Textarea
                    placeholder="You are a helpful customer support agent for Acme Inc. You are friendly, professional, and always provide accurate information..."
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={6}
                    className="font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {systemPrompt.length} characters
                  </p>
                </div>

                {/* Model */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Model</Label>
                  <ModelSelector
                    value={model}
                    onChange={(newModel) => {
                      setModel(newModel)
                      setChatMessages([])
                      setConversationId(null)
                    }}
                    byokProvider={byokProvider}
                    onByokProviderChange={setByokProvider}
                    byokApiKey={byokApiKey}
                    onByokApiKeyChange={setByokApiKey}
                  />
                </div>

                {/* Temperature */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Temperature</Label>
                    <span className="text-xs text-muted-foreground font-mono">{temperature.toFixed(1)}</span>
                  </div>
                  <Slider
                    value={[temperature]}
                    onValueChange={([v]) => setTemperature(v)}
                    min={0}
                    max={2}
                    step={0.1}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Lower = more focused, Higher = more creative
                  </p>
                </div>

                {/* Tools */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Tools</Label>
                  <div className="space-y-1.5">
                    {AVAILABLE_TOOLS.map((tool) => (
                      <div
                        key={tool.id}
                        className="flex items-center justify-between rounded-md border border-border/50 p-2.5"
                      >
                        <div className="flex items-center gap-2.5">
                          <tool.icon className="h-3.5 w-3.5 text-muted-foreground" />
                          <div>
                            <div className="text-xs font-medium">{tool.name}</div>
                            <div className="text-[10px] text-muted-foreground">{tool.description}</div>
                          </div>
                        </div>
                        <Switch
                          checked={tools.includes(tool.id)}
                          onCheckedChange={() => toggleTool(tool.id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Knowledge Tab */}
            {activeTab === 'knowledge' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Upload Knowledge</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Add text content that your agent can reference. Each entry is stored in an isolated namespace.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <Input
                    placeholder="Document name (e.g., FAQ, Product Docs)"
                    value={knowledgeName}
                    onChange={(e) => setKnowledgeName(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Textarea
                    placeholder="Paste your knowledge base content here..."
                    value={knowledgeText}
                    onChange={(e) => setKnowledgeText(e.target.value)}
                    rows={6}
                    className="text-sm"
                  />
                  <Button
                    onClick={handleKnowledgeUpload}
                    className="w-full bg-foreground text-background hover:bg-foreground/90 h-8 text-xs"
                    disabled={knowledgeLoading || !knowledgeText.trim() || !knowledgeName.trim()}
                  >
                    {knowledgeLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                    ) : (
                      <Upload className="h-3 w-3 mr-1.5" />
                    )}
                    Upload Knowledge
                  </Button>
                </div>

                <Separator />

                {/* Existing knowledge bases */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Uploaded Documents</Label>
                  {(!agent.knowledgeBases || agent.knowledgeBases.length === 0) ? (
                    <p className="text-[10px] text-muted-foreground py-4 text-center">
                      No documents uploaded yet
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {agent.knowledgeBases.map((kb) => (
                        <div
                          key={kb.id}
                          className="flex items-center justify-between rounded-md border border-border/50 p-2.5"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                            <div>
                              <div className="text-xs font-medium">{kb.fileName}</div>
                              <div className="text-[10px] text-muted-foreground">{kb.fileType}</div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-400 hover:text-red-500"
                            onClick={() => handleKnowledgeDelete(kb.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Telegram Tab */}
            {activeTab === 'telegram' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Connect to Telegram</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Connect your agent to a Telegram bot so users can chat with it from their phone.
                  </p>
                </div>

                {/* How to set up */}
                <div className="rounded-md border border-border/50 p-3 space-y-2">
                  <div className="text-xs font-medium">Setup Steps:</div>
                  <ol className="space-y-1.5 text-[10px] text-muted-foreground">
                    {[
                      'Open Telegram and search for @BotFather',
                      'Send /newbot and follow the prompts',
                      'Copy the bot token BotFather gives you',
                      'Paste it below and click Connect',
                    ].map((step, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border text-[9px] font-mono">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Current connection status */}
                {agent.telegramConnection ? (
                  <div className="rounded-md border border-border/50 p-3">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <TelegramIcon className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="font-medium text-xs">
                          @{agent.telegramConnection.botUsername || 'Unknown Bot'}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {agent.telegramConnection.botName || 'Telegram Bot'}
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className={
                          agent.telegramConnection.isActive
                            ? 'bg-foreground text-background ml-auto text-[10px]'
                            : 'bg-muted text-muted-foreground ml-auto text-[10px]'
                        }
                      >
                        {agent.telegramConnection.isActive ? 'Active' : 'Pending'}
                      </Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-red-400 hover:text-red-500 h-7 text-[11px]"
                      onClick={handleTelegramDisconnect}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Disconnect Bot
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <Input
                      placeholder="Paste your Telegram bot token..."
                      value={telegramToken}
                      onChange={(e) => {
                        setTelegramToken(e.target.value)
                        setTelegramError('')
                        setTelegramSuccess('')
                      }}
                      type="password"
                      className="h-8 text-sm"
                    />
                    {telegramError && (
                      <p className="text-[10px] text-red-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {telegramError}
                      </p>
                    )}
                    {telegramSuccess && (
                      <p className="text-[10px] text-foreground flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        {telegramSuccess}
                      </p>
                    )}
                    <Button
                      onClick={handleTelegramConnect}
                      className="w-full bg-foreground text-background hover:bg-foreground/90 h-8 text-xs"
                      disabled={telegramConnecting || !telegramToken.trim()}
                    >
                      {telegramConnecting ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                      ) : (
                        <TelegramIcon className="h-3 w-3 mr-1.5" />
                      )}
                      Connect Bot
                    </Button>
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground">
                  The webhook will be automatically configured when you publish your agent.
                  Messages sent to your Telegram bot will be forwarded to this agent.
                </p>
              </>
            )}

            {/* Discord Tab */}
            {activeTab === 'discord' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Connect to Discord</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Connect your agent to a Discord bot so it can respond to messages in your server.
                  </p>
                </div>

                {/* Setup instructions */}
                <div className="rounded-md border border-border/50 p-3 space-y-2">
                  <div className="text-xs font-medium">Setup Steps:</div>
                  <ol className="space-y-1.5 text-[10px] text-muted-foreground">
                    {[
                      'Go to discord.com/developers and create a New Application',
                      'Navigate to the Bot section and click "Add Bot"',
                      'Copy the Bot Token from the bot page',
                      'Enable MESSAGE CONTENT INTENT under Privileged Gateway Intents',
                      'Optional: Enter your Guild/Server ID to restrict to one server',
                      'Set the Interactions Endpoint URL to your agent\'s webhook after publishing',
                      'Paste the bot token below and click Connect Bot',
                    ].map((step, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border text-[9px] font-mono">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Current connection status */}
                {discordChannel ? (
                  <div className="rounded-md border border-border/50 p-3">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <Gamepad2 className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="font-medium text-xs">
                          {discordChannel.botUsername || discordChannel.username || 'Discord Bot'}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {discordChannel.guildId ? `Guild: ${discordChannel.guildId}` : 'Connected'}
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className="bg-foreground text-background ml-auto text-[10px]"
                      >
                        Active
                      </Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-red-400 hover:text-red-500 h-7 text-[11px]"
                      onClick={handleDiscordDisconnect}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Disconnect Bot
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <Input
                      placeholder="Bot Token"
                      value={discordBotToken}
                      onChange={(e) => {
                        setDiscordBotToken(e.target.value)
                        setDiscordError('')
                        setDiscordSuccess('')
                      }}
                      type="password"
                      className="h-8 text-sm"
                    />
                    <Input
                      placeholder="Guild/Server ID (optional)"
                      value={discordGuildId}
                      onChange={(e) => {
                        setDiscordGuildId(e.target.value)
                        setDiscordError('')
                        setDiscordSuccess('')
                      }}
                      className="h-8 text-sm"
                    />
                    {discordError && (
                      <p className="text-[10px] text-red-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {discordError}
                      </p>
                    )}
                    {discordSuccess && (
                      <p className="text-[10px] text-foreground flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        {discordSuccess}
                      </p>
                    )}
                    <Button
                      onClick={handleDiscordConnect}
                      className="w-full bg-foreground text-background hover:bg-foreground/90 h-8 text-xs"
                      disabled={discordConnecting || !discordBotToken.trim()}
                    >
                      {discordConnecting ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                      ) : (
                        <Gamepad2 className="h-3 w-3 mr-1.5" />
                      )}
                      Connect Bot
                    </Button>
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground">
                  The interactions endpoint URL will be configured automatically when you publish your agent.
                  Make sure to enable the Message Content Intent in the Discord Developer Portal.
                </p>
              </>
            )}

            {/* WhatsApp Tab */}
            {activeTab === 'whatsapp' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Connect to WhatsApp</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Connect your agent to WhatsApp Business API so customers can chat with it directly.
                  </p>
                </div>

                {/* Setup instructions */}
                <div className="rounded-md border border-border/50 p-3 space-y-2">
                  <div className="text-xs font-medium">Setup Steps:</div>
                  <ol className="space-y-1.5 text-[10px] text-muted-foreground">
                    {[
                      'Go to business.facebook.com and create a Business Account',
                      'Navigate to WhatsApp Manager and create a Phone Number',
                      'Go to API Setup and copy the Phone Number ID',
                      'Generate a Permanent Access Token from System Users',
                      'Set a Verify Token (any custom string you choose)',
                      'Configure the webhook URL to your agent\'s endpoint after publishing',
                      'Enter the credentials below and click Connect',
                    ].map((step, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border text-[9px] font-mono">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Current connection status */}
                {whatsappChannel ? (
                  <div className="rounded-md border border-border/50 p-3">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <MessageCircle className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="font-medium text-xs">
                          {whatsappChannel.phoneNumberId || whatsappChannel.phoneNumber || 'WhatsApp Bot'}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Connected via WhatsApp Business API
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className="bg-foreground text-background ml-auto text-[10px]"
                      >
                        Active
                      </Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-red-400 hover:text-red-500 h-7 text-[11px]"
                      onClick={handleWhatsappDisconnect}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <Input
                      placeholder="Phone Number ID"
                      value={whatsappPhoneNumberId}
                      onChange={(e) => {
                        setWhatsappPhoneNumberId(e.target.value)
                        setWhatsappError('')
                        setWhatsappSuccess('')
                      }}
                      className="h-8 text-sm"
                    />
                    <Input
                      placeholder="Access Token"
                      value={whatsappAccessToken}
                      onChange={(e) => {
                        setWhatsappAccessToken(e.target.value)
                        setWhatsappError('')
                        setWhatsappSuccess('')
                      }}
                      type="password"
                      className="h-8 text-sm"
                    />
                    <Input
                      placeholder="Verify Token (custom string)"
                      value={whatsappVerifyToken}
                      onChange={(e) => {
                        setWhatsappVerifyToken(e.target.value)
                        setWhatsappError('')
                        setWhatsappSuccess('')
                      }}
                      className="h-8 text-sm"
                    />
                    {whatsappError && (
                      <p className="text-[10px] text-red-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {whatsappError}
                      </p>
                    )}
                    {whatsappSuccess && (
                      <p className="text-[10px] text-foreground flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        {whatsappSuccess}
                      </p>
                    )}
                    <Button
                      onClick={handleWhatsappConnect}
                      className="w-full bg-foreground text-background hover:bg-foreground/90 h-8 text-xs"
                      disabled={whatsappConnecting || !whatsappPhoneNumberId.trim() || !whatsappAccessToken.trim() || !whatsappVerifyToken.trim()}
                    >
                      {whatsappConnecting ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                      ) : (
                        <MessageCircle className="h-3 w-3 mr-1.5" />
                      )}
                      Connect
                    </Button>
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground">
                  The webhook URL will be configured automatically when you publish your agent.
                  Make sure your WhatsApp Business API account is approved and out of the sandbox.
                </p>
              </>
            )}

            {/* Widget Tab */}
            {activeTab === 'widget' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Chat Widget</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Embed a chat widget on any website to let visitors interact with your agent.
                  </p>
                </div>

                {/* Setup instructions */}
                <div className="rounded-md border border-border/50 p-3 space-y-2">
                  <div className="text-xs font-medium">How to Embed:</div>
                  <ol className="space-y-1.5 text-[10px] text-muted-foreground">
                    {[
                      'Publish your agent first to generate the embed code',
                      'Copy the embed script below',
                      'Paste it into your website\'s HTML before the closing </body> tag',
                      'The chat widget will appear as a floating button in the bottom-right corner',
                    ].map((step, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border text-[9px] font-mono">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Embed code */}
                {agent.status === 'published' && widgetEmbedCode ? (
                  <div className="space-y-2.5">
                    <div className="relative">
                      <pre className="rounded-md border border-border/50 bg-muted/50 p-3 text-[10px] font-mono text-muted-foreground overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap break-all">
                        {widgetEmbedCode}
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2 h-6 w-6 p-0"
                        onClick={copyEmbedCode}
                      >
                        {copiedEmbed ? (
                          <Check className="h-3 w-3 text-foreground" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-7 text-[11px]"
                      onClick={copyEmbedCode}
                    >
                      {copiedEmbed ? (
                        <Check className="h-3 w-3 mr-1 text-foreground" />
                      ) : (
                        <Copy className="h-3 w-3 mr-1" />
                      )}
                      {copiedEmbed ? 'Copied!' : 'Copy Embed Code'}
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-md border border-border/50 p-4 text-center">
                    <Code2 className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-[10px] text-muted-foreground">
                      {agent.status === 'published'
                        ? 'No embed code available yet. Try refreshing.'
                        : 'Publish your agent first to generate the widget embed code.'}
                    </p>
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground">
                  The widget is fully customizable. You can modify the appearance by adding data attributes to the script tag.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Right Panel — Chat Preview */}
        <div className="flex-1 flex flex-col bg-muted/10">
          {/* Chat Header */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-background">
            <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-xs font-medium">Chat Preview</h3>
              <p className="text-[10px] text-muted-foreground">Test your agent before publishing</p>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-20">
                <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center mb-4">
                  <Bot className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-medium mb-1">{name || 'Your Agent'}</h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Start a conversation to test how your agent responds. Configure its personality in the settings panel.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-w-2xl mx-auto">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`flex gap-2 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      <div
                        className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${
                          msg.role === 'user'
                            ? 'bg-foreground text-background'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {msg.role === 'user' ? (
                          <User className="h-3 w-3" />
                        ) : (
                          <Bot className="h-3 w-3" />
                        )}
                      </div>
                      <div
                        className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-foreground text-background rounded-br-sm'
                            : 'bg-muted rounded-bl-sm'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="flex gap-2 max-w-[80%]">
                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                        <Bot className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div className="bg-muted rounded-lg rounded-bl-sm px-3 py-2">
                        <div className="flex gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Chat Input */}
          <div className="border-t p-3 bg-background">
            <div className="flex gap-2 max-w-2xl mx-auto">
              <Input
                placeholder="Type a message to test your agent..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleChat()}
                disabled={chatLoading}
                className="flex-1 h-8 text-sm"
              />
              <Button
                onClick={handleChat}
                disabled={chatLoading || !chatInput.trim()}
                className="bg-foreground text-background hover:bg-foreground/90 h-8 w-8"
                size="icon"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
