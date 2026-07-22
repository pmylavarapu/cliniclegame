import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      fontSize: {
        // Locked type scale. Use only these across the app.
        eyebrow: ["0.6875rem", { lineHeight: "1", letterSpacing: "0.12em" }], // 11px
        caption: ["0.8125rem", { lineHeight: "1.35" }],                        // 13px
        body:    ["0.9375rem", { lineHeight: "1.55" }],                        // 15px
        lede:    ["1.0625rem", { lineHeight: "1.6" }],                         // 17px
        ui:      ["0.875rem", { lineHeight: "1.25", letterSpacing: "-0.005em" }], // 14px
        "title-sm": ["1.0625rem", { lineHeight: "1.35", letterSpacing: "-0.01em" }], // 17px
        title:      ["1.25rem",   { lineHeight: "1.3",  letterSpacing: "-0.015em" }], // 20px
        "title-lg": ["1.75rem",   { lineHeight: "1.2",  letterSpacing: "-0.02em" }],  // 28px
        "title-xl": ["2rem",      { lineHeight: "1.15", letterSpacing: "-0.02em" }],  // 32px
      },
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        fg: "rgb(var(--fg) / <alpha-value>)",
        "fg-soft": "rgb(var(--fg-soft) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        "border-strong": "rgb(var(--border-strong) / <alpha-value>)",
        hot: "rgb(var(--hot) / <alpha-value>)",
        warm: "rgb(var(--warm) / <alpha-value>)",
        cold: "rgb(var(--cold) / <alpha-value>)",
        primary: "rgb(var(--primary) / <alpha-value>)",
        hint: "rgb(var(--hint) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        link: "rgb(var(--link) / <alpha-value>)",
        closeness: "rgb(var(--closeness) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
      },
      boxShadow: {
        card: "0 1px 2px rgb(0 0 0 / 0.04), 0 1px 3px rgb(0 0 0 / 0.03)",
      },
    },
  },
  plugins: [],
};

export default config;
