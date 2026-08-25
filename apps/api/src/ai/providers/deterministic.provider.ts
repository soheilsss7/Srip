import { Injectable } from '@nestjs/common';
import { AiProviderPort, AiProviderRequest, AiProviderResponse } from './ai-provider.port';
@Injectable()
export class DeterministicAiProvider implements AiProviderPort {
  async generate(request: AiProviderRequest): Promise<AiProviderResponse> {
    const text = `Deterministic AI fallback. ${request.prompt.slice(0, 900)}`;
    return { text, provider:'deterministic', model:'rule-based-v1', inputTokens: request.prompt.length, outputTokens:text.length };
  }
  async health(){ return {ok:true, provider:'deterministic'}; }
}
