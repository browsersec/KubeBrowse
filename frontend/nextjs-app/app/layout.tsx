import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import Sidebar from "@/components/sidebar/Sidebar";

export const metadata: Metadata = {
  title: "KubeBrowse",
  description: "Kubernetes Browser Management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ThemeProvider>
          <div className="flex h-screen bg-background text-foreground transition-colors duration-200">
            <Sidebar />
            <div className="flex-1 overflow-auto">
              {children}
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
