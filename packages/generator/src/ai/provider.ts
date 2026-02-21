import type { AiProvider, AiProviderResponse } from '../types.js';

export class NoOpAiProvider implements AiProvider {
  readonly name = 'no-op';

  // eslint-disable-next-line @typescript-eslint/require-await
  async complete(): Promise<AiProviderResponse> {
    return { content: '[]', tokensUsed: 0 };
  }
}
