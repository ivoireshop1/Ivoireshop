import { Footer } from "@/src/components/layout/footer";
import { Header } from "@/src/components/layout/header";
import { PageHero } from "@/src/components/storefront/page-hero";
import { ContactForm } from "@/src/components/customer/contact-form";

const faqs = [["How do I shop as a guest?", "Browse the shop and add products to your cart without creating an account."], ["Can I create an account later?", "Yes. You can create an account whenever you are ready."], ["How do I find products?", "Use the shop search, category filters, or browse our category collection."], ["How does delivery work?", "Delivery details will be shared as the shopping and checkout experience develops."]];

export default function ContactPage() {
  return <><Header /><main><PageHero eyebrow="Get in touch" title="We're Here To Help." description="Have a question about a product, your order, or shopping with Ivoire Shop? We're here to help." />
    <section className="mx-auto grid max-w-7xl gap-12 px-5 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:px-8"><ContactForm /><div className="space-y-4"><h2 className="text-2xl font-semibold text-forest-green">Shopping with confidence</h2>{[["Customer Support", "We're here to help with your shopping experience."], ["Secure Shopping", "Shop with confidence through our secure checkout process."]].map(([title, copy]) => <div className="rounded-xl border border-black/10 bg-surface p-5" key={title}><h3 className="font-semibold text-forest-green">{title}</h3><p className="mt-2 text-sm leading-6 text-muted">{copy}</p></div>)}</div></section>
    <section className="bg-[#f5f0e6]"><div className="mx-auto max-w-3xl px-5 py-16 lg:px-8"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Helpful answers</p><h2 className="mt-3 text-3xl font-semibold text-forest-green">Frequently Asked Questions</h2><div className="mt-8 divide-y divide-black/10">{faqs.map(([question, answer]) => <details className="py-4" key={question}><summary className="cursor-pointer font-semibold text-forest-green">{question}</summary><p className="mt-3 text-sm leading-6 text-muted">{answer}</p></details>)}</div></div></section>
  </main><Footer /></>;
}
