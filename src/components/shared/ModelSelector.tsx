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

export const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

interface ModelsResponse {
  groq: { id: string; owned_by?: string }[];
  nvidia_nim: { id: string; label: string; description: string }[];
}

function formatModelName(id: string): string {
  // Convert model ID like 'llama-3.3-70b-versatile' to 'Llama 3.3 70B Versatile'
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
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
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
        {data?.groq && data.groq.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-xs font-semibold text-emerald-600">Groq</SelectLabel>
            {data.groq.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                <div className="flex flex-col">
                  <span className="font-medium">{formatModelName(model.id)}</span>
                  {model.owned_by && (
                    <span className="text-xs text-muted-foreground">{model.owned_by}</span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {data?.nvidia_nim && data.nvidia_nim.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-xs font-semibold text-green-600">NVIDIA NIM</SelectLabel>
            {data.nvidia_nim.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                <div className="flex flex-col">
                  <span className="font-medium">{model.label}</span>
                  <span className="text-xs text-muted-foreground">{model.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
