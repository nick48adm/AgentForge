'use client';

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
import { Loader2 } from 'lucide-react';

// Default model: first Groq model (fastest, free tier)
export const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

interface StaticModel {
  id: string;
  label: string;
  description: string;
}

interface ModelsResponse {
  groq: { id: string; owned_by?: string }[];
  nvidia_nim: StaticModel[];
  openai: StaticModel[];
  anthropic: StaticModel[];
}

function formatModelName(id: string): string {
  return id
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function ModelSelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { data, isLoading } = useQuery<ModelsResponse>({
    queryKey: ['models'],
    queryFn: async () => {
      const res = await fetch('/api/models');
      if (!res.ok) throw new Error('Failed to fetch models');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
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
        {/* Groq */}
        {data?.groq && data.groq.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-[10px] font-semibold text-muted-foreground">Groq (Free)</SelectLabel>
            {data.groq.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                <div className="flex flex-col">
                  <span className="text-xs font-medium">{formatModelName(model.id)}</span>
                  {model.owned_by && (
                    <span className="text-[10px] text-muted-foreground">{model.owned_by}</span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        )}

        {/* OpenAI */}
        {data?.openai && data.openai.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-[10px] font-semibold text-muted-foreground">OpenAI</SelectLabel>
            {data.openai.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                <div className="flex flex-col">
                  <span className="text-xs font-medium">{model.label}</span>
                  <span className="text-[10px] text-muted-foreground">{model.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        )}

        {/* Anthropic */}
        {data?.anthropic && data.anthropic.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-[10px] font-semibold text-muted-foreground">Anthropic</SelectLabel>
            {data.anthropic.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                <div className="flex flex-col">
                  <span className="text-xs font-medium">{model.label}</span>
                  <span className="text-[10px] text-muted-foreground">{model.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        )}

        {/* NVIDIA NIM */}
        {data?.nvidia_nim && data.nvidia_nim.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-[10px] font-semibold text-muted-foreground">NVIDIA NIM</SelectLabel>
            {data.nvidia_nim.map((model) => (
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
  );
}
