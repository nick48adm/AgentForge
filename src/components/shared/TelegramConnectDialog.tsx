'use client';

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Smartphone, ExternalLink, Check, Loader2, Unplug } from "lucide-react";

interface TelegramConnectDialogProps {
  agentId: string;
  isConnected: boolean;
  botUsername?: string;
  onConnect: (agentId: string, botToken: string) => Promise<void>;
  onDisconnect: (agentId: string) => Promise<void>;
  trigger?: React.ReactNode;
}

export function TelegramConnectDialog({
  agentId,
  isConnected,
  botUsername,
  onConnect,
  onDisconnect,
  trigger,
}: TelegramConnectDialogProps) {
  const [open, setOpen] = useState(false);
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
      setOpen(false);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant={isConnected ? "outline" : "default"}
            size="sm"
            className={isConnected ? "text-emerald-600 border-emerald-200 dark:border-emerald-800" : "bg-emerald-600 hover:bg-emerald-700"}
          >
            <Smartphone className="w-4 h-4 mr-1.5" />
            {isConnected ? "Connected" : "Telegram"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-emerald-600" />
            Telegram Integration
          </DialogTitle>
          <DialogDescription>
            Connect your agent to Telegram so users can chat with it via a bot.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instructions */}
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
                <Check className="w-5 h-5" />
                <span className="font-medium">Connected as @{botUsername}</span>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDisconnect}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Unplug className="w-4 h-4 mr-1.5" />
                )}
                Disconnect Bot
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="botToken">Bot Token</Label>
                <Input
                  id="botToken"
                  type="password"
                  placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button
                onClick={handleConnect}
                disabled={loading || !botToken.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Smartphone className="w-4 h-4 mr-1.5" />
                )}
                Connect Bot
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
