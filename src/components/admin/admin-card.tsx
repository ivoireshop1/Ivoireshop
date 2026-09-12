import { ReactNode } from "react";

export function AdminCard({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-[#173f35]/10 bg-white p-5 shadow-[0_12px_32px_rgba(23,63,53,0.05)] ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-[#173f35]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
