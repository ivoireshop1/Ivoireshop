import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { isNextImageSrc } from "./image-url.ts";
import { compressProductImage, estimateOptimizedWebp } from "./product-image-bytes.ts";

test("supabase product image hosts stay eligible for the Next optimizer", () => {
  assert.equal(isNextImageSrc("https://lidqskyavlkzwerpncxa.supabase.co/storage/v1/object/public/product-images/example.png"), true);
  assert.equal(isNextImageSrc("https://images.unsplash.com/photo"), true);
  assert.equal(isNextImageSrc("blob:https://ivoireshop-steel.vercel.app/preview"), false);
  assert.equal(isNextImageSrc("https://example.com/photo.png"), false);
});

test("future uploads compress oversized pngs and keep smaller originals", async () => {
  const raw = Buffer.alloc(900 * 700 * 3);
  for (let i = 0; i < raw.length; i += 1) raw[i] = (i * 31) % 256;
  const png = await sharp(raw, { raw: { width: 900, height: 700, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer();
  const prepared = await compressProductImage({ bytes: png, contentType: "image/png" });
  assert.equal(prepared.compressed, true);
  assert.equal(prepared.contentType, "image/webp");
  assert.equal(prepared.extension, ".webp");
  assert.ok(prepared.bytes.length < prepared.originalBytes);

  const tiny = await sharp({
    create: { width: 1, height: 1, channels: 3, background: { r: 1, g: 2, b: 3 } },
  }).jpeg({ quality: 40 }).toBuffer();
  const kept = await compressProductImage({ bytes: tiny, contentType: "image/jpeg" });
  assert.ok(kept.bytes.length <= tiny.length);

  const gif = Buffer.from("GIF89a");
  const passed = await compressProductImage({ bytes: gif, contentType: "image/gif", fallbackExtension: ".gif" });
  assert.equal(passed.compressed, false);
  assert.equal(passed.extension, ".gif");
});

test("display widths are far smaller than a multi-megabyte source", async () => {
  const raw = Buffer.alloc(1400 * 1000 * 3);
  for (let i = 0; i < raw.length; i += 1) raw[i] = (i * 17) % 256;
  const source = await sharp(raw, { raw: { width: 1400, height: 1000, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer();
  const thumb = await estimateOptimizedWebp({ bytes: source, width: 64 });
  const card = await estimateOptimizedWebp({ bytes: source, width: 640 });
  assert.ok(source.length > 500_000);
  assert.ok(thumb.length < 80_000);
  assert.ok(card.length < source.length / 5);
});
