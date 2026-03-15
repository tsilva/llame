import { ImageResponse } from "next/og";

export const socialImageAlt = "llame runs private AI models directly in your browser.";
export const socialImageSize = {
  width: 1200,
  height: 630,
};

export const socialImageContentType = "image/png";

export function createSocialImageResponse() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "stretch",
          background:
            "linear-gradient(135deg, #111827 0%, #1f2937 45%, #0f766e 100%)",
          color: "#f9fafb",
          display: "flex",
          flexDirection: "column",
          fontFamily: "sans-serif",
          height: "100%",
          justifyContent: "space-between",
          padding: "56px 64px",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            gap: 18,
          }}
        >
          <div
            style={{
              alignItems: "center",
              background: "#10a37f",
              borderRadius: 9999,
              display: "flex",
              fontSize: 42,
              fontWeight: 700,
              height: 72,
              justifyContent: "center",
              width: 72,
            }}
          >
            l
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ fontSize: 24, letterSpacing: 6, opacity: 0.7, textTransform: "uppercase" }}>
              local browser ai
            </div>
            <div style={{ fontSize: 36, fontWeight: 700 }}>llame</div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            maxWidth: 900,
          }}
        >
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05 }}>
            Run private AI models directly in your browser.
          </div>
          <div style={{ color: "#d1d5db", display: "flex", fontSize: 30, lineHeight: 1.35 }}>
            WebGPU-accelerated chat with Qwen, Llama, and other ONNX models. No backend. No prompt upload.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 16,
          }}
        >
          {["WebGPU + WASM", "ONNX models", "On-device prompts"].map((label) => (
            <div
              key={label}
              style={{
                alignItems: "center",
                background: "rgba(255, 255, 255, 0.1)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: 9999,
                color: "#e5e7eb",
                display: "flex",
                fontSize: 26,
                padding: "14px 22px",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    socialImageSize,
  );
}
