import type { Metadata } from "next";
import "./globals.css";
import VisitTracker from "./visit-tracker";
export const metadata: Metadata = {
 metadataBase:new URL('https://bizproof.xaikorea.ai.kr'),
 title:'BizProof | 기업 자격 플랫폼',
 description:'한 번 발급한 기업 자격으로 구매사 등록과 지원사업 조건을 확인하세요. 합성 데이터 기반 공개 시연입니다.',
 icons:{icon:[{url:'/favicon.svg?v=2',type:'image/svg+xml'},{url:'/favicon-32.png?v=2',type:'image/png',sizes:'32x32'}],shortcut:'/favicon.ico?v=2',apple:{url:'/apple-touch-icon.png',sizes:'180x180'}},
 openGraph:{type:'website',locale:'ko_KR',siteName:'BizProof',title:'BizProof | 한 번 증명하고, 더 많은 기회로.',description:'하나의 기업 자격으로 구매사 등록·지원사업 조건 확인. 합성 데이터 기반 공개 시연.',images:[{url:'/og-image.png',width:1200,height:630,alt:'BizProof — 한 번 증명하고, 더 많은 기회로.'}]},
 twitter:{card:'summary_large_image',title:'BizProof | 한 번 증명하고, 더 많은 기회로.',description:'하나의 기업 자격으로 구매사 등록·지원사업 조건 확인.',images:['/og-image.png']}
};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ko"><body>{children}<VisitTracker/></body></html>}
