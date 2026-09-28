export type CanonicalCategoryName = "Foods" | "Cosmetics" | "Ivoire Market";
export type ClassificationConfidence = "keep" | "review" | "obvious-market";

const OBVIOUS_MARKET =
  /\b(pots?|pans?|cookware|saucepan|skillet|wok|casserole|dutch oven|frying[\s-]?pan|kitchen utensils?|spatula|ladle|colander|cutting board|chopping board|mixing bowl|dinnerware|plates?|food[\s-]?storage|storage containers?|household storage)\b/i;

const OBVIOUS_COSMETICS =
  /\b(lipstick|mascara|foundation|concealer|shampoo|conditioner|body lotion|face cream|moisturizer|skincare|hair oil|shea butter soap)\b/i;

const OBVIOUS_FOODS =
  /\b(rice|couscous|vermicelli|palm oil|olive oil|beans?|flour|spice|seasoning|noodles?|canned|snack|tea|coffee|juice|fufu)\b/i;

export function classifyCatalogName(name: string, currentCategory: string): {
  current: string;
  recommended: CanonicalCategoryName | "Needs manual review";
  confidence: ClassificationConfidence;
  reason: string;
} {
  const text = name.trim();
  const current = currentCategory || "Uncategorized";
  const looksMarket = OBVIOUS_MARKET.test(text);
  const looksCosmetic = OBVIOUS_COSMETICS.test(text);
  const looksFood = OBVIOUS_FOODS.test(text);
  const signals = [looksMarket, looksCosmetic, looksFood].filter(Boolean).length;

  if (signals > 1) {
    return { current, recommended: "Needs manual review", confidence: "review", reason: "Name matches more than one category signal." };
  }
  if (looksMarket && current !== "Ivoire Market") {
    return {
      current,
      recommended: "Ivoire Market",
      confidence: "obvious-market",
      reason: "Name describes cookware or household merchandise, not food.",
    };
  }
  if (looksCosmetic && current !== "Cosmetics") {
    return { current, recommended: "Cosmetics", confidence: "review", reason: "Name looks like beauty or personal-care merchandise." };
  }
  if (looksFood && current !== "Foods") {
    return { current, recommended: "Foods", confidence: "review", reason: "Name looks like edible or drinkable merchandise." };
  }
  if (!looksMarket && !looksCosmetic && !looksFood && current === "Uncategorized") {
    return { current, recommended: "Needs manual review", confidence: "review", reason: "No reliable category signal." };
  }
  return { current, recommended: current as CanonicalCategoryName, confidence: "keep", reason: "Leave in the current canonical category unless an admin changes it." };
}
