import type { FormModel } from '@sentinel/analysis';
import type { TestCase, GeneratorConfig, DataGeneratorStrategy } from '../types.js';
import { RealisticDataStrategy, BoundaryDataStrategy } from './strategies.js';

export function generateTestData(
  testCases: readonly TestCase[],
  forms: readonly FormModel[],
  config: GeneratorConfig,
): readonly TestCase[] {
  const strategy: DataGeneratorStrategy =
    config.dataStrategy === 'boundary' ? new BoundaryDataStrategy() : new RealisticDataStrategy();

  const result: TestCase[] = [];

  for (const tc of testCases) {
    // For test cases with form-submit steps, populate inputData
    const updatedSteps = tc.steps.map((step) => {
      if (step.action !== 'form-submit') return step;

      const matchingForm = forms[0];
      if (matchingForm === undefined) return step;

      const inputData: Record<string, string> = {};
      for (const field of matchingForm.fields) {
        const key =
          field.name ?? field.label ?? `field-${String(matchingForm.fields.indexOf(field))}`;
        inputData[key] = strategy.generateValid(field);
      }
      return { ...step, inputData };
    });

    result.push({ ...tc, steps: updatedSteps });

    // Generate error-path test cases — one per constraint violation per form
    if (tc.type === 'happy-path') {
      for (const form of forms) {
        for (const field of form.fields) {
          const invalids = strategy.generateInvalid(field);
          for (const invalid of invalids) {
            const errorSteps = updatedSteps.map((step) => {
              if (step.action !== 'form-submit') return step;
              const errorData: Record<string, string> = { ...step.inputData };
              const fieldKey =
                field.name ?? field.label ?? `field-${String(form.fields.indexOf(field))}`;
              errorData[fieldKey] = invalid.value;
              return { ...step, inputData: errorData };
            });

            result.push({
              ...tc,
              id: `${tc.id}-error-${invalid.violatedConstraint}-${field.name ?? field.inputType}`,
              name: `shows error for ${invalid.violatedConstraint} on ${field.name ?? field.label ?? field.inputType}`,
              type: 'error-path',
              steps: errorSteps,
              tags: [...tc.tags, 'error-path'],
            });
          }
        }
      }
    }
  }

  return result;
}
