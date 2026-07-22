import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        fg: "rgb(var(--fg) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        hot: "rgb(var(--hot) / <alpha-value>)",
        warm: "rgb(var(--warm) / <alpha-value>)",
        cold: "rgb(var(--cold) / <alpha-value>)",
        primary: "rgb(var(--primary) / <alpha-value>)",
        hint: "rgb(var(--hint) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};

export default config;
