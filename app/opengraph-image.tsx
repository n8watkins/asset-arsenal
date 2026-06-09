import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Premium dark product OG card: logo mark, wordmark, tagline, indigo/teal glow.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          position: "relative",
          background: "#07080d",
          color: "#f5f6fb",
          fontFamily: "sans-serif",
          overflow: "hidden",
          padding: "84px 96px",
        }}
      >
        {/* Indigo glow */}
        <div
          style={{
            position: "absolute",
            top: -320,
            left: -200,
            width: 820,
            height: 820,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(109,94,252,0.42) 0%, rgba(109,94,252,0) 70%)",
          }}
        />
        {/* Teal glow */}
        <div
          style={{
            position: "absolute",
            bottom: -360,
            right: -240,
            width: 760,
            height: 760,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(45,212,191,0.30) 0%, rgba(45,212,191,0) 70%)",
          }}
        />
        {/* Faint icon-grid motif (top-right) */}
        <div
          style={{
            position: "absolute",
            top: 64,
            right: 72,
            display: "flex",
            flexWrap: "wrap",
            width: 312,
            gap: 16,
            opacity: 0.16,
          }}
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 88,
                height: 88,
                borderRadius: 20,
                border: "2px solid #8f83ff",
              }}
            />
          ))}
        </div>

        {/* Logo mark */}
        <div
          style={{
            display: "flex",
            width: 132,
            height: 132,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 32,
            background: "linear-gradient(135deg, #8f83ff 0%, #6d5efc 100%)",
            boxShadow: "0 24px 60px -16px rgba(109,94,252,0.7)",
          }}
        >
          <svg
            width="78"
            height="78"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="4" y="4" width="7" height="7" rx="1.5" />
            <rect x="13" y="4" width="7" height="7" rx="1.5" />
            <rect x="4" y="13" width="7" height="7" rx="1.5" />
            <path d="M13 16.5h7M16.5 13v7" />
          </svg>
        </div>

        {/* Wordmark */}
        <div
          style={{
            display: "flex",
            marginTop: 56,
            fontSize: 104,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          {SITE.name}
        </div>

        {/* Tagline */}
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 40,
            fontWeight: 400,
            color: "#a8adc4",
            maxWidth: 880,
            lineHeight: 1.25,
          }}
        >
          {SITE.tagline}
        </div>

        {/* Accent underline */}
        <div
          style={{
            display: "flex",
            marginTop: 44,
            width: 200,
            height: 8,
            borderRadius: 999,
            background: "linear-gradient(90deg, #6d5efc 0%, #2dd4bf 100%)",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
