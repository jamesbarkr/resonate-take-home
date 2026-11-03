import type { Metadata } from "next";
import "./globals.css";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Lakeside Family Dental";

export const metadata: Metadata = {
  title: `${appName} | Boston, MA`,
  description:
    "Gentle, modern dental care for the whole family. Book cleanings, checkups, same-day emergency visits, and family appointments online.",
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
