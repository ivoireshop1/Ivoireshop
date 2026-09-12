const benefits = [
  ["01", "Quality products", "Curated essentials chosen for freshness, flavor, and everyday trust."],
  ["02", "Easy shopping", "Browse, filter, and order your favorites in just a few clicks."],
  ["03", "Secure checkout", "A simple, reassuring checkout experience built for peace of mind."],
  ["04", "Shop your way", "Create an account, save favorites, or shop as a guest whenever you like."],
];

export function BenefitsSection() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8" id="about">
      <div className="rounded-[30px] border border-black/10 bg-[#f5f0e6] p-4 shadow-[0_20px_35px_rgba(23,63,53,0.04)] sm:p-6">
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Why shoppers choose us</p>
            <h2 className="mt-2 text-3xl font-semibold text-forest-green">A better grocery routine</h2>
          </div>
          <p className="max-w-lg text-sm leading-6 text-muted">
            Thoughtful essentials and a smooth experience that makes everyday shopping feel easier and more joyful.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {benefits.map(([number, title, copy]) => (
            <div className="rounded-[22px] border border-black/8 bg-white/70 p-5 shadow-sm" key={title}>
              <span className="text-sm font-semibold text-gold">{number}</span>
              <h3 className="mt-4 text-lg font-semibold uppercase tracking-[0.08em] text-forest-green">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
