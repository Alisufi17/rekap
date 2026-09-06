import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: "#0E7C5A",
        accent: "#C0432A",
        ink: "#1B1F1C",
        "ink-soft": "#5B6660",
        "ink-faint": "#9AA39D",
        surface: "#F5F6F2",
        border: "#E4E7E1",
        online: "#0E7C5A",
        offline: "#2F6FA0",
      },
    },
  },
  plugins: [],
};

export default config;
