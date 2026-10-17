/** PostgREST cannot infer products → categories after subcategory_id was added. */
export const PRODUCT_CATEGORY_EMBED = "categories:categories!products_category_id_fkey(name, slug)";
export const PRODUCT_SUBCATEGORY_EMBED = "subcategory:categories!products_subcategory_id_fkey(name, slug)";
export const PRODUCT_CATEGORY_NAME_EMBED = "categories:categories!products_category_id_fkey(name)";
export const PRODUCT_SHOP_EMBEDS = `${PRODUCT_CATEGORY_EMBED}, ${PRODUCT_SUBCATEGORY_EMBED}`;
