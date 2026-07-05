import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hueb AI Concierge Demo",
  description: "A beginner-friendly luxury jewelry AI concierge prototype."
};

// Next.js App Router projects need a root layout.
// This file wraps every page in the app.
export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
