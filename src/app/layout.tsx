import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Lojinha EntreGô",
    template: "%s | Lojinha EntreGô",
  },
  description: "Seus pedidos viram pontos. Seus pontos viram conquistas.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Lojinha EntreGô" },
};

export const viewport: Viewport = {
  themeColor: "#2c67ea",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${jakarta.variable} antialiased`}>{children}</body>
    </html>
  );
}
