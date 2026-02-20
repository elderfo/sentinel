import type { VisualRegion } from '../types.js';

/** Interface for screenshot-based visual element recognition. */
export interface VisualRecognizer {
  recognize(screenshot: Buffer): Promise<readonly VisualRegion[]>;
}

/** No-op implementation that returns no visual regions. Placeholder for future AI/CV integration. */
export class NoOpVisualRecognizer implements VisualRecognizer {
  recognize(
    _screenshot: Buffer, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<readonly VisualRegion[]> {
    return Promise.resolve([]);
  }
}
