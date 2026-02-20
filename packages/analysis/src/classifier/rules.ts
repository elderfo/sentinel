import type { ElementCategory } from '../types.js';

/** Maps ARIA roles to element categories. */
const ROLE_TO_CATEGORY: Readonly<Record<string, ElementCategory>> = {
  button: 'button',
  link: 'navigation-link',
  checkbox: 'checkbox',
  radio: 'radio',
  combobox: 'dropdown',
  listbox: 'dropdown',
  textbox: 'form-field',
  searchbox: 'form-field',
  spinbutton: 'form-field',
  slider: 'form-field',
};

/** Maps input types to element categories. */
const INPUT_TYPE_TO_CATEGORY: Readonly<Record<string, ElementCategory>> = {
  checkbox: 'checkbox',
  radio: 'radio',
  date: 'date-picker',
  'datetime-local': 'date-picker',
  month: 'date-picker',
  week: 'date-picker',
  time: 'date-picker',
  file: 'file-upload',
};

/** Maps tag names to element categories (for tags that are always interactive). */
const TAG_TO_CATEGORY: Readonly<Record<string, ElementCategory>> = {
  button: 'button',
  select: 'dropdown',
  textarea: 'form-field',
};

export function categorizeByRole(role: string): ElementCategory | null {
  return ROLE_TO_CATEGORY[role] ?? null;
}

export function categorizeByTag(
  tag: string,
  attributes: Readonly<Record<string, string>>,
): ElementCategory | null {
  const lower = tag.toLowerCase();

  if (lower === 'a' && 'href' in attributes) {
    return 'navigation-link';
  }

  if (lower === 'input') {
    const inputType = (attributes['type'] ?? 'text').toLowerCase();
    return INPUT_TYPE_TO_CATEGORY[inputType] ?? 'form-field';
  }

  return TAG_TO_CATEGORY[lower] ?? null;
}
