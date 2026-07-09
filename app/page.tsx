"use client";

import { FormEvent, useState } from "react";

type Product = {
  id: string;
  name: string;
  collection: string;
  price_usd: number | null;
  price_note: string;
  category: string;
  metal: string;
  stones: string[];
  description: string;
  story: string;
  occasion: string;
  style_keywords: string[];
  matching_products: string[];
  product_url: string | null;
  image_url: string | null;
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
      <section className="concierge-column" aria-label="Hueb AI concierge chat">
        <header className="top-bar">
          <a className="wordmark" href="https://www.hueb.com">
            HUEB
          </a>
          <span className="private-label">Private AI Concierge</span>
        </header>

        <div className="hero-copy">
          <p className="eyebrow">Fine jewelry guidance</p>
          <h1>A private consultation for pieces with presence.</h1>
          <p className="hero-text">
            Describe the moment, the metal, the mood, or the budget. Your
            concierge will curate from the Hueb product selection.
          </p>
        </div>

        <div className="salon-card">
          <div className="salon-card-header">
            <div>
              <p className="eyebrow">Concierge conversation</p>
              <h2>Tell us what you are looking for.</h2>
            </div>
            <span className="availability-dot">Live</span>
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
                <p>Selecting pieces from the Hueb catalog...</p>
              </div>
            ) : null}
          </div>

          <form className="chat-form" onSubmit={handleSubmit}>
            <input
              aria-label="Message"
              onChange={(event) => setInput(event.target.value)}
              placeholder="Try: yellow gold earrings under $5,000 for a birthday gift"
              value={input}
            />
            <button disabled={isLoading} type="submit">
              Send
            </button>
          </form>

          {error ? <p className="error-message">{error}</p> : null}
        </div>
      </section>

      <section className="recommendations" aria-label="Recommended products">
        <div className="section-heading">
          <p className="eyebrow">Curated selection</p>
          <h2>Recommended by your concierge</h2>
          <p>
            Product cards appear here after your concierge finds matching Hueb
            pieces.
          </p>
        </div>

        {recommendedProducts.length === 0 ? (
          <div className="empty-state">
            <p>Awaiting your first request</p>
            <span>
              Ask for an occasion, budget, metal, category, stone, or style to
              begin the curation.
            </span>
          </div>
        ) : (
          <div className="product-grid">
            {recommendedProducts.map((product) => (
              <article className="product-card" key={product.id}>
                <div className="image-wrap">
                  {product.image_url ? (
                    <img alt={product.name} src={product.image_url} />
                  ) : (
                    <div className="image-placeholder">Image available on request</div>
                  )}
                </div>
                <div className="product-content">
                  <div className="product-topline">
                    <p className="collection">
                      {product.collection || "Hueb selection"}
                    </p>
                    <span className="price-value">
                      {product.price_usd === null
                        ? "Price available on request"
                        : `Catalog price: $${product.price_usd.toLocaleString()}`}
                    </span>
                  </div>
                  {product.price_usd !== null ? (
                    <p className="price-note">Live website price may vary.</p>
                  ) : null}
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <dl>
                    <div>
                      <dt>Metal</dt>
                      <dd>{product.metal || "Available on request"}</dd>
                    </div>
                    <div>
                      <dt>Occasion</dt>
                      <dd>{product.occasion}</dd>
                    </div>
                    <div>
                      <dt>Stones</dt>
                      <dd>
                        {product.stones.length > 0
                          ? product.stones.join(", ")
                          : "Available on request"}
                      </dd>
                    </div>
                  </dl>
                  {product.product_url ? (
                    <a href={product.product_url} rel="noreferrer" target="_blank">
                      View on Hueb
                    </a>
                  ) : (
                    <span className="concierge-note">Product link unavailable</span>
                  )}
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

        :root {
          --ivory: #fbf6ee;
          --champagne: #ead9bd;
          --soft-gold: #b88a45;
          --deep-gold: #8d6731;
          --espresso: #231712;
          --espresso-soft: #4e3b30;
          --porcelain: #fffdf8;
          --rose-shell: #f3e7dc;
          --line: rgba(117, 83, 45, 0.18);
          --shadow: 0 30px 90px rgba(45, 30, 17, 0.12);
        }

        body {
          margin: 0;
          background:
            linear-gradient(120deg, rgba(255, 252, 246, 0.92), rgba(238, 221, 194, 0.82)),
            var(--ivory);
          color: var(--espresso);
          font-family: "Avenir Next", "Segoe UI", Arial, sans-serif;
        }

        /* The page now uses a two-column editorial layout like a luxury shopping service. */
        .page-shell {
          min-height: 100vh;
          padding: 34px;
          display: grid;
          grid-template-columns: minmax(360px, 0.92fr) minmax(420px, 1.08fr);
          gap: 34px;
          position: relative;
          overflow: hidden;
        }

        .page-shell::before {
          content: "";
          position: absolute;
          inset: 18px;
          border: 1px solid rgba(184, 138, 69, 0.18);
          pointer-events: none;
        }

        .concierge-column,
        .recommendations {
          position: relative;
          z-index: 1;
        }

        .concierge-column {
          min-height: calc(100vh - 68px);
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
        }

        .wordmark {
          color: var(--espresso);
          font-family: Didot, "Bodoni 72", Georgia, serif;
          font-size: 26px;
          letter-spacing: 0.18em;
          text-decoration: none;
        }

        .private-label,
        .availability-dot {
          border: 1px solid rgba(184, 138, 69, 0.36);
          border-radius: 999px;
          color: var(--deep-gold);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          padding: 9px 13px;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .hero-copy {
          max-width: 700px;
          padding: 28px 4px 0;
        }

        .eyebrow,
        .collection {
          margin: 0 0 10px;
          color: var(--deep-gold);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        h1,
        h2,
        h3 {
          margin: 0;
          color: var(--espresso);
          font-family: Didot, "Bodoni 72", Georgia, serif;
          font-weight: 400;
        }

        h1 {
          max-width: 720px;
          font-size: clamp(48px, 6.2vw, 86px);
          line-height: 0.95;
        }

        .hero-text {
          max-width: 570px;
          margin: 22px 0 0;
          color: var(--espresso-soft);
          font-size: 17px;
          line-height: 1.75;
        }

        h2 {
          font-size: 30px;
          line-height: 1.12;
        }

        h3 {
          font-size: 25px;
          line-height: 1.15;
        }

        /* The chat container is styled like a private salon tray instead of a basic demo panel. */
        .salon-card,
        .recommendations {
          background: rgba(255, 253, 248, 0.88);
          border: 1px solid var(--line);
          border-radius: 8px;
          box-shadow: var(--shadow);
          backdrop-filter: blur(18px);
        }

        .salon-card {
          flex: 1;
          min-height: 470px;
          padding: 26px;
          display: flex;
          flex-direction: column;
        }

        .salon-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          border-bottom: 1px solid var(--line);
          padding-bottom: 20px;
        }

        .availability-dot {
          background: #fff9ef;
          color: #7f5a28;
        }

        .conversation {
          flex: 1;
          padding: 24px 4px;
          overflow-y: auto;
        }

        /* Message bubbles are intentionally soft and quiet, like a private consultation. */
        .message {
          margin-bottom: 16px;
          max-width: 88%;
          padding: 15px 17px;
          border-radius: 8px;
          box-shadow: 0 12px 26px rgba(48, 32, 18, 0.06);
        }

        .message span {
          display: block;
          margin-bottom: 7px;
          color: var(--deep-gold);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .message p {
          margin: 0;
          font-size: 15px;
          line-height: 1.65;
        }

        .message.advisor {
          background: var(--rose-shell);
          border: 1px solid rgba(184, 138, 69, 0.14);
        }

        .message.user {
          background: var(--espresso);
          color: #fff8ee;
          margin-left: auto;
        }

        .message.user span {
          color: var(--champagne);
        }

        .chat-form {
          border-top: 1px solid var(--line);
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
          border: 1px solid rgba(141, 103, 49, 0.26);
          background: rgba(255, 255, 255, 0.82);
          color: var(--espresso);
          padding: 15px 16px;
          outline: none;
        }

        input:focus {
          border-color: rgba(184, 138, 69, 0.8);
          box-shadow: 0 0 0 4px rgba(184, 138, 69, 0.12);
        }

        button {
          border: 0;
          background: var(--espresso);
          color: #fff9ef;
          cursor: pointer;
          font-weight: 800;
          letter-spacing: 0.08em;
          min-width: 104px;
          padding: 0 24px;
          text-transform: uppercase;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.58;
        }

        .error-message {
          color: #9f2f2f;
          margin: 12px 0 0;
        }

        .recommendations {
          min-height: calc(100vh - 68px);
          padding: 30px;
          display: flex;
          flex-direction: column;
        }

        .section-heading {
          border-bottom: 1px solid var(--line);
          margin-bottom: 24px;
          padding-bottom: 22px;
        }

        .section-heading p:last-child {
          max-width: 560px;
          margin: 12px 0 0;
          color: var(--espresso-soft);
          line-height: 1.65;
        }

        .empty-state {
          flex: 1;
          min-height: 360px;
          border: 1px dashed rgba(141, 103, 49, 0.3);
          border-radius: 8px;
          color: var(--espresso-soft);
          display: grid;
          place-content: center;
          padding: 34px;
          text-align: center;
        }

        .empty-state p {
          margin: 0 0 10px;
          color: var(--espresso);
          font-family: Didot, "Bodoni 72", Georgia, serif;
          font-size: 32px;
        }

        .empty-state span {
          display: block;
          max-width: 390px;
          line-height: 1.65;
        }

        .product-grid {
          display: grid;
          gap: 22px;
        }

        /* Product cards now resemble luxury ecommerce tiles with image-first hierarchy. */
        .product-card {
          background: var(--porcelain);
          border: 1px solid rgba(184, 138, 69, 0.18);
          border-radius: 8px;
          box-shadow: 0 20px 55px rgba(45, 30, 17, 0.08);
          display: grid;
          grid-template-columns: 230px 1fr;
          overflow: hidden;
          transition:
            box-shadow 180ms ease,
            transform 180ms ease;
        }

        .product-card:hover {
          box-shadow: 0 28px 70px rgba(45, 30, 17, 0.13);
          transform: translateY(-2px);
        }

        .image-wrap {
          background: #f0e6d8;
          min-height: 260px;
          overflow: hidden;
        }

        .product-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 240ms ease;
        }

        .image-placeholder {
          width: 100%;
          height: 100%;
          min-height: inherit;
          display: grid;
          place-items: center;
          color: var(--deep-gold);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.12em;
          padding: 24px;
          text-align: center;
          text-transform: uppercase;
        }

        .product-card:hover img {
          transform: scale(1.035);
        }

        .product-content {
          padding: 24px;
        }

        .product-topline {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
        }

        .price-value {
          color: var(--espresso);
          font-size: 14px;
          font-weight: 800;
          white-space: nowrap;
        }

        .price-note {
          margin: 6px 0 14px;
          color: var(--deep-gold);
          font-size: 12px;
          font-weight: 700;
        }

        .product-content p {
          color: var(--espresso-soft);
          line-height: 1.62;
        }

        dl {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          margin: 20px 0;
        }

        dt {
          color: var(--deep-gold);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        dd {
          margin: 5px 0 0;
          color: var(--espresso);
          font-size: 13px;
          line-height: 1.35;
          text-transform: capitalize;
        }

        a {
          color: var(--deep-gold);
          display: inline-flex;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-decoration: none;
          text-transform: uppercase;
        }

        .concierge-note {
          color: var(--espresso-soft);
          display: inline-flex;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        @media (max-width: 1020px) {
          .page-shell {
            grid-template-columns: 1fr;
            padding: 24px;
          }

          .page-shell::before {
            inset: 12px;
          }

          .concierge-column,
          .recommendations {
            min-height: auto;
          }
        }

        @media (max-width: 680px) {
          .page-shell {
            gap: 22px;
            padding: 16px;
          }

          .page-shell::before {
            display: none;
          }

          .top-bar,
          .salon-card-header,
          .product-topline {
            align-items: flex-start;
            flex-direction: column;
          }

          .hero-copy {
            padding-top: 14px;
          }

          h1 {
            font-size: 46px;
          }

          h2 {
            font-size: 25px;
          }

          .salon-card,
          .recommendations {
            padding: 20px;
          }

          .message {
            max-width: 96%;
          }

          .chat-form,
          .product-card,
          dl {
            grid-template-columns: 1fr;
          }

          button {
            min-height: 50px;
          }

          .image-wrap {
            min-height: 300px;
          }
        }
      `}</style>
    </main>
  );
}
