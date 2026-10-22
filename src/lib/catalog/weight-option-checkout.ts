import { customerWeightSelectionAllowed } from "./selling.ts";
import { parseWeightOption, type ProductWeightOption } from "./weight-options.ts";

export type CheckoutCartItem = {
  product_id: string;
  quantity: number;
  weight_option_id?: string | null;
};

export const WEIGHT_OPTIONS_SCHEMA_REQUIRED =
  "Weight options need the shipping/weight schema applied before checkout. Existing each-based products can still check out.";

type QueryClient = any;

export function checkoutItemsFromCart(
  items: Array<{ productId: string; quantity: number; weightOptionId?: string | null; sellingMethod?: string | null }>,
): CheckoutCartItem[] {
  return items.map((item) => ({
    product_id: item.productId,
    quantity: item.quantity,
    ...(item.weightOptionId && customerWeightSelectionAllowed(item.sellingMethod) ? { weight_option_id: item.weightOptionId } : {}),
  }));
}

export function checkoutItemsForSellingMethod(
  items: CheckoutCartItem[],
  products: Array<{ id?: string; selling_method?: string | null }>,
): CheckoutCartItem[] {
  return items.map((item) => {
    const product = products.find((row) => row.id === item.product_id);
    if (customerWeightSelectionAllowed(product?.selling_method)) return item;
    return { product_id: item.product_id, quantity: item.quantity };
  });
}

export function cartItemUsesWeightOption(item: { weight_option_id?: string | null }) {
  return Boolean(String(item.weight_option_id ?? "").trim());
}

export function requireWeightOptionSchema(items: CheckoutCartItem[], schemaReady: boolean) {
  if (items.some(cartItemUsesWeightOption) && !schemaReady) return WEIGHT_OPTIONS_SCHEMA_REQUIRED;
  return null;
}

export async function weightOptionsSchemaReady(supabase: QueryClient) {
  const options = await supabase.from("product_weight_options").select("id").limit(0);
  if (options.error) return false;
  const snapshots = await supabase.from("order_items").select("weight_option_id").limit(0);
  return !snapshots.error;
}

export async function loadProductWeightOptions(supabase: QueryClient, productIds: string[]) {
  const ids = [...new Set(productIds.filter(Boolean))];
  if (!ids.length) return { options: [] as ProductWeightOption[], schemaReady: true };
  const { data, error } = await supabase.from("product_weight_options").select("*").in("product_id", ids);
  if (error) return { options: [] as ProductWeightOption[], schemaReady: false };
  return {
    options: (data ?? []).map(parseWeightOption).filter((row: ProductWeightOption | null): row is ProductWeightOption => Boolean(row)),
    schemaReady: true,
  };
}

export function findWeightOption(
  options: ProductWeightOption[],
  productId: string,
  weightOptionId?: string | null,
) {
  const optionId = String(weightOptionId ?? "").trim();
  if (!optionId) return null;
  return options.find((option) => option.id === optionId && option.productId === productId) ?? null;
}

export function lineUnitPrice(productPrice: number | string | null | undefined, option?: ProductWeightOption | null) {
  if (option) return option.price;
  const price = Number(productPrice);
  return Number.isFinite(price) && price > 0 ? price : null;
}

export function attachCheckoutWeightOption<T extends { id?: string; price?: number | string | null; selling_method?: string | null }>(
  product: T,
  item: CheckoutCartItem,
  options: ProductWeightOption[],
) {
  const productId = String(product.id ?? item.product_id);
  const allowOption = customerWeightSelectionAllowed(product.selling_method);
  const weightOption = allowOption ? findWeightOption(options, productId, item.weight_option_id) : null;
  const price = lineUnitPrice(product.price, weightOption);
  return {
    ...product,
    id: productId,
    quantity: item.quantity,
    price,
    weightOption,
  };
}

export function weightOptionCheckoutError(
  items: CheckoutCartItem[],
  products: Array<{ id?: string; selling_method?: string | null; weightOption?: ProductWeightOption | null }>,
) {
  for (const item of items) {
    if (!cartItemUsesWeightOption(item)) continue;
    const product = products.find((row) => row.id === item.product_id);
    if (!customerWeightSelectionAllowed(product?.selling_method)) continue;
    const option = product?.weightOption ?? null;
    if (!option || !option.isEnabled) return "A selected weight option is no longer available.";
    if (option.trackInventory && (option.stockQuantity == null || option.stockQuantity < item.quantity)) {
      return "Some items are no longer available in the requested quantity.";
    }
  }
  return null;
}
