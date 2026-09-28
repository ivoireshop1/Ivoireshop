import { createClient } from "@/src/lib/supabase/server";
import { productMissingRequirements, productNeedsReview, productReadyToPublish } from "@/src/lib/catalog/product-readiness";
import { describeStoreStatus, getStoreStatus } from "@/src/lib/store/status";
import { startOfStoreDayIso, storeGreetingAt } from "@/src/lib/store/timezone";

export type AdminDashboardMetric = {
  label: string;
  value: string;
  detail: string;
  tone: "positive" | "warning" | "neutral" | "danger";
  href?: string;
};

export type AdminActionItem = {
  title: string;
  count: number;
  description: string;
  href: string;
  tone: "positive" | "warning" | "danger" | "neutral";
};

export type AdminRecentOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  itemCount: number;
  total: number;
  status: string;
  createdAt: string;
};

export type AdminBestSeller = {
  productId: string;
  productName: string;
  units: number;
  revenue: number;
  stock: number;
};

export type AdminRevenuePoint = {
  label: string;
  value: number;
};

export type AdminStoreStatus = {
  isOpen: boolean;
  label: string;
  description: string;
  tone: "positive" | "warning" | "neutral";
  updatedAt: string | null;
};

export async function getAdminDashboardData() {
  const supabase = await createClient();
  const startOfToday = startOfStoreDayIso();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [todayOrdersResult, todayCustomersResult, productResult, recentOrdersResult, orderItemsResult, allOrdersResult, pendingReviewsResult, storeStatusRow] =
    await Promise.all([
      supabase
        .from("orders")
        .select("id, order_number, customer_name, total, status, payment_status, created_at")
        .gte("created_at", startOfToday)
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, created_at")
        .gte("created_at", startOfToday),
      supabase.from("products").select("id, name, stock_quantity, is_active, price, category_id, product_images(image_url)").order("stock_quantity", { ascending: true }),
      supabase
        .from("orders")
        .select("id, order_number, customer_name, total, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("order_items").select("order_id, product_id, product_name, quantity, product_price"),
      supabase.from("orders").select("id, status, payment_status, total"),
      supabase.from("product_reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
      getStoreStatus(),
    ]);

  if ([todayOrdersResult, todayCustomersResult, productResult, recentOrdersResult, orderItemsResult, allOrdersResult].some((result) => result.error)) {
    throw new Error("Unable to load dashboard data.");
  }
  const todayOrders = todayOrdersResult.data ?? [];
  const todayCustomers = todayCustomersResult.data ?? [];
  const products = productResult.data ?? [];
  const recentOrders = recentOrdersResult.data ?? [];
  const orderItems = orderItemsResult.data ?? [];
  const allOrders = allOrdersResult.data ?? [];
  const pendingReviewCount = pendingReviewsResult.count ?? 0;
  const store = storeStatusRow;

  const catalogStats = {
    total: products.length,
    active: products.filter((product) => product.is_active).length,
    needReview: products.filter((product) =>
      productNeedsReview({
        name: product.name,
        categoryId: product.category_id,
        price: product.price,
        stockQuantity: product.stock_quantity,
        isActive: product.is_active,
        images: product.product_images,
      }),
    ).length,
    needsPricing: products.filter((product) => productMissingRequirements({ name: product.name, categoryId: product.category_id, price: product.price, stockQuantity: product.stock_quantity, isActive: product.is_active, images: product.product_images }).includes("Price")).length,
    needsInventory: products.filter((product) => productMissingRequirements({ name: product.name, categoryId: product.category_id, price: product.price, stockQuantity: product.stock_quantity, isActive: product.is_active, images: product.product_images }).includes("Inventory")).length,
    needsImage: products.filter((product) => productMissingRequirements({ name: product.name, categoryId: product.category_id, price: product.price, stockQuantity: product.stock_quantity, isActive: product.is_active, images: product.product_images }).includes("Image")).length,
    draft: products.filter((product) => !product.is_active).length,
    readyToPublish: products.filter((product) =>
      productReadyToPublish({
        name: product.name,
        categoryId: product.category_id,
        price: product.price,
        stockQuantity: product.stock_quantity,
        isActive: product.is_active,
        images: product.product_images,
      }),
    ).length,
  };

  const revenueToday = todayOrders
    .filter((order) => order.payment_status === "paid")
    .reduce((sum, order) => sum + Number(order.total ?? 0), 0);

  const orderCountToday = todayOrders.length;
  const newCustomersToday = todayCustomers.length;
  const lowStockProducts = products.filter((product) => Number(product.stock_quantity) > 0 && Number(product.stock_quantity) <= 5);
  const outOfStockProducts = products.filter((product) => Number(product.stock_quantity) <= 0);

  const actionItems: AdminActionItem[] = [
    {
      title: "Out of stock",
      count: outOfStockProducts.length,
      description: outOfStockProducts.length > 0 ? "Review inventory" : "Everything looks good",
      href: "/admin/inventory",
      tone: outOfStockProducts.length > 0 ? "danger" : "positive",
    },
    {
      title: "Low stock",
      count: lowStockProducts.length,
      description: lowStockProducts.length > 0 ? "Review inventory" : "Inventory levels look healthy",
      href: "/admin/inventory",
      tone: lowStockProducts.length > 0 ? "warning" : "positive",
    },
    {
      title: "New orders",
      count: todayOrders.filter((order) => ["pending", "confirmed", "processing"].includes(order.status)).length,
      description: "Orders to review",
      href: "/admin/orders",
      tone: "neutral",
    },
    {
      title: "Today",
      count: todayOrders.filter((order) => ["ready_for_pickup", "shipped", "delivered"].includes(order.status)).length,
      description: "Orders in motion",
      href: "/admin/orders",
      tone: "positive",
    },
    {
      title: "Products needing review",
      count: catalogStats.needReview,
      description: `${catalogStats.readyToPublish} ready to publish`,
      href: "/admin/products?review=needs-review",
      tone: catalogStats.needReview > 0 ? "warning" : "positive",
    },
    {
      title: "Reviews awaiting moderation",
      count: pendingReviewCount,
      description: "Pending customer reviews",
      href: "/admin/reviews?status=pending",
      tone: pendingReviewCount > 0 ? "warning" : "positive",
    },
  ];

  const revenueTrend = await getRevenueTrend(supabase, sevenDaysAgo.toISOString());

  const bestSellerMap = new Map<string, AdminBestSeller>();
  orderItems.forEach((item) => {
    const productId = item.product_id ?? "unknown";
    const productName = item.product_name ?? "Unknown product";
    const qty = Number(item.quantity ?? 0);
    const price = Number(item.product_price ?? 0);
    const current = bestSellerMap.get(productId) ?? {
      productId,
      productName,
      units: 0,
      revenue: 0,
      stock: 0,
    };

    current.units += qty;
    current.revenue += qty * price;
    bestSellerMap.set(productId, current);
  });

  const productStockLookup = new Map<string, number>(
    (products ?? []).map((product) => [product.id, Number(product.stock_quantity ?? 0)]),
  );

  const bestSellers = Array.from(bestSellerMap.values())
    .map((seller) => ({
      ...seller,
      stock: productStockLookup.get(seller.productId) ?? 0,
    }))
    .sort((a, b) => b.units - a.units)
    .slice(0, 5);

  const recentOrderRows: AdminRecentOrder[] = (recentOrders ?? []).map((order) => ({
    id: order.id,
    orderNumber: order.order_number,
    customerName: order.customer_name ?? "Guest customer",
    itemCount: orderItems.filter((item) => item.order_id === order.id).reduce((sum, item) => sum + item.quantity, 0),
    total: Number(order.total ?? 0),
    status: order.status,
    createdAt: order.created_at,
  }));

  const described = describeStoreStatus(store);
  const storeStatus: AdminStoreStatus = {
    isOpen: store.isOpen,
    label: described.label,
    description: described.description,
    tone: described.tone,
    updatedAt: store.updatedAt,
  };

  const metrics: AdminDashboardMetric[] = [
    {
      label: "Total products",
      value: String(catalogStats.total),
      detail: `${catalogStats.active} active · ${catalogStats.needReview} need review`,
      tone: catalogStats.needReview > 0 ? "warning" : "positive",
      href: "/admin/products?review=needs-review",
    },
    {
      label: "Total orders",
      value: String(allOrders.length),
      detail: `${allOrders.filter((order) => ["pending", "confirmed", "processing"].includes(order.status)).length} need review`,
      tone: "neutral",
    },
    {
      label: "New customers today",
      value: String(newCustomersToday),
      detail: "Profiles created today",
      tone: "positive",
    },
    {
      label: "Low stock",
      value: String(lowStockProducts.length),
      detail: lowStockProducts.length > 0 ? "Products need attention" : "Inventory looks healthy",
      tone: lowStockProducts.length > 0 ? "warning" : "positive",
    },
  ];

  return {
    metrics,
    actionItems,
    recentOrders: recentOrderRows,
    bestSellers,
    revenueTrend,
    storeStatus,
    outOfStockCount: outOfStockProducts.length,
    lowStockCount: lowStockProducts.length,
    todayOrderCount: orderCountToday,
    totalOrderCount: allOrders.length,
    pendingOrderCount: allOrders.filter((order) => ["pending", "confirmed", "processing"].includes(order.status)).length,
    todaysRevenue: revenueToday,
    averageOrderValue: orderCountToday > 0 ? revenueToday / orderCountToday : 0,
    greeting: storeGreetingAt(new Date()),
    catalogStats,
    pendingReviewCount,
  };
}

async function getRevenueTrend(supabase: Awaited<ReturnType<typeof createClient>>, sinceIso: string) {
  const { data, error } = await supabase
    .from("orders")
    .select("created_at, total, payment_status")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return Array.from({ length: 7 }, (_, index) => ({
      label: dayLabel(index),
      value: 0,
    }));
  }

  const totalsByDay = new Map<string, number>();

  data.forEach((order) => {
    if (order.payment_status !== "paid") return;
    const key = new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    totalsByDay.set(key, (totalsByDay.get(key) ?? 0) + Number(order.total ?? 0));
  });

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return {
      label,
      value: totalsByDay.get(label) ?? 0,
    };
  });
}

function dayLabel(offset: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (6 - offset));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
