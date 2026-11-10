import { easyshipPublicStatus } from "@/src/lib/shipping/easyship";

export function EasyshipRotationCard() {
  const status = easyshipPublicStatus();
  return (
    <section className="rounded-2xl border border-[#b8964c]/40 bg-[#fbf7ee] p-5">
      <h2 className="font-semibold text-[#173f35]">Easyship token rotation</h2>
      <p className="mt-2 text-sm text-[#7c5d1a]">
        Previously screenshot-exposed Easyship Production and Sandbox tokens must be rotated by the founder.
        This page never shows the secret. Prefer a least-privilege <strong>public.rate:read</strong> connection. Do not create shipments or buy labels from this key.
      </p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-[#6b6b6b]">Configured</dt><dd className="font-semibold text-[#173f35]">{status.configured ? "Yes" : "No"}</dd></div>
        <div><dt className="text-[#6b6b6b]">Mode</dt><dd className="font-semibold text-[#173f35]">{status.mode ?? "—"}</dd></div>
        <div><dt className="text-[#6b6b6b]">Key last 4</dt><dd className="font-semibold text-[#173f35]">{status.keyLast4 ? `••••${status.keyLast4}` : "—"}</dd></div>
        <div><dt className="text-[#6b6b6b]">Rotation</dt><dd className="font-semibold text-[#173f35]">{status.rotationRequired ? "Required" : status.keysRotated ? "Marked rotated" : "Not configured"}</dd></div>
      </dl>
      <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-[#173f35]">
        <li>In Easyship, revoke the screenshot-exposed Production and Sandbox API connections.</li>
        <li>Create new keys with rate-read scope only. Keep Sandbox and Production separate.</li>
        <li>In Vercel project ivoireshop1/ivoireshop Production, replace Sensitive <code>EASYSHIP_API_KEY</code>. Do not paste it into chat, Git, or screenshots.</li>
        <li>After both environments are replaced, set Sensitive <code>EASYSHIP_KEYS_ROTATED=true</code> on Steel Production only.</li>
      </ol>
    </section>
  );
}
