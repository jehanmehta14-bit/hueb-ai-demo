type ChatLogInput = {
  userMessage: string;
  advisorMessage: string;
  recommendedProductIds: string[];
  recommendedProductNames: string[];
  userIp?: string | null;
  userAgent?: string | null;
};

type PgPool = {
  query: (sql: string, values?: unknown[]) => Promise<unknown>;
};

type PgModule = {
  Pool: new (config: {
    connectionString: string;
    ssl?: { rejectUnauthorized: boolean };
  }) => PgPool;
};

let pool: PgPool | null = null;

async function getPool() {
  // DATABASE_URL is the single connection string Vercel/Neon gives us.
  // Keeping it in an environment variable means it is never stored in GitHub.
  if (!process.env.DATABASE_URL) {
    return null;
  }

  // Next.js can reuse this module while the server is warm.
  // Reusing one Pool avoids creating a brand-new database connection for every chat.
  if (!pool) {
    // Load pg only when logging is needed.
    // Function() keeps Turbopack from requiring pg during a local build before
    // the student has successfully run npm install.
    const loadPg = Function("packageName", "return import(packageName)");
    const { Pool } = (await loadPg("pg")) as PgModule;

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : undefined
    });
  }

  return pool;
}

export async function saveChatLog({
  userMessage,
  advisorMessage,
  recommendedProductIds,
  recommendedProductNames,
  userIp,
  userAgent
}: ChatLogInput) {
  const db = await getPool();

  // Local beginners may not have a database yet.
  // Skipping logging keeps the chat feature working while setup is incomplete.
  if (!db) {
    console.warn("DATABASE_URL is missing. Chat logging was skipped.");
    return;
  }

  await db.query(
    `
      INSERT INTO chat_logs (
        user_message,
        advisor_message,
        recommended_product_ids,
        recommended_product_names,
        user_ip,
        user_agent
      )
      VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6)
    `,
    [
      userMessage,
      advisorMessage,
      JSON.stringify(recommendedProductIds),
      JSON.stringify(recommendedProductNames),
      userIp || null,
      userAgent || null
    ]
  );
}
