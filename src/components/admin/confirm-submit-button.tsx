"use client";

export function ConfirmSubmitButton({
  label,
  message,
  className,
}: {
  label: string;
  message: string;
  className: string;
}) {
  return (
    <button
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
      type="submit"
    >
      {label}
    </button>
  );
}
