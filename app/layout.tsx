import type { Metadata } from "next";
import "./globals.css";
import { DebateProvider } from "@/contexts/DebateContext";

export const metadata: Metadata = {
  title: "Debate Arena - Multi-Agent AI Debate Platform",
  description: "AI personas with configurable perspectives debate from their unique viewpoints, orchestrated by a ReAct-based moderator with 3D visualization.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        <DebateProvider>{children}</DebateProvider>
      </body>
    </html>
  );
}
