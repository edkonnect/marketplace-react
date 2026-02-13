import { useCallback, useRef, useEffect, useState } from "react";

export type FieldValidator<TValues, TValue = any> = (
  value: TValue,
  values: TValues
) => string | null;

export type ValidatorMap<TValues> = {
  [K in keyof TValues]?:
    | FieldValidator<TValues, TValues[K]>
    | Array<FieldValidator<TValues, TValues[K]>>;
};

type FieldMeta = {
  error: string | null;
  touched: boolean;
  invalid: boolean;
};

type SetValueOptions = {
  validate?: boolean;
  touch?: boolean;
};

type RegisteredField<TValues, K extends keyof TValues> = {
  inputProps: {
    name: string;
    value: TValues[K];
    onChange: (value: any) => void;
    onBlur: () => void;
    "aria-invalid"?: boolean;
    "data-invalid"?: boolean;
  };
  meta: FieldMeta;
  setValue: (
    next: TValues[K] | ((prev: TValues[K]) => TValues[K]),
    options?: SetValueOptions
  ) => void;
  touch: () => void;
};

const parseEventValue = (valueOrEvent: any) => {
  if (valueOrEvent && typeof valueOrEvent === "object" && "target" in valueOrEvent) {
    const target = (valueOrEvent as { target: HTMLInputElement }).target;
    if (target.type === "checkbox") {
      return target.checked as any;
    }
    return target.value as any;
  }

  return valueOrEvent as any;
};

export function useValidatedForm<TValues extends Record<string, any>>(
  initialValues: TValues,
  validators: ValidatorMap<TValues> = {}
) {
  const initialValuesRef = useRef(initialValues);

  useEffect(() => {
    initialValuesRef.current = initialValues;
  }, [initialValues]);

  // Keep validators in a ref so inline object literals don't cause cascading re-renders
  const validatorsRef = useRef(validators);
  useEffect(() => {
    validatorsRef.current = validators;
  });

  const [values, setValues] = useState<TValues>(initialValuesRef.current);
  const [touched, setTouched] = useState<Partial<Record<keyof TValues, boolean>>>(
    {}
  );
  const [errors, setErrors] = useState<Partial<Record<keyof TValues, string | null>>>(
    {}
  );

  const runValidators = useCallback(
    <K extends keyof TValues>(name: K, value: TValues[K], allValues: TValues) => {
      const rules = validatorsRef.current[name];
      const validatorsForField = Array.isArray(rules)
        ? (rules as Array<FieldValidator<TValues, TValues[K]>>)
        : rules
          ? [rules as FieldValidator<TValues, TValues[K]>]
          : [];

      const message =
        validatorsForField
          .map((rule) => rule(value, allValues))
          .find((result) => result) ?? null;

      setErrors((prev) => ({ ...prev, [name]: message }));
      return message;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const getMeta = useCallback(
    <K extends keyof TValues>(name: K): FieldMeta => {
      const error = (errors[name] as string | null) ?? null;
      const isTouched = !!touched[name];
      return {
        error,
        touched: isTouched,
        invalid: isTouched && !!error,
      };
    },
    [errors, touched]
  );

  const touch = useCallback(<K extends keyof TValues>(name: K) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
  }, []);

  const setValue = useCallback(
    <K extends keyof TValues>(
      name: K,
      next: TValues[K] | ((prev: TValues[K]) => TValues[K]),
      options: SetValueOptions = {}
    ) => {
      setValues((prev) => {
        const nextValue =
          typeof next === "function" ? (next as (prev: TValues[K]) => TValues[K])(prev[name]) : next;
        const nextValues = { ...prev, [name]: nextValue };
        const shouldValidate = options.validate ?? !!touched[name];

        if (options.touch) {
          setTouched((current) => ({ ...current, [name]: true }));
        }

        if (shouldValidate) {
          runValidators(name, nextValue, nextValues);
        }

        return nextValues;
      });
    },
    [runValidators, touched]
  );

  const register = useCallback(
    <K extends keyof TValues>(
      name: K,
      options: {
        parse?: (value: any) => TValues[K];
        validateOnChange?: boolean;
      } = {}
    ): RegisteredField<TValues, K> => {
      const meta = getMeta(name);

      const handleChange = (valueOrEvent: any) => {
        const parsed = options.parse ? options.parse(valueOrEvent) : parseEventValue(valueOrEvent);
        setValue(name, parsed, {
          validate: options.validateOnChange ?? meta.touched,
        });
      };

      const handleBlur = () => {
        touch(name);
        runValidators(name, values[name], values);
      };

      return {
        inputProps: {
          name: String(name),
          value: values[name] as TValues[K],
          onChange: handleChange,
          onBlur: handleBlur,
          "aria-invalid": meta.invalid || undefined,
          "data-invalid": meta.invalid || undefined,
        },
        meta,
        setValue: (next, setOptions) => setValue(name, next, setOptions),
        touch: () => touch(name),
      };
    },
    [getMeta, runValidators, setValue, touch, values]
  );

  const validateForm = useCallback(
    (valuesOverride?: TValues) => {
      const currentValues = valuesOverride ?? values;
      let isValid = true;
      const touchedFields: Partial<Record<keyof TValues, boolean>> = {};
      const nextErrors: Partial<Record<keyof TValues, string | null>> = {};

      (Object.keys(validatorsRef.current) as Array<keyof TValues>).forEach((name) => {
        touchedFields[name] = true;
        const message = runValidators(name, currentValues[name], currentValues);
        nextErrors[name] = message;
        if (message) {
          isValid = false;
        }
      });

      if (Object.keys(touchedFields).length > 0) {
        setTouched((prev) => ({ ...prev, ...touchedFields }));
      }

      return { isValid, errors: nextErrors };
    },
    [runValidators, values]
  );

  const reset = useCallback((nextValues?: TValues) => {
    const base = nextValues ?? initialValuesRef.current;
    setValues(base);
    setErrors({});
    setTouched({});
  }, []);

  return {
    values,
    errors,
    touched,
    register,
    setValue,
    touch,
    getMeta,
    validateForm,
    reset,
  };
}

export type UseValidatedFormReturn<TValues extends Record<string, any>> = ReturnType<
  typeof useValidatedForm<TValues>
>;
export type RegisteredFieldReturn<TValues extends Record<string, any>, K extends keyof TValues> =
  RegisteredField<TValues, K>;
