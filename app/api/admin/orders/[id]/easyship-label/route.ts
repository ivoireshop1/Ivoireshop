import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/auth/guards";
import { labelPdfReady } from "@/src/lib/shipping/easyship-labels";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("easyship_label_purchases")
    .select("label_pdf_base64, label_ready")
    .eq("order_id", id)
    .eq("status", "purchased")
    .eq("label_ready", true)
    .order("purchased_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const encoded = typeof data?.label_pdf_base64 === "string" ? data.label_pdf_base64.replace(/\s/g, "") : "";
  if (!data?.label_ready || !labelPdfReady(encoded)) {
    return NextResponse.json({ error: "A purchased UPS label file is not stored for this order." }, { status: 404 });
  }
  const bytes = Buffer.from(encoded, "base64");
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="ups-label.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
