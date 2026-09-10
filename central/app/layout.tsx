import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.PUBLIC_BASE_URL ?? "http://localhost:5173/central",
  ),
  title: "Speed GT Brasil",
  description: "Sistema privado de gestão da liga Speed GT Brasil.",
  openGraph: {
    title: "Speed GT Brasil",
    description: "Central de gestão da liga Speed GT Brasil.",
    type: "website",
    locale: "pt_BR",
    images: [{ url: "/central/og.png", width: 1200, height: 630, alt: "Speed GT Brasil — Central da liga" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Speed GT Brasil",
    description: "Central de gestão da liga Speed GT Brasil.",
    images: ["/central/og.png"],
  },
  icons: {
    icon: "/central/favicon.svg",
    shortcut: "/central/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
