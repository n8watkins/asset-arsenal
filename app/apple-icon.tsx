import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// 180×180 rounded-square mark with the 2×2 grid glyph on the dark brand bg.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#07080d",
        }}
      >
        <div
          style={{
            width: 148,
            height: 148,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 38,
            background: "linear-gradient(135deg, #8f83ff 0%, #6d5efc 100%)",
            boxShadow: "0 18px 48px -12px rgba(109,94,252,0.65)",
          }}
        >
          <svg
            width="92"
            height="92"
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
      </div>
    ),
    { ...size },
  );
}
