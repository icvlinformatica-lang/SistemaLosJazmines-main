import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { StoreProvider } from "@/lib/store-context"
import { UIProvider } from "@/lib/ui-context"
import { Sidebar } from "@/components/sidebar"
import { Toaster } from "@/components/ui/toaster"
import { WelcomeModal } from "@/components/welcome-modal"
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
        <StoreProvider>
          <UIProvider>
            <div className="flex h-screen overflow-hidden">
              <Sidebar />
              <main className="relative flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
                {children}
              </main>
            </div>
            <Toaster />
            <WelcomeModal />
          </UIProvider>
        </StoreProvider>
      </body>
    </html>
  )
}
