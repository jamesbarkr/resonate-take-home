import type { Metadata } from "next";
import "./globals.css";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Lakeside Family Dental";

export const metadata: Metadata = {
  title: `${appName} | Patient Assistant`,
  description:
    "A conversational scheduling assistant for a dental practice, built for the Resonate AI take-home assessment.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
