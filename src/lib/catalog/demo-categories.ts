import { demoImages } from "@/src/lib/demo-images";

export const demoCategories = [
  { name: "African Groceries", filter: "African Foods", image: demoImages.categories.africanFoods, description: "Authentic pantry favorites for everyday cooking." },
  { name: "Rice & Grains", filter: "Rice & Grains", image: demoImages.categories.riceAndGrains, description: "Everyday essentials for your kitchen." },
  { name: "Spices & Seasonings", filter: "Spices & Seasoning", image: demoImages.categories.spices, description: "Warm, fragrant flavor for every dish." },
  { name: "African Products", filter: "African Foods", image: demoImages.categories.africanFoods, description: "Familiar products and genuine flavors." },
  { name: "Fresh Produce", filter: "Fresh Produce", image: demoImages.categories.freshProduce, description: "Fresh kitchen staples for your table." },
  { name: "Oils & Cooking", filter: "Oils & Cooking", image: demoImages.categories.africanFoods, description: "Cooking essentials to bring meals together." },
  { name: "Beverages", filter: "Drinks", image: demoImages.categories.drinks, description: "Refreshing favorites for every occasion." },
  { name: "Snacks & Essentials", filter: "Snacks", image: demoImages.categories.snacks, description: "Crisp, comforting pantry treats." },
  { name: "Beauty & Skincare", filter: "African Foods", image: demoImages.categories.freshProduce, description: "Thoughtful everyday care, coming soon." },
  { name: "Household & More", filter: "African Foods", image: demoImages.categories.africanFoods, description: "More useful essentials for your home." },
] as const;
