import type { RawDomData, DomNode } from '../types.js';

function buildCssSelector(
  tag: string,
  id: string | null,
  classes: readonly string[],
  parentSelector: string,
): string {
  if (id) {
    return `${tag}#${id}`;
  }
  const classStr = classes.length > 0 ? `.${classes.join('.')}` : '';
  const self = `${tag}${classStr}`;
  return parentSelector ? `${parentSelector} > ${self}` : self;
}

function buildXpath(tag: string, siblingIndex: number | null, parentXpath: string): string {
  const indexSuffix = siblingIndex !== null ? `[${String(siblingIndex)}]` : '';
  return `${parentXpath}/${tag}${indexSuffix}`;
}

function parseNode(
  raw: RawDomData,
  parentXpath: string,
  parentCssSelector: string,
  siblingIndex: number | null,
): DomNode {
  const xpath = buildXpath(raw.tag, siblingIndex, parentXpath);
  const cssSelector = buildCssSelector(raw.tag, raw.id, raw.classes, parentCssSelector);

  const visibleChildren = raw.children.filter((child) => child.isVisible);

  // Count siblings per tag for xpath indexing
  const tagTotals = new Map<string, number>();
  for (const child of visibleChildren) {
    tagTotals.set(child.tag, (tagTotals.get(child.tag) ?? 0) + 1);
  }

  const tagCounts = new Map<string, number>();
  const children: DomNode[] = visibleChildren.map((child) => {
    const currentCount = (tagCounts.get(child.tag) ?? 0) + 1;
    tagCounts.set(child.tag, currentCount);
    const total = tagTotals.get(child.tag) ?? 1;
    const childSiblingIndex = total > 1 ? currentCount : null;
    return parseNode(child, xpath, cssSelector, childSiblingIndex);
  });

  return {
    tag: raw.tag,
    id: raw.id,
    classes: [...raw.classes],
    attributes: { ...raw.attributes },
    textContent: raw.textContent,
    children,
    boundingBox: raw.boundingBox ? { ...raw.boundingBox } : null,
    isVisible: raw.isVisible,
    xpath,
    cssSelector,
  };
}

/** Parse raw serialized DOM data into a structured DomNode tree. */
export function parseDom(raw: RawDomData): DomNode {
  return parseNode(raw, '', '', null);
}
