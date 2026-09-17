import { requireAdmin } from "@/src/lib/auth/guards";

export default async function AdminPaymentsPage() {
  await requireAdmin();

  const providers = [
    {
      name: "Stripe",
      configured: Boolean(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_PUBLISHABLE_KEY),
      environment: process.env.STRIPE_SECRET_KEY ? "Live env detected" : "Not configured",
      keys: ["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY"],
    },
    {
      name: "Square",
      configured: Boolean(process.env.SQUARE_APPLICATION_ID || process.env.SQUARE_ACCESS_TOKEN),
      environment: process.env.SQUARE_ACCESS_TOKEN ? "Live env detected" : "Not configured",
      keys: ["SQUARE_APPLICATION_ID", "SQUARE_ACCESS_TOKEN", "SQUARE_LOCATION_ID"],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#b8964c]">Setup</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#173f35]">Payments</h1>
      </div>

      <div className="space-y-4">
        {providers.map((provider) => (
          <section className="rounded-[28px] border border-[#173f35]/10 bg-white p-6 shadow-[0_12px_32px_rgba(23,63,53,0.04)]" key={provider.name}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#b8964c]">Provider</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#173f35]">{provider.name}</h2>
              </div>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] ${
                  provider.configured ? "bg-[#173f35]/10 text-[#173f35]" : "bg-[#7f1d1d]/10 text-[#7f1d1d]"
                }`}
              >
                {provider.configured ? "Configured" : "Not configured"}
              </span>
            </div>

            <p className="mt-4 text-sm text-[#6b6b6b]">{provider.environment}</p>

            <div className="mt-4 rounded-2xl border border-[#173f35]/10 bg-[#f9f7f3] p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#6b6b6b]">Expected environment keys</p>
              <ul className="mt-3 space-y-2 text-sm text-[#173f35]">
                {provider.keys.map((key) => (
                  <li key={key}>• {key}</li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
