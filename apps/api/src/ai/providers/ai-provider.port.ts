export type AiProviderRequest = { system: string; prompt: string; model?: string; timeoutMs?: number };
export type AiProviderResponse = { text: string; provider: string; model?: string; inputTokens: number; outputTokens: number };
export interface AiProviderPort { generate(request: AiProviderRequest): Promise<AiProviderResponse>; health(): Promise<{ok:boolean; provider:string}>; }
