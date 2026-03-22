"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, User, GraduationCap, Loader2 } from "lucide-react";
import { getStudentsInRoom } from "../actions";

interface StudentListViewProps {
    room: any;
    teacherId: number;
    onBack: () => void;
}

export default function StudentListView({ room, teacherId, onBack }: StudentListViewProps) {
    const [selectedRoomStudents, setSelectedRoomStudents] = useState<any[] | null>(null);

    useEffect(() => {
        if (room && teacherId) {
            viewRoomDetails(room.room_code);
        }
    }, [room, teacherId]);

    const viewRoomDetails = async (roomCode: string) => {
        try {
            setSelectedRoomStudents(null);
            const { students, error } = await getStudentsInRoom(teacherId, roomCode);
            if (!error && students) {
                setSelectedRoomStudents(students);
            }
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <>
            <div className="mb-8 animate-fade-up">
                <button
                    onClick={onBack}
                    className="inline-flex items-center gap-2 text-gray-500 hover:text-[#7ca3d5] font-bold transition-colors mb-6 group bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100"
                >
                    <ArrowLeft
                        size={18}
                        className="group-hover:-translate-x-1 transition-transform"
                    />
                    <span>กลับไปหน้ารายชื่อห้อง</span>
                </button>

                <div className="bg-white rounded-[2rem] p-8 md:p-10 shadow-sm border border-gray-100 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#7ca3d5]/5 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative z-10">
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                            <span className="bg-[#7ca3d5] text-white text-[10px] sm:text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">
                                Room Details
                            </span>
                            <span className="text-[#7ca3d5] bg-[#7ca3d5]/10 border border-[#7ca3d5]/20 font-bold text-xs px-3 py-1 rounded-full text-center truncate max-w-[200px] sm:max-w-[400px]">
                                {room?.major_name || "ไม่ระบุสาขา"}
                            </span>
                        </div>
                        <h1 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tight">
                            {`ห้อง ${room?.room_code || "N/A"}`}
                        </h1>
                    </div>

                    <div className="bg-gradient-to-br from-[#7ca3d5]/10 to-blue-50 px-8 py-6 rounded-3xl border border-[#7ca3d5]/20 shadow-sm flex items-center gap-6 relative z-10 shrink-0">
                        <div className="text-center">
                            <span className="block text-xs font-black text-[#7ca3d5]/70 uppercase tracking-widest mb-1 relative after:content-[''] after:block after:w-4 after:h-0.5 after:bg-[#7ca3d5]/30 after:mt-1 after:mx-auto">
                                นักศึกษา
                            </span>
                            <span className="text-4xl font-black text-[#7ca3d5] tracking-tighter">
                                {selectedRoomStudents ? (
                                    selectedRoomStudents.length
                                ) : (
                                    <Loader2 size={24} className="animate-spin inline" />
                                )}
                            </span>
                        </div>
                        <div className="w-px h-16 bg-[#7ca3d5]/20"></div>
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-[#7ca3d5] shadow-sm border border-[#7ca3d5]/10 transform rotate-3">
                            <GraduationCap size={32} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden animate-fade-in-up delay-100">
                <div className="bg-gray-50 px-8 py-5 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <User size={18} className="text-[#7ca3d5]" />
                        รายชื่อนักศึกษาในที่ปรึกษา
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-white border-b border-gray-100">
                                <th className="px-8 py-4 text-xs font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">
                                    ลำดับ
                                </th>
                                <th className="px-8 py-4 text-xs font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">
                                    รหัสนักศึกษา
                                </th>
                                <th className="px-8 py-4 text-xs font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">
                                    ชื่อ-นามสกุล
                                </th>
                                <th className="px-8 py-4 text-xs font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">
                                    หลักสูตร
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 bg-white">
                            {selectedRoomStudents === null ? (
                                <tr>
                                    <td colSpan={4} className="py-20 text-center">
                                        <Loader2
                                            size={32}
                                            className="animate-spin mx-auto text-[#7ca3d5]"
                                        />
                                    </td>
                                </tr>
                            ) : selectedRoomStudents.length > 0 ? (
                                selectedRoomStudents.map((student: any, index: number) => {
                                    return (
                                        <tr
                                            key={student.student_id}
                                            className="hover:bg-[#7ca3d5]/5 transition-colors group"
                                        >
                                            <td className="px-8 py-5 text-sm font-bold text-gray-400">
                                                {index + 1}
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className="font-mono text-sm font-bold text-gray-600 bg-gray-50 px-2 py-1 rounded-md border border-gray-100 group-hover:bg-white group-hover:border-[#7ca3d5]/30 group-hover:text-[#7ca3d5] transition-colors">
                                                    {student.student_id || "-"}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-[#7ca3d5]/10 group-hover:text-[#7ca3d5] group-hover:border-transparent transition-colors">
                                                        <User size={16} />
                                                    </div>
                                                    <span className="font-bold text-gray-800 text-sm">
                                                        {`${student.first_name || ""} ${student.last_name || ""}`.trim() ||
                                                            "-"}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-sm font-medium text-gray-600">
                                                {student.major || (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-8 py-24 text-center">
                                        <div className="flex flex-col items-center">
                                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 text-2xl border border-gray-100 mb-4">
                                                👥
                                            </div>
                                            <h3 className="font-bold text-gray-800 text-lg mb-1">
                                                ไม่พบข้อมูลนักเรียน
                                            </h3>
                                            <p className="text-gray-400 text-sm">
                                                ยังไม่มีนักศึกษาถูกกำหนดให้อยู่ในห้องเรียนนี้
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
