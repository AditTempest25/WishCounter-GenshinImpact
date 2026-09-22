import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Irminsul Wish",
  description: "Automatic Genshin Impact wish tracking",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
