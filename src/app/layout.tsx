import type { Metadata, Viewport } from "next";
import "./globals.css";

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
      <body className="antialiased">{children}</body>
    </html>
  );
}
