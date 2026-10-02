import { NextResponse } from "next/server";
import { ivoireCueWav } from "@/src/lib/audio/cue-data";

export async function GET(_request: Request, context: { params: Promise<{ cue: string }> }) {
  const { cue } = await context.params;
  const encoded = ivoireCueWav[cue];
  if (!encoded) return new NextResponse("Not found", { status: 404 });
  const body = Buffer.from(encoded, "base64");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "audio/wav",
      "Content-Length": String(body.length),
      "Cache-Control": "public, max-age=86400, immutable",
      "Accept-Ranges": "bytes",
    },
  });
}
