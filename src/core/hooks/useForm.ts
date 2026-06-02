import { useState } from "react";
import { z } from "zod";

export function useForm<T>(schema: z.ZodSchema<T>, initialValues: T) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): boolean {
    const result = schema.safeParse(values);
    if (!result.success) {
      const fieldErrors: typeof errors = {};
      result.error.issues.forEach(e => {
        const field = e.path[0] as keyof T;
        fieldErrors[field] = e.message;
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  }

  return { values, setValues, errors, setErrors, validate, isSubmitting, setIsSubmitting };
}
