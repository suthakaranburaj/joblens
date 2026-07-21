import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { ThemeProvider } from "@/providers/ThemeProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "JobLens",
    template: "%s | JobLens",
  },
  description:
    "Analyze job postings with AI — extract requirements, culture signals, and red flags, then match your resume using Groq.",
  applicationName: "JobLens",
  keywords: [
    "job analysis",
    "resume match",
    "career",
    "Groq",
    "Next.js",
    "JobLens",
  ],
  authors: [{ name: "JobLens" }],
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} h-full antialiased`}
    >
      <body
        className={`${inter.className} flex min-h-full flex-col bg-background text-foreground`}
      >
        <ThemeProvider>
          <Header />
          <main className="flex w-full flex-1 flex-col pt-14 sm:pt-16">
            {children}
          </main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
