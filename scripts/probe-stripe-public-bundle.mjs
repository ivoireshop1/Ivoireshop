/** Safe Production probe: does the storefront bundle contain a Stripe publishable key? Never prints the full key. */
const origin = process.argv[2] || "https://ivoireshop-steel.vercel.app";
const html = await (await fetch(`${origin}/checkout`)).text();
const urls = [...html.matchAll(/\/_next\/static\/[^"']+\.js/g)].map((m) => m[0]);
let hit = null;
for (const path of urls.slice(0, 40)) {
  const js = await (await fetch(`${origin}${path}`)).text();
  const match = js.match(/pk_(test|live)_[A-Za-z0-9]+/);
  if (match) {
    hit = { mode: match[1], prefix: match[0].slice(0, 12), length: match[0].length, file: path };
    break;
  }
}
console.log(
  JSON.stringify(
    {
      origin,
      publishableInClientBundle: Boolean(hit),
      mode: hit?.mode ?? null,
      prefix: hit?.prefix ?? null,
      length: hit?.length ?? 0,
      filesChecked: Math.min(urls.length, 40),
    },
    null,
    2,
  ),
);
