import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const imageRoot = path.resolve("public/images/Foods 12-22-25");
const reviewSourcePath = path.join(imageRoot, "image-review-needed.json");
const outputPath = path.join(imageRoot, "unidentified-image-review.json");

const encodeImagePath = (file) =>
  `/images/Foods%2012-22-25/${file.split("/").map(encodeURIComponent).join("/")}`;

const reviewSource = JSON.parse((await readFile(reviewSourcePath, "utf8")).replace(/^\uFEFF/, ""));
const reviewList = reviewSource.map(({ file, reason }) => ({
  image_path: encodeImagePath(file),
  current_filename: path.basename(file),
  suggested_product_name: null,
  confidence: "low",
  reason_for_uncertainty: reason,
}));

await writeFile(outputPath, `${JSON.stringify(reviewList, null, 2)}\n`);
console.log(`Wrote ${reviewList.length} unidentified image review entries to ${outputPath}`);