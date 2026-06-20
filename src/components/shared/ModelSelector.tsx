'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Key, Zap, Eye, EyeOff } from 'lucide-react';

// Default model: first NVIDIA NIM model
export const DEFAULT_MODEL = 'deepseek-ai/deepseek-v4-flash';

interface ModelInfo {
  id: string;
  label: string;
  description: string;
}

type ByokProvider = 'nvidia-nim' | 'openrouter' | 'groq';

interface ModelsResponse {
  nim: ModelInfo[];
  byok: {
    'nvidia-nim': ModelInfo[];
    openrouter: ModelInfo[];
    groq: ModelInfo[];
  };
}

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
  byokProvider?: string | null;
  onByokProviderChange?: (provider: string | null) => void;
  byokApiKey?: string | null;
  onByokApiKeyChange?: (key: string | null) => void;
}

const BYOK_PROVIDER_LABELS: Record<ByokProvider, { label: string; badge: string; placeholder: string }> = {
  'nvidia-nim': {
    label: 'NVIDIA NIM',
    badge: 'NIM',
    placeholder: 'nvapi-...',
  },
  openrouter: {
    label: 'OpenRouter',
    badge: 'OR',
    placeholder: 'sk-or-...',
  },
  groq: {
    label: 'Groq',
    badge: 'Groq',
    placeholder: 'gsk_...',
  },
};

export function ModelSelector({
  value,
  onChange,
  byokProvider,
  onByokProviderChange,
  byokApiKey,
  onByokApiKeyChange,
}: ModelSelectorProps) {
  const [mode, setMode] = useState<'nim' | 'byok'>(byokProvider ? 'byok' : 'nim');
  const [selectedByokProvider, setSelectedByokProvider] = useState<ByokProvider>(
    (byokProvider as ByokProvider) || 'nvidia-nim'
  );
  const [apiKey, setApiKey] = useState(byokApiKey || '');
  const [showKey, setShowKey] = useState(false);

  const { data, isLoading } = useQuery<ModelsResponse>({
    queryKey: ['models'],
    queryFn: async () => {
      const res = await fetch('/api/models');
      if (!res.ok) throw new Error('Failed to fetch models');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Sync external byokProvider prop to internal state
  useEffect(() => {
    if (byokProvider) {
      setMode('byok');
      setSelectedByokProvider(byokProvider as ByokProvider);
    } else {
      setMode('nim');
    }
  }, [byokProvider]);

  useEffect(() => {
    setApiKey(byokApiKey || '');
  }, [byokApiKey]);

  const handleModeChange = (newMode: 'nim' | 'byok') => {
    setMode(newMode);
    if (newMode === 'nim') {
      // Switching to NIM: clear BYOK settings
      onByokProviderChange?.(null);
      onByokApiKeyChange?.(null);
      // Set a default NIM model if current model isn't a NIM model
      if (data?.nim && data.nim.length > 0) {
        const isNimModel = data.nim.some((m) => m.id === value);
        if (!isNimModel) {
          onChange(data.nim[0].id);
        }
      }
    } else {
      // Switching to BYOK: set provider
      onByokProviderChange?.(selectedByokProvider);
      // Set a default model for the selected BYOK provider
      const providerModels = data?.byok?.[selectedByokProvider];
      if (providerModels && providerModels.length > 0) {
        onChange(providerModels[0].id);
      }
    }
  };

  const handleByokProviderChange = (provider: ByokProvider) => {
    setSelectedByokProvider(provider);
    onByokProviderChange?.(provider);
    // Reset API key when switching providers
    setApiKey('');
    onByokApiKeyChange?.(null);
    // Set a default model for the new provider
    const providerModels = data?.byok?.[provider];
    if (providerModels && providerModels.length > 0) {
      onChange(providerModels[0].id);
    }
  };

  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    onByokApiKeyChange?.(key || null);
  };

  // Get the current model list based on mode
  const currentModels: ModelInfo[] =
    mode === 'nim' ? (data?.nim || []) : (data?.byok?.[selectedByokProvider] || []);

  return (
    <div className="space-y-3">
      {/* Mode Toggle */}
      <div className="flex rounded-lg border border-border/60 p-0.5 bg-muted/30">
        <button
          type="button"
          onClick={() => handleModeChange('nim')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
            mode === 'nim'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground/70'
          }`}
        >
          <Zap className="h-3 w-3" />
          NVIDIA NIM
          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 leading-tight">
            Free
          </Badge>
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('byok')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
            mode === 'byok'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground/70'
          }`}
        >
          <Key className="h-3 w-3" />
          Bring Your Own Key
        </button>
      </div>

      {/* BYOK Provider Selection */}
      {mode === 'byok' && (
        <div className="space-y-2.5">
          {/* Provider Tabs */}
          <div className="flex gap-1.5">
            {(Object.keys(BYOK_PROVIDER_LABELS) as ByokProvider[]).map((provider) => (
              <button
                key={provider}
                type="button"
                onClick={() => handleByokProviderChange(provider)}
                className={`flex-1 px-2 py-1.5 rounded-md text-[10px] font-medium border transition-all ${
                  selectedByokProvider === provider
                    ? 'border-foreground/30 bg-foreground/5 text-foreground'
                    : 'border-border/40 text-muted-foreground hover:text-foreground/70 hover:border-border/60'
                }`}
              >
                {BYOK_PROVIDER_LABELS[provider].label}
              </button>
            ))}
          </div>

          {/* API Key Input */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              {BYOK_PROVIDER_LABELS[selectedByokProvider].label} API Key
            </Label>
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                placeholder={BYOK_PROVIDER_LABELS[selectedByokProvider].placeholder}
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                className="h-7 text-xs pr-8 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Model Selector Dropdown */}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full h-8 text-xs">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading models...
            </div>
          ) : (
            <SelectValue placeholder="Select a model" />
          )}
        </SelectTrigger>
        <SelectContent>
          {mode === 'nim' && (
            <SelectGroup>
              <SelectLabel className="text-[10px] font-semibold text-muted-foreground">
                NVIDIA NIM · Server Key
              </SelectLabel>
              {(data?.nim || []).map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium">{model.label}</span>
                    <span className="text-[10px] text-muted-foreground">{model.description}</span>
                  </div>
                </SelectItem>
              ))}
              {(!data?.nim || data.nim.length === 0) && (
                <div className="px-2 py-3 text-[10px] text-muted-foreground text-center">
                  No NVIDIA NIM API key configured on server
                </div>
              )}
            </SelectGroup>
          )}

          {mode === 'byok' && (
            <SelectGroup>
              <SelectLabel className="text-[10px] font-semibold text-muted-foreground">
                {BYOK_PROVIDER_LABELS[selectedByokProvider].label} · Your Key
              </SelectLabel>
              {currentModels.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium">{model.label}</span>
                    <span className="text-[10px] text-muted-foreground">{model.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>

      {/* BYOK Warning */}
      {mode === 'byok' && !apiKey && (
        <p className="text-[10px] text-amber-500/80">
          ⚠ Enter your API key above to use BYOK models
        </p>
      )}
    </div>
  );
}
