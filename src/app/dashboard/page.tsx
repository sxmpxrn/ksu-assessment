import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatRoundId } from "@/utils/round-formatter";
import {
  User,
  Mail,
  MapPin,
  BookOpen,
  GraduationCap,
  IdCard,
  CalendarDays,
  ShieldCheck,
  ClipboardList,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  School,
  FileText,
  Settings,
  Award,
  Clock,
  Phone,
} from "lucide-react";

export default async function Profile() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // ตรวจสอบเซสชันจาก HTTP Cookie (LDAP Session)
  const sessionToken = cookieStore.get("session_token")?.value;
  if (!sessionToken) {
    redirect("/login");
  }

  // 1. ดึงข้อมูล Login (user_sessions)
  const { data: sessionData } = await supabase
    .from("user_sessions")
    .select("*")
    .eq("session_token_hash", sessionToken)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!sessionData) {
    redirect("/login");
  }

  // 2. ดึงข้อมูลนักศึกษาจาก students table + Join ข้อมูลตาราง teachers แบบใหม่ล่าสุด
  const { data: studentData, error: studentError } = await supabase
    .from("students")
    .select(`
      *,
      teachers (
        teacher_id,
        first_name,
        last_name,
        code_room,
        major,
        faculty
      )
    `)
    .eq("first_name", sessionData.first_name)
    .eq("last_name", sessionData.last_name)
    .single();

  if (!studentData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4">
        <div className="bg-white p-10 rounded-[2rem] shadow-sm border border-slate-100 text-center max-w-md w-full">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">ไม่พบข้อมูลนักศึกษา</h2>
          <p className="text-slate-500 mb-8">
            โปรดตรวจสอบการเข้าสู่ระบบของคุณ หรือติดต่อฝ่ายทะเบียน
          </p>
          <Link
            href="/login"
            className="block w-full py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors"
          >
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </div>
    );
  }

  // จัดการข้อมูลอาจารย์ที่ปรึกษา (อิงจากตารางครูใหม่ที่พ่วงมาด้วย teacher_id)
  const advisorsList = studentData.teachers ? [{
    id: studentData.teachers.teacher_id,
    fullName: `${studentData.teachers.first_name} ${studentData.teachers.last_name}`,
    phone: "-", // Schema ใหม่ยังไม่มีเบอร์ติดต่อ
    avatar_url: null, // ยังไม่มีรูปโปรไฟล์
  }] : [];

  const fullName = `${studentData.first_name} ${studentData.last_name}`.trim();
  const createdYear = studentData.created_at ? new Date(studentData.created_at).getFullYear().toString() : "-";

  type AssessmentStatus = {
    aroundId: number;
    termLabel: string;
    advisorName: string;
    advisorId: number;
    isCompleted: boolean;
  };

  const assessmentStatus: AssessmentStatus[] = [];
  const now = new Date().toISOString();

  // ดึงข้อมูลรอบประเมิน (assessment_detail) โครงสร้างเดิม
  const { data: details } = await supabase
    .from("assessment_detail")
    .select("around_id, start_date, end_date")
    .lte("start_date", now)
    .gte("end_date", now);

  if (details && details.length > 0) {
    const uniqueRoundsMap = new Map();
    details.forEach((d: any) => {
      if (!uniqueRoundsMap.has(d.around_id)) {
        uniqueRoundsMap.set(d.around_id, d);
      }
    });
    const activeRounds = Array.from(uniqueRoundsMap.values());

    // เช็คประวัติการประเมิน (assessment_answer) โครงสร้างเดิมโดยใช้ student_id รหัสนักศึกษา
    const { data: completedA } = await supabase
      .from("assessment_answer")
      .select("around_id, teacher_id")
      .eq("student_id", studentData.student_id || "-");

    const completedSet = new Set(
      completedA?.map((a: any) => `${a.around_id}-${a.teacher_id}`) || []
    );

    for (const round of activeRounds as any[]) {
      const termLabel = formatRoundId(round.around_id);

      if (advisorsList.length > 0) {
        advisorsList.forEach((adv: any) => {
          const isDone = completedSet.has(`${round.around_id}-${adv.id}`);
          assessmentStatus.push({
            aroundId: round.around_id,
            termLabel,
            advisorName: adv.fullName,
            advisorId: adv.id,
            isCompleted: isDone,
          });
        });
      } else {
        assessmentStatus.push({
          aroundId: round.around_id,
          termLabel,
          advisorName: "ไม่มีอาจารย์ที่ปรึกษา",
          advisorId: 0,
          isCompleted: false,
        });
      }
    }
  }

  const pendingCount = assessmentStatus.filter((s) => !s.isCompleted).length;

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-24 relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-[30%] h-[30%] bg-blue-500/10 rounded-full blur-[80px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 relative z-10">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">ภาพรวมแดชบอร์ดส่วนตัว</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2 text-sm font-medium">
            <CalendarDays size={16} className="text-indigo-500" />
            {new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* LEFT COLUMN: Profile Card (Sticky) */}
          <div className="lg:col-span-4 lg:sticky lg:top-8 space-y-6">
            <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-8 shadow-sm border border-white/60 relative overflow-hidden group hover:shadow-md transition-shadow duration-300">
              <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-br from-indigo-500 to-blue-600 opacity-90"></div>

              <div className="relative z-10 flex flex-col items-center mt-6">
                <div className="w-32 h-32 bg-white rounded-[2rem] p-2 mb-5 shadow-xl shadow-indigo-600/10 group-hover:scale-105 transition-transform duration-500 -rotate-3 group-hover:rotate-0">
                  <div className="w-full h-full bg-slate-50 rounded-[1.5rem] overflow-hidden border border-slate-100 flex items-center justify-center text-indigo-200">
                    <User size={56} strokeWidth={1.5} />
                  </div>
                </div>

                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-indigo-100 mb-3">
                  <GraduationCap size={14} /> {sessionData.role || "นักศึกษา"}
                </span>

                <h2 className="text-2xl font-black text-slate-800 mb-1 text-center">{fullName}</h2>
                <p className="text-slate-500 text-sm font-medium flex items-center justify-center gap-1.5 mb-6">
                  <Mail size={14} className="text-slate-400" /> ไม่ระบุอีเมล
                </p>

                <div className="w-full grid grid-cols-2 gap-3 mb-8">
                  <div className="bg-slate-50 rounded-2xl py-3 px-2 border border-slate-100 flex flex-col items-center justify-center">
                    <IdCard size={18} className="text-blue-500 mb-1" />
                    <span className="text-[10px] uppercase font-bold text-slate-400">รหัส นศ.</span>
                    <span className="font-black text-slate-800 text-sm tracking-wide">{studentData.student_id || "-"}</span>
                  </div>
                  <div className="bg-slate-50 rounded-2xl py-3 px-2 border border-slate-100 flex flex-col items-center justify-center">
                    <BookOpen size={18} className="text-emerald-500 mb-1" />
                    <span className="text-[10px] uppercase font-bold text-slate-400">ห้องเรียน</span>
                    <span className="font-black text-slate-800 text-sm">{studentData.code_room || "N/A"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Support Help Block */}
            <div className="bg-slate-900 rounded-[2rem] p-6 text-white relative overflow-hidden group shadow-md">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700"></div>
              <ShieldCheck size={24} className="text-emerald-400 mb-3 relative z-10" />
              <h3 className="text-lg font-bold mb-2 relative z-10">ต้องการความช่วยเหลือ?</h3>
              <p className="text-slate-400 text-xs mb-5 font-medium leading-relaxed relative z-10">
                หากพบปัญหาในการใช้งาน หรือข้อมูลส่วนบุคคลไม่ถูกต้อง กรุณาติดต่อหน่วยงานทะเบียน
              </p>
            </div>
          </div>

          {/* RIGHT COLUMN: Content */}
          <div className="lg:col-span-8 space-y-6 lg:space-y-8">

            {/* Assessment Priority Box (ซ่อนชั่วคราวถ้า assessmentStatus = []) */}
            {assessmentStatus.length > 0 && (
              <div className={`rounded-[2rem] p-6 sm:p-8 shadow-sm border relative overflow-hidden transition-colors ${pendingCount > 0 ? 'bg-indigo-600 border-indigo-700' : 'bg-white border-slate-200'}`}>
                {/* Decorative BG */}
                {pendingCount > 0 && <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>}

                <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${pendingCount > 0 ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                      <ClipboardList size={24} />
                    </div>
                    <div>
                      <h2 className={`text-xl font-black mb-1 ${pendingCount > 0 ? 'text-white' : 'text-slate-800'}`}>แบบประเมินอาจารย์ที่ปรึกษา</h2>
                      <p className={`text-sm font-medium ${pendingCount > 0 ? 'text-indigo-100' : 'text-slate-500'}`}>
                        {pendingCount > 0 ? 'กรุณาดำเนินการประเมินให้เสร็จสิ้น' : 'ส่วนสำคัญสำหรับการประเมินการปฏิบัติงาน'}
                      </p>
                    </div>
                  </div>

                  {pendingCount > 0 ? (
                    <div className="bg-white text-indigo-600 font-black text-xs px-4 py-2.5 rounded-xl shadow-sm animate-pulse whitespace-nowrap">
                      รอดำเนินการ {pendingCount} รายการ
                    </div>
                  ) : (
                    <div className="bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2">
                      <CheckCircle2 size={16} /> ประเมินครบแล้ว
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                  {assessmentStatus.map((status) => (
                    <div key={`${status.aroundId}-${status.advisorId}`} className={`p-4 sm:p-5 rounded-[1.5rem] border flex flex-col justify-between gap-5 transition-all ${pendingCount > 0 ? 'bg-white/10 border-white/20 hover:bg-white/20' : 'bg-slate-50 border-slate-100 hover:bg-white hover:shadow-md'}`}>
                      <div>
                        <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${pendingCount > 0 ? 'text-indigo-200' : 'text-slate-400'}`}>{status.termLabel}</div>
                        <h3 className={`font-bold text-lg line-clamp-1 ${pendingCount > 0 ? 'text-white' : 'text-slate-800'}`} title={status.advisorName}>{status.advisorName}</h3>
                      </div>

                      {status.isCompleted ? (
                        <div className={`flex items-center gap-2 font-bold text-sm ${pendingCount > 0 ? 'text-emerald-300' : 'text-emerald-600'}`}>
                          <CheckCircle2 size={18} /> ประเมินสำเร็จ
                        </div>
                      ) : (
                        <Link href="/dashboard/assessment-advisor" className={`flex items-center justify-between w-full py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${pendingCount > 0 ? 'bg-white text-indigo-600 hover:bg-indigo-50' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                          ดำเนินการประเมิน <ChevronRight size={16} />
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                icon={<School size={20} className="text-blue-500" />}
                title="ระดับคณะ"
                value={studentData.faculty || "ไม่ระบุ"}
                bgClass="bg-blue-50"
              />
              <StatCard
                icon={<Award size={20} className="text-purple-500" />}
                title="สาขาวิชา"
                value={studentData.major || "ไม่ระบุ"}
                bgClass="bg-purple-50"
              />
            </div>

            {/* Main Content Split */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Account Details */}
              <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm border border-slate-100 flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-slate-50 text-slate-500 rounded-xl border border-slate-100">
                    <FileText size={18} />
                  </div>
                  <h3 className="text-lg font-black text-slate-800">ข้อมูลรายละเอียด</h3>
                </div>

                <div className="space-y-4">
                  <InfoRow label="คณะต้นสังกัด" value={studentData.faculty} />
                  <InfoRow label="หลักสูตร/สาขา" value={studentData.major} />
                  <InfoRow label="รหัสประจำตัว" value={studentData.student_id ? studentData.student_id : "-"} />
                  <InfoRow label="ห้องเรียนประจำ" value={studentData.code_room || " ไม่ระบุ"} />
                </div>
              </div>

              {/* Advisors List */}
              <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm border border-slate-100 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                      <User size={18} />
                    </div>
                    <h3 className="text-lg font-black text-slate-800">อาจารย์ที่ปรึกษา</h3>
                  </div>
                  <span className="bg-slate-50 text-slate-500 font-bold px-2.5 py-1 rounded-lg text-xs border border-slate-100">
                    {advisorsList.length} ท่าน
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar max-h-[220px]">
                  {advisorsList.length > 0 ? (
                    advisorsList.map((adv: any, i: number) => (
                      <div key={i} className="flex items-center gap-4 p-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-indigo-50/30 hover:border-indigo-100 transition-colors group">
                        <div className="w-10 h-10 bg-white shadow-sm border border-slate-100 rounded-full flex items-center justify-center font-bold text-indigo-500 text-sm overflow-hidden shrink-0">
                          <User size={16} />
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <div className="font-bold text-slate-800 text-sm truncate" title={adv.fullName}>{adv.fullName}</div>
                          <div className="text-[10px] text-slate-400 font-semibold mt-0.5 flex items-center gap-1">
                            <Phone size={10} /> {adv.phone}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-100 rounded-2xl">
                      <MapPin className="text-slate-300 mb-2" size={24} />
                      <p className="text-sm font-bold text-slate-500 mb-1">ยังไม่มีอาจารย์ที่ปรึกษา</p>
                      <p className="text-xs font-medium text-slate-400">ระบบยังไม่ได้ผูกชื่ออาจารย์ในฐานข้อมูล</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Micro Components
function StatCard({ icon, title, value, bgClass }: { icon: React.ReactNode, title: string, value: string, bgClass: string }) {
  return (
    <div className="bg-white rounded-[1.5rem] p-5 shadow-sm border border-slate-100 flex flex-col gap-3 group hover:shadow-md transition-shadow">
      <div className={`w-fit p-2.5 rounded-xl ${bgClass} group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <h4 className="text-base font-black text-slate-800 truncate" title={value}>{value}</h4>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string, value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-3 border-b border-slate-50 last:border-0 last:pb-0">
      <span className="text-xs font-bold text-slate-400">{label}</span>
      <span className="text-sm font-bold text-slate-800 sm:text-right truncate">{value || "-"}</span>
    </div>
  );
}