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
  title: { default: "Best Credit Card for Your Purchase | Kaunsa Card?", template: "%s | Kaunsa Card?" },
  description: "Find the best Indian credit card for a purchase. Compare direct payment, SmartBuy and voucher rewards with clear calculations and sources.",
  applicationName: "Kaunsa Card?",
  keywords: ["best credit card for payment", "Indian credit card rewards", "credit card reward calculator", "SmartBuy", "credit card vouchers"],
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website", locale: "en_IN", url: "/", siteName: "Kaunsa Card?",
    title: "Which credit card should you use?",
    description: "Compare direct payment, bank portals and vouchers before you pay.",
  },
  twitter: { card: "summary_large_image", title: "Which credit card should you use?", description: "Tell Kaunsa Card? what you are buying. It checks your cards and shows the reward maths." },
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
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "WebApplication", name: "Kaunsa Card?", url: "https://kaunsa-card.vercel.app", applicationCategory: "FinanceApplication", operatingSystem: "Web", description: "Finds the best way to pay using supported Indian credit cards, bank portals and vouchers.", offers: { "@type": "Offer", price: "0", priceCurrency: "INR" } },
            { "@type": "FAQPage", mainEntity: [
              { "@type": "Question", name: "What does Kaunsa Card do?", acceptedAnswer: { "@type": "Answer", text: "It compares selected Indian credit cards for a purchase and ranks direct, bank-portal and voucher payment routes." } },
              { "@type": "Question", name: "Does Kaunsa Card need my card number?", acceptedAnswer: { "@type": "Answer", text: "No. You select card names only. Kaunsa Card does not ask for card numbers or bank login details." } },
              { "@type": "Question", name: "Are the reward estimates guaranteed?", acceptedAnswer: { "@type": "Answer", text: "No. Results are estimates based on published rules. Merchant classification, limits and changing bank terms can affect actual rewards." } },
            ] },
          ],
        }).replace(/</g, "\\u003c") }} />
      </body>
    </html>
  );
}
