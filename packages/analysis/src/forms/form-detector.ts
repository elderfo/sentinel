import type { DomNode, FormModel, FormField } from '../types.js';
import { extractConstraints } from './constraints.js';

/** Input types that are not interactive form fields. */
const EXCLUDED_INPUT_TYPES = new Set(['submit', 'reset', 'button', 'hidden', 'image']);

/** Tags that are valid form field containers. */
const FIELD_TAGS = new Set(['input', 'select', 'textarea']);

/**
 * Builds a map of id → label text from all <label for="…"> elements in the tree.
 */
function buildLabelMap(root: DomNode): Map<string, string> {
  const map = new Map<string, string>();
  collectLabels(root, map);
  return map;
}

function collectLabels(node: DomNode, map: Map<string, string>): void {
  if (node.tag.toLowerCase() === 'label') {
    const forAttr = node.attributes['for'];
    if (forAttr) {
      map.set(forAttr, node.textContent.trim());
    }
  }
  for (const child of node.children) {
    collectLabels(child, map);
  }
}

/**
 * Collects all form field nodes (input, select, textarea — excluding non-interactive
 * input types) that are descendants of the given node.
 */
function collectFields(node: DomNode, results: DomNode[]): void {
  const tag = node.tag.toLowerCase();

  if (FIELD_TAGS.has(tag)) {
    if (tag === 'input') {
      const inputType = (node.attributes['type'] ?? 'text').toLowerCase();
      if (!EXCLUDED_INPUT_TYPES.has(inputType)) {
        results.push(node);
      }
    } else {
      results.push(node);
    }
  }

  for (const child of node.children) {
    collectFields(child, results);
  }
}

/**
 * Converts a DomNode representing a form field into a FormField model.
 */
function buildFormField(node: DomNode, labelMap: Map<string, string>): FormField {
  const tag = node.tag.toLowerCase();
  const attrs = node.attributes;

  const inputType = tag === 'input' ? (attrs['type'] ?? 'text').toLowerCase() : tag;

  const name = attrs['name'] ?? null;
  const placeholder = attrs['placeholder'] ?? null;

  const id = node.id;
  const label = id !== null ? (labelMap.get(id) ?? null) : null;

  return {
    node,
    inputType,
    name,
    label,
    placeholder,
    constraints: extractConstraints(node),
  };
}

/**
 * Walks the root DomNode tree, finds all <form> elements, and builds FormModel
 * instances for each one including their detected fields.
 */
export function detectForms(root: DomNode): readonly FormModel[] {
  const forms: FormModel[] = [];
  // Build the label map from the full document tree so labels outside a form
  // can still be resolved (unusual but valid HTML).
  const labelMap = buildLabelMap(root);
  collectForms(root, labelMap, forms);
  return forms;
}

function collectForms(node: DomNode, labelMap: Map<string, string>, results: FormModel[]): void {
  if (node.tag.toLowerCase() === 'form') {
    const attrs = node.attributes;
    const action = attrs['action'] ?? null;
    const method = (attrs['method'] ?? 'GET').toUpperCase();

    const fieldNodes: DomNode[] = [];
    collectFields(node, fieldNodes);

    const fields: FormField[] = fieldNodes.map((fieldNode) => buildFormField(fieldNode, labelMap));

    results.push({
      formElement: node,
      action,
      method,
      fields,
      isMultiStep: false,
    });

    // Do not recurse into nested forms — they are invalid HTML but we stop here.
    return;
  }

  for (const child of node.children) {
    collectForms(child, labelMap, results);
  }
}
