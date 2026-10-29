import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={metadataBase:new URL('https://mercurius-scout-platform.flashtour-4833.chatgpt.site'),title:'مرقوريوس | منصة إدارة المجموعات الكشفية',description:'خطط وأعضاء وأرشيف ومالية مترابطة للمجموعات الكشفية في الكنائس. تعرّف على مرقوريوس واطلب تجربة لمجموعتك.',icons:{icon:'/favicon.svg'},openGraph:{title:'مرقوريوس | كل تفاصيل مجموعتك، على خطة واحدة',description:'منصة عربية تربط الخطة والتنفيذ برحلة الفرد.',locale:'ar_EG',type:'website'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ar" dir="rtl"><body>{children}</body></html>}
