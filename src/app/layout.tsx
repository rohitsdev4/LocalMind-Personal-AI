import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";

export const metadata: Metadata = {
    title: "LocalMind -- AI Life Assistant",
    description:
        "Your AI-powered personal assistant. Manage tasks, habits, and journals with AI -- smart, private, and always available.",
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "LocalMind",
    },
    icons: {
        icon: "/icons/icon-192.png",
        apple: "/icons/icon-192.png",
    },
    openGraph: {
        title: "LocalMind -- AI Life Assistant",
        description: "Your AI-powered personal life assistant",
        type: "website",
    },
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
    themeColor: "#0a0a0f",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark">
            <head>
                {/* PWA Meta Tags */}
                <meta name="application-name" content="LocalMind" />
                <meta name="mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta
                    name="apple-mobile-web-app-status-bar-style"
                    content="black-translucent"
                />
                <meta name="apple-mobile-web-app-title" content="LocalMind" />
                <meta name="format-detection" content="telephone=no" />
                <meta name="msapplication-TileColor" content="#0a0a0f" />
                <meta name="msapplication-tap-highlight" content="no" />

                {/* Preconnect for fonts */}
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link
                    rel="preconnect"
                    href="https://fonts.gstatic.com"
                    crossOrigin="anonymous"
                />
            </head>
            <body className="antialiased safe-top safe-bottom">
                {children}
                <ServiceWorkerRegistrar />
            </body>
        </html>
    );
}
