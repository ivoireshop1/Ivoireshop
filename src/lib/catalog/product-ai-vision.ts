import { generateText } from "ai";
import {
  parseProductAiJson,
  productAiSystemPrompt,
  productAiUserPrompt,
  suggestionHasContent,
  type ProductAiSuggestion,
} from "@/src/lib/catalog/product-ai";
import { productAiGatewayReady } from "@/src/lib/catalog/product-ai-errors";

export const PRODUCT_AI_VISION_MODEL = "google/gemini-2.5-flash";

export async function analyzeProductImageWithGateway(input: {
  bytes: Uint8Array;
  mediaType: string;
  categoryName: string;
  draftName: string;
}): Promise<ProductAiSuggestion> {
  if (!productAiGatewayReady()) {
    const error = new Error("AI_NOT_CONFIGURED");
    error.name = "LoadAPIKeyError";
    throw error;
  }

  const result = await generateText({
    model: PRODUCT_AI_VISION_MODEL,
    system: productAiSystemPrompt(input.categoryName),
    maxRetries: 0,
    timeout: 50_000,
    abortSignal: AbortSignal.timeout(50_000),
    providerOptions: {
      gateway: {
        tags: ["feature:product-ai-fill"],
      },
    },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: productAiUserPrompt({ categoryName: input.categoryName, draftName: input.draftName }) },
          { type: "file", data: input.bytes, mediaType: input.mediaType },
        ],
      },
    ],
  });
  const parsed = parseProductAiJson(result.text);
  if (!suggestionHasContent(parsed)) {
    const error = new Error("AI_RESPONSE_INVALID");
    error.name = "ProductAiResponseInvalid";
    throw error;
  }
  return parsed;
}
