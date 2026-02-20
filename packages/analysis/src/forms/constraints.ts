import type { DomNode, FieldConstraints } from '../types.js';

/**
 * Extracts HTML constraint attributes from a form field node.
 * Supports both native attributes (required, pattern, min, max, minlength, maxlength)
 * and their ARIA equivalents (aria-required).
 */
export function extractConstraints(node: DomNode): FieldConstraints {
  const attrs = node.attributes;

  const required = 'required' in attrs || attrs['aria-required'] === 'true';

  const pattern = attrs['pattern'] ?? null;
  const min = attrs['min'] ?? null;
  const max = attrs['max'] ?? null;

  const minLengthRaw = attrs['minlength'];
  const maxLengthRaw = attrs['maxlength'];

  const minLengthParsed = minLengthRaw !== undefined ? parseInt(minLengthRaw, 10) : NaN;
  const maxLengthParsed = maxLengthRaw !== undefined ? parseInt(maxLengthRaw, 10) : NaN;

  return {
    required,
    pattern,
    min,
    max,
    minLength: isNaN(minLengthParsed) ? null : minLengthParsed,
    maxLength: isNaN(maxLengthParsed) ? null : maxLengthParsed,
  };
}
