import type { Metadata } from "next";
import { serif, sans } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Image Editor",
  description: "Image masking and highlighting tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${serif.variable} ${sans.variable} font-sans bg-gray-50 text-black`}>
        {children}
      </body>
    </html>
  );
}
