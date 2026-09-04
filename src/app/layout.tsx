import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { AnalyticsProvider } from "./AnalyticsProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://kaunsa-card.vercel.app"),
  title: { default: "Kaunsa Card? | Find the best way to pay", template: "%s | Kaunsa Card?" },
  description: "Compare direct card payment, bank portals and voucher routes for Indian credit cards. See the reward maths, official source and exact steps before you pay.",
  applicationName: "Kaunsa Card?",
  keywords: ["best credit card for payment", "Indian credit card rewards", "credit card reward calculator", "SmartBuy", "credit card vouchers"],
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website", locale: "en_IN", url: "/", siteName: "Kaunsa Card?",
    title: "Kaunsa Card? | Find the best way to pay",
    description: "Compare direct payment, bank portals and voucher routes before you pay.",
  },
  twitter: { card: "summary", title: "Kaunsa Card? | Find the best way to pay", description: "The best way to pay, not merely the best card." },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider>
          <ConvexClientProvider><AnalyticsProvider>{children}</AnalyticsProvider></ConvexClientProvider>
        </ClerkProvider>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org", "@type": "WebApplication", name: "Kaunsa Card?",
          url: "https://kaunsa-card.vercel.app", applicationCategory: "FinanceApplication", operatingSystem: "Web",
          description: "Compares verified payment routes for supported Indian credit cards.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
        }).replace(/</g, "\\u003c") }} />
      </body>
    </html>
  );
}
