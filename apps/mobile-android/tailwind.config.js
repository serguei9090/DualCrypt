/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#090a0f",
        foreground: "#f8fafc",
        primary: {
          DEFAULT: "#06b6d4",
          foreground: "#000000",
        },
      },
    },
  },
  plugins: [],
};
