import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export const inputClasses =
  "h-[54px] w-full rounded-button border border-hairline bg-charcoal px-4 text-base text-chalk outline-none transition-colors focus:border-chalk aria-[invalid=true]:border-conditioning";

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-fog">
        {label}
        {hint ? <span className="font-medium text-ash"> · {hint}</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-[13px] font-medium text-conditioning" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cn(inputClasses, className)} {...rest} />;
}

/**
 * Segmented control built from native radio inputs, so it works inside a
 * plain <form> / FormData and with the keyboard.
 */
export function Segmented<T extends string>({
  name,
  options,
  defaultValue,
  legend,
  hint,
  error,
}: {
  name: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  defaultValue?: T;
  legend: string;
  hint?: string;
  error?: string;
}) {
  return (
    <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
      <legend className="mb-2.5 p-0 text-[13px] font-semibold text-fog">
        {legend}
        {hint ? <span className="font-medium text-ash"> · {hint}</span> : null}
      </legend>
      <div className="flex rounded-button border border-line bg-charcoal p-1">
        {options.map((o) => (
          <label key={o.value} className="relative flex-1">
            <input
              type="radio"
              name={name}
              value={o.value}
              defaultChecked={defaultValue === o.value}
              className="peer sr-only"
            />
            <span className="press flex h-11 items-center justify-center rounded-[10px] px-2 text-center text-sm font-semibold leading-tight text-mist peer-checked:bg-chalk peer-checked:text-matte peer-focus-visible:outline-2 peer-focus-visible:outline-chalk">
              {o.label}
            </span>
          </label>
        ))}
      </div>
      {error ? (
        <p className="text-[13px] font-medium text-conditioning" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
