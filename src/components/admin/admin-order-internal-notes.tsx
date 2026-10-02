"use client";

import { useState, useTransition } from "react";
import { addOrderInternalNote, updateOrderInternalNote } from "@/src/lib/admin/order-ops-actions";
import { formatStoreDateTime } from "@/src/lib/store/timezone";
import { useLiveNotifications } from "@/src/components/realtime/live-notifications-provider";

export type InternalNote = {
  id: string;
  body: string;
  created_at: string;
  created_by: string | null;
  author_name?: string | null;
};

export function AdminOrderInternalNotes({ orderId, notes }: { orderId: string; notes: InternalNote[] }) {
  const live = useLiveNotifications();
  const [rows, setRows] = useState(notes);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  function add() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await addOrderInternalNote(orderId, draft);
      setBusy(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDraft("");
      setSaved(true);
      setRows((current) => [{ id: `local-${Date.now()}`, body: draft.trim(), created_at: new Date().toISOString(), created_by: null, author_name: "You" }, ...current]);
      live.bumpLiveOrder(orderId);
    });
  }

  function saveEdit(id: string) {
    if (id.startsWith("local-")) return;
    setBusy(true);
    startTransition(async () => {
      const result = await updateOrderInternalNote(id, editBody);
      setBusy(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      setRows((current) => current.map((row) => (row.id === id ? { ...row, body: editBody.trim() } : row)));
      setEditingId(null);
      live.bumpLiveOrder(orderId);
    });
  }

  return (
    <section className="rounded-2xl bg-white p-5">
      <h2 className="font-semibold text-[#173f35]">Internal notes</h2>
      <p className="mt-1 text-sm text-[#6b6b6b]">Admin only. Customers and receipts never see these.</p>
      <label className="mt-3 block text-sm text-[#173f35]">
        Add a note
        <textarea className="mt-2 min-h-24 w-full min-w-0 rounded-xl border border-[#173f35]/15 px-3 py-2" maxLength={2000} onChange={(event) => setDraft(event.target.value)} value={draft} />
      </label>
      <button className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-[#173f35] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || !draft.trim()} onClick={add} type="button">
        {busy ? "Saving…" : "Save note"}
      </button>
      {error ? <p className="mt-2 text-sm text-red-800">{error}</p> : null}
      {saved ? <p className="mt-2 text-sm text-[#173f35]">Updated ✓</p> : null}
      <ul className="mt-4 space-y-3">
        {rows.map((note) => (
          <li className="rounded-xl border border-[#173f35]/10 p-3" key={note.id}>
            {editingId === note.id ? (
              <>
                <textarea className="min-h-20 w-full rounded-xl border border-[#173f35]/15 px-3 py-2 text-sm" value={editBody} onChange={(event) => setEditBody(event.target.value)} />
                <div className="mt-2 flex gap-2">
                  <button className="min-h-11 rounded-xl bg-[#173f35] px-3 text-sm text-white" onClick={() => saveEdit(note.id)} type="button">Save</button>
                  <button className="min-h-11 px-3 text-sm text-[#173f35]" onClick={() => setEditingId(null)} type="button">Cancel</button>
                </div>
              </>
            ) : (
              <>
                <p className="whitespace-pre-wrap break-words text-sm text-[#173f35]">{note.body}</p>
                <p className="mt-2 text-xs text-[#6b6b6b]">{note.author_name || "Admin"} · {formatStoreDateTime(note.created_at)}</p>
                {!note.id.startsWith("local-") ? (
                  <button className="mt-1 min-h-11 text-sm font-semibold text-[#173f35] underline" onClick={() => { setEditingId(note.id); setEditBody(note.body); }} type="button">Edit</button>
                ) : null}
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
