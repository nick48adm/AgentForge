'use client';

import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";

export interface ChatMessageData {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

export function ChatMessage({ message }: { message: ChatMessageData }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-2.5 px-4 py-2.5",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center">
          <Bot className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[75%] rounded-lg px-3.5 py-2 text-xs leading-relaxed",
          isUser
            ? "bg-foreground text-background rounded-br-sm"
            : "bg-muted border border-border rounded-bl-sm"
        )}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
        <div
          className={cn(
            "text-[9px] mt-1.5",
            isUser
              ? "text-background/50"
              : "text-muted-foreground"
          )}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
      {isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-foreground/10 flex items-center justify-center">
          <User className="w-3.5 h-3.5 text-foreground" />
        </div>
      )}
    </div>
  );
}
