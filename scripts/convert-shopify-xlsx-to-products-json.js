const fs = require("fs");
const path = require("path");

let xlsx;

try {
  xlsx = require("xlsx");
} catch {
  console.error(
    "The xlsx package is missing. Run `npm install` first, then run this script again."
  );
  process.exit(1);
}

const inputPath = path.join(__dirname, "..", "data", "product data_shopify.xlsx");
const outputPath = path.join(__dirname, "..", "data", "products.json");
const reportPath = path.join(__dirname, "..", "data", "catalog-quality-report.json");

function readCell(row, columnName) {
  // Shopify exports use long column names. This helper keeps the mapping tidy.
  const value = row[columnName];

  if (value === null || value === undefined) return "";

  return String(value).trim();
}

function cleanHtml(html) {
  // Product descriptions often arrive as HTML.
  // This turns them into simple plain text for the AI catalog.
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value) {
  // Missing prices should stay unknown.
  // A missing price is not $0, so we return null instead of inventing a value.
  const cleaned = String(value || "").replace(/[^0-9.-]/g, "");

  if (!cleaned) return null;

  const number = Number(cleaned);

  return Number.isFinite(number) ? number : null;
}

function buildPriceNote(price) {
  // Shopify export prices are catalog prices from the spreadsheet.
  // They may not match the live website exactly because the storefront can vary
  // by region, currency, promotions, and Shopify market settings.
  if (price === null) return "Price available on request.";

  return "Catalog price from Shopify export. Live website price may vary by region/currency.";
}

function splitList(value) {
  // Shopify fields may use commas, semicolons, pipes, or new lines.
  // The app expects arrays for stones and style_keywords.
  return String(value || "")
    .split(/[,;|\n\r]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueArray(items) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const cleaned = String(item || "").trim();
    const key = cleaned.toLowerCase();

    if (cleaned && !seen.has(key)) {
      seen.add(key);
      result.push(cleaned);
    }
  }

  return result;
}

function titleCase(value) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ");
}

function normalizeSearchText(...values) {
  return values.join(" ").toLowerCase();
}

function inferCollection(collection, title, handle, tags, knownCollections) {
  if (collection) return collection;

  const searchableText = normalizeSearchText(title, handle, tags);
  const matchedKnownCollection = knownCollections.find((knownCollection) =>
    searchableText.includes(knownCollection.toLowerCase())
  );

  if (matchedKnownCollection) return matchedKnownCollection;

  // If no formal collection is present, use the first word after "18 Karat".
  // This is a light inference from the Shopify title/handle, not precise data.
  const titleWithoutKarat = title.replace(/^18\s*[- ]?\s*karat\s+/i, "").trim();
  const firstTitleWord = titleWithoutKarat.split(/\s+/)[0];

  return firstTitleWord ? titleCase(firstTitleWord) : "";
}

function inferCategory(type, article, title, handle) {
  const directArticle = article.toLowerCase();
  const searchableText = normalizeSearchText(type, article, title, handle);

  if (directArticle) return directArticle;
  if (searchableText.includes("ring")) return "ring";
  if (searchableText.includes("necklace") || searchableText.includes("pendant")) return "necklace";
  if (searchableText.includes("bracelet") || searchableText.includes("bangle")) return "bracelet";
  if (searchableText.includes("earring") || searchableText.includes("huggies")) return "earrings";

  return "";
}

function inferMetal(color, karat, title, handle, tags) {
  const searchableText = normalizeSearchText(color, karat, title, handle, tags);
  const inferredKarat = karat || (searchableText.includes("18-karat") || searchableText.includes("18k") ? "18k" : "");
  let inferredColor = color;

  if (!inferredColor) {
    if (searchableText.includes("yellow gold")) inferredColor = "Yellow Gold";
    else if (searchableText.includes("rose gold")) inferredColor = "Rose Gold";
    else if (searchableText.includes("pink gold")) inferredColor = "Pink Gold";
    else if (searchableText.includes("white gold")) inferredColor = "White Gold";
    else if (searchableText.includes("gold")) inferredColor = "Gold";
    else if (searchableText.includes("platinum")) inferredColor = "Platinum";
    else if (searchableText.includes("silver")) inferredColor = "Silver";
  }

  return uniqueArray([inferredKarat, inferredColor]).join(" ").trim();
}

function inferStones(gemstone, stoneType, title, tags) {
  const stoneCandidates = [
    ...splitList(gemstone),
    ...splitList(stoneType)
  ];
  const searchableText = normalizeSearchText(gemstone, stoneType, title, tags);
  const knownStones = [
    "diamond",
    "emerald",
    "sapphire",
    "pink sapphire",
    "ruby",
    "pearl",
    "aquamarine",
    "tourmaline",
    "green tourmaline",
    "topaz",
    "amethyst",
    "quartz",
    "onyx",
    "tsavorite",
    "opal",
    "turquoise"
  ];

  for (const stone of knownStones) {
    if (searchableText.includes(stone)) stoneCandidates.push(titleCase(stone));
  }

  return uniqueArray(stoneCandidates);
}

function inferOccasion(category, tags, title, description) {
  const text = normalizeSearchText(category, tags, title, description);

  if (text.includes("anniversary")) return "anniversary";
  if (text.includes("evening") || text.includes("statement")) return "evening";
  if (text.includes("everyday") || text.includes("huggies")) return "everyday";
  if (text.includes("gift") || text.includes("heart") || text.includes("butterfly")) return "gift";

  return "gift";
}

