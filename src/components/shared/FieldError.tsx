'use client';

import { useState, useCallback } from 'react';

// ============================================================================
// FieldError — Tiny inline error message for form fields
// ============================================================================

/**
 * Renders an inline field-level validation error.
 * Use directly below the input/select element.
 *
 * @example
 * <Input className={fieldErrorClass(errors.email)} ... />
 * <FieldError message={errors.email} />
 */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-500 mt-1">{message}</p>;
}

/**
 * Returns `'border-red-500'` when there's an error, empty string otherwise.
 * Append to the input's className.
 */
export function fieldErrorClass(error?: string): string {
  return error ? 'border-red-500' : '';
}

// ============================================================================
// useFormErrors — Lightweight inline-error state for useState-based forms
// ============================================================================

type ErrorMap<T extends string = string> = Partial<Record<T, string>>;

/**
 * Hook to manage field-level error messages for existing useState-based forms.
 * Does NOT replace React Hook Form — use for forms that aren't worth a full RHF migration.
 *
 * @example
 * const { errors, setFieldError, clearFieldError, clearAll, validateFields } = useFormErrors<'email' | 'password'>();
 *
 * // In submit handler:
 * const valid = validateFields({
 *   email: [!email, 'Email is required'],
 *   password: [password.length < 6, 'Password must be at least 6 characters'],
 * });
 * if (!valid) return;
 */
export function useFormErrors<T extends string = string>() {
  const [errors, setErrors] = useState<ErrorMap<T>>({});

  const setFieldError = useCallback((field: T, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  }, []);

  const clearFieldError = useCallback((field: T) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setErrors({}), []);

  /**
   * Validate multiple fields at once.
   * Pass a record of `fieldName: [condition, errorMessage]`.
   * Returns `true` if all fields pass, `false` if any fail.
   * Sets error messages on failing fields and clears passing ones.
   */
  const validateFields = useCallback(
    (rules: Partial<Record<T, [boolean, string]>>): boolean => {
      const newErrors: ErrorMap<T> = {};
      let valid = true;

      for (const [field, rule] of Object.entries(rules) as [T, [boolean, string]][]) {
        if (rule && rule[0]) {
          newErrors[field] = rule[1];
          valid = false;
        }
      }

      setErrors(newErrors);
      return valid;
    },
    []
  );

  return { errors, setFieldError, clearFieldError, clearAll, validateFields };
}
