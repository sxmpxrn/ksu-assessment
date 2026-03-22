import { createClient } from "@/utils/supabase/server"; // ✅ เปลี่ยนมาใช้ตัว server
import { cookies } from "next/headers";
import { redirect } from "next/navigation"; // ✅ ใช้ redirect ของ server
import { Pencil, Eye, Plus, CalendarX2 } from "lucide-react";
import Link from "next/link";
import { formatRoundId } from "@/utils/round-formatter";

// --- Helper Functions (เหมือนเดิม) ---
const formatDate = (dateString: string) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = (date.getFullYear() + 543).toString();
  return `${day}/${month}/${year}`;
};

const getStatus = (endDateString: string) => {
  if (!endDateString) return { isActive: false, label: "ไม่ระบุ", color: "bg-gray-100 text-gray-600 border-gray-200" };
  const now = new Date();
  const end = new Date(endDateString);
  end.setHours(23, 59, 59, 999);
  const isActive = now <= end;
  
  return {
    isActive,
    label: isActive ? "กำลังดำเนินงาน" : "หมดเวลา",
    color: isActive
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : "bg-gray-100 text-gray-600 border-gray-200"
  };
};

// ✅ เติมคำว่า async นำหน้า Component และไม่ต้องใช้ useState / useEffect แล้ว
export default async function AssessmentDashboard() {
  // 1. สร้าง Supabase Client ฝั่ง Server
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // 2. ตรวจสอบสิทธิ์การเข้าถึงถูกจัดการที่ layout.tsx แล้ว

  // 3. ดึงข้อมูลจากฐานข้อมูลโดยตรง
  const { data, error } = await supabase
    .from("assessment_detail")
    .select("around_id, start_date, end_date")
    .order("around_id", { ascending: false });

  if (error) {
    console.error("Error fetching assessments:", error.message);
  }

  // 4. จัดเตรียมข้อมูล (กรองรอบที่ซ้ำออก)
  const assessmentRounds = data ? Array.from(
    new Map(data.map((item) => [item.around_id, item])).values()
  ) : [];

  return (
    <div className="p-6 md:p-10 font-sans text-gray-800 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Assessment Dashboard
            </h1>
            <p className="text-gray-500 mt-2">
              รายการรอบการประเมินทั้งหมด ({assessmentRounds.length})
            </p>
          </div>
          <Link
            href="/dashboard-admin/assessment-create"
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-ksu text-white rounded-xl hover:bg-ksu-dark transition-all shadow-md hover:shadow-lg font-bold text-sm"
          >
            <Plus size={18} />
            สร้างแบบประเมินใหม่
          </Link>
        </div>

        {/* Content Section */}
        {assessmentRounds.length === 0 ? (
          // UI กรณีไม่มีข้อมูล
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <CalendarX2 className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium text-lg">ยังไม่มีรอบการประเมินในระบบ</p>
            <p className="text-gray-400 text-sm mt-1">คลิกที่ปุ่ม "สร้างแบบประเมินใหม่" เพื่อเริ่มต้น</p>
          </div>
        ) : (
          // UI แสดงรายการ
          <div className="space-y-4">
            {assessmentRounds.map((round) => {
              const status = getStatus(round.end_date);
              const displayId = formatRoundId(round.around_id);

              return (
                <div
                  key={round.around_id}
                  className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition-shadow"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-ksu">
                        {displayId}
                      </h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${status.color}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 flex items-center gap-2">
                      <span className="font-medium text-gray-700">
                        ระยะเวลา:
                      </span>
                      {formatDate(round.start_date)} - {formatDate(round.end_date)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {status.isActive ? (
                      <Link
                        href={`/dashboard-admin/assessment-edit/${round.around_id}`}
                        className="p-2 text-gray-400 hover:text-ksu hover:bg-ksu/10 rounded-lg transition-colors"
                        title="แก้ไข"
                      >
                        <Pencil size={18} />
                      </Link>
                    ) : (
                      <Link
                        href={`/dashboard-admin/assessment-view/${round.around_id}`}
                        className="p-2 text-gray-400 hover:text-ksu hover:bg-ksu/10 rounded-lg transition-colors"
                        title="ดูรายละเอียด"
                      >
                        <Eye size={18} />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}