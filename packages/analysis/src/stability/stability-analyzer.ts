import type {
  InteractiveElement,
  StabilizedElement,
  SelectorCandidate,
  StabilityAnalysis,
} from '../types.js';
import { isDynamicId } from './dynamic-id-detector.js';

const STABLE_ID_SCORE = 100;
const DYNAMIC_ID_SCORE = 20;
const ARIA_SCORE = 80;
const CSS_SCORE = 60;
const XPATH_SCORE = 30;

/** Escape a string for safe use as a CSS identifier (e.g. in `#id` selectors). */
function escapeCssIdentifier(value: string): string {
  return value.replace(/([^\w-])/g, '\\$1');
}

/** Escape a string for safe use inside a CSS attribute value (e.g. `[attr="value"]`). */
function escapeCssAttributeValue(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

function buildIdCandidate(id: string): SelectorCandidate {
  const score = isDynamicId(id) ? DYNAMIC_ID_SCORE : STABLE_ID_SCORE;
  return { strategy: 'id', value: `#${escapeCssIdentifier(id)}`, score };
}

function buildAriaCandidate(
  attributes: Readonly<Record<string, string>>,
): SelectorCandidate | null {
  const role = attributes['role'];
  const label = attributes['aria-label'];
  if (!role && !label) return null;

  const parts: string[] = [];
  if (role) parts.push(`[role="${escapeCssAttributeValue(role)}"]`);
  if (label) parts.push(`[aria-label="${escapeCssAttributeValue(label)}"]`);
  return { strategy: 'aria', value: parts.join(''), score: ARIA_SCORE };
}

function buildCssCandidate(tag: string, classes: readonly string[]): SelectorCandidate {
  const classSelector = classes.map((c) => `.${escapeCssIdentifier(c)}`).join('');
  return { strategy: 'css', value: `${tag}${classSelector}`, score: CSS_SCORE };
}

function buildXpathCandidate(xpath: string): SelectorCandidate {
  return { strategy: 'xpath', value: xpath, score: XPATH_SCORE };
}

function buildStabilityAnalysis(element: InteractiveElement): StabilityAnalysis {
  const { node } = element;

  // xpath is always available as the baseline candidate
  const xpathCandidate = buildXpathCandidate(node.xpath);
  const candidates: SelectorCandidate[] = [];

  if (node.id) {
    candidates.push(buildIdCandidate(node.id));
  }

  const ariaCandidate = buildAriaCandidate(node.attributes);
  if (ariaCandidate) {
    candidates.push(ariaCandidate);
  }

  if (node.classes.length > 0) {
    candidates.push(buildCssCandidate(node.tag, node.classes));
  }

  candidates.push(xpathCandidate);
  candidates.sort((a, b) => b.score - a.score);

  // candidates always contains at least the xpath candidate
  const recommended = candidates[0] ?? xpathCandidate;

  return {
    selectors: candidates,
    recommendedSelector: recommended,
  };
}

/** Analyze selector stability for each interactive element and produce a recommended locator strategy. */
export function analyzeStability(
  elements: readonly InteractiveElement[],
): readonly StabilizedElement[] {
  return elements.map((element) => ({
    ...element,
    stability: buildStabilityAnalysis(element),
  }));
}
