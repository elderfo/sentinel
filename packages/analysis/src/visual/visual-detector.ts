import type {
  DomNode,
  InteractiveElement,
  VisualRegion,
  VisualDetectionResult,
  BoundingBox,
} from '../types.js';

function hasBackgroundImage(attributes: Readonly<Record<string, string>>): boolean {
  const style = attributes['style'];
  if (!style) return false;
  return /background-image\s*:/i.test(style);
}

function boundingBoxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function collectVisualNodes(
  node: DomNode,
  regions: VisualRegion[],
  canvasElements: DomNode[],
): void {
  if (!node.isVisible || !node.boundingBox) {
    return;
  }

  const tag = node.tag.toLowerCase();

  if (tag === 'canvas') {
    canvasElements.push(node);
    regions.push({
      boundingBox: node.boundingBox,
      confidence: 1.0,
      label: 'canvas-control',
      source: 'dom-structural',
    });
  } else if (tag === 'svg') {
    regions.push({
      boundingBox: node.boundingBox,
      confidence: 0.9,
      label: 'svg-graphic',
      source: 'dom-structural',
    });
  } else if (tag === 'area') {
    regions.push({
      boundingBox: node.boundingBox,
      confidence: 0.85,
      label: 'image-map-area',
      source: 'dom-structural',
    });
  } else if (hasBackgroundImage(node.attributes)) {
    regions.push({
      boundingBox: node.boundingBox,
      confidence: 0.7,
      label: 'image-background',
      source: 'dom-structural',
    });
  }

  for (const child of node.children) {
    collectVisualNodes(child, regions, canvasElements);
  }
}

/** Detect visually significant elements in the DOM that may not be well-represented as interactive elements. */
export function detectVisualElements(
  root: DomNode,
  interactiveElements: readonly InteractiveElement[],
): VisualDetectionResult {
  const visualRegions: VisualRegion[] = [];
  const canvasElements: DomNode[] = [];

  collectVisualNodes(root, visualRegions, canvasElements);

  const unmatchedRegions = visualRegions.filter((region) => {
    return !interactiveElements.some((el) => {
      if (!el.node.boundingBox) return false;
      return boundingBoxesOverlap(region.boundingBox, el.node.boundingBox);
    });
  });

  return { visualRegions, unmatchedRegions, canvasElements };
}
