import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export async function POST() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;

  if (sessionToken) {
    // สร้าง Supabase client
    const supabase = createClient(cookieStore);
    
    // 1. ลบ session ออกจากฐานข้อมูล user_sessions
    await supabase
      .from("user_sessions")
      .delete()
      .eq("session_token_hash", sessionToken);
    
    // 2. ลบ Cookie
    cookieStore.delete("session_token");
  }

  // เผื่อมี session ของระบบเก่า (Supabase Auth เดิม) ก็สั่งลบไปด้วย
  const supabaseOld = createClient(cookieStore);
  try {
    await supabaseOld.auth.signOut();
  } catch (e) {
    // ignore
  }

  return NextResponse.json({ success: true });
}
