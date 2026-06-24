import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { T } from "@/lib/ui";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Menu4U",
  description: "מערכת ניהול תפריטים ומסעדות",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "מלצר",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "application-name": "מלצר",
  },
};

export const viewport = {
  themeColor: "#1a1a2e",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="he"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Inject T design tokens as CSS variables — the ONLY place to change the palette/fonts */}
      <style>{`
        :root {
          --c-bg:       ${T.bg};
          --c-surface:  ${T.surface};
          --c-panel:    ${T.panel};
          --c-raised:   ${T.raised};
          --c-overlay:  ${T.overlay};
          --c-border:   ${T.border};
          --c-text:     ${T.text};
          --c-sub:      ${T.sub};
          --c-muted:    ${T.muted};
          --c-gold:     ${T.gold};
          --c-green:    ${T.green};
          --c-orange:   ${T.orange};
          --c-red:      ${T.red};
          --c-blue:     ${T.blue};
          --c-purple:   ${T.purple};
          --c-cyan:     ${T.cyan};
          --c-rose:     ${T.rose};
          --c-emerald:  ${T.emerald};
          --c-amber:    ${T.amber};
          --c-yellow:   ${T.yellow};
          --c-bg-neon:  ${T.bgNeon};
          --c-font-sans: ${T.fontSans};
          --c-font-mono: ${T.fontMono};
        }
      `}</style>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'));` }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
