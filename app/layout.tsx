import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kartu Review",
  description: "Sistem pengelolaan kartu QR/NFC Google Review",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
          {children}
        </div>
      </body>
    </html>
  );
}
