/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "Courier New", "monospace"],
      },
      colors: {
        background: "#080b13",
        foreground: "#f8fafc",
        cyber: {
          bg: "#080b13",
          surface: "#0f172a",
          card: "#1e293b",
          cyan: "#06b6d4",
          emerald: "#10b981",
          amber: "#f59e0b",
          rose: "#ef4444",
        },
      },
    },
  },
  plugins: [],
};
