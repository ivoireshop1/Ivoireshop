<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Founder authentication (permanent)

- Never reset, rotate, generate, replace, or change any Production admin password (including `ivoireshop37@gmail.com` and the BADGER GHOST support mailbox).
- Never use Supabase Admin API, SQL, scripts, or CLI to change Production admin credentials, email, MFA, role, or sessions without explicit written approval.
- Never use Production admin accounts for automated testing. Use `qa-*@example.com` accounts and `scripts/qa-auth-guard.mjs` / `src/lib/auth/protected-accounts.ts`.
- Password recovery testing must not target protected Production admin mailboxes or ids.
- Steel Production authenticated verification requires founder-supervised login when Admin access is required.
