import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { OneSignalProvider } from "@/components/OneSignalProvider";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DealSpy.eu - EU Csődvagyon Monitoring",
  description:
    "Automatikus csődvagyon és aukció monitoring Magyarország, Ausztria és Németország területén. Értesítünk, ha megjelenik amit keresel.",
  keywords: [
    "csődvagyon",
    "aukció",
    "insolvency",
    "bankruptcy",
    "auction",
    "EU",
    "monitoring",
  ],
  authors: [{ name: "DealSpy.eu" }],
  openGraph: {
    title: "DealSpy.eu - EU Csődvagyon Monitoring",
    description:
      "Automatikus csődvagyon és aukció monitoring. Értesítünk, ha megjelenik amit keresel.",
    url: "https://dealspy.eu",
    siteName: "DealSpy.eu",
    locale: "hu_HU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DealSpy.eu - EU Csődvagyon Monitoring",
    description:
      "Automatikus csődvagyon és aukció monitoring. Értesítünk, ha megjelenik amit keresel.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hu">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#1e3a5f" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <OneSignalProvider />
        {children}
      </body>
    </html>
  );
}
