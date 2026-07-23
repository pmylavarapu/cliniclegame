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
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "var(--font-inter)",
          "system-ui",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      fontSize: {
        eyebrow: ["0.6875rem", { lineHeight: "1", letterSpacing: "0.06em" }], // 11px
        caption: ["0.8125rem", { lineHeight: "1.35", letterSpacing: "-0.005em" }],
        body:    ["0.9375rem", { lineHeight: "1.5",  letterSpacing: "-0.011em" }],
        lede:    ["1.0625rem", { lineHeight: "1.55", letterSpacing: "-0.015em" }],
        ui:      ["0.9375rem", { lineHeight: "1.15", letterSpacing: "-0.011em" }],
        "title-sm": ["1.125rem", { lineHeight: "1.2",  letterSpacing: "-0.02em" }],
        title:      ["1.375rem", { lineHeight: "1.15", letterSpacing: "-0.022em" }],
        "title-lg": ["1.875rem", { lineHeight: "1.1",  letterSpacing: "-0.028em" }],
        "title-xl": ["2.5rem",   { lineHeight: "1.05", letterSpacing: "-0.032em" }],
        "title-2xl": ["3.25rem", { lineHeight: "1",    letterSpacing: "-0.035em" }],
      },
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        fg: "rgb(var(--fg) / <alpha-value>)",
        "fg-soft": "rgb(var(--fg-soft) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        "border-strong": "rgb(var(--border-strong) / <alpha-value>)",
        hot: "rgb(var(--hot-r) var(--hot-g) var(--hot-b) / <alpha-value>)",
        warm: "rgb(var(--warm-r) var(--warm-g) var(--warm-b) / <alpha-value>)",
        cold: "rgb(var(--cold) / <alpha-value>)",
        primary: "rgb(var(--primary) / <alpha-value>)",
        hint: "rgb(var(--hint) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        link: "rgb(var(--link) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
      },
      boxShadow: {
        card: "0 1px 2px rgb(0 0 0 / 0.04), 0 1px 3px rgb(0 0 0 / 0.03)",
      },
      borderRadius: {
        DEFAULT: "0.625rem",
        sm: "0.375rem",
        md: "0.625rem",
        lg: "0.875rem",
        xl: "1.125rem",
        "2xl": "1.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
