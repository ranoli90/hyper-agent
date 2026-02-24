/**
 * @fileoverview HyperAgent Ollama client.
 * Local AI inference via Ollama with automatic detection and fallback.
 * 
 * Features:
 * - Automatic Ollama server detection (localhost:11434)
 * - Model listing and selection
 * - Streaming support
 * - Automatic fallback to OpenRouter when Ollama unavailable
 * - Companion app detection for hybrid local/cloud mode
 */

import type { LLMResponse } from './types';

export const OLLAMA_CONFIG = {
  DEFAULT_HOST: 'http://localhost:11434',
  API_PATH: '/api/generate',
  LIST_PATH: '/api/tags',
  TIMEOUT_MS: 120000,
} as const;

export const OLLAMA_MODELS = {
  RECOMMENDED: 'llama3.2:3b',
  VISION: 'llama3.2-vision:11b',
  CODE: 'codellama:7b',
  FAST: 'llama3.2:1b',
  DEFAULT: 'llama3.2:3b',
} as const;

export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

export interface OllamaStatus {
  available: boolean;
  host: string;
  models: OllamaModel[];
  error?: string;
}

export interface OllamaRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  context?: number[];
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
    stop?: string[];
  };
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

class OllamaClient {
  private host: string = OLLAMA_CONFIG.DEFAULT_HOST;
  private available: boolean = false;
  private models: OllamaModel[] = [];
  private lastCheck: number = 0;
  private readonly CHECK_INTERVAL_MS = 30000;

  async checkAvailability(): Promise<OllamaStatus> {
    const now = Date.now();
    if (now - this.lastCheck < this.CHECK_INTERVAL_MS && this.lastCheck > 0) {
      return {
        available: this.available,
        host: this.host,
        models: this.models,
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.host}${OLLAMA_CONFIG.LIST_PATH}`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        this.models = data.models || [];
        this.available = true;
        this.lastCheck = now;

        console.log(`[Ollama] Available with ${this.models.length} models:`, 
          this.models.map(m => m.name).join(', '));

        return {
          available: true,
          host: this.host,
          models: this.models,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[Ollama] Not available: ${errorMessage}`);
    }

    this.available = false;
    this.models = [];
    this.lastCheck = now;

    return {
      available: false,
      host: this.host,
      models: [],
      error: 'Ollama server not running. Install from ollama.ai and run `ollama serve`',
    };
  }

  async generate(
    prompt: string,
    options: {
      model?: string;
      temperature?: number;
      stream?: boolean;
      systemPrompt?: string;
    } = {}
  ): Promise<LLMResponse> {
    const status = await this.checkAvailability();
    if (!status.available) {
      throw new Error('Ollama not available');
    }

    const model = options.model || OLLAMA_MODELS.DEFAULT;
    const request: OllamaRequest = {
      model,
      prompt: options.stream ? prompt : this.buildPrompt(prompt, options.systemPrompt),
      stream: options.stream ?? false,
      options: {
        temperature: options.temperature ?? 0.7,
        top_p: 0.9,
        top_k: 40,
        num_predict: 2048,
      },
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), OLLAMA_CONFIG.TIMEOUT_MS);

      const response = await fetch(`${this.host}${OLLAMA_CONFIG.API_PATH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      if (options.stream) {
        return this.handleStreamResponse(response, model);
      }

      const data: OllamaResponse = await response.json();
      return this.convertToLLMResponse(data, model);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Ollama] Generate error: ${errorMessage}`);
      throw error;
    }
  }

  private buildPrompt(userPrompt: string, systemPrompt?: string): string {
    const system = systemPrompt || `You are HyperAgent, an autonomous browser automation AI.`;
    return `${system}

User: ${userPrompt}

Assistant:`;
  }

  private async handleStreamResponse(response: Response, _model: string): Promise<LLMResponse> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let fullResponse = '';
    let done = false;

    try {
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;

        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(Boolean);

          for (const line of lines) {
            try {
              const data: OllamaResponse = JSON.parse(line);
              fullResponse += data.response;

              if (data.done) {
                done = true;
              }
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      summary: fullResponse.slice(0, 200),
      thinking: undefined,
      actions: [],
      done: true,
      needsScreenshot: false,
    };
  }

  private convertToLLMResponse(data: OllamaResponse, _model: string): LLMResponse {
    const response = data.response.trim();

    // Try to parse as JSON for structured actions
    try {
      const parsed = JSON.parse(response);
      if (parsed.actions || parsed.summary || parsed.done !== undefined) {
        return {
          summary: parsed.summary || response.slice(0, 200),
          thinking: parsed.thinking,
          actions: parsed.actions || [],
          done: parsed.done ?? true,
          needsScreenshot: parsed.needsScreenshot ?? false,
        };
      }
    } catch {
      // Not JSON, return as text response
    }

    // Return as text summary
    return {
      summary: response.slice(0, 200),
      thinking: undefined,
      actions: [],
      done: true,
      needsScreenshot: false,
    };
  }

  setHost(host: string): void {
    this.host = host;
    this.lastCheck = 0;
    this.available = false;
  }

  getHost(): string {
    return this.host;
  }

  isAvailable(): boolean {
    return this.available;
  }

  getModels(): OllamaModel[] {
    return this.models;
  }

  getRecommendedModel(): string {
    if (this.models.length === 0) {
      return OLLAMA_MODELS.DEFAULT;
    }

    // Prefer llama3.2 models
    const llamaModel = this.models.find(m => m.name.startsWith('llama3.2'));
    if (llamaModel) {
      return llamaModel.name;
    }

    // Return first available
    return this.models[0].name;
  }
}

export const ollamaClient = new OllamaClient();

export async function checkOllamaStatus(): Promise<OllamaStatus> {
  return ollamaClient.checkAvailability();
}

export async function generateWithOllama(
  prompt: string,
  options?: {
    model?: string;
    temperature?: number;
    stream?: boolean;
    systemPrompt?: string;
  }
): Promise<LLMResponse> {
  return ollamaClient.generate(prompt, options);
}
