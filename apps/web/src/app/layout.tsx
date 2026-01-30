import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import { AuthProvider } from "../context/AuthContext";
import { ThemeProvider } from "../context/ThemeContext";
import { Toaster } from "../components/ui/sonner";
import "./globals.css";
import styles from "./layout.module.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "700"],
});

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "Vacation Price Tracker",
  description: "Track flight and hotel prices for your next trip.",
};

function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <span>Track flight and hotel prices without the spreadsheet sprawl.</span>
      <span className={styles.divider} aria-hidden="true">
        ·
      </span>
      <span>(c) {year} Ethan Smith</span>
    </footer>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  var STORAGE_KEY = 'theme-mode';
  var mode = localStorage.getItem(STORAGE_KEY) || 'system';
  var dark = false;
  if (mode === 'dark') {
    dark = true;
  } else if (mode === 'system') {
    var hour = new Date().getHours();
    dark = hour >= 18 || hour < 8;
  }
  if (dark) {
    document.documentElement.classList.add('dark');
  }
})();
`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            {children}
            <SiteFooter />
            <Toaster position="top-right" richColors closeButton />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
