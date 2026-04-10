import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { UIProvider } from "@/lib/ui-context"
import { ProfileProvider } from "@/lib/profile-context"
import { AppShell } from "@/components/app-shell"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Los Jazmines - Sistema",
  description: "Sistema de gestión de catering profesional para planificación de eventos",
  generator: 'v0.app',
  icons: {
    icon: "/pwa-icon-512.jpg",
    apple: "/pwa-icon-512.jpg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1a3a2a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <link rel="apple-touch-icon" href="/pwa-icon-512.jpg" />
      </head>
      <body className="font-sans antialiased bg-background text-foreground">
        <ProfileProvider>
          <UIProvider>
            <AppShell>
              {children}
            </AppShell>
          </UIProvider>
        </ProfileProvider>
      </body>
    </html>
  )
}
