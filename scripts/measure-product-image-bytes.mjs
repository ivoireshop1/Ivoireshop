import sharp from "sharp";

const base = "https://lidqskyavlkzwerpncxa.supabase.co/storage/v1/object/public/product-images";
const samples = [
  "4945d373-d1be-4618-902b-d0261362f64f-1790571734992-42mmt.png",
  "b3efbc0e-9f60-4390-a474-397ecaefae90-1790571801535-5kuao.png",
  "6161faa7-4e48-4801-b645-3b01ee8e25d6-1790571829783-q3ha0.png",
  "img-0165-1790575598797-55n7q.jpeg",
];

const rows = [];
for (const name of samples) {
  const response = await fetch(`${base}/${name}`);
  if (!response.ok) {
    rows.push({ name, status: response.status });
    continue;
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const widths = [64, 640, 1200];
  const optimized = {};
  for (const width of widths) {
    const webp = await sharp(bytes, { failOn: "none" }).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
    optimized[`w${width}`] = webp.length;
  }
  const stored = await sharp(bytes, { failOn: "none" })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  rows.push({
    name,
    originalBytes: bytes.length,
    optimizer: optimized,
    futureUploadBytes: stored.length < bytes.length ? stored.length : bytes.length,
  });
}

console.log(JSON.stringify(rows, null, 2));
