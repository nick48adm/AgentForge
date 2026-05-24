'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ModelSelector } from "@/components/shared/ModelSelector";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ChatMessage, ChatMessageData } from "@/components/shared/ChatMessage";
import { ChatInput } from "@/components/shared/ChatInput";
import { TelegramConnectDialog } from "@/components/shared/TelegramConnectDialog";
import {
  ArrowLeft,
  Save,
  Rocket,
  Bot,
  Settings,
  MessageSquare,
  BookOpen,
  Smartphone,
  Loader2,
  Upload,
  Trash2,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export function BuilderView() {
  const { selectedAgentId, setView } = useAppStore();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch agent details
  const { data: agent, isLoading } = useQuery({
    queryKey: ["agent", selectedAgentId],
    queryFn: async () => {
      if (!selectedAgentId) return null;
      const res = await fetch(`/api/agents/${selectedAgentId}`);
      if (!res.ok) throw new Error("Failed to fetch agent");
      return res.json();
    },
    enabled: !!selectedAgentId,
  });

  // Fetch knowledge bases
  const { data: knowledgeBases = [] } = useQuery({
    queryKey: ["knowledge", selectedAgentId],
    queryFn: async () => {
      if (!selectedAgentId) return [];
      const res = await fetch(`/api/knowledge?agentId=${selectedAgentId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedAgentId,
  });

  // Form state
  const [form, setForm] = useState({
    name: "",
    description: "",
    avatar: "",
    systemPrompt: "",
    model: "llama-3.3-70b-versatile",
    temperature: 0.7,
    tools: [] as string[],
  });

  // Update form when agent data loads
  useEffect(() => {
    if (agent) {
      setForm({
        name: agent.name || "",
        description: agent.description || "",
        avatar: agent.avatar || "",
        systemPrompt: agent.systemPrompt || "",
        model: agent.model || "llama-3.3-70b-versatile",
        temperature: agent.temperature ?? 0.7,
        tools: JSON.parse(agent.tools || "[]"),
      });

      // Load last conversation
      if (agent.conversations?.length > 0) {
        const lastConv = agent.conversations[0];
        setConversationId(lastConv.id);
        try {
          const msgs = JSON.parse(lastConv.messages);
          setMessages(msgs);
        } catch {
          setMessages([]);
        }
      }
    }
  }, [agent]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Save agent mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/agents/${selectedAgentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent", selectedAgentId] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast.success("Agent saved");
    },
    onError: () => {
      toast.error("Failed to save agent");
    },
  });

  // Deploy mutation
  const deployMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/agents/${selectedAgentId}/deploy`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to deploy");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent", selectedAgentId] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast.success("Deployment started!");
    },
    onError: () => {
      toast.error("Failed to deploy");
    },
  });

  // Send chat message
  const handleSendMessage = useCallback(
    async (message: string) => {
      const userMsg: ChatMessageData = {
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsChatLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: selectedAgentId,
            message,
            conversationId,
          }),
        });

        if (!res.ok) throw new Error("Chat failed");
        const data = await res.json();

        setConversationId(data.conversationId);
        setMessages((prev) => [...prev, data.message]);
      } catch (err) {
        const errorMsg: ChatMessageData = {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        toast.error("Failed to send message");
      } finally {
        setIsChatLoading(false);
      }
    },
    [selectedAgentId, conversationId]
  );

  // Knowledge upload mutation
  const knowledgeUploadMutation = useMutation({
    mutationFn: async ({
      fileName,
      fileType,
      content,
    }: {
      fileName: string;
      fileType: string;
      content: string;
    }) => {
      const formData = new FormData();
      formData.append("agentId", selectedAgentId || "");
      formData.append("fileName", fileName);
      formData.append("fileType", fileType);
      formData.append("content", content);
      const res = await fetch("/api/knowledge", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["knowledge", selectedAgentId],
      });
      toast.success("Knowledge uploaded");
    },
    onError: () => {
      toast.error("Failed to upload knowledge");
    },
  });

  // Delete knowledge mutation
  const knowledgeDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/knowledge/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["knowledge", selectedAgentId],
      });
      toast.success("Knowledge deleted");
    },
  });

  // Telegram connect/disconnect
  const telegramConnectMutation = useMutation({
    mutationFn: async ({
      agentId,
      botToken,
    }: {
      agentId: string;
      botToken: string;
    }) => {
      const res = await fetch("/api/telegram/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, botToken }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to connect");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent", selectedAgentId] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast.success("Telegram bot connected!");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const telegramDisconnectMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const res = await fetch("/api/telegram/disconnect", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      if (!res.ok) throw new Error("Failed to disconnect");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent", selectedAgentId] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast.success("Telegram bot disconnected");
    },
  });

  const toggleTool = (toolName: string) => {
    setForm((prev) => ({
      ...prev,
      tools: prev.tools.includes(toolName)
        ? prev.tools.filter((t) => t !== toolName)
        : [...prev.tools, toolName],
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      knowledgeUploadMutation.mutate({
        fileName: file.name,
        fileType: file.name.endsWith(".pdf")
          ? "pdf"
          : file.name.endsWith(".url")
          ? "url"
          : "text",
        content,
      });
    };
    reader.readAsText(file);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <p className="text-muted-foreground">Agent not found</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)]">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Left Panel - Settings */}
        <ResizablePanel defaultSize={45} minSize={30}>
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setView("dashboard")}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-sm">{form.name || "Agent"}</h2>
                    <StatusBadge status={agent.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    v{agent.version} · {agent.model}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="gap-1.5"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                  Save
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    saveMutation.mutate();
                    setTimeout(() => deployMutation.mutate(), 500);
                  }}
                  disabled={deployMutation.isPending || agent.status === "published"}
                  className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                >
                  {deployMutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Rocket className="w-3 h-3" />
                  )}
                  Publish
                </Button>
              </div>
            </div>

            {/* Settings Tabs */}
            <ScrollArea className="flex-1">
              <Tabs defaultValue="general" className="w-full">
                <div className="px-4 pt-3">
                  <TabsList className="w-full grid grid-cols-4">
                    <TabsTrigger value="general" className="text-xs gap-1">
                      <Settings className="w-3 h-3" />
                      <span className="hidden sm:inline">General</span>
                    </TabsTrigger>
                    <TabsTrigger value="prompt" className="text-xs gap-1">
                      <MessageSquare className="w-3 h-3" />
                      <span className="hidden sm:inline">Prompt</span>
                    </TabsTrigger>
                    <TabsTrigger value="knowledge" className="text-xs gap-1">
                      <BookOpen className="w-3 h-3" />
                      <span className="hidden sm:inline">Knowledge</span>
                    </TabsTrigger>
                    <TabsTrigger value="integrations" className="text-xs gap-1">
                      <Smartphone className="w-3 h-3" />
                      <span className="hidden sm:inline">Connect</span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* General Tab */}
                <TabsContent value="general" className="p-4 space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Agent Name</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      placeholder="My Agent"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="avatar">Avatar Emoji</Label>
                    <Input
                      id="avatar"
                      value={form.avatar}
                      onChange={(e) =>
                        setForm({ ...form, avatar: e.target.value })
                      }
                      placeholder="🤖"
                      className="w-20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                      placeholder="What does this agent do?"
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Model</Label>
                    <ModelSelector
                      value={form.model}
                      onChange={(v) => setForm({ ...form, model: v })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Temperature: {form.temperature.toFixed(1)}
                    </Label>
                    <Slider
                      value={[form.temperature]}
                      onValueChange={([v]) =>
                        setForm({ ...form, temperature: v })
                      }
                      min={0}
                      max={2}
                      step={0.1}
                      className="mt-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Precise</span>
                      <span>Creative</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Label>Tools</Label>
                    {[
                      { id: "web_search", label: "Web Search", desc: "Search the web for information" },
                      { id: "calendar", label: "Calendar", desc: "Access calendar events" },
                      { id: "webhooks", label: "Custom Webhooks", desc: "Send data to external APIs" },
                    ].map((tool) => (
                      <div
                        key={tool.id}
                        className="flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium">{tool.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {tool.desc}
                          </p>
                        </div>
                        <Switch
                          checked={form.tools.includes(tool.id)}
                          onCheckedChange={() => toggleTool(tool.id)}
                        />
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* Prompt Tab */}
                <TabsContent value="prompt" className="p-4 space-y-4 mt-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="systemPrompt">System Prompt</Label>
                      <span className="text-xs text-muted-foreground">
                        {form.systemPrompt.length} characters
                      </span>
                    </div>
                    <Textarea
                      id="systemPrompt"
                      value={form.systemPrompt}
                      onChange={(e) =>
                        setForm({ ...form, systemPrompt: e.target.value })
                      }
                      placeholder="You are a helpful AI assistant that..."
                      rows={12}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Define your agent&apos;s personality, behavior, and
                      constraints. This shapes how it responds to every message.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Prompt Templates</Label>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        {
                          label: "Customer Support",
                          prompt:
                            "You are a friendly customer support agent. Help users with their questions, resolve issues patiently, and escalate complex problems. Always be polite and professional.",
                        },
                        {
                          label: "Code Assistant",
                          prompt:
                            "You are an expert programmer. Help users write, debug, and optimize code. Explain your reasoning clearly and suggest best practices. Use code blocks for code examples.",
                        },
                        {
                          label: "Creative Writer",
                          prompt:
                            "You are a creative writing assistant. Help users with stories, poems, essays, and other creative content. Be imaginative and express ideas vividly.",
                        },
                      ].map((template) => (
                        <Button
                          key={template.label}
                          variant="outline"
                          size="sm"
                          className="justify-start h-auto py-2 text-left"
                          onClick={() =>
                            setForm({
                              ...form,
                              systemPrompt: template.prompt,
                            })
                          }
                        >
                          <span className="font-medium">{template.label}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                {/* Knowledge Tab */}
                <TabsContent value="knowledge" className="p-4 space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label>Knowledge Base</Label>
                    <p className="text-xs text-muted-foreground">
                      Upload documents to give your agent custom knowledge.
                    </p>
                  </div>

                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Upload a text file to add knowledge
                    </p>
                    <label className="cursor-pointer">
                      <span className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                        Choose file
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept=".txt,.md,.csv,.json"
                        onChange={handleFileUpload}
                      />
                    </label>
                  </div>

                  {knowledgeBases.length > 0 && (
                    <div className="space-y-2">
                      <Label>Uploaded Files</Label>
                      {knowledgeBases.map((kb: any) => (
                        <div
                          key={kb.id}
                          className="flex items-center justify-between bg-muted rounded-lg p-3"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {kb.fileName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {kb.fileType} ·{" "}
                                {new Date(kb.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 flex-shrink-0"
                            onClick={() =>
                              knowledgeDeleteMutation.mutate(kb.id)
                            }
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Integrations Tab */}
                <TabsContent value="integrations" className="p-4 space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label>Telegram Integration</Label>
                    <p className="text-xs text-muted-foreground">
                      Connect your agent to a Telegram bot so users can chat with it
                      directly from Telegram.
                    </p>
                  </div>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                            <Smartphone className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Telegram Bot</p>
                            <p className="text-xs text-muted-foreground">
                              {agent.telegramConnection?.isActive
                                ? `@${agent.telegramConnection?.botUsername || "connected"}`
                                : "Not connected"}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={
                            agent.telegramConnection?.isActive
                              ? "default"
                              : "outline"
                          }
                          className={
                            agent.telegramConnection?.isActive
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : ""
                          }
                        >
                          {agent.telegramConnection?.isActive
                            ? "Active"
                            : "Inactive"}
                        </Badge>
                      </div>

                      <TelegramConnectDialog
                        agentId={selectedAgentId || ""}
                        isConnected={!!agent.telegramConnection?.isActive}
                        botUsername={
                          agent.telegramConnection?.botUsername || undefined
                        }
                        onConnect={async (agentId, botToken) => {
                          await telegramConnectMutation.mutateAsync({
                            agentId,
                            botToken,
                          });
                        }}
                        onDisconnect={async (agentId) => {
                          await telegramDisconnectMutation.mutateAsync(agentId);
                        }}
                        trigger={
                          <Button
                            variant={
                              agent.telegramConnection?.isActive
                                ? "outline"
                                : "default"
                            }
                            size="sm"
                            className={
                              agent.telegramConnection?.isActive
                                ? ""
                                : "bg-emerald-600 hover:bg-emerald-700"
                            }
                          >
                            <Smartphone className="w-4 h-4 mr-1.5" />
                            {agent.telegramConnection?.isActive
                              ? "Manage"
                              : "Connect"}
                          </Button>
                        }
                      />
                    </CardContent>
                  </Card>

                  {agent.status === "published" && agent.sandboxUrl && (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Rocket className="w-4 h-4 text-emerald-600" />
                          <span className="text-sm font-medium">
                            Deployment Info
                          </span>
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p>
                            Container:{" "}
                            <code className="bg-muted px-1 rounded">
                              {agent.containerId}
                            </code>
                          </p>
                          <p>
                            Sandbox URL:{" "}
                            <code className="bg-muted px-1 rounded">
                              {agent.sandboxUrl}
                            </code>
                          </p>
                          <p>
                            Published:{" "}
                            {new Date(agent.publishedAt).toLocaleString()}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </ScrollArea>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel - Chat Preview */}
        <ResizablePanel defaultSize={55} minSize={35}>
          <div className="h-full flex flex-col bg-muted/30">
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-border bg-background">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/40 dark:to-emerald-800/40 flex items-center justify-center">
                  {form.avatar ? (
                    <span className="text-base">{form.avatar}</span>
                  ) : (
                    <Bot className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold">
                    {form.name || "Agent"} Preview
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Test your agent in real-time
                  </p>
                </div>
              </div>
            </div>

            {/* Chat Messages */}
            <ScrollArea className="flex-1">
              <div className="py-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center px-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/40 dark:to-emerald-800/40 flex items-center justify-center mb-4">
                      <Bot className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="font-semibold mb-1">
                      Chat with {form.name || "your agent"}
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Send a message to test how your agent responds based on its
                      current configuration.
                    </p>
                  </div>
                ) : (
                  <AnimatePresence>
                    {messages.map((msg, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChatMessage message={msg} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
                {isChatLoading && (
                  <div className="flex gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="bg-muted border border-border rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0ms]" />
                        <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:150ms]" />
                        <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            {/* Chat Input */}
            <ChatInput
              onSend={handleSendMessage}
              isLoading={isChatLoading}
              placeholder={`Message ${form.name || "agent"}...`}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
