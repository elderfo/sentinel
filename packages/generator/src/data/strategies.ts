import type { FormField } from '@sentinel/analysis';
import type { DataGeneratorStrategy, InvalidInput } from '../types.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function generateInvalidInputs(field: FormField): readonly InvalidInput[] {
  const results: InvalidInput[] = [];
  const { constraints } = field;

  if (constraints.required) {
    results.push({
      value: '',
      violatedConstraint: 'required',
      description: 'Empty value for required field',
    });
  }

  if (constraints.minLength !== null) {
    const len = constraints.minLength - 1;
    results.push({
      value: 'a'.repeat(Math.max(0, len)),
      violatedConstraint: 'minLength',
      description: `Value shorter than minimum length of ${String(constraints.minLength)}`,
    });
  }

  if (constraints.maxLength !== null) {
    results.push({
      value: 'a'.repeat(constraints.maxLength + 1),
      violatedConstraint: 'maxLength',
      description: `Value longer than maximum length of ${String(constraints.maxLength)}`,
    });
  }

  if (constraints.min !== null) {
    const minVal = Number(constraints.min);
    results.push({
      value: String(minVal - 1),
      violatedConstraint: 'min',
      description: `Value below minimum of ${constraints.min}`,
    });
  }

  if (constraints.max !== null) {
    const maxVal = Number(constraints.max);
    results.push({
      value: String(maxVal + 1),
      violatedConstraint: 'max',
      description: `Value above maximum of ${constraints.max}`,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// RealisticDataStrategy
// ---------------------------------------------------------------------------

export class RealisticDataStrategy implements DataGeneratorStrategy {
  readonly generateValid = (field: FormField): string => {
    const { constraints } = field;

    switch (field.inputType) {
      case 'email':
        return 'user@example.com';
      case 'tel':
        return '+1-555-0100';
      case 'date': {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${String(year)}-${month}-${day}`;
      }
      case 'number': {
        const min = constraints.min !== null ? Number(constraints.min) : 0;
        const max = constraints.max !== null ? Number(constraints.max) : 100;
        return String(Math.floor((min + max) / 2));
      }
      case 'password':
        return 'P@ssw0rd123!';
      default: {
        if (constraints.minLength !== null || constraints.maxLength !== null) {
          const minLen = constraints.minLength ?? 1;
          const maxLen = constraints.maxLength ?? minLen + 10;
          const targetLen = Math.min(Math.max(minLen, Math.floor((minLen + maxLen) / 2)), maxLen);
          return 'a'.repeat(targetLen);
        }
        return 'Test Value';
      }
    }
  };

  readonly generateInvalid = (field: FormField): readonly InvalidInput[] => {
    return generateInvalidInputs(field);
  };
}

// ---------------------------------------------------------------------------
// BoundaryDataStrategy
// ---------------------------------------------------------------------------

export class BoundaryDataStrategy implements DataGeneratorStrategy {
  readonly generateValid = (field: FormField): string => {
    const { constraints } = field;

    switch (field.inputType) {
      case 'email':
        return 'a@b.co';
      case 'tel':
        return '+10';
      case 'date': {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${String(year)}-${month}-${day}`;
      }
      case 'number': {
        const min = constraints.min !== null ? Number(constraints.min) : 0;
        return String(min);
      }
      case 'password':
        return 'P@ss1!';
      default: {
        if (constraints.minLength !== null) {
          return 'a'.repeat(constraints.minLength);
        }
        if (constraints.maxLength !== null) {
          return 'a'.repeat(constraints.maxLength);
        }
        return 'a';
      }
    }
  };

  readonly generateInvalid = (field: FormField): readonly InvalidInput[] => {
    return generateInvalidInputs(field);
  };
}
