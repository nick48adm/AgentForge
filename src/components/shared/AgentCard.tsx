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
    <Card className="group hover:border-border transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center text-sm font-semibold">
              {agent.avatar || <Bot className="w-4 h-4 text-muted-foreground" />}
            </div>
            <div>
              <h3 className="font-medium text-xs">{agent.name}</h3>
              <p className="text-[10px] text-muted-foreground font-mono">{agent.model}</p>
            </div>
          </div>
          <StatusBadge status={agent.status} />
        </div>

        <p className="text-[11px] text-muted-foreground mb-3 line-clamp-2">
          {agent.description || "No description"}
        </p>

        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-3">
          <MessageSquare className="w-3 h-3" />
          <span>{agent._count?.conversations || 0} conversations</span>
          {agent.telegramConnection?.isActive && (
            <>
              <span className="mx-1">&middot;</span>
              <Smartphone className="w-3 h-3" />
              <span>Telegram</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-0.5 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] gap-0.5"
            onClick={() => onEdit(agent.id)}
          >
            <Pencil className="w-2.5 h-2.5" /> Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] gap-0.5"
            onClick={() => onChat(agent.id)}
          >
            <MessageSquare className="w-2.5 h-2.5" /> Chat
          </Button>
          {agent.status === "published" ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] gap-0.5 text-red-400 hover:text-red-500"
              onClick={() => onStop(agent.id)}
            >
              <StopCircle className="w-2.5 h-2.5" /> Stop
            </Button>
          ) : agent.status === "deploying" ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] gap-0.5 text-muted-foreground cursor-not-allowed"
              disabled
            >
              <Send className="w-2.5 h-2.5" /> Deploying...
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] gap-0.5"
              onClick={() => onDeploy(agent.id)}
            >
              <Send className="w-2.5 h-2.5" /> Deploy
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] gap-0.5"
            onClick={() => onTelegram(agent.id)}
          >
            <Smartphone className="w-2.5 h-2.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] gap-0.5 text-red-400 hover:text-red-500"
            onClick={() => onDelete(agent.id)}
          >
            <Trash2 className="w-2.5 h-2.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
