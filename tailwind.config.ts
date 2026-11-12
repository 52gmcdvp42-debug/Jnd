import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#101827", 900: "#0a101c", 800: "#101827", 700: "#172235", 600: "#1f2d45", 500: "#2a3a57" },
        electric: { DEFAULT: "#087BFF", 600: "#006ae6", 400: "#3a95ff", 100: "#e1efff" },
        snow: "#F4F6FA",
        silver: { DEFAULT: "#929BAA", 300: "#c3c9d3", 600: "#6b7484" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
