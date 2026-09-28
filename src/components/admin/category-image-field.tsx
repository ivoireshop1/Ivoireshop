"use client";

import Image from "next/image";
import { useState } from "react";

export function CategoryImageField({
  name = "image_url",
  defaultValue,
}: {
  name?: string;
  defaultValue?: string | null;
}) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/upload", { method: "POST", body });
      const payload = await response.json();
      if (!response.ok || !payload.success || !payload.urls?.[0]) {
        throw new Error(payload.error || "Image upload failed.");
      }
      setUrl(payload.urls[0]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Image upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <input name={name} type="hidden" value={url} />
      <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-dashed border-[#173f35]/25 bg-[#f9f7f3] px-3 py-2 text-sm font-medium text-[#173f35]">
        <input
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          disabled={uploading}
          onChange={(event) => void handleFile(event.target.files)}
          type="file"
        />
        {uploading ? "Uploading..." : "Upload image"}
      </label>
      {url ? (
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#eadfce]">
          <Image alt="Category image preview" className="object-cover" fill sizes="(max-width: 768px) 90vw, 280px" src={url} unoptimized />
        </div>
      ) : (
        <p className="text-xs text-[#6b6b6b]">No category image yet. A tasteful fallback is used on the storefront.</p>
      )}
      {error ? <p className="text-xs text-[#7f1d1d]">{error}</p> : null}
    </div>
  );
}
