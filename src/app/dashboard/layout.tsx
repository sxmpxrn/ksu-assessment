import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;

  if (!sessionToken) {
    redirect("/login");
  }

  const supabase = createClient(cookieStore);
  
  // ยืนยันว่า Session ถูกต้องผ่าน Database
  const { data: sessionData } = await supabase
    .from("user_sessions")
    .select("role")
    .eq("session_token_hash", sessionToken)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!sessionData || sessionData.role !== "student") {
    // โยนกลับ Login ถ้า Token ปลอมหรือหมดอายุ ส่วน proxy.ts จะจัดการ redirect ที่ถูกต้องให้เอง
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      {/* Main Content Area */}
      <div className="flex-1 md:ml-[280px] /* 280px to match sidebar width */ flex flex-col min-h-screen transition-all duration-300">
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