function buildProductUrl(handle) {
  // Hueb public product URLs use Shopify-style lowercase handles.
  // The export may contain mixed-case handles, but Shopify storefront URLs are
  // normally lowercase. We trim spaces and lowercase the handle to avoid 404s
  // caused only by casing/whitespace differences.
  const cleanedHandle = handle.trim().toLowerCase();

  return cleanedHandle ? `https://www.hueb.com/products/${cleanedHandle}` : null;
}

function convertRowToProduct(row, knownCollections) {
  const handle = readCell(row, "Handle");
  const title = readCell(row, "Title");
  const sku = readCell(row, "Variant SKU");
  const bodyHtml = readCell(row, "Body HTML");
  const description = cleanHtml(bodyHtml);
  const collectionCell = readCell(
    row,
    "Metafield:custom.collections [single_line_text_field]"
  );
  const article = readCell(row, "Metafield:custom.article [single_line_text_field]");
  const type = readCell(row, "Type");
  const color = readCell(row, "Metafield:custom.color [multi_line_text_field]");
  const karat = readCell(row, "Metafield:custom.metal_karat[single_line_text_field]");
  const gemstone = readCell(row, "Metafield:custom.germstone [multi_line_text_field]]");
  const stoneType = readCell(row, "Metafield:custom.stone_type [single_line_text_field]");
  const productAlma = readCell(row, "Metafield:custom.product_alma");
  const productName = readCell(row, "Metafield:custom.product_name");
  const tags = readCell(row, "Tags");
  const imageSrc = readCell(row, "Image Src");
  const variantImage = readCell(row, "Variant Image");
  const generatedProductUrl = buildProductUrl(handle);
  const price = parseNumber(readCell(row, "Variant Price"));

  const collection = inferCollection(collectionCell, title, handle, tags, knownCollections);
  const category = inferCategory(type, article, title, handle);
  const metal = inferMetal(color, karat, title, handle, tags);
  const stones = inferStones(gemstone, stoneType, title, tags);
  const story = productAlma || productName || description;

  return {
    id: sku || handle,
    name: title,
    collection,
    price_usd: price,
    price_note: buildPriceNote(price),
    category,
    metal,
    stones,
    description,
    story,
    occasion: inferOccasion(category, tags, title, description),
    style_keywords: uniqueArray([
      ...splitList(tags),
      collection,
      metal,
      ...stones,
      category
    ]),
    matching_products: [],
    product_url: generatedProductUrl,
    image_url: imageSrc || variantImage || null,
    handle,
    sku,
    generated_product_url: generatedProductUrl
  };
}

function buildQualityReport(products) {
  const missingUrlProducts = products
    .filter((product) => !product.product_url)
    .map((product) => ({
      name: product.name,
      handle: product.handle,
      generated_url: product.generated_product_url,
      sku: product.sku || null
    }));

  // Read this report after each import to understand the health of the catalog.
  // Counts show how many products have usable URLs, images, prices, and metadata.
  // URL validation is intentionally not performed here because Hueb may block
  // automated requests or vary by region. Missing URL rows mean the Shopify
  // export did not provide a Handle.
  return {
    total_products: products.length,
    products_with_valid_urls: products.filter((product) => product.product_url).length,
    products_with_missing_or_broken_urls: products.filter((product) => !product.product_url).length,
    products_with_images: products.filter((product) => product.image_url).length,
    products_missing_images: products.filter((product) => !product.image_url).length,
    products_with_prices: products.filter((product) => product.price_usd !== null).length,
    products_missing_prices: products.filter((product) => product.price_usd === null).length,
    products_with_collection: products.filter((product) => product.collection).length,
    products_missing_collection: products.filter((product) => !product.collection).length,
    products_with_metal: products.filter((product) => product.metal).length,
    products_missing_metal: products.filter((product) => !product.metal).length,
    products_with_stones: products.filter((product) => product.stones.length > 0).length,
    products_missing_stones: products.filter((product) => product.stones.length === 0).length,
    broken_urls: missingUrlProducts
  };
}

function removeImportOnlyFields(product) {
  const {
    handle,
    sku,
    generated_product_url,
    ...catalogProduct
  } = product;

  return catalogProduct;
}

async function main() {
  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    console.error("Place the Shopify export at data/product data_shopify.xlsx and try again.");
    process.exit(1);
  }

  // Read the first worksheet from the Shopify export.
  const workbook = xlsx.readFile(inputPath);
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows = xlsx.utils.sheet_to_json(worksheet, { defval: "" });
  const knownCollections = uniqueArray(
    rows.map((row) =>
      readCell(row, "Metafield:custom.collections [single_line_text_field]")
    )
  );

  const products = [];
  const seenIds = new Set();

  for (const row of rows) {
    const title = readCell(row, "Title");

    // Shopify export rows with empty Title are usually extra image or variant rows.
    if (!title) continue;

    const product = convertRowToProduct(row, knownCollections);

    // Skip unusable rows and duplicate products.
    if (!product.id || !product.name || seenIds.has(product.id)) continue;

    seenIds.add(product.id);
    products.push(product);
  }

  console.log(`Converted ${products.length} top-level Shopify product rows.`);
  console.log("Generated product URLs from lowercase Shopify handles.");

  const qualityReport = buildQualityReport(products);
  const catalogProducts = products.map(removeImportOnlyFields);

  fs.writeFileSync(outputPath, `${JSON.stringify(catalogProducts, null, 2)}\n`);
  fs.writeFileSync(reportPath, `${JSON.stringify(qualityReport, null, 2)}\n`);

  console.log(`Wrote ${outputPath}`);
  console.log(`Wrote ${reportPath}`);
  console.log(
    `${qualityReport.products_with_valid_urls} products have generated URLs, ${qualityReport.products_with_missing_or_broken_urls} products are missing URLs.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
