import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "Ellavox — Meeting Intelligence Pipeline",
  description: "Extract action items from meeting transcripts automatically",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
