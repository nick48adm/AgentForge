'use client';

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import {
  Bot,
  Pencil,
  MessageSquare,
  Send,
  Trash2,
  StopCircle,
  Smartphone,
} from "lucide-react";

interface AgentCardProps {
  agent: {
    id: string;
    name: string;
    description: string;
    model: string;
    status: string;
    avatar?: string | null;
    updatedAt: string;
    telegramConnection?: { isActive: boolean; botUsername?: string } | null;
    _count?: { conversations: number };
  };
  onEdit: (id: string) => void;
  onChat: (id: string) => void;
  onDeploy: (id: string) => void;
  onStop: (id: string) => void;
  onDelete: (id: string) => void;
  onTelegram: (id: string) => void;
}

export function AgentCard({
  agent,
  onEdit,
  onChat,
  onDeploy,
  onStop,
  onDelete,
  onTelegram,
}: AgentCardProps) {
  return (
    <Card className="group hover:shadow-lg transition-all duration-200 hover:border-emerald-200 dark:hover:border-emerald-800">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/40 dark:to-emerald-800/40 flex items-center justify-center text-lg">
              {agent.avatar || <Bot className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
            </div>
            <div>
              <h3 className="font-semibold text-sm">{agent.name}</h3>
              <p className="text-xs text-muted-foreground">{agent.model}</p>
            </div>
          </div>
          <StatusBadge status={agent.status} />
        </div>

        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
          {agent.description || "No description"}
        </p>

        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
          <MessageSquare className="w-3 h-3" />
          <span>{agent._count?.conversations || 0} conversations</span>
          {agent.telegramConnection?.isActive && (
            <>
              <span className="mx-1">·</span>
              <Smartphone className="w-3 h-3 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400">Telegram</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => onEdit(agent.id)}
          >
            <Pencil className="w-3 h-3" /> Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => onChat(agent.id)}
          >
            <MessageSquare className="w-3 h-3" /> Chat
          </Button>
          {agent.status === "published" ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-red-600 hover:text-red-700"
              onClick={() => onStop(agent.id)}
            >
              <StopCircle className="w-3 h-3" /> Stop
            </Button>
          ) : agent.status === "deploying" ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-amber-600 cursor-not-allowed"
              disabled
            >
              <Send className="w-3 h-3" /> Deploying…
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-emerald-600 hover:text-emerald-700"
              onClick={() => onDeploy(agent.id)}
            >
              <Send className="w-3 h-3" /> Deploy
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => onTelegram(agent.id)}
          >
            <Smartphone className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-destructive"
            onClick={() => onDelete(agent.id)}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
