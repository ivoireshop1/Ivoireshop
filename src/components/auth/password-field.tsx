"use client";

import { useId, useState } from "react";

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  minLength = 8,
  required = true,
  name,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
  required?: boolean;
  name?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  const toggleLabel = visible ? "Hide password" : "Show password";

  return (
    <div>
      <label className="block text-sm font-medium" htmlFor={inputId}>
        {label}
      </label>
      <div className="relative mt-2">
        <input
          autoComplete={autoComplete}
          className="min-h-11 w-full min-w-0 rounded-lg border border-black/15 py-3 pl-4 pr-12"
          id={inputId}
          minLength={minLength}
          name={name}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          type={visible ? "text" : "password"}
          value={value}
        />
        <button
          aria-controls={inputId}
          aria-label={toggleLabel}
          aria-pressed={visible}
          className="absolute inset-y-1 right-1 inline-flex w-10 items-center justify-center rounded-md text-forest-green hover:bg-forest-green/5"
          onClick={() => setVisible((current) => !current)}
          onMouseDown={(event) => event.preventDefault()}
          type="button"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10.5 6.2A10.7 10.7 0 0 1 12 6c6.5 0 10 6 10 6a18.4 18.4 0 0 1-3.2 3.8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6.1 6.8C3.7 8.5 2 12 2 12s3.5 6 10 6c1.4 0 2.7-.3 3.8-.8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9.9 9.9a2.5 2.5 0 0 0 3.5 3.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
