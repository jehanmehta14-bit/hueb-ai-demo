# Hueb AI Concierge Demo

This is a beginner-friendly Next.js and TypeScript prototype for a luxury jewelry AI concierge.

The app lets a shopper type a request like:

> I need yellow gold earrings under $5,000 for a birthday gift.

The backend searches `data/products.json`, sends the best matching products to the OpenAI API, and returns:

- `advisor_message`
- `recommended_products`

The AI is instructed to recommend only products from the local JSON catalog.

## Project Structure

```txt
hueb-ai-demo/
  app/
    page.tsx
    layout.tsx
    api/
      chat/
        route.ts
  data/
    products.json
  lib/
    db.ts
  sql/
    create-chat-logs.sql
  .env.example
  README.md
  package.json
  next-env.d.ts
  tsconfig.json
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create your local environment file:

```bash
cp .env.example .env.local
```

3. Open `.env.local` and replace the placeholder with your real OpenAI API key:

```bash
OPENAI_API_KEY=your_real_api_key
DATABASE_URL=your_postgres_connection_string
```

4. Start the development server:

```bash
npm run dev
```

5. Open the local URL shown in your terminal, usually:

```txt
http://localhost:3000
```

## How It Works

The homepage is in `app/page.tsx`.

- It shows the chat interface.
- It sends the shopper message to `/api/chat`.
- It displays the advisor response.
- It displays recommended product cards.

The backend route is in `app/api/chat/route.ts`.

- It loads products from `data/products.json`.
- It scores products by budget, category, metal, collection, occasion, stones, and keywords.
- It sends the top matching products to OpenAI.
- It uses OpenAI's Responses API for the advisor message.
- It asks OpenAI to return product IDs only.
- It uses those IDs to return real product objects from `products.json`.
- It saves each successful chat request and response to Postgres when `DATABASE_URL` is configured.

The catalog is in `data/products.json`.

- The current products are placeholders.
- Replace them later with real Hueb product data when available.

## Shopify Catalog Import

The script at `scripts/convert-shopify-xlsx-to-products-json.js` converts the Shopify Excel export into `data/products.json`.

Put the export here:

```txt
data/product data_shopify.xlsx
```

Then run:

```bash
npm run convert:products
```

The script also writes:

```txt
data/catalog-quality-report.json
```

Use that report to check catalog health after each import. It shows how many products have generated public URLs, images, prices, collections, metals, and stones.

The importer creates product links from lowercase Shopify handles. It does not remove a link just because an automated request fails, because the live Hueb website may block automated checks or behave differently by region/currency. A product URL is only `null` when the Shopify export has no handle.

Prices are labeled as catalog prices from the Shopify export because live website prices may vary by region/currency. Missing prices are stored as `null`, not `0`, because an unknown price is not the same as a free product.

## Rate Limiting

The `/api/chat` route includes a simple in-memory rate limiter.

- Each IP address can make 10 chat requests per hour.
- If someone goes over the limit, the API returns HTTP `429`.
- This protects OpenAI API costs by blocking repeated spam requests before the app calls OpenAI.

This is beginner-friendly and works for demos, but it is not ideal for production. In production, especially on Vercel where server instances can restart or scale, replace the in-memory `Map` with shared storage such as Redis, Vercel KV, or Upstash.

## Important Learning Note

Never put your OpenAI API key directly in frontend code.

This project keeps the API key in the backend route so the browser cannot see it.

The same rule applies to `DATABASE_URL`. Keep it in `.env.local` locally and in Vercel environment variables when deployed.

## Database Logging Setup

This app can save each chat request and AI response to a Vercel-compatible Postgres database.

### 1. Create A Database On Vercel

In your Vercel project dashboard:

1. Go to the `Storage` tab.
2. Create a Postgres database. Vercel may offer Neon-backed Postgres.
3. Copy the database connection string called `DATABASE_URL`.

### 2. Add `DATABASE_URL`

For local development, add it to `.env.local`:

```bash
DATABASE_URL=your_real_database_url
```

For deployment, add the same variable in Vercel:

```txt
Project Settings -> Environment Variables -> DATABASE_URL
```

Do not commit `.env.local` to GitHub.

### 3. Create The Table

Open your database SQL editor in Vercel or Neon, then run the SQL from:

```txt
sql/create-chat-logs.sql
```

That creates a table called `chat_logs`.

### 4. Test Logging

Start the app:

```bash
npm run dev
```

Send a chat message in the concierge.

Then run this in your database SQL editor:

```sql
SELECT *
FROM chat_logs
ORDER BY created_at DESC
LIMIT 10;
```

If logging is working, you will see the latest user message, advisor message, and recommended product IDs/names.

If the database is not set up yet, the chat still works. The server will skip logging instead of crashing the user experience.
