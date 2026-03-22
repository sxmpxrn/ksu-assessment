import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/app/components/header"; // ปรับ path ให้ตรงกับไฟล์ Header ของคุณ
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server"; // ปรับ path ให้ตรงกับไฟล์ของคุณ

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KSU Assessment",
  description: "ระบบบริหารจัดการประเมินผลนักศึกษา",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 1. ดึงข้อมูล Cookie และสร้าง Supabase Client
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // 2. ดึงข้อมูล User ปัจจุบัน (รองรับทั้ง Session แบบเก่าและ LDAP แบบใหม่)
  let userData = null;

  // ลองดึงจาก System Session (LDAP) ก่อน
  const sessionToken = cookieStore.get("session_token")?.value;
  if (sessionToken) {
    const { data: sessionData } = await supabase
      .from("user_sessions")
      .select("first_name, last_name, role")
      .eq("session_token_hash", sessionToken)
      .gt("expires_at", new Date().toISOString()) // เช็ค Session ไม่ให้หมดอายุ
      .single();

    if (sessionData) {
      userData = {
        name: `${sessionData.first_name || ""} ${sessionData.last_name || ""}`.trim() || "Unknown User",
        id: "LDAP-User", // หรือใช้ ID รูปแบบอื่นถ้ามี
        type: sessionData.role === 'student' ? 'นักศึกษา' 
            : sessionData.role === 'advisor' ? 'อาจารย์ที่ปรึกษา'
            : sessionData.role === 'admin' ? 'ผู้ดูแลระบบ'
            : sessionData.role === 'executives' ? 'ผู้บริหาร'
            : 'ผู้ใช้งาน',
        role: sessionData.role || "student",
      };
    }
  }

  // ถ้ายังไม่มีข้อมูล ลองfallbackเป็น Supabase Auth เผื่อมีค้างในระบบ
  if (!userData) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      userData = {
        name: user.user_metadata?.username || user.email || "Unknown User",
        id: user.user_metadata?.username || user.id.substring(0, 8), 
        type: user.user_metadata?.role === 'student' ? 'นักศึกษา' 
            : user.user_metadata?.role === 'advisor' ? 'อาจารย์ที่ปรึกษา'
            : user.user_metadata?.role === 'admin' ? 'ผู้ดูแลระบบ'
            : user.user_metadata?.role === 'executives' ? 'ผู้บริหาร'
            : 'ผู้ใช้งาน',
        role: user.user_metadata?.role || "student",
      };
    }
  }

  return (
    <html lang="th">
      <body className={inter.className}>
        {/* 4. ส่ง userData เข้าไปที่ Props user ของ Header */}
        <Header user={userData} />
        
        <main>{children}</main>
      </body>
    </html>
  );
}