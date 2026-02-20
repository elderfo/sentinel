import type { BrowserEngine, PageHandle } from '@sentinel/browser';
import type {
  BoundingBox,
  InteractiveElement,
  VisualDetectionResult,
  VisualRegion,
} from '../types.js';
import { extractDom } from '../parser/index.js';
import { detectVisualElements } from './visual-detector.js';
import type { VisualRecognizer } from './visual-recognizer.js';
import { NoOpVisualRecognizer } from './visual-recognizer.js';

function boundingBoxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function filterUnmatchedRegions(
  regions: readonly VisualRegion[],
  interactiveElements: readonly InteractiveElement[],
): VisualRegion[] {
  return regions.filter((region) => {
    return !interactiveElements.some((el) => {
      if (!el.node.boundingBox) return false;
      return boundingBoxesOverlap(region.boundingBox, el.node.boundingBox);
    });
  });
}

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
  const unmatchedRecognized = filterUnmatchedRegions(recognizedRegions, interactiveElements);

  return {
    visualRegions: [...domResult.visualRegions, ...recognizedRegions],
    unmatchedRegions: [...domResult.unmatchedRegions, ...unmatchedRecognized],
    canvasElements: domResult.canvasElements,
  };
}
