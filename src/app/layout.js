import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import SocketProvider from "@/lib/websocket/SocketProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "KDA 평가 시스템",
  description: "KDA 교육 프로그램 기수별 학생 평가 관리",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SocketProvider>
          <TooltipProvider>
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <main className="flex-1">{children}</main>
            </div>
          </TooltipProvider>
        </SocketProvider>
      </body>
    </html>
  );
}
