import type { BrowserEngine, PageHandle } from '@sentinel/browser';
import type { InteractiveElement, VisualDetectionResult } from '../types.js';
import { extractDom } from '../parser/index.js';
import { detectVisualElements } from './visual-detector.js';
import type { VisualRecognizer } from './visual-recognizer.js';
import { NoOpVisualRecognizer } from './visual-recognizer.js';

/** Extract visual elements from a browser page using DOM analysis and optional screenshot recognition. */
export async function extractVisualElements(
  engine: BrowserEngine,
  page: PageHandle,
  interactiveElements: readonly InteractiveElement[],
  recognizer: VisualRecognizer = new NoOpVisualRecognizer(),
): Promise<VisualDetectionResult> {
  const [domRoot, screenshot] = await Promise.all([
    extractDom(engine, page),
    engine.screenshot(page, { fullPage: true }),
  ]);

  const domResult = detectVisualElements(domRoot, interactiveElements);
  const recognizedRegions = await recognizer.recognize(screenshot);

  return {
    visualRegions: [...domResult.visualRegions, ...recognizedRegions],
    unmatchedRegions: [...domResult.unmatchedRegions, ...recognizedRegions],
    canvasElements: domResult.canvasElements,
  };
}
