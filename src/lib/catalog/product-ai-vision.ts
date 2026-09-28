import { generateText } from "ai";
import {
  parseProductAiJson,
  productAiSystemPrompt,
  productAiUserPrompt,
  type ProductAiSuggestion,
} from "@/src/lib/catalog/product-ai";

export async function analyzeProductImageWithGateway(input: {
  bytes: Uint8Array;
  mediaType: string;
  categoryName: string;
  draftName: string;
}): Promise<ProductAiSuggestion> {
  const result = await generateText({
    model: "openai/gpt-5.4",
    system: productAiSystemPrompt(input.categoryName),
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(20_000),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: productAiUserPrompt({ categoryName: input.categoryName, draftName: input.draftName }) },
          { type: "image", image: input.bytes, mediaType: input.mediaType },
        ],
      },
    ],
  });
  return parseProductAiJson(result.text);
}
