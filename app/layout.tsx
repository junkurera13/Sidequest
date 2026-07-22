import type { Metadata } from "next";
import { DM_Sans, Newsreader } from "next/font/google";
import "./globals.css";

const sidequestSans = DM_Sans({
  variable: "--font-sidequest-sans",
  subsets: ["latin"],
});

const sidequestSerif = Newsreader({
  variable: "--font-sidequest-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Sidequest",
  description:
    "Experiences that feel strangely meant for you.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sidequestSans.variable} ${sidequestSerif.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
