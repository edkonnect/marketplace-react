import { forwardRef } from "react";
import type { ReactElement } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  RegisteredFieldReturn,
  UseValidatedFormReturn,
} from "@/hooks/useValidatedForm";

type BaseFieldProps = {
  label?: React.ReactNode;
  required?: boolean;
  helperText?: React.ReactNode;
  className?: string;
  meta?: {
    error: string | null;
    touched: boolean;
    invalid: boolean;
  };
  children: React.ReactNode;
};

export function FormFieldWrapper({
  label,
  required,
  helperText,
  meta,
  className,
  children,
}: BaseFieldProps) {
  const showError = meta?.touched && !!meta?.error;

  return (
    <div
      className={cn("form-field", className)}
      data-invalid={showError || undefined}
    >
      {label && (
        <Label className="form-label">
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
      )}

      {children}

      {showError ? (
        <p className="form-error" role="alert">
          {meta?.error}
        </p>
      ) : (
        helperText && <p className="form-helper">{helperText}</p>
      )}
    </div>
  );
}

type InputFieldProps<TValues extends Record<string, any>, K extends keyof TValues> = {
  field: RegisteredFieldReturn<TValues, K>;
  label?: React.ReactNode;
  required?: boolean;
  helperText?: React.ReactNode;
} & Omit<React.ComponentProps<typeof Input>, "name" | "value" | "onChange" | "onBlur">;

export const FormInput = forwardRef(
  <TValues extends Record<string, any>, K extends keyof TValues>(
    { field, label, required, helperText, className, ...props }: InputFieldProps<TValues, K>,
    ref: React.Ref<HTMLInputElement>
  ) => {
    const { inputProps, meta } = field;
    return (
      <FormFieldWrapper
        label={label}
        required={required}
        helperText={helperText}
        meta={meta}
      >
        <Input
          {...inputProps}
          {...props}
          ref={ref}
          className={className}
          aria-invalid={meta.invalid || undefined}
          data-invalid={meta.invalid || undefined}
          onBlur={inputProps.onBlur}
        />
      </FormFieldWrapper>
    );
  }
) as <TValues extends Record<string, any>, K extends keyof TValues>(
  props: InputFieldProps<TValues, K> & { ref?: React.Ref<HTMLInputElement> }
) => ReactElement;

type TextareaFieldProps<TValues extends Record<string, any>, K extends keyof TValues> = {
  field: RegisteredFieldReturn<TValues, K>;
  label?: React.ReactNode;
  required?: boolean;
  helperText?: React.ReactNode;
} & Omit<React.ComponentProps<typeof Textarea>, "name" | "value" | "onChange" | "onBlur">;

export const FormTextarea = forwardRef(
  <TValues extends Record<string, any>, K extends keyof TValues>(
    { field, label, required, helperText, className, ...props }: TextareaFieldProps<TValues, K>,
    ref: React.Ref<HTMLTextAreaElement>
  ) => {
    const { inputProps, meta } = field;
    return (
      <FormFieldWrapper
        label={label}
        required={required}
        helperText={helperText}
        meta={meta}
      >
        <Textarea
          {...inputProps}
          {...props}
          ref={ref}
          className={className}
          aria-invalid={meta.invalid || undefined}
          data-invalid={meta.invalid || undefined}
          onBlur={inputProps.onBlur}
        />
      </FormFieldWrapper>
    );
  }
) as <TValues extends Record<string, any>, K extends keyof TValues>(
  props: TextareaFieldProps<TValues, K> & { ref?: React.Ref<HTMLTextAreaElement> }
) => ReactElement;

type SelectFieldProps<TValues extends Record<string, any>, K extends keyof TValues> = {
  field: RegisteredFieldReturn<TValues, K>;
  label?: React.ReactNode;
  required?: boolean;
  helperText?: React.ReactNode;
  placeholder?: string;
  children: React.ReactNode;
};

export function FormSelect<TValues extends Record<string, any>, K extends keyof TValues>({
  field,
  label,
  required,
  helperText,
  placeholder,
  children,
}: SelectFieldProps<TValues, K>) {
  const { inputProps, meta, touch } = field;
  const ariaInvalid = meta.invalid || undefined;

  return (
    <FormFieldWrapper
      label={label}
      required={required}
      helperText={helperText}
      meta={meta}
    >
      <Select
        value={(inputProps.value as string | undefined) ?? ""}
        onValueChange={(value) => {
          inputProps.onChange(value);
          touch();
        }}
      >
        <SelectTrigger
          aria-invalid={ariaInvalid}
          data-invalid={ariaInvalid}
          onBlur={inputProps.onBlur}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </FormFieldWrapper>
  );
}

type CheckboxGroupItem = {
  value: string;
  label: string;
};

type CheckboxGroupProps<TValues extends Record<string, any>, K extends keyof TValues> = {
  field: RegisteredFieldReturn<TValues, K>;
  items: CheckboxGroupItem[];
  selected: string[];
  onToggle: (value: string) => void;
  label?: React.ReactNode;
  required?: boolean;
  helperText?: React.ReactNode;
  columns?: number;
};

export function FormCheckboxGroup<TValues extends Record<string, any>, K extends keyof TValues>({
  field,
  items,
  selected,
  onToggle,
  label,
  required,
  helperText,
  columns = 3,
}: CheckboxGroupProps<TValues, K>) {
  const { meta } = field;
  const ariaInvalid = meta.invalid || undefined;

  return (
    <FormFieldWrapper
      label={label}
      required={required}
      helperText={helperText}
      meta={meta}
    >
      <div
        role="group"
        aria-invalid={ariaInvalid}
        className={cn(
          "grid gap-3",
          columns === 2 && "md:grid-cols-2",
          columns === 3 && "md:grid-cols-3"
        )}
      >
        {items.map((item) => (
          <label
            key={item.value}
            className="flex items-center space-x-2 cursor-pointer"
          >
            <input
              type="checkbox"
              aria-invalid={ariaInvalid}
              checked={selected.includes(item.value)}
              onChange={() => {
                field.touch();
                onToggle(item.value);
              }}
              onBlur={field.touch}
              className="w-4 h-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
            />
            <span className="text-sm">{item.label}</span>
          </label>
        ))}
      </div>
    </FormFieldWrapper>
  );
}

export type FormHelpers<TValues extends Record<string, any>> = Pick<
  UseValidatedFormReturn<TValues>,
  "register" | "setValue" | "touch" | "getMeta" | "validateForm" | "values"
>;
