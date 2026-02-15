import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import {
  ClerkProvider,
  SignedIn,
  UserButton,
} from "@clerk/nextjs";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "HapticPhonix — Feel the Sound. Master Speech.",
  description:
    "AI-powered speech learning through lip-reading and haptic feedback technology.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <body
          className={`${spaceGrotesk.variable} ${inter.variable} antialiased bg-[#0a0a0a] text-[#F5F5F5]`}
        >
          {/* Signed-in header (dashboard pages) */}
          <SignedIn>
            <header className="sticky top-0 z-50 flex justify-between items-center px-6 py-3 border-b border-white/10 glass-panel">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#B87333] to-[#D4A574] flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/>
                    <path d="M8.5 2h7"/><path d="M7 16h10"/>
                  </svg>
                </div>
                <span className="font-display font-bold text-lg tracking-tight text-white">
                  Haptic<span className="text-[#B87333]">Phonix</span>
                </span>
              </div>
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: "w-9 h-9 border-2 border-[#B87333]/50",
                  },
                }}
              />
            </header>
          </SignedIn>
          <main>{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
