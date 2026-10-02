"use server";

import { requireAdmin } from "@/src/lib/auth/guards";

export async function setOrderItemPicked(orderId: string, orderItemId: string, picked: boolean) {
  const { supabase, user } = await requireAdmin();
  if (picked) {
    const { error } = await supabase.from("order_item_picks").upsert({
      order_item_id: orderItemId,
      order_id: orderId,
      picked_by: user.id,
      picked_at: new Date().toISOString(),
    }, { onConflict: "order_item_id" });
    if (error) return { error: "Could not save picked state." };
    return { saved: true, picked: true };
  }
  const { error } = await supabase.from("order_item_picks").delete().eq("order_item_id", orderItemId).eq("order_id", orderId);
  if (error) return { error: "Could not clear picked state." };
  return { saved: true, picked: false };
}

export async function addOrderInternalNote(orderId: string, body: string) {
  const { supabase, user } = await requireAdmin();
  const text = body.trim();
  if (text.length < 1 || text.length > 2000) return { error: "Enter a note up to 2,000 characters." };
  const { error } = await supabase.from("order_internal_notes").insert({
    order_id: orderId,
    body: text,
    created_by: user.id,
  });
  if (error) return { error: "Could not save the note." };
  return { saved: true };
}

export async function updateOrderInternalNote(noteId: string, body: string) {
  const { supabase } = await requireAdmin();
  const text = body.trim();
  if (text.length < 1 || text.length > 2000) return { error: "Enter a note up to 2,000 characters." };
  const { error } = await supabase.from("order_internal_notes").update({ body: text }).eq("id", noteId);
  if (error) return { error: "Could not update the note." };
  return { saved: true };
}
