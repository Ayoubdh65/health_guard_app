/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                brand: {
                    50: '#eef7ff',
                    100: '#d9edff',
                    200: '#bce0ff',
                    300: '#8ecdff',
                    400: '#59b0ff',
                    500: '#338dfc',
                    600: '#1d6ef1',
                    700: '#1558de',
                    800: '#1847b4',
                    900: '#1a3f8e',
                    950: '#152856',
                },
                vital: {
                    heart: '#ef4444',
                    spo2: '#3b82f6',
                    temp: '#f59e0b',
                    bp: '#8b5cf6',
                    rr: '#10b981',
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'fade-in': 'fadeIn 0.5s ease-out',
                'slide-up': 'slideUp 0.4s ease-out',
                'glow': 'glow 2s ease-in-out infinite alternate',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                glow: {
                    '0%': { boxShadow: '0 0 5px rgba(51, 141, 252, 0.2)' },
                    '100%': { boxShadow: '0 0 20px rgba(51, 141, 252, 0.4)' },
                },
            },
        },
    },
    plugins: [],
}
