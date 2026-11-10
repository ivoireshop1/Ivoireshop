import { notFound } from "next/navigation";
import { CompareBuyLabels } from "@/src/components/admin/compare-buy-labels";
import { compareLabelsEligible } from "@/src/lib/shipping/compare-labels";
import { previewCompareQuotes, previewPurchaseBlocked } from "@/src/lib/shipping/compare-label-preview";

export const dynamic = "force-dynamic";

const destination = {
  name: "QA Quote",
  address_line_1: "233 Peachtree St NE",
  address_line_2: "",
  city: "Atlanta",
  state: "GA",
  postal_code: "30303",
  country: "US",
};

const shipFrom = {
  name: "Ivoire Shop",
  address_line_1: "1210 Rockbridge Rd NW",
  city: "Norcross",
  state: "GA",
  postal_code: "30093",
  country: "US",
};

const samples = [
  { id: "preview-parcel", label: "Paid UPS parcel", fulfillment_method: "delivery", fulfillment_provider: "ups" },
  { id: "preview-pickup", label: "Store pickup", fulfillment_method: "local_pickup", fulfillment_provider: "pickup" },
  { id: "preview-local", label: "Local delivery", fulfillment_method: "delivery", fulfillment_provider: "store" },
];

export default function CompareLabelsPreviewPage() {
  if (process.env.COMPARE_LABELS_PREVIEW !== "1") notFound();
  return (
    <main className="mx-auto max-w-5xl space-y-8 bg-[#f7f4ef] p-4">
      <p className="rounded-xl bg-white p-4 text-sm text-[#173f35]">Sample quotes for layout checks. This page does not call Easyship and cannot buy postage. The customer shipping charge shown here stays $12.50.</p>
      {samples.map((order) => (
        <section data-order-kind={order.id} key={order.id}>
          <h1 className="mb-3 text-lg font-semibold text-[#173f35]">{order.label}</h1>
          {compareLabelsEligible(order) ? (
            <CompareBuyLabels
              customerShipping={12.5}
              destination={destination}
              orderId={order.id}
              purchaseAction={previewPurchaseBlocked}
              quoteAction={previewCompareQuotes}
              savedCourierServiceId="preview-ups-ground"
              savedService="UPS Ground"
              shipFrom={shipFrom}
              verifiedPurchaseAllowed={false}
            />
          ) : (
            <p data-compare-absent={order.id}>Compare & Buy Labels is not shown.</p>
          )}
        </section>
      ))}
    </main>
  );
}
