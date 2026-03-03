import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7ff",
          100: "#e0efff",
          200: "#b8dbff",
          300: "#7ac0ff",
          400: "#3aa1ff",
          500: "#0f83f5",
          600: "#0066d6",
          700: "#0052ad",
          800: "#004590",
          900: "#003b77",
        },
        surface: {
          DEFAULT: "#0a0a0f",
          50: "#f8f9fa",
          100: "#1a1a2e",
          200: "#16213e",
          300: "#1e2d4a",
          400: "#2a3f5f",
          500: "#0f3460",
        },
        accent: {
          purple: "#7c3aed",
          pink: "#ec4899",
          teal: "#14b8a6",
          amber: "#f59e0b",
          emerald: "#10b981",
          rose: "#f43f5e",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
        "bounce-soft": "bounceSoft 1.5s ease-in-out infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
        "shimmer": "shimmer 2s linear infinite",
        "typing": "typing 1.4s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        bounceSoft: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(15, 131, 245, 0.3)" },
          "100%": { boxShadow: "0 0 20px rgba(15, 131, 245, 0.6)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        typing: {
          "0%": { opacity: "0.3" },
          "50%": { opacity: "1" },
          "100%": { opacity: "0.3" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
export default config;
