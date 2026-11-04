import type { Metadata } from "next";
import { Caveat, Poppins, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { getAuthSession } from "@/lib/auth/session";
import { getPublicBranding } from "@/lib/branding/branding";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],

  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPublicBranding();
  return {
    title: "Homyz — Travel & Hospitality Platform",
    description: "Stay like a homie. Premium booking and property management.",
    icons: { icon: branding.faviconUrl },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Resolve the cookie-backed session before the first client render. Passing
  // this snapshot into SessionProvider prevents an authenticated browser from
  // ever hydrating through a false logged-out state.
  const [session, branding] = await Promise.all([getAuthSession(), getPublicBranding()]);

  return (
    <html
      lang="en"
      className={`${poppins.variable} ${geistMono.variable} ${caveat.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className={`${poppins.className} min-h-full flex flex-col text-muted-foreground bg-white`}
        suppressHydrationWarning
      >
        <Providers session={session} branding={branding}>{children}</Providers>
      </body>
    </html>
  );
}
