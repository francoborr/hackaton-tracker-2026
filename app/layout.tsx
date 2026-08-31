import type { Metadata } from "next";
import { Pirata_One, Noto_Serif } from "next/font/google";
import "./globals.css";

const pirataOne = Pirata_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pirata",
});

const notoSerif = Noto_Serif({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-noto-serif",
});

export const metadata: Metadata = {
  title: "Hackathon 2026 — Cartas de Poder",
  description: "Tracker de cartas de poder de la Hackathon 2026 de Mimiquate",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${pirataOne.variable} ${notoSerif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
