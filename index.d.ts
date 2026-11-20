/* eslint-disable */
/**
 * GENERATED FILE - DO NOT EDIT.
 * Generated from schema/*.schema.json by scripts/gen-types.mjs.
 * Run `npm run gen:types` to regenerate.
 */

/**
 * A product category in the faux catalog.
 */
export interface Category {
  /**
   * Stable slug identifier.
   */
  id: string;
  /**
   * Display name.
   */
  name: string;
  /**
   * Short description of the category.
   */
  description?: string;
}

/**
 * A product in the faux catalog.
 */
export interface Product {
  /**
   * Stable slug identifier.
   */
  id: string;
  /**
   * Display name.
   */
  name: string;
  /**
   * Id of the Category this product belongs to.
   */
  categoryId: string;
  /**
   * Price in US cents.
   */
  priceCents: number;
  /**
   * ISO 4217 currency code. Only USD is supported.
   */
  currency: "USD";
  /**
   * Short product description.
   */
  description: string;
  /**
   * Whether the product is currently in stock.
   */
  inStock: boolean;
}
