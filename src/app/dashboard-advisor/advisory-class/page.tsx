"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Loader2 } from "lucide-react";
import StudentListView from "./components/StudentListView";
import { getAdvisoryData } from "./actions";

export default function AdvisoryClass() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [teacherId, setTeacherId] = useState<number | null>(null);

  // Data
  const [myRooms, setMyRooms] = useState<any[]>([]);
  const [currentViewRoom, setCurrentViewRoom] = useState<any>(null);

  // Fetch Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getAdvisoryData();
      if (res.error) {
        if (res.error === "Unauthorized") {
          router.push("/login");
          return;
        }
        console.error(res.error);
      } else {
        setTeacherId(res.teacherId || null);
        setMyRooms(res.myRooms || []);
      }
    } catch (error) {
      console.error("Error fetching advisory class data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [router]);

  // Render Loader
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50/50">
        <div className="p-6 bg-white rounded-2xl shadow-xl flex flex-col items-center">
          <Loader2 size={48} className="animate-spin text-[#7ca3d5] mb-4" />
          <p className="font-bold text-gray-600 animate-pulse text-lg">
            กำลังโหลดข้อมูลห้องเรียน...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans pb-24 selection:bg-[#7ca3d5]/30">
      <div className="max-w-7xl mx-auto">
        {!currentViewRoom ? (
          <>
            {/* Main Rooms Page */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight mb-2">
                  ห้องเรียนที่ดูแล (Advisory Class)
                </h1>
                <p className="text-gray-500 font-medium md:text-lg">
                  จัดการและดูแลข้อมูลห้องเรียนที่คุณรับผิดชอบเป็นที่ปรึกษา
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {myRooms && myRooms.length > 0 ? (
                myRooms.map((room: any, index: number) => {
                  return (
                    <div
                      key={index}
                      className="group bg-white p-6 md:p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:border-[#7ca3d5]/30 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden flex flex-col justify-between"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[#7ca3d5]/5 rounded-full blur-3xl group-hover:bg-[#7ca3d5]/10 transition-colors" />

                      <div className="flex flex-col gap-4 relative z-10">
                        <div className="w-16 h-16 bg-[#7ca3d5]/10 text-[#7ca3d5] rounded-2xl flex items-center justify-center text-3xl group-hover:bg-[#7ca3d5] group-hover:text-white transition-colors duration-300">
                          🏫
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-[#7ca3d5] uppercase tracking-widest mb-1">
                            {room?.major_name || "ไม่ระบุสาขา"}
                          </span>
                          <span className="text-2xl font-black text-gray-800 tracking-tight group-hover:text-[#7ca3d5] transition-colors">
                            {`ห้อง ${room?.room_code || "N/A"}`}
                          </span>
                        </div>
                      </div>

                      <div className="pt-6 mt-6 border-t border-gray-50 relative z-10">
                        <button
                          onClick={() => setCurrentViewRoom(room)}
                          className="w-full py-3.5 bg-gray-50 text-gray-700 text-center rounded-xl font-bold hover:bg-[#7ca3d5] hover:text-white transition-all duration-300 text-sm flex items-center justify-center gap-2"
                        >
                          <User size={16} /> ดูรายชื่อนักศึกษา
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full py-24 bg-white/60 backdrop-blur-sm rounded-[2rem] border border-dashed border-gray-300 text-center shadow-sm">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 border border-gray-100 text-gray-300">
                    📭
                  </div>
                  <h3 className="text-xl md:text-2xl font-black text-gray-800 mb-2">
                    ยังไม่มีห้องเรียนที่ดูแล
                  </h3>
                  <p className="text-gray-500 md:text-lg max-w-md mx-auto">
                    ข้อมูลนักศึกษาของคุณยังไม่ถูกเชื่อมต่อเข้าสู่ระบบ หากมีข้อสงสัยโปรดติดต่อผู้ดูแลระบบ
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <StudentListView room={currentViewRoom} teacherId={teacherId!} onBack={() => setCurrentViewRoom(null)} />
        )}
      </div>
    </div>
  );
}