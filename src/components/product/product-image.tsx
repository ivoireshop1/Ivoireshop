"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

export function ProductImage(props: ImageProps) {
  const [failedSource, setFailedSource] = useState<ImageProps["src"] | null>(null);
  if (!props.src || failedSource === props.src) {
    return <span role="img" aria-label={`${props.alt}: image unavailable`} className="absolute inset-0 flex items-center justify-center bg-[#eadfce] p-4 text-center text-sm text-forest-green">Image unavailable</span>;
  }
  return <Image {...props} alt={props.alt} onError={() => setFailedSource(props.src)} />;
}
