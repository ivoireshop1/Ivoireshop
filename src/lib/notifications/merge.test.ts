import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeInboxItems } from "./merge.ts";
import type { InboxItem } from "./inbox-item.ts";

const sample = (id: string, extra: Partial<InboxItem> = {}): InboxItem => ({
  id,
  kind: "order",
  title: "Order",
  message: "Update",
  created_at: "2026-10-02T18:58:00.000Z",
  read_at: null,
  event_type: "new_order",
  ...extra,
});

test("realtime merge deduplicates the same notification id", () => {
  const first = mergeInboxItems([], [sample("a"), sample("b")]);
  const next = mergeInboxItems(first, [sample("a", { title: "Updated" })]);
  assert.equal(next.length, 2);
  assert.equal(next.find((item) => item.id === "a")?.title, "Updated");
});
