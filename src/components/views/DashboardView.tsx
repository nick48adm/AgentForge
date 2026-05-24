'use client';

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AgentCard } from "@/components/shared/AgentCard";
import { TelegramConnectDialog } from "@/components/shared/TelegramConnectDialog";
import {
  Bot,
  Plus,
  Activity,
  MessageSquare,
  Zap,
  Loader2,
  Sparkles,
  Smartphone,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export function DashboardView() {
  const { setView, setSelectedAgentId, user } = useAppStore();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [telegramAgentId, setTelegramAgentId] = useState<string>("");
  const [newAgent, setNewAgent] = useState({
    name: "",
    description: "",
    systemPrompt: "You are a helpful AI assistant.",
    model: "llama-3.3-70b-versatile",
  });

  // Fetch agents
  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const res = await fetch("/api/agents");
      if (!res.ok) throw new Error("Failed to fetch agents");
      return res.json();
    },
  });

  // Fetch usage
  const { data: usage } = useQuery({
    queryKey: ["usage"],
    queryFn: async () => {
      const res = await fetch("/api/usage");
      if (!res.ok) throw new Error("Failed to fetch usage");
      return res.json();
    },
  });

  // Create agent mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof newAgent) => {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create agent");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setCreateOpen(false);
      setNewAgent({
        name: "",
        description: "",
        systemPrompt: "You are a helpful AI assistant.",
        model: "llama-3.3-70b-versatile",
      });
      toast.success("Agent created!");
      setSelectedAgentId(data.id);
      setView("builder");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Deploy agent mutation
  const deployMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const res = await fetch(`/api/agents/${agentId}/deploy`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to deploy");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast.success("Deployment started! This may take a few seconds.");
    },
    onError: () => {
      toast.error("Failed to deploy agent");
    },
  });

  // Stop agent mutation
  const stopMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const res = await fetch(`/api/agents/${agentId}/stop`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to stop");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast.success("Agent stopped");
    },
  });

  // Delete agent mutation
  const deleteMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast.success("Agent deleted");
    },
  });

  // Telegram connect mutation
  const telegramConnectMutation = useMutation({
    mutationFn: async ({ agentId, botToken }: { agentId: string; botToken: string }) => {
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast.success(`Connected as @${data.botUsername}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Telegram disconnect mutation
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
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast.success("Telegram bot disconnected");
    },
  });

  const activeAgents = agents.filter(
    (a: any) => a.status === "published"
  ).length;
  const totalMessages = usage?.summary?.totalMessages || 0;
  const totalTokens =
    (usage?.summary?.totalTokensIn || 0) +
    (usage?.summary?.totalTokensOut || 0);

  const stats = [
    {
      label: "Active Agents",
      value: activeAgents,
      icon: <Activity className="w-5 h-5" />,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
    },
    {
      label: "Total Messages",
      value: totalMessages,
      icon: <MessageSquare className="w-5 h-5" />,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-900/30",
    },
    {
      label: "Tokens Used",
      value: totalTokens.toLocaleString(),
      icon: <Zap className="w-5 h-5" />,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-100 dark:bg-purple-900/30",
    },
  ];

  const telegramAgent = agents.find((a: any) => a.id === telegramAgentId);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-8">
      {/* Welcome header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl md:text-3xl font-bold">
          Welcome back, {user?.name || "User"} 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your AI agents and monitor their performance.
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center ${stat.color}`}
                >
                  {stat.icon}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-bold">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Agent Grid Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Your Agents</h2>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="w-4 h-4" />
            New Agent
          </Button>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                Create New Agent
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="agent-name">Agent Name</Label>
                <Input
                  id="agent-name"
                  placeholder="e.g., Customer Support Bot"
                  value={newAgent.name}
                  onChange={(e) =>
                    setNewAgent({ ...newAgent, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-desc">Description</Label>
                <Textarea
                  id="agent-desc"
                  placeholder="What does this agent do?"
                  value={newAgent.description}
                  onChange={(e) =>
                    setNewAgent({ ...newAgent, description: e.target.value })
                  }
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-prompt">System Prompt</Label>
                <Textarea
                  id="agent-prompt"
                  placeholder="Define your agent's personality and behavior..."
                  value={newAgent.systemPrompt}
                  onChange={(e) =>
                    setNewAgent({ ...newAgent, systemPrompt: e.target.value })
                  }
                  rows={4}
                />
              </div>
              <Button
                onClick={() => createMutation.mutate(newAgent)}
                disabled={!newAgent.name.trim() || createMutation.isPending}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Create Agent
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Agent Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 h-40">
                <div className="h-4 bg-muted rounded w-24 mb-3" />
                <div className="h-3 bg-muted rounded w-32 mb-6" />
                <div className="h-3 bg-muted rounded w-full mb-2" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : agents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Bot className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold mb-1">No agents yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first AI agent to get started.
            </p>
            <Button
              onClick={() => setCreateOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Create Your First Agent
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent: any, i: number) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <AgentCard
                agent={agent}
                onEdit={(id) => {
                  setSelectedAgentId(id);
                  setView("builder");
                }}
                onChat={(id) => {
                  setSelectedAgentId(id);
                  setView("builder");
                }}
                onDeploy={(id) => deployMutation.mutate(id)}
                onStop={(id) => stopMutation.mutate(id)}
                onDelete={(id) => {
                  if (
                    window.confirm(
                      "Are you sure you want to delete this agent?"
                    )
                  ) {
                    deleteMutation.mutate(id);
                  }
                }}
                onTelegram={(id) => {
                  setTelegramAgentId(id);
                  setTelegramOpen(true);
                }}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* Telegram Connect Dialog */}
      <Dialog open={telegramOpen} onOpenChange={setTelegramOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-emerald-600" />
              Telegram Integration
            </DialogTitle>
          </DialogHeader>
          {telegramAgent && (
            <TelegramConnectInline
              agentId={telegramAgent.id}
              isConnected={!!telegramAgent.telegramConnection?.isActive}
              botUsername={telegramAgent.telegramConnection?.botUsername}
              onConnect={async (agentId, botToken) => {
                await telegramConnectMutation.mutateAsync({ agentId, botToken });
              }}
              onDisconnect={async (agentId) => {
                await telegramDisconnectMutation.mutateAsync(agentId);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Inline telegram connect form for dialog
function TelegramConnectInline({
  agentId,
  isConnected,
  botUsername,
  onConnect,
  onDisconnect,
}: {
  agentId: string;
  isConnected: boolean;
  botUsername?: string;
  onConnect: (agentId: string, botToken: string) => Promise<void>;
  onDisconnect: (agentId: string) => Promise<void>;
}) {
  const [botToken, setBotToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleConnect = async () => {
    if (!botToken.trim()) {
      setError("Please enter a bot token");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onConnect(agentId, botToken.trim());
      setBotToken("");
    } catch (err: any) {
      setError(err.message || "Failed to connect");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await onDisconnect(agentId);
    } catch (err: any) {
      setError(err.message || "Failed to disconnect");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted p-3 text-sm space-y-2">
        <p className="font-medium">How to get a bot token:</p>
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
          <li>Open Telegram and search for <strong>@BotFather</strong></li>
          <li>Send <code className="bg-background px-1 rounded">/newbot</code></li>
          <li>Choose a name and username for your bot</li>
          <li>Copy the bot token provided</li>
        </ol>
      </div>

      {isConnected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <Smartphone className="w-5 h-5" />
            <span className="font-medium">Connected as @{botUsername}</span>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDisconnect}
            disabled={loading}
            className="w-full"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
            Disconnect Bot
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="dashBotToken">Bot Token</Label>
            <Input
              id="dashBotToken"
              type="password"
              placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            onClick={handleConnect}
            disabled={loading || !botToken.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Smartphone className="w-4 h-4 mr-1.5" />}
            Connect Bot
          </Button>
        </div>
      )}
    </div>
  );
}
