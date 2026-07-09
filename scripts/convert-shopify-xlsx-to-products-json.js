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
  // Prices must be numbers in products.json, not strings like "$1,200".
  const cleaned = String(value || "").replace(/[^0-9.-]/g, "");
  const number = Number(cleaned);

  return Number.isFinite(number) ? number : 0;
}

function splitList(value) {
  // Shopify fields may use commas, semicolons, or new lines.
  // The app expects arrays for stones and style_keywords.
  return String(value || "")
    .split(/[,;\n\r]+/)
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

function inferCategory(type, article, title) {
  const directArticle = article.toLowerCase();
  const searchableText = `${type} ${article} ${title}`.toLowerCase();

  if (directArticle) return directArticle;
  if (searchableText.includes("ring")) return "ring";
  if (searchableText.includes("necklace") || searchableText.includes("pendant")) return "necklace";
  if (searchableText.includes("bracelet") || searchableText.includes("bangle")) return "bracelet";
  if (searchableText.includes("earring") || searchableText.includes("huggies")) return "earrings";

  return "jewelry";
}

function inferOccasion(category, tags, title, description) {
  const text = `${category} ${tags} ${title} ${description}`.toLowerCase();

  if (text.includes("anniversary")) return "anniversary";
  if (text.includes("evening") || text.includes("statement")) return "evening";
  if (text.includes("everyday") || text.includes("huggies")) return "everyday";
  if (text.includes("gift") || text.includes("heart") || text.includes("butterfly")) return "gift";

  return "gift";
}

function buildMetal(color, karat) {
  // Example: color = "Yellow Gold", karat = "18k" -> "18k Yellow Gold".
  return uniqueArray([karat, color]).join(" ").trim();
}

function buildProductUrl(handle) {
  return handle ? `https://www.hueb.com/products/${handle}` : "";
}

function convertRowToProduct(row) {
  const handle = readCell(row, "Handle");
  const title = readCell(row, "Title");
  const sku = readCell(row, "Variant SKU");
  const bodyHtml = readCell(row, "Body HTML");
  const description = cleanHtml(bodyHtml);
  const collection = readCell(
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

  const category = inferCategory(type, article, title);
  const metal = buildMetal(color, karat);
  const stones = uniqueArray([...splitList(gemstone), ...splitList(stoneType)]);
  const story = productAlma || productName || description;

  return {
    id: sku || handle,
    name: title,
    collection,
    price_usd: parseNumber(readCell(row, "Variant Price")),
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
    product_url: buildProductUrl(handle),
    image_url: imageSrc || variantImage
  };
}

function main() {
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

  const products = [];
  const seenIds = new Set();

  for (const row of rows) {
    const title = readCell(row, "Title");

    // Shopify export rows with empty Title are usually extra image or variant rows.
    if (!title) continue;

    const product = convertRowToProduct(row);

    // Skip unusable rows and duplicate products.
    if (!product.id || !product.name || seenIds.has(product.id)) continue;

    seenIds.add(product.id);
    products.push(product);
  }

  fs.writeFileSync(outputPath, `${JSON.stringify(products, null, 2)}\n`);

  console.log(`Converted ${products.length} products.`);
  console.log(`Wrote ${outputPath}`);
}

main();
