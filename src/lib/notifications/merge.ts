import type { InboxItem } from "./inbox-item";

export function mergeInboxItems(current: InboxItem[], incoming: InboxItem[], limit = 80) {
  const next = [...current];
  for (const row of incoming) {
    const index = next.findIndex((item) => item.id === row.id && item.kind === row.kind);
    if (index >= 0) next[index] = { ...next[index], ...row };
    else next.unshift(row);
  }
  return next.slice(0, limit);
}
