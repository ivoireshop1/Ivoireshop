export function AdminSupportFallback({
  title = "Need help?",
}: {
  title?: string;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-[#173f35]/15 bg-white p-4 text-sm text-[#173f35]">
      <p className="font-semibold">{title}</p>
      <p className="mt-2 text-[#6b6b6b]">If this continues, contact Ivoire Shop support.</p>
      <p className="mt-3">
        Phone:{" "}
        <a className="font-medium underline underline-offset-2" href="tel:3138259887">
          313-825-9887
        </a>
      </p>
      <p className="mt-1">
        Email:{" "}
        <a className="font-medium break-all underline underline-offset-2" href="mailto:jittabadger.business@gmail.com">
          jittabadger.business@gmail.com
        </a>
      </p>
    </div>
  );
}
