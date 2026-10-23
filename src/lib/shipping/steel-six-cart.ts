import type { CartParcelProduct } from "./packages";

export type SteelSixLine = CartParcelProduct & { id: string };

export const STEEL_SIX_CART: SteelSixLine[] = [
  {
    id: "482b28fb-09eb-44ce-815f-042d3a7d058b",
    name: "ELEPHANT BRAND Broken Jasmine Rice A1 Super",
    quantity: 1,
    item_weight_lb: 25,
    weight_oz: 400,
    packaging_weight_oz: 4,
    weight_source: "verified",
    category_slug: "ivoire-market",
  },
  {
    id: "d284cc2a-3d1d-4417-9093-5afdea56eed5",
    name: "Peak milk",
    quantity: 1,
    packaging_weight_oz: 4,
    category_slug: "ivoire-market",
  },
  {
    id: "d8cf6231-d804-4f84-a459-26237e11bcaa",
    name: "Cow Feet’s",
    quantity: 1,
    packaging_weight_oz: 4,
    category_slug: "ivoire-market",
  },
  {
    id: "78137679-cf2b-4eb9-96db-72cd0a1ce67c",
    name: "My project 1 (53)",
    quantity: 1,
    packaging_weight_oz: 4,
    category_slug: "ivoire-market",
  },
  {
    id: "138fff79-4418-4cc7-9d4e-cb7129d88e0c",
    name: "Caro Light Lightening Beauty Cream",
    quantity: 1,
    packaging_weight_oz: 4,
    category_slug: "ivoire-market",
  },
  {
    id: "af9202bc-c0fd-40a0-889c-687770541b4d",
    name: "MAKARI Naturalle Carotonic Extrême Glow Renewing Face Cream SPF 15, 50ml",
    quantity: 1,
    packaging_weight_oz: 4,
    category_slug: "ivoire-market",
  },
] as const;

export const STEEL_SIX_SHIPPO_DESTINATION = {
  name: "Shippo TEST recipient",
  address_line_1: "1 Main St",
  city: "Clayton",
  state: "OH",
  postal_code: "45315",
  country: "US",
} as const;
