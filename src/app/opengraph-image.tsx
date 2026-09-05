import { ImageResponse } from "next/og";

export const alt = "Kaunsa Card? Find the best card and way to pay";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "70px 76px", background: "#f6f2e8", color: "#14231a", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 32, fontWeight: 800 }}><span style={{ width: 58, height: 58, borderRadius: 15, display: "flex", alignItems: "center", justifyContent: "center", background: "#14231a", color: "#cce83f" }}>K</span>Kaunsa Card?</div>
      <div style={{ display: "flex", flexDirection: "column" }}><span style={{ fontSize: 24, letterSpacing: 4, color: "#427654", fontWeight: 700 }}>BEFORE YOU PAY</span><span style={{ marginTop: 20, maxWidth: 920, fontSize: 76, lineHeight: 1.02, letterSpacing: -3, fontWeight: 800 }}>Which card should you use?</span><span style={{ marginTop: 28, fontSize: 30, color: "#59635c" }}>Direct, portal or voucher—see the reward maths.</span></div>
    </div>,
    size,
  );
}
