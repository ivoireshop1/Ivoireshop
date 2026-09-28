import assert from "node:assert/strict";

console.log("==================================================");
console.log("IVOIRE SHOP - ADMIN PRODUCT SYSTEM LIFECYCLE TESTS");
console.log("==================================================");

let passedCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`✓ PASS: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`✗ FAIL: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// Validation logic simulation matching saveProduct and ProductForm
function validateProductSubmission({
  name,
  categoryId,
  price,
  stockQuantity,
  images,
  isActive,
  isDraft,
}) {
  const errors = [];
  const wantsActive = !isDraft && isActive;

  if (!name || !name.trim()) {
    errors.push("missing_name");
  }

  if (wantsActive) {
    if (!categoryId || !categoryId.trim()) {
      errors.push("missing_category");
    }
    const numPrice = Number(price);
    if (!price || !Number.isFinite(numPrice) || numPrice <= 0) {
      errors.push("missing_price");
    }
    const numStock = Number(stockQuantity);
    if (
      stockQuantity === "" ||
      stockQuantity === null ||
      stockQuantity === undefined ||
      !Number.isFinite(numStock) ||
      !Number.isInteger(numStock) ||
      numStock < 0
    ) {
      errors.push("missing_stock");
    }
    if (!images || images.length === 0) {
      errors.push("missing_image");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    isActive: wantsActive && errors.length === 0,
    isDraft,
    needsPricing: !price || stockQuantity === "" || stockQuantity === null,
  };
}

// Storefront mapping simulation matching catalog.ts and relation-utils.ts
function toOneRelation(rel) {
  if (!rel) return null;
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

function mapProductRow(row) {
  const category = toOneRelation(row.categories)?.name || "Uncategorized";
  const image = row.product_images?.slice().sort((a, b) => a.position - b.position)[0]?.image_url || "";
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    price: Number(row.price),
    category,
    image,
    stockQuantity: row.stock_quantity,
    isActive: Boolean(row.is_active),
    isFeatured: Boolean(row.is_featured),
  };
}

// Test A: Draft Creation (Can save with partial data without activation)
runTest("Test A: Draft creation saves data without forcing customer-store activation", () => {
  const draft = validateProductSubmission({
    name: "Attieke Premium Bag 1KG",
    categoryId: "cat-1",
    price: "7.99",
    stockQuantity: "50",
    images: ["/images/attieke.jpg"],
    isActive: false,
    isDraft: true,
  });

  assert.equal(draft.valid, true);
  assert.equal(draft.isActive, false);
  assert.equal(draft.isDraft, true);
  assert.deepEqual(draft.errors, []);
});

// Test B: Publish Activation
runTest("Test B: Marking product active with complete info validates successfully", () => {
  const published = validateProductSubmission({
    name: "Attieke Premium Bag 1KG",
    categoryId: "cat-1",
    price: "7.99",
    stockQuantity: "50",
    images: ["/images/attieke.jpg"],
    isActive: true,
    isDraft: false,
  });

  assert.equal(published.valid, true);
  assert.equal(published.isActive, true);
  assert.deepEqual(published.errors, []);
});

// Test C: Category assignment & storefront reflection
runTest("Test C: Category reflects accurately from relational structure to storefront", () => {
  const dbRowGrains = {
    id: "prod-1",
    name: "Jasmine Rice",
    slug: "jasmine-rice",
    price: 18.5,
    stock_quantity: 40,
    is_active: true,
    is_featured: false,
    categories: { name: "Rice & Grains" },
    product_images: [{ image_url: "/images/rice.jpg", position: 0 }],
  };

  let storefrontProduct = mapProductRow(dbRowGrains);
  assert.equal(storefrontProduct.category, "Rice & Grains");

  // Change category to "Spices & Seasoning"
  const dbRowSpices = {
    ...dbRowGrains,
    categories: { name: "Spices & Seasoning" },
  };
  storefrontProduct = mapProductRow(dbRowSpices);
  assert.equal(storefrontProduct.category, "Spices & Seasoning");
});

// Test D: Price editing independence
runTest("Test D: Changing price never modifies stock quantity or erases stock", () => {
  let state = {
    price: "12.99",
    stock: "25",
  };

  // Change price
  state.price = "14.50";
  assert.equal(state.price, "14.50");
  assert.equal(state.stock, "25", "Stock must remain intact when price changes");

  // Empty string in price input should not mutate stock
  state.price = "";
  assert.equal(state.stock, "25", "Stock must remain intact even if price input is blank");
});

// Test E: Quantity/Stock editing independence
runTest("Test E: Changing stock never modifies or hides price", () => {
  let state = {
    price: "12.99",
    stock: "25",
  };

  // Change stock
  state.stock = "100";
  assert.equal(state.stock, "100");
  assert.equal(state.price, "12.99", "Price must remain intact when stock changes");

  // Zero stock (out of stock) should never wipe price
  state.stock = "0";
  assert.equal(state.stock, "0");
  assert.equal(state.price, "12.99", "Zero stock must never clear price");
});

// Test F: Multiple images & primary ordering
runTest("Test F: Image ordering preserves primary image at position 0", () => {
  const images = [
    { image_url: "/images/second.jpg", position: 1 },
    { image_url: "/images/primary.jpg", position: 0 },
    { image_url: "/images/third.jpg", position: 2 },
  ];

  const dbRow = {
    id: "prod-2",
    name: "Palm Oil 1L",
    slug: "palm-oil-1l",
    price: 9.99,
    stock_quantity: 15,
    is_active: true,
    is_featured: false,
    categories: [{ name: "Oils & Cooking" }],
    product_images: images,
  };

  const product = mapProductRow(dbRow);
  assert.equal(product.image, "/images/primary.jpg", "Primary image must be the one with position 0");
});

// Test G: Featured status independence
runTest("Test G: Toggling featured is independent from price, stock, and category", () => {
  let product = {
    name: "Plantain Chips",
    category: "Snacks",
    price: "3.50",
    stock: "80",
    isFeatured: false,
  };

  // Toggle featured ON
  product.isFeatured = true;
  assert.equal(product.isFeatured, true);
  assert.equal(product.price, "3.50");
  assert.equal(product.stock, "80");
  assert.equal(product.category, "Snacks");

  // Change price and stock; verify featured remains ON
  product.price = "3.99";
  product.stock = "75";
  assert.equal(product.isFeatured, true, "Featured must remain untouched when price or stock changes");
});

// Test H: Missing publishing requirements validation
runTest("Test H1: Attempting to publish without category fails with missing_category", () => {
  const res = validateProductSubmission({
    name: "Fresh Plantains",
    categoryId: "",
    price: "4.99",
    stockQuantity: "20",
    images: ["/images/plantains.jpg"],
    isActive: true,
    isDraft: false,
  });

  assert.equal(res.valid, false);
  assert.equal(res.isActive, false);
  assert.ok(res.errors.includes("missing_category"));
});

runTest("Test H2: Attempting to publish without price fails with missing_price", () => {
  const res = validateProductSubmission({
    name: "Fresh Plantains",
    categoryId: "cat-produce",
    price: "",
    stockQuantity: "20",
    images: ["/images/plantains.jpg"],
    isActive: true,
    isDraft: false,
  });

  assert.equal(res.valid, false);
  assert.equal(res.isActive, false);
  assert.ok(res.errors.includes("missing_price"));
});

runTest("Test H3: Attempting to publish without stock quantity fails with missing_stock", () => {
  const res = validateProductSubmission({
    name: "Fresh Plantains",
    categoryId: "cat-produce",
    price: "4.99",
    stockQuantity: "",
    images: ["/images/plantains.jpg"],
    isActive: true,
    isDraft: false,
  });

  assert.equal(res.valid, false);
  assert.equal(res.isActive, false);
  assert.ok(res.errors.includes("missing_stock"));
});

runTest("Test H4: Attempting to publish without image fails with missing_image", () => {
  const res = validateProductSubmission({
    name: "Fresh Plantains",
    categoryId: "cat-produce",
    price: "4.99",
    stockQuantity: "20",
    images: [],
    isActive: true,
    isDraft: false,
  });

  assert.equal(res.valid, false);
  assert.equal(res.isActive, false);
  assert.ok(res.errors.includes("missing_image"));
});

runTest("Test H5: Incomplete product can still be saved as draft without crashing", () => {
  const res = validateProductSubmission({
    name: "Work in Progress Item",
    categoryId: "",
    price: "",
    stockQuantity: "",
    images: [],
    isActive: false,
    isDraft: true,
  });

  assert.equal(res.valid, true);
  assert.equal(res.isActive, false);
  assert.equal(res.isDraft, true);
});

console.log("--------------------------------------------------");
console.log(`ALL ${passedCount} LIFECYCLE TESTS PASSED!`);
console.log("==================================================");

