import { NextResponse } from "next/server";
import OpenAI from "openai";
import products from "../../../data/products.json";
import { saveChatLog } from "../../../lib/db";

type Product = {
  id: string;
  name: string;
  collection: string;
  price_usd: number;
  category: string;
  metal: string;
  stones: string[];
  description: string;
  story: string;
  occasion: string;
  style_keywords: string[];
  matching_products: string[];
  product_url: string;
  image_url: string;
};

type AdvisorResponse = {
  advisor_message: string;
  recommended_product_ids: string[];
};

const productCatalog = products as Product[];

type RateLimitEntry = {
  requestCount: number;
  windowStartedAt: number;
};

const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const rateLimitByIp = new Map<string, RateLimitEntry>();
const rateLimitMessage =
  "You’ve reached the request limit for now. Please try again later.";

function getClientIp(request: Request) {
  // The IP address tells us which visitor is making the request.
  // On Vercel, x-forwarded-for often contains the real visitor IP first,
  // followed by proxy IPs. Locally, it may be missing, so we use a demo fallback.
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  return forwardedFor?.split(",")[0]?.trim() || realIp || "local-demo-user";
}

function isRateLimited(request: Request) {
  // Rate limiting means counting how many requests a visitor makes in a time window.
  // This protects OpenAI API costs because repeated spam requests get blocked before
  // the server calls OpenAI.
  const clientIp = getClientIp(request);
  const now = Date.now();
  const currentEntry = rateLimitByIp.get(clientIp);

  // The in-memory Map stores one counter per IP address.
  // This is simple and good for a demo, but it resets when the server restarts.
  if (!currentEntry || now - currentEntry.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
    rateLimitByIp.set(clientIp, {
      requestCount: 1,
      windowStartedAt: now
    });

    return false;
  }

  if (currentEntry.requestCount >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  currentEntry.requestCount += 1;
  rateLimitByIp.set(clientIp, currentEntry);

  return false;
}

function findBudget(message: string) {
  // This beginner-friendly budget parser looks for phrases like "$5000",
  // "$5,000", "under 5000", or "below 5000".
  // It avoids treating "18k gold" as a budget.
  const budgetMatch =
    message.match(/\$\s*([0-9][0-9,]*)/i) ||
    message.match(/(?:under|below|less than|up to|budget|around)\s*\$?\s*([0-9][0-9,]*)/i);

  if (!budgetMatch) return null;

  const parsedBudget = Number(budgetMatch[1].replaceAll(",", ""));
  return Number.isFinite(parsedBudget) ? parsedBudget : null;
}

function includesAny(message: string, words: string[]) {
  return words.some((word) => message.includes(word.toLowerCase()));
}

function scoreProduct(product: Product, message: string) {
  const lowerMessage = message.toLowerCase();
  let score = 0;

  const budget = findBudget(lowerMessage);
  if (budget && product.price_usd <= budget) score += 4;
  if (budget && product.price_usd > budget) score -= 3;

  // Category search: ring, necklace, bracelet, or earrings.
  if (lowerMessage.includes(product.category.toLowerCase())) score += 5;

  // Metal search: yellow gold, white gold, rose gold, etc.
  if (lowerMessage.includes(product.metal.toLowerCase())) score += 4;
  if (product.metal.toLowerCase().includes("yellow") && lowerMessage.includes("gold")) {
    score += 2;
  }

  // Collection search: Solana, Clarity, Moonlit, etc.
  if (lowerMessage.includes(product.collection.toLowerCase())) score += 4;

  // Occasion search: graduation gift, birthday gift, gala, self purchase, etc.
  if (lowerMessage.includes(product.occasion.toLowerCase())) score += 4;
  if (product.occasion.includes("gift") && lowerMessage.includes("gift")) score += 2;

  // Stone and style keyword search.
  if (includesAny(lowerMessage, product.stones)) score += 3;
  if (includesAny(lowerMessage, product.style_keywords)) score += 3;

  // Text fields give the search a little flexibility for natural language.
  const searchableText = [
    product.name,
    product.description,
    product.story,
    product.occasion,
    product.collection
  ]
    .join(" ")
    .toLowerCase();

  for (const word of lowerMessage.split(/\W+/)) {
    if (word.length > 3 && searchableText.includes(word)) score += 1;
  }

  return score;
}

function findTopMatchingProducts(message: string) {
  // Search every product, sort by score, and keep a small group for the AI.
  // The AI only sees this short list, which makes it less likely to wander.
  const scoredProducts = productCatalog.map((product) => ({
    product,
    score: scoreProduct(product, message)
  }));

  return scoredProducts
    .sort((a, b) => b.score - a.score || a.product.price_usd - b.product.price_usd)
    .slice(0, 5)
    .map((item) => item.product);
}

function keepOnlyCatalogProducts(productIds: string[], allowedProducts: Product[]) {
  // The model returns IDs, not full product objects.
  // We use those IDs to fetch trusted product data from products.json.
  const allowedIds = new Set(allowedProducts.map((product) => product.id));
  const uniqueIds = Array.from(new Set(productIds));

  return uniqueIds
    .filter((id) => allowedIds.has(id))
    .map((id) => productCatalog.find((product) => product.id === id))
    .filter((product): product is Product => Boolean(product));
}

function isCatalogCountQuestion(message: string) {
  // Some questions are about the catalog itself, not about recommending jewelry.
  // Answer these directly from products.json so the AI does not guess.
  const lowerMessage = message.toLowerCase();
  const asksHowMany = /how many|number of|count|total/.test(lowerMessage);
  const mentionsCatalogItems = /piece|pieces|product|products|item|items|jewel|jewelry/.test(
    lowerMessage
  );

  return asksHowMany && mentionsCatalogItems;
}

async function safelySaveChatLog({
  request,
  userMessage,
  advisorMessage,
  finalProducts
}: {
  request: Request;
  userMessage: string;
  advisorMessage: string;
  finalProducts: Product[];
}) {
  try {
    // Database logging happens after the chat response has been created.
    // If this fails, we catch the error so the shopper still gets the answer.
    await saveChatLog({
      userMessage,
      advisorMessage,
      recommendedProductIds: finalProducts.map((product) => product.id),
      recommendedProductNames: finalProducts.map((product) => product.name),
      userIp: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: request.headers.get("user-agent")
    });
  } catch (logError) {
    console.error("Chat logging failed, but the chat response will still be returned.", logError);
  }
}

export async function POST(request: Request) {
  try {
    const { message } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Please send a message to the concierge." },
        { status: 400 }
      );
    }

    if (isRateLimited(request)) {
      return NextResponse.json(
        {
          advisor_message: rateLimitMessage,
          recommended_products: []
        },
        { status: 429 }
      );
    }

    if (isCatalogCountQuestion(message)) {
      const advisorMessage = `There are ${productCatalog.length.toLocaleString(
        "en-US"
      )} pieces in the current Hueb catalog.`;

      await safelySaveChatLog({
        request,
        userMessage: message,
        advisorMessage,
        finalProducts: []
      });

      return NextResponse.json({
        advisor_message: advisorMessage,
        recommended_products: []
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY is missing. Add it to a .env.local file before using the concierge."
        },
        { status: 500 }
      );
    }

    const matchingProducts = findTopMatchingProducts(message);

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const response = await openai.responses.create({
      model: "gpt-5.4-mini",
      reasoning: { effort: "low" },
      text: {
        format: {
          type: "json_schema",
          name: "hueb_advisor_response",
          strict: true,
          schema: {
            type: "object",
            properties: {
              advisor_message: { type: "string" },
              recommended_product_ids: {
                type: "array",
                items: { type: "string" }
              }
            },
            required: ["advisor_message", "recommended_product_ids"],
            additionalProperties: false
          }
        }
      },
      input: [
        {
          role: "developer",
          content: [
            "You are a luxury jewelry sales advisor for a Hueb prototype.",
            "You are warm, polished, specific, and concise.",
            "Only recommend products from the provided candidate list.",
            "Return JSON with advisor_message and recommended_product_ids.",
            "recommended_product_ids must contain only IDs from the candidate list.",
            "Recommend 1 to 3 products."
          ].join(" ")
        },
        {
          role: "user",
          content: JSON.stringify({
            shopper_message: message,
            candidate_products: matchingProducts.map((product) => ({
              id: product.id,
              name: product.name,
              collection: product.collection,
              price_usd: product.price_usd,
              category: product.category,
              metal: product.metal,
              stones: product.stones,
              description: product.description,
              story: product.story,
              occasion: product.occasion,
              style_keywords: product.style_keywords
            }))
          })
        }
      ]
    });

    const rawContent = response.output_text || "{}";
    const advisorResponse = JSON.parse(rawContent) as AdvisorResponse;
    const recommendedProducts = keepOnlyCatalogProducts(
      advisorResponse.recommended_product_ids || [],
      matchingProducts
    );

    // If the model returns no valid IDs, use the best search result as a safe fallback.
    const finalProducts =
      recommendedProducts.length > 0 ? recommendedProducts : matchingProducts.slice(0, 1);

    const advisorMessage =
      advisorResponse.advisor_message ||
      "I selected a piece from the Hueb demo catalog that best matches your request.";

    await safelySaveChatLog({
      request,
      userMessage: message,
      advisorMessage,
      finalProducts
    });

    return NextResponse.json({
      advisor_message: advisorMessage,
      recommended_products: finalProducts
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "The concierge had trouble creating a recommendation." },
      { status: 500 }
    );
  }
}
