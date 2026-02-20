import { describe, it, expect } from 'vitest';
import { NoOpVisualRecognizer } from '../visual/visual-recognizer.js';
import type { VisualRecognizer } from '../visual/visual-recognizer.js';

describe('NoOpVisualRecognizer', () => {
  it('implements VisualRecognizer interface', () => {
    const recognizer: VisualRecognizer = new NoOpVisualRecognizer();
    expect(recognizer).toBeDefined();
  });

  it('returns an empty array for any screenshot', async () => {
    const recognizer = new NoOpVisualRecognizer();
    const screenshot = Buffer.from('fake-png-data');
    const result = await recognizer.recognize(screenshot);
    expect(result).toEqual([]);
  });
});
