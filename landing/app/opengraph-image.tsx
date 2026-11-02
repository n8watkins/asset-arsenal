import { ImageResponse } from "next/og";

// Rendered once at build time for the static export.
export const dynamic = "force-static";

export const alt = "Asset Arsenal: reimagine your page in any style, then ship the assets";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const skins = [
  { name: "Plain", bg: "#f6f6f7", card: "#ffffff", ink: "#1d1d22", btn: "#3b82f6", border: "1px solid #e2e2e6" },
  { name: "High fantasy", bg: "#1d1710", card: "#ead9b0", ink: "#3a2a14", btn: "#7a1f1f", border: "4px solid #b08a3e" },
  { name: "Sci-fi", bg: "#050b14", card: "#0a1e30", ink: "#d8f6ff", btn: "#0b3a4a", border: "2px solid #1fb6d9" },
];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "60px 72px", background: "#0e0d12", color: "#f2eee6", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, fontWeight: 800 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f3b73f" }} />
          Asset Arsenal
        </div>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 800, letterSpacing: -2 }}>
          Give your page a&nbsp;<span style={{ color: "#f3b73f" }}>skin</span>.
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          {skins.map((s) => (
            <div key={s.name} style={{ display: "flex", flexDirection: "column", gap: 12, width: 330, padding: 20, borderRadius: 18, background: s.bg }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16, borderRadius: 10, background: s.card, border: s.border, color: s.ink }}>
                <div style={{ fontSize: 24, fontWeight: 700 }}>Suggestion box</div>
                <div style={{ display: "flex", height: 26, borderRadius: 6, background: s.ink, opacity: 0.12 }} />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ display: "flex", padding: "6px 14px", borderRadius: 6, background: s.btn, color: "#ffffff", fontSize: 18 }}>Send idea</div>
                </div>
              </div>
              <div style={{ fontSize: 18, color: s.name === "Plain" ? "#6b6b75" : "#c9b98f" }}>{s.name}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
