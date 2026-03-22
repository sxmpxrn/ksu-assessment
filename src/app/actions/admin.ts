"use server";

import { createClient } from "@supabase/supabase-js";

// ฟังก์ชันลบผู้ใช้จาก auth.users ด้วยสิทธิ์ Admin
export async function deleteUserFromAuth(userId: string) {
  try {
    // ต้องใช้ SERVICE_ROLE_KEY เท่านั้นถึงจะจัดการ auth.admin ได้
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );  

    const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      console.error("Error deleting user from auth:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Server Action Error:", error);
    return { success: false, error: error.message || "Unknown error occurred" };
  }
}