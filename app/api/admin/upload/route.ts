import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/auth/guards";
import { compressProductImage } from "@/src/lib/catalog/product-image-bytes";
import path from "node:path";

export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdmin();

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const singleFile = formData.get("file") as File | null;
    const allFiles = [...(singleFile ? [singleFile] : []), ...files].filter(
      (f): f is File => f instanceof File && f.size > 0,
    );

    if (allFiles.length === 0) {
      return NextResponse.json({ error: "No files uploaded." }, { status: 400 });
    }

    const uploadedUrls: string[] = [];

    for (const file of allFiles) {
      if (!file.type.startsWith("image/")) {
        return NextResponse.json(
          { error: `File "${file.name}" is not a supported image format.` },
          { status: 400 },
        );
      }

      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: `File "${file.name}" exceeds the 10MB size limit.` },
          { status: 400 },
        );
      }

      const originalExtension = path.extname(file.name) || ".jpg";
      const arrayBuffer = await file.arrayBuffer();
      const prepared = await compressProductImage({
        bytes: Buffer.from(arrayBuffer),
        contentType: file.type,
        fallbackExtension: originalExtension,
      });
      const baseName = path
        .basename(file.name, originalExtension)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .slice(0, 40);
      const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const filename = `${baseName || "product"}-${uniqueSuffix}${prepared.extension}`;

      // Only persistent Storage uploads may become product image references.
      // Original bytes stay on the admin's device. Stored objects are new files, not replacements.
      const { error: storageError } = await supabase.storage
        .from("product-images")
        .upload(filename, prepared.bytes, { contentType: prepared.contentType, upsert: false });
      if (storageError) {
        return NextResponse.json({ error: "Image Storage upload failed. Please try again." }, { status: 502 });
      }
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(filename);
      uploadedUrls.push(urlData.publicUrl);
    }

    return NextResponse.json({ success: true, urls: uploadedUrls });
  } catch (error) {
    console.error("Admin upload handler error:", error);
    const message = error instanceof Error ? error.message : "Failed to process image upload.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
