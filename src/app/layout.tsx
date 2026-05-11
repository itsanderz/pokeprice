import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PokePrice — Real-time Pokémon Card Pricing",
  description: "Search any Pokémon card for real-time prices from TCGPlayer & Cardmarket",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
