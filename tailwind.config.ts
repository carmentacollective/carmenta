import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
        "./components/**/*.{ts,tsx}",
        "./app/**/*.{ts,tsx}",
        "./lib/**/*.{ts,tsx}",
        "./node_modules/streamdown/dist/**/*.js",
    ],
    theme: {
        container: {
            center: true,
            padding: {
                DEFAULT: "1rem",
                sm: "1.5rem",
                md: "2rem",
                lg: "2.5rem",
            },
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            spacing: {
                "safe-top": "env(safe-area-inset-top)",
                "safe-bottom": "env(safe-area-inset-bottom)",
                "safe-left": "env(safe-area-inset-left)",
                "safe-right": "env(safe-area-inset-right)",
            },
            fontFamily: {
                sans: ["var(--font-outfit)", "system-ui", "sans-serif"],
                mono: ["var(--font-mono)", "monospace"],
            },
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
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
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
                "2xl": "1rem",
                "3xl": "1.5rem",
            },
            backdropBlur: {
                glass: "var(--glass-blur)",
            },
            /**
             * Semantic Z-Index Scale
             *
             * Centralized stacking order - use these instead of arbitrary values.
             * See lib/z-index.ts for documentation on when to use each level.
             *
             * base (0)     - Default, background elements
             * content (10) - Page content, relatively positioned elements
             * sticky (20)  - Sticky headers, sidebars
             * dropdown (30)- Dropdown menus, select options
             * backdrop (40)- Modal/drawer backdrop overlays
             * modal (50)   - Modals, dialogs, drawers, popovers
             * tooltip (50) - Tooltips (same level as modals)
             * toast (60)   - Toast notifications (always visible)
             */
            zIndex: {
                base: "0",
                content: "10",
                sticky: "20",
                dropdown: "30",
                backdrop: "40",
                modal: "50",
                tooltip: "50",
                toast: "60",
            },
            keyframes: {
                "fade-in": {
                    from: { opacity: "0" },
                    to: { opacity: "1" },
                },
                "fade-up": {
                    from: { opacity: "0", transform: "translateY(10px)" },
                    to: { opacity: "1", transform: "translateY(0)" },
                },
                "drawer-down": {
                    from: { opacity: "0", transform: "translateY(-100%)" },
                    to: { opacity: "1", transform: "translateY(0)" },
                },
                float: {
                    "0%, 100%": { transform: "translateY(0)" },
                    "50%": { transform: "translateY(-10px)" },
                },
                "pulse-glow": {
                    "0%, 100%": {
                        boxShadow: "0 0 20px hsl(280 40% 75% / 0.3)",
                    },
                    "50%": { boxShadow: "0 0 40px hsl(280 40% 75% / 0.5)" },
                },
                "sparkle-burst": {
                    "0%": { opacity: "1", transform: "translateY(0) scale(1)" },
                    "100%": { opacity: "0", transform: "translateY(-12px) scale(0)" },
                },
                "star-pop": {
                    "0%": { transform: "scale(1)" },
                    "50%": { transform: "scale(1.3)" },
                    "100%": { transform: "scale(1)" },
                },
                // Easter egg: floating emoji rising effect (iMessage-style)
                "float-up": {
                    "0%": {
                        opacity: "1",
                        transform: "translateY(0) translateX(0)",
                    },
                    "100%": {
                        opacity: "0",
                        transform: "translateY(-100vh) translateX(var(--drift, 0px))",
                    },
                },
                // Easter egg: shake wiggle for device shake response
                wiggle: {
                    "0%, 100%": { transform: "rotate(0deg)" },
                    "25%": { transform: "rotate(-5deg)" },
                    "75%": { transform: "rotate(5deg)" },
                },
            },
            animation: {
                "fade-in": "fade-in 0.5s ease-out",
                "fade-up": "fade-up 0.5s ease-out",
                "drawer-down": "drawer-down 0.2s ease-out",
                float: "float 6s ease-in-out infinite",
                "pulse-glow": "pulse-glow 3s ease-in-out infinite",
                "star-pop": "star-pop 0.3s ease-out",
                // Easter eggs
                "float-up": "float-up 3s ease-out forwards",
                wiggle: "wiggle 0.5s ease-in-out",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
};

export default config;
