import type { Metadata } from "next";
import "./globals.css";
import VisitTracker from "./visit-tracker";
export const metadata: Metadata = { title: "BizProof | 기업 자격 플랫폼", description: "한 번의 기업 자격으로 구매 등록과 지원사업 조건을 검증합니다.", icons: { icon: "/favicon.svg" } };
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ko"><body>{children}<VisitTracker/></body></html>}
