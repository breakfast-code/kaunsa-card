export type PurchaseType = "shopping" | "flight" | "hotel" | "dining" | "utility" | "insurance" | "fuel" | "rent" | "education" | "jewellery" | "railway" | "government" | "gaming" | "toll" | "gift-card" | "emi" | "general";
export type PaymentMode = "online" | "store";

export type PublicCard = {
  id: string;
  issuer: string;
  name: string;
  short: string;
  tone: string;
};

export const cardCatalogue: PublicCard[] = [
  { id: "hdfc-dcb-metal", issuer: "HDFC Bank", name: "Diners Club Black Metal", short: "DCB", tone: "obsidian" },
  { id: "hdfc-infinia", issuer: "HDFC Bank", name: "Infinia Metal", short: "Infinia", tone: "obsidian" },
  { id: "hdfc-regalia-gold", issuer: "HDFC Bank", name: "Regalia Gold", short: "Regalia", tone: "gold" },
  { id: "hdfc-millennia", issuer: "HDFC Bank", name: "Millennia", short: "Millennia", tone: "navy" },
  { id: "hdfc-tata-neu-infinity", issuer: "HDFC Bank", name: "Tata Neu Infinity", short: "Neu Infinity", tone: "navy" },
  { id: "hdfc-tata-neu-plus", issuer: "HDFC Bank", name: "Tata Neu Plus", short: "Neu Plus", tone: "navy" },
  { id: "icici-amazon-pay", issuer: "ICICI Bank", name: "Amazon Pay ICICI", short: "Amazon Pay", tone: "amazon" },
  { id: "icici-epm", issuer: "ICICI Bank", name: "Emeralde Private Metal", short: "EPM", tone: "emerald" },
  { id: "icici-sapphiro", issuer: "ICICI Bank", name: "Sapphiro", short: "Sapphiro", tone: "navy" },
  { id: "axis-atlas", issuer: "Axis Bank", name: "ATLAS Credit Card", short: "ATLAS", tone: "burgundy" },
  { id: "axis-ace", issuer: "Axis Bank", name: "ACE Credit Card", short: "ACE", tone: "burgundy" },
  { id: "axis-flipkart", issuer: "Axis Bank", name: "Flipkart Axis Bank", short: "Flipkart", tone: "burgundy" },
  { id: "amex-plat-travel", issuer: "American Express", name: "Platinum Travel", short: "Platinum", tone: "silver" },
  { id: "amex-mrcc", issuer: "American Express", name: "Membership Rewards Card", short: "MRCC", tone: "silver" },
  { id: "amex-gold", issuer: "American Express", name: "Gold Card", short: "Gold", tone: "gold" },
  { id: "sbi-cashback", issuer: "SBI Card", name: "CASHBACK SBI Card", short: "CASHBACK", tone: "navy" },
  { id: "sbi-simplyclick", issuer: "SBI Card", name: "SimplyCLICK", short: "SimplyCLICK", tone: "navy" },
  { id: "hsbc-premier", issuer: "HSBC", name: "Premier Credit Card", short: "Premier", tone: "ruby" },
  { id: "hsbc-travelone", issuer: "HSBC", name: "TravelOne Credit Card", short: "TravelOne", tone: "ruby" },
  { id: "hsbc-live-plus", issuer: "HSBC", name: "Live+ Credit Card", short: "Live+", tone: "ruby" },
  { id: "scapia-visa", issuer: "Federal Bank", name: "Scapia Federal Visa", short: "Scapia", tone: "sky" },
];

export const cardIssuers = [...new Set(cardCatalogue.map((card) => card.issuer))];
