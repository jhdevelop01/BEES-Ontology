import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // BEES 브랜드 컬러
        bees: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        // 디지털 트윈 팔레트
        dt: {
          bg: "#0a0e1a",
          card: "rgba(255,255,255,0.05)",
          border: "rgba(255,255,255,0.1)",
          accent: "#22d3ee",
          glow: "#06b6d4",
        },
      },
      boxShadow: {
        "glow-sm": "0 0 10px rgba(34,211,238,0.1)",
        glow: "0 0 20px rgba(34,211,238,0.15)",
        "glow-lg": "0 0 30px rgba(34,211,238,0.2)",
        "glow-emerald": "0 0 12px rgba(52,211,153,0.4)",
        "glow-rose": "0 0 12px rgba(244,63,94,0.3)",
        "glow-amber": "0 0 12px rgba(251,191,36,0.3)",
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 10px rgba(34,211,238,0.1)" },
          "50%": { boxShadow: "0 0 20px rgba(34,211,238,0.25)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
