"use client";

import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { ShieldAlert, Clock, LogOut, MailCheck } from "lucide-react";

export default function WaitingForConfirm() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    // 1. เรียก API ทึ่สร้างไว้เพื่อลบข้อมูล session ใน Database และลบ Cookie
    await fetch("/api/auth/logout", { method: "POST" });
    
    // 2. นำผู้ใช้กลับไปหน้า Login
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 font-sans relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-amber-400/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-400/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="bg-white/80 backdrop-blur-xl p-8 md:p-12 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-white max-w-lg w-full text-center relative z-10 animate-fade-up">
        
        {/* Icon & Status */}
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 bg-amber-100 rounded-full animate-ping opacity-70"></div>
          <div className="relative bg-amber-50 w-full h-full rounded-full border-4 border-white shadow-lg flex items-center justify-center text-amber-500">
            <Clock size={40} />
          </div>
          <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1.5 shadow-sm">
            <ShieldAlert size={20} className="text-rose-500" />
          </div>
        </div>

        <h1 className="text-2xl md:text-3xl font-black text-slate-800 mb-3 tracking-tight">
          รอการยืนยันบัญชี
        </h1>
        
        <p className="text-slate-500 font-medium leading-relaxed mb-12">
          ไม่มีข้อมูลของคุณในระบบโปรดติดต่อฝ่ายงานทะเบียน
        </p>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg flex items-center justify-center gap-2 group"
        >
          <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
          ออกจากระบบ
        </button>

      </div>
    </div>
  );
}