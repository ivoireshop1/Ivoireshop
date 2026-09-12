const benefits = [
  ["01", "Quality products", "Carefully selected products you can trust."],
  ["02", "Easy shopping", "Find and order your favorite products easily."],
  ["03", "Secure checkout", "Safe and simple checkout experience."],
  ["04", "Shop your way", "Sign in, create an account, or browse as a guest."],
];

export function BenefitsSection() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8" id="about">
      <div className="grid gap-5 border-y border-black/10 py-10 md:grid-cols-3">
        {benefits.map(([number, title, copy]) => <div className="flex gap-4" key={title}><span className="text-sm font-semibold text-gold">{number}</span><div><h2 className="font-semibold uppercase tracking-wide text-forest-green">{title}</h2><p className="mt-2 text-sm leading-6 text-muted">{copy}</p></div></div>)}
      </div>
    </section>
  );
}
