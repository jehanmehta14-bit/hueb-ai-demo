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

The catalog is in `data/products.json`.

- The current products are placeholders.
- Replace them later with real Hueb product data when available.

## Important Learning Note

Never put your OpenAI API key directly in frontend code.

This project keeps the API key in the backend route so the browser cannot see it.
