import type { PurchaseType } from "./card-catalogue";

export type MerchantRecord = {
  key: string;
  name: string;
  category: string;
  defaultType: PurchaseType;
  aliases: string[];
};

export const merchants: MerchantRecord[] = [
  { key: "makemytrip", name: "MakeMyTrip", category: "online-travel-agent", defaultType: "flight", aliases: ["make my trip", "mmt"] },
  { key: "flipkart", name: "Flipkart", category: "marketplace", defaultType: "shopping", aliases: [] },
  { key: "swiggy", name: "Swiggy", category: "food-delivery", defaultType: "dining", aliases: [] },
  { key: "zomato", name: "Zomato", category: "food-delivery", defaultType: "dining", aliases: [] },
  { key: "bookmyshow", name: "BookMyShow", category: "entertainment", defaultType: "shopping", aliases: ["book my show"] },
  { key: "irctc", name: "IRCTC", category: "railway", defaultType: "railway", aliases: [] },
  { key: "myntra", name: "Myntra", category: "fashion", defaultType: "shopping", aliases: [] },
  { key: "nykaa", name: "Nykaa", category: "beauty", defaultType: "shopping", aliases: [] },
  { key: "ajio", name: "Ajio", category: "fashion", defaultType: "shopping", aliases: [] },
  { key: "uber", name: "Uber", category: "transport", defaultType: "general", aliases: [] },
  { key: "blinkit", name: "Blinkit", category: "quick-commerce", defaultType: "shopping", aliases: [] },
  { key: "zepto", name: "Zepto", category: "quick-commerce", defaultType: "shopping", aliases: [] },
  { key: "tata-neu", name: "Tata Neu", category: "super-app", defaultType: "shopping", aliases: ["tataneu"] },
  { key: "croma", name: "Croma", category: "electronics", defaultType: "shopping", aliases: ["tata croma"] },
  { key: "reliance-digital", name: "Reliance Digital", category: "electronics", defaultType: "shopping", aliases: [] },
  { key: "cleartrip", name: "Cleartrip", category: "online-travel-agent", defaultType: "flight", aliases: [] },
  { key: "goibibo", name: "Goibibo", category: "online-travel-agent", defaultType: "flight", aliases: ["go ibibo"] },
  { key: "agoda", name: "Agoda", category: "online-travel-agent", defaultType: "hotel", aliases: [] },
  { key: "apollo", name: "Apollo", category: "pharmacy", defaultType: "shopping", aliases: ["apollo 24x7", "apollo pharmacy"] },
  { key: "bigbasket", name: "Big Basket", category: "grocery", defaultType: "shopping", aliases: ["bigbasket"] },
  { key: "amazon", name: "Amazon", category: "marketplace", defaultType: "shopping", aliases: ["amazon.in"] },
  { key: "air-india", name: "Air India", category: "airline-direct", defaultType: "flight", aliases: [] },
  { key: "indigo", name: "IndiGo", category: "airline-direct", defaultType: "flight", aliases: ["6e"] },
  { key: "marriott", name: "Marriott", category: "hotel-direct", defaultType: "hotel", aliases: [] },
  { key: "accor", name: "Accor", category: "hotel-direct", defaultType: "hotel", aliases: [] },
  { key: "kalyan-jewellers", name: "Kalyan Jewellers", category: "jewellery", defaultType: "jewellery", aliases: ["kalyan jewelers"] },
  { key: "tanishq", name: "Tanishq", category: "jewellery", defaultType: "jewellery", aliases: [] },
  { key: "malabar-gold", name: "Malabar Gold & Diamonds", category: "jewellery", defaultType: "jewellery", aliases: ["malabar gold"] },
  { key: "joyalukkas", name: "Joyalukkas", category: "jewellery", defaultType: "jewellery", aliases: ["joy alukkas"] },
];

const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function resolveMerchant(input: string) {
  const value = normalized(input);
  if (!value) return undefined;
  return merchants.find((merchant) => [merchant.name, merchant.key, ...merchant.aliases]
    .some((candidate) => {
      const match = normalized(candidate);
      return value === match || value.includes(match);
    }));
}
