import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  User,
  Settings,
  BookOpen,
  Users,
  GraduationCap,
  CalendarDays,
  Mail,
  ChevronRight,
  MapPin
} from "lucide-react";

export default async function AdvisorProfile() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;

  if (!sessionToken) {
    redirect("/login");
  }

  const supabase = createClient(cookieStore);

  const { data: sessionData } = await supabase
    .from("user_sessions")
    .select("first_name, last_name, role")
    .eq("session_token_hash", sessionToken)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!sessionData || sessionData.role !== "advisor") {
    redirect("/login");
  }

  // 1. ดึงข้อมูลอาจารย์จากตาราง teachers แบบตรงๆ
  const { data: teacherData, error: teacherError } = await supabase
    .from("teachers")
    .select("*")
    .eq("first_name", sessionData.first_name)
    .eq("last_name", sessionData.last_name)
    .single();

  if (teacherError || !teacherData) {
    return (
      <div className="min-h-screen bg-[#f4f7fa] flex items-center justify-center p-4">
        <div className="bg-white p-10 rounded-[2rem] shadow-lg shadow-slate-200/50 text-center max-w-md w-full border border-slate-100">
          <div className="w-20 h-20 bg-red-50 text-red-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <User size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">ไม่พบข้อมูลอาจารย์</h2>
          <p className="text-slate-500 mb-8">ระบบไม่สามารถดึงข้อมูลของคุณจากฐานข้อมูลได้ โปรดลองใหม่อีกครั้ง</p>
          <Link href="/login" className="block w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-colors">
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </div>
    );
  }

  // เตรียมข้อมูลโปรไฟล์อาจารย์
  const advisor = {
    full_name: `${teacherData.first_name} ${teacherData.last_name}`.trim(),
    major_name: teacherData.major || "ไม่ระบุสาขาวิชา",
    faculty_name: teacherData.faculty || "ไม่ระบุคณะ",
    email: "-", // The new teachers schema doesn't store email by default
    profile_url: null,
  };

  // 2. ดึงข้อมูลห้องเรียนที่ดูแล (จากตาราง students ที่มี teacher_id ตรงกัน)
  const { data: studentsData } = await supabase
    .from("students")
    .select("code_room")
    .eq("teacher_id", teacherData.teacher_id);
    
  // ดึง code_room แบบไม่ซ้ำกัน
  const uniqueRooms = Array.from(new Set((studentsData || []).map(s => s.code_room))).filter(Boolean);
  
  const managedRooms = uniqueRooms.map((code) => ({ room_code: code }));
  
  // หากไม่มีนักศึกษาในตาราง แต่ในโปรไฟล์ครูมีห้องอยู่ ให้แสดงห้องนั้นแทน
  if (managedRooms.length === 0 && teacherData.code_room) {
    managedRooms.push({ room_code: teacherData.code_room });
  }

  return (
    <div className="min-h-screen bg-[#f4f7fa] font-sans pb-24 relative">

      {/* 1. Gradient Cover Banner */}
      <div className="absolute top-0 left-0 right-0 h-64 sm:h-72 bg-gradient-to-br from-[#7ca3d5] via-[#8bbdf0] to-[#6a8ebd] rounded-b-[3rem] shadow-inner overflow-hidden z-0">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 relative z-10">

        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 sm:mb-12 text-white drop-shadow-md">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Profile & Dashboard</h1>
            <p className="text-white/80 mt-1.5 flex items-center gap-2 font-medium">
              <CalendarDays size={18} />
              {new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        {/* 2. Main Profile Card */}
        <div className="bg-white rounded-[2.5rem] p-6 sm:p-10 shadow-xl shadow-[#7ca3d5]/10 border border-white flex flex-col lg:flex-row gap-8 lg:gap-12 relative overflow-hidden">

          {/* Avatar Section */}
          <div className="flex flex-col items-center shrink-0">
            <div className="relative group">
              <div className="w-32 h-32 sm:w-44 sm:h-44 bg-slate-50 rounded-[2rem] border-4 border-white shadow-lg flex items-center justify-center overflow-hidden text-slate-300 relative z-10 rotate-3 group-hover:rotate-0 transition-transform duration-300">
                {advisor.profile_url ? (
                  <img src={advisor.profile_url} alt="Advisor Profile" className="w-full h-full object-cover" />
                ) : (
                  <User size={64} strokeWidth={1.5} />
                )}
              </div>
              <div className="absolute inset-0 bg-[#7ca3d5]/30 blur-xl rounded-full scale-110 z-0"></div>
            </div>

            <span className="mt-6 inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#7ca3d5]/10 text-[#7ca3d5] font-bold text-sm rounded-xl border border-[#7ca3d5]/20">
              <Users size={16} /> อาจารย์ประจำสาขา
            </span>
          </div>

          {/* Info Section */}
          <div className="flex-1 flex flex-col justify-center">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-800 mb-6 text-center lg:text-left">
              {advisor.full_name}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {/* Major */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:border-[#7ca3d5]/30 hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-xl bg-[#7ca3d5]/10 text-[#7ca3d5] flex items-center justify-center shrink-0">
                  <GraduationCap size={24} />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">สาขาวิชา (Major)</p>
                  <p className="font-bold text-slate-700 leading-tight">{advisor.major_name}</p>
                </div>
              </div>

              {/* Faculty */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:border-[#7ca3d5]/30 hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center shrink-0">
                  <BookOpen size={24} />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">คณะ (Faculty)</p>
                  <p className="font-bold text-slate-700 leading-tight">{advisor.faculty_name}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Managed Classrooms Section */}
        <div className="mt-12 space-y-6">
          <div className="flex items-center justify-between px-2">
            <div>
              <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <div className="p-2 bg-[#7ca3d5] text-white rounded-lg shadow-sm">
                  <Users size={20} />
                </div>
                ห้องเรียนที่ดูแลทั้งหมด
              </h3>
              <p className="text-slate-500 font-medium mt-1 ml-12">รายชื่อห้องเรียนที่ท่านเป็นที่ปรึกษาในภาคการศึกษานี้</p>
            </div>
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-3xl font-black text-[#7ca3d5]">{managedRooms.length}</span>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Rooms</span>
            </div>
          </div>

          {managedRooms.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {managedRooms.map((room, index) => (
                <div
                  key={index}
                  className="bg-white p-6 rounded-[1.5rem] border border-slate-100 hover:border-[#7ca3d5]/50 hover:shadow-lg hover:shadow-[#7ca3d5]/10 transition-all duration-300 group flex flex-col justify-between h-full relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-[#7ca3d5] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                  <div className="flex items-start justify-between mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 group-hover:bg-[#7ca3d5]/10 text-slate-400 group-hover:text-[#7ca3d5] flex items-center justify-center font-black text-xl transition-colors duration-300 border border-slate-100">
                      {room.room_code ? room.room_code.substring(0, 2) : "RM"}
                    </div>
                    <div className="bg-slate-100 text-slate-500 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      Active
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-400 mb-1">รหัสห้องเรียน</p>
                    <h4 className="text-xl font-black text-slate-800 mb-4">{room.room_code || "ไม่ระบุ"}</h4>

                    <Link href={`#`} className="w-full py-2.5 bg-slate-50 text-slate-600 hover:bg-[#7ca3d5] hover:text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors duration-300">
                      ดูรายชื่อนักศึกษา <ChevronRight size={16} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white p-12 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center shadow-sm">
              <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-5">
                <MapPin size={40} />
              </div>
              <h4 className="text-xl font-black text-slate-700 mb-2">ยังไม่มีข้อมูลห้องเรียน</h4>
              <p className="text-slate-500 font-medium max-w-sm">
                ระบบยังไม่ได้จัดสรรห้องเรียนในการดูแลให้กับคุณ หากมีข้อสงสัยกรุณาติดต่อฝ่ายวิชาการ
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}