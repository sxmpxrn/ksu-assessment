"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server"; // ปรับ path ให้ตรงกับโปรเจกต์คุณ
import { redirect } from "next/navigation";

export async function logout() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const sessionToken = cookieStore.get("session_token")?.value;

  if (sessionToken) {
    // ลบ session ออกจากฐานข้อมูล user_sessions (Stateful Session)
    await supabase.from("user_sessions").delete().eq("session_token_hash", sessionToken);
    
    // ลบ HTTP-Only Cookie
    cookieStore.delete("session_token");
  }

  // เผื่อมี Session ตกค้างใน Supabase Auth ด้วย ก็สั่งให้ Supabase เคลียร์ Session ปัจจุบันทิ้งเผื่อไว้
  try {
    await supabase.auth.signOut();
  } catch(e) {}

  // การ redirect จะจัดการได้ทั้ง Client และ Server
  // แต่ถ้าอยากใช้ window.location.href ที่ฝั่ง client ก็ไม่ต้องใส่บรรทัดล่างครับ
  // redirect("/");
}