"use client";

import { FormEvent, useState } from "react";

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

type ChatMessage = {
  role: "user" | "advisor";
  text: string;
};

export default function HomePage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "advisor",
      text: "Welcome to the Hueb concierge. Tell me the occasion, budget, metal, or style you have in mind."
    }
  ]);
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    // Add the shopper's message immediately so the interface feels responsive.
    setMessages((currentMessages) => [
      ...currentMessages,
      { role: "user", text: trimmedInput }
    ]);
    setInput("");
    setError("");
    setIsLoading(true);

    try {
      // This calls our own backend route.
      // The browser never sees the private OpenAI API key.
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message: trimmedInput })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        { role: "advisor", text: data.advisor_message }
      ]);
      setRecommendedProducts(data.recommended_products || []);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "The concierge could not respond.";

      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="chat-panel" aria-label="Hueb AI concierge chat">
        <div className="brand-bar">
          <div>
            <p className="eyebrow">Hueb AI Concierge</p>
            <h1>Luxury jewelry guidance, from a tiny demo catalog.</h1>
          </div>
          <span className="status-pill">Prototype</span>
        </div>

        <div className="conversation">
          {messages.map((message, index) => (
            <div
              className={`message ${message.role}`}
              key={`${message.role}-${index}`}
            >
              <span>{message.role === "advisor" ? "Advisor" : "You"}</span>
              <p>{message.text}</p>
            </div>
          ))}

          {isLoading ? (
            <div className="message advisor">
              <span>Advisor</span>
              <p>Selecting pieces from the Hueb demo catalog...</p>
            </div>
          ) : null}
        </div>

        <form className="chat-form" onSubmit={handleSubmit}>
          <input
            aria-label="Message"
            onChange={(event) => setInput(event.target.value)}
            placeholder="Try: I need yellow gold earrings under $5,000 for a birthday gift"
            value={input}
          />
          <button disabled={isLoading} type="submit">
            Send
          </button>
        </form>

        {error ? <p className="error-message">{error}</p> : null}
      </section>

      <section className="recommendations" aria-label="Recommended products">
        <div className="section-heading">
          <p className="eyebrow">Recommendations</p>
          <h2>Catalog pieces selected for this conversation</h2>
        </div>

        {recommendedProducts.length === 0 ? (
          <div className="empty-state">
            Ask for a style, occasion, metal, category, or budget to see product
            cards here.
          </div>
        ) : (
          <div className="product-grid">
            {recommendedProducts.map((product) => (
              <article className="product-card" key={product.id}>
                <img alt={product.name} src={product.image_url} />
                <div className="product-content">
                  <p className="collection">{product.collection}</p>
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <dl>
                    <div>
                      <dt>Price</dt>
                      <dd>${product.price_usd.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>Metal</dt>
                      <dd>{product.metal}</dd>
                    </div>
                    <div>
                      <dt>Occasion</dt>
                      <dd>{product.occasion}</dd>
                    </div>
                  </dl>
                  <a href={product.product_url}>View placeholder product</a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #f7f1e8;
          color: #211a16;
          font-family: Arial, Helvetica, sans-serif;
        }

        .page-shell {
          min-height: 100vh;
          padding: 40px;
          display: grid;
          grid-template-columns: minmax(320px, 0.95fr) minmax(320px, 1.05fr);
          gap: 28px;
        }

        .chat-panel,
        .recommendations {
          background: rgba(255, 252, 247, 0.92);
          border: 1px solid #e6d7c5;
          border-radius: 8px;
          box-shadow: 0 24px 70px rgba(53, 39, 25, 0.12);
        }

        .chat-panel {
          min-height: calc(100vh - 80px);
          padding: 28px;
          display: flex;
          flex-direction: column;
        }

        .brand-bar {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          border-bottom: 1px solid #eadfce;
          padding-bottom: 22px;
        }

        .eyebrow,
        .collection {
          margin: 0 0 8px;
          color: #8a6b47;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        h1,
        h2,
        h3 {
          margin: 0;
          font-family: Georgia, "Times New Roman", serif;
          font-weight: 500;
        }

        h1 {
          max-width: 560px;
          font-size: 40px;
          line-height: 1.05;
        }

        h2 {
          font-size: 26px;
        }

        h3 {
          font-size: 22px;
        }

        .status-pill {
          border: 1px solid #b89965;
          border-radius: 999px;
          color: #6f512d;
          flex: 0 0 auto;
          font-size: 12px;
          padding: 8px 12px;
        }

        .conversation {
          flex: 1;
          padding: 24px 0;
          overflow-y: auto;
        }

        .message {
          margin-bottom: 16px;
          max-width: 88%;
          padding: 14px 16px;
          border-radius: 8px;
        }

        .message span {
          display: block;
          margin-bottom: 6px;
          font-size: 12px;
          font-weight: 700;
          color: #8a6b47;
        }

        .message p {
          margin: 0;
          line-height: 1.55;
        }

        .message.advisor {
          background: #f0e4d4;
        }

        .message.user {
          background: #211a16;
          color: white;
          margin-left: auto;
        }

        .message.user span {
          color: #d6b987;
        }

        .chat-form {
          border-top: 1px solid #eadfce;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          padding-top: 18px;
        }

        input,
        button {
          border-radius: 8px;
          font: inherit;
        }

        input {
          width: 100%;
          border: 1px solid #d9c7af;
          background: white;
          color: #211a16;
          padding: 14px 16px;
        }

        button {
          border: 0;
          background: #8a5d2f;
          color: white;
          cursor: pointer;
          font-weight: 700;
          padding: 0 22px;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .error-message {
          color: #9f2f2f;
          margin: 12px 0 0;
        }

        .recommendations {
          padding: 28px;
        }

        .section-heading {
          margin-bottom: 20px;
        }

        .empty-state {
          border: 1px dashed #d8c6ad;
          border-radius: 8px;
          color: #6f6258;
          line-height: 1.6;
          padding: 22px;
        }

        .product-grid {
          display: grid;
          gap: 18px;
        }

        .product-card {
          background: #fffaf4;
          border: 1px solid #e6d7c5;
          border-radius: 8px;
          display: grid;
          grid-template-columns: 180px 1fr;
          overflow: hidden;
        }

        .product-card img {
          width: 100%;
          height: 100%;
          min-height: 220px;
          object-fit: cover;
        }

        .product-content {
          padding: 20px;
        }

        .product-content p {
          color: #5f5248;
          line-height: 1.55;
        }

        dl {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          margin: 18px 0;
        }

        dt {
          color: #8a6b47;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
        }

        dd {
          margin: 4px 0 0;
          color: #211a16;
        }

        a {
          color: #8a5d2f;
          font-weight: 700;
          text-decoration: none;
        }

        @media (max-width: 900px) {
          .page-shell {
            grid-template-columns: 1fr;
            padding: 20px;
          }

          .chat-panel {
            min-height: auto;
          }
        }

        @media (max-width: 620px) {
          h1 {
            font-size: 32px;
          }

          .brand-bar,
          .chat-form,
          .product-card,
          dl {
            grid-template-columns: 1fr;
          }

          .brand-bar {
            display: grid;
          }

          button {
            min-height: 48px;
          }
        }
      `}</style>
    </main>
  );
}
