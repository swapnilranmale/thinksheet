/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "float-slow": "float-slow 6s ease-in-out infinite",
        "float-slower": "float-slower 8s ease-in-out infinite",
        "float-slowest": "float-slowest 10s ease-in-out infinite",
        "gradient": "gradient-shift 8s ease infinite",
        "slide-up": "slide-up 0.5s ease-out",
        "slide-in-left": "slide-in-left 0.6s ease-out",
        "error-in": "error-slide-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "shake": "shake 0.4s ease-in-out",
        "badge-appear": "badge-appear 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "spin-smooth": "spin-smooth 1s linear infinite",
        "text-fade": "text-fade 0.6s ease-out",
        "bell-ring": "bell-ring 1s ease-in-out 3",
        "logo-heartbeat": "logo-heartbeat 2.2s ease-in-out infinite",
        "logo-ring-pulse": "logo-ring-pulse 2.2s ease-out infinite",
      },
      keyframes: {
        "fade-in": {
          "from": { opacity: "0", transform: "translateY(4px)" },
          "to": { opacity: "1", transform: "translateY(0)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0px) translateX(0px)" },
          "50%": { transform: "translateY(-20px) translateX(10px)" },
        },
        "float-slower": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-30px)" },
        },
        "float-slowest": {
          "0%, 100%": { transform: "translateY(0px) translateX(0px)" },
          "50%": { transform: "translateY(-25px) translateX(-15px)" },
        },
        "gradient-shift": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        "slide-up": {
          "from": { opacity: "0", transform: "translateY(20px)" },
          "to": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          "from": { opacity: "0", transform: "translateX(-30px)" },
          "to": { opacity: "1", transform: "translateX(0)" },
        },
        "error-slide-in": {
          "from": { opacity: "0", transform: "translateY(-10px) scaleX(0.95)" },
          "to": { opacity: "1", transform: "translateY(0) scaleX(1)" },
        },
        "shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-2px)" },
          "20%, 40%, 60%, 80%": { transform: "translateX(2px)" },
        },
        "badge-appear": {
          "from": { opacity: "0", transform: "scale(0.8)" },
          "to": { opacity: "1", transform: "scale(1)" },
        },
        "spin-smooth": {
          "from": { transform: "rotate(0deg)" },
          "to": { transform: "rotate(360deg)" },
        },
        "text-fade": {
          "from": { opacity: "0", transform: "translateY(10px)" },
          "to": { opacity: "1", transform: "translateY(0)" },
        },
        "bell-ring": {
          "0%": { transform: "rotate(0deg)" },
          "10%": { transform: "rotate(14deg)" },
          "20%": { transform: "rotate(-12deg)" },
          "30%": { transform: "rotate(10deg)" },
          "40%": { transform: "rotate(-8deg)" },
          "50%": { transform: "rotate(6deg)" },
          "60%": { transform: "rotate(-4deg)" },
          "70%": { transform: "rotate(2deg)" },
          "80%": { transform: "rotate(-1deg)" },
          "100%": { transform: "rotate(0deg)" },
        },
        "logo-heartbeat": {
          "0%, 100%": { transform: "scale(1)" },
          "12%": { transform: "scale(1.15)" },
          "24%": { transform: "scale(1)" },
          "36%": { transform: "scale(1.08)" },
          "48%": { transform: "scale(1)" },
        },
        "logo-ring-pulse": {
          "0%": { transform: "scale(1)", opacity: "0.65" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};
