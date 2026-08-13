import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hackathon 2026 — Cartas de Poder",
  description: "Tracker de cartas de poder de la Hackathon 2026 de Mimiquate",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
