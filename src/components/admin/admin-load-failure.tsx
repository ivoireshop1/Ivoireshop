import { AdminSupportFallback } from "@/src/components/admin/admin-support-fallback";

export function AdminLoadFailure({
  title,
  message,
  code,
}: {
  title: string;
  message: string;
  code?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold text-[#173f35]">{title}</h1>
      <p className="mt-3 text-sm text-[#6b6b6b]">{message}</p>
      {code ? <p className="mt-2 text-xs text-[#6b6b6b]">Reference: {code}</p> : null}
      <AdminSupportFallback />
    </div>
  );
}
