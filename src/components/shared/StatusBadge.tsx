'use client';

import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  draft: { label: "Draft", variant: "outline", className: "bg-muted text-muted-foreground border-border" },
  deploying: { label: "Deploying", variant: "secondary", className: "bg-foreground/10 text-foreground border-foreground/20" },
  published: { label: "Published", variant: "default", className: "bg-foreground text-background border-foreground" },
  stopped: { label: "Stopped", variant: "secondary", className: "bg-red-500/10 text-red-400 border-red-500/20" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.draft;

  return (
    <Badge variant={config.variant} className={`text-[10px] font-medium ${config.className}`}>
      {config.label}
    </Badge>
  );
}
