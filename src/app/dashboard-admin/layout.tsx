import React from "react";
import AdminLayoutClient from "./layout-client";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export default async function AdminLayout({
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
    .select("role, first_name, last_name")
    .eq("session_token_hash", sessionToken)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!sessionData || sessionData.role !== "admin") {
    redirect("/login");
  }

  const user = {
    name: `${sessionData.first_name} ${sessionData.last_name}`.trim(),
    id: "ADMIN",
    type: "ผู้ดูแลระบบ",
    role: "admin",
  };

  return <AdminLayoutClient user={user}>{children}</AdminLayoutClient>;
}
