import type { Metadata } from "next";
import { Pixelify_Sans, VT323 } from "next/font/google";
import "./globals.css";

const pixelifySans = Pixelify_Sans({
  variable: "--font-pixelify-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const vt323 = VT323({
  variable: "--font-vt323",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "sidequest",
  description: "text us. we'll find u something to do.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${pixelifySans.variable} ${vt323.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-black text-white scanlines flex flex-col font-[family-name:var(--font-pixelify-sans)]">
        {children}
      </body>
    </html>
  );
}
