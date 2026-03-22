"use client";

import {
    Calendar,
    ClipboardList,
    User,
    ClipboardCheck,
    AlertCircle,
    Lock,
    Loader2,
} from "lucide-react";
import { parseRoundId, getTermLabel } from "@/utils/round-formatter";

// --- Types ---
export type AssessmentRound = {
    around_id: number;
    start_date: string;
    end_date: string;
};

export type Advisor = {
    id: string;
    fullName: string;
};

// --- Utils ---
const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = (date.getFullYear() + 543).toString();
    return `${day}/${month}/${year}`;
};

export const getStatus = (startDateString: string, endDateString: string) => {
    const now = new Date();
    const start = new Date(startDateString);
    const end = new Date(endDateString);

    if (now < start) {
        return {
            isActive: false,
            label: "ยังไม่เปิด",
            color: "bg-yellow-100 text-yellow-700 border-yellow-200",
        };
    }

    const isActive = now <= end;
    return {
        isActive,
        label: isActive ? "กำลังดำเนินการ" : "หมดเวลา",
        color: isActive
            ? "bg-emerald-100 text-emerald-700 border-emerald-200"
            : "bg-gray-100 text-gray-600 border-gray-200",
    };
};

// --- Props ---
type Props = {
    studentData: any;
    advisors: Advisor[];
    rounds: AssessmentRound[];
    completedAssessments: string[];
    userDataLoading: boolean;
    dashboardLoading: boolean;
    onSelectRound: (roundId: number, advisorId: string) => void;
};

// --- Component ---
export default function AdvisorDashboard({
    studentData,
    advisors,
    rounds,
    completedAssessments,
    userDataLoading,
    dashboardLoading,
    onSelectRound,
}: Props) {
    const isConfirmed = studentData?.confirm === true;

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20 px-4 sm:px-6 font-sans">
            {/* HEADER */}
            <div className="py-8 border-b border-gray-100">
                <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 flex items-center gap-3">
                    <span className="bg-[#C1322E] text-white p-2 rounded-xl">
                        <ClipboardList size={24} />
                    </span>
                    ประเมินอาจารย์ที่ปรึกษา
                </h1>
                <p className="text-gray-500 mt-3 text-base">
                    เลือกอาจารย์ที่ปรึกษาที่ต้องการประเมินจากรายการรอบการประเมินที่เปิดอยู่ด้านล่าง
                </p>
            </div>

            {userDataLoading || dashboardLoading ? (
                <div className="flex justify-center py-20">
                    <Loader2 size={40} className="animate-spin text-[#C1322E]" />
                </div>
            ) : (
                <div className="space-y-8">

                    {/* แจ้งเตือนถ้านักศึกษายังไม่ได้รับ Confirm จากอาจารย์ */}
                    {!isConfirmed && (
                        <div className="bg-amber-50 border border-amber-200 p-6 rounded-[1.5rem] flex items-start gap-4 shadow-sm animate-fade-up">
                            <div className="bg-amber-100 p-3 rounded-full text-amber-600 shrink-0">
                                <Lock size={24} />
                            </div>
                            <div>
                                <h3 className="text-amber-800 font-bold text-lg mb-1">สถานะของคุณถูกล็อกชั่วคราว</h3>
                                <p className="text-amber-700 text-sm leading-relaxed">
                                    คุณยังไม่สามารถทำแบบประเมินได้ เนื่องจากอาจารย์ที่ปรึกษายังไม่ได้ <strong>&quot;ยืนยันสถานะ&quot;</strong> ของคุณในระบบ กรุณารอให้อาจารย์ที่ปรึกษากดยืนยันในห้องเรียนก่อน แล้วจึงกลับมาทำแบบประเมินอีกครั้ง
                                </p>
                            </div>
                        </div>
                    )}

                    {rounds.length === 0 ? (
                        <div className="text-center py-24 bg-white rounded-3xl border border-gray-100 shadow-sm">
                            <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <ClipboardList size={32} className="text-gray-300" />
                            </div>
                            <p className="text-gray-500 font-medium">
                                ไม่พบรอบการประเมินที่เปิดอยู่
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {rounds.map((round) => {
                                const { year, term } = parseRoundId(round.around_id);
                                const termLabel = getTermLabel(term);
                                const status = getStatus(round.start_date, round.end_date);

                                if (!status.isActive) return null;

                                return (
                                    <div
                                        key={round.around_id}
                                        className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100/80 hover:shadow-md transition-all"
                                    >
                                        <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <h2 className="text-xl font-bold text-gray-900">
                                                        ปีการศึกษา {year}{" "}
                                                        <span className="text-gray-400 font-normal">
                                                            |
                                                        </span>{" "}
                                                        {termLabel}
                                                    </h2>
                                                    <span
                                                        className={`px-3 py-1 rounded-full text-xs font-bold ${status.color}`}
                                                    >
                                                        {status.label}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                                    <Calendar size={14} />
                                                    {formatDate(round.start_date)} -{" "}
                                                    {formatDate(round.end_date)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Advisors Grid */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {advisors.map((adv) => {
                                                const isDone = completedAssessments.includes(
                                                    `${round.around_id}-${adv.id}`,
                                                );

                                                // ล็อกปุ่มถ้าหมดเวลา หรือ ทำเสร็จแล้ว หรือ ยังไม่ได้ confirm
                                                const isDisabled = !status.isActive || isDone || !isConfirmed;

                                                return (
                                                    <button
                                                        key={adv.id}
                                                        onClick={() =>
                                                            onSelectRound(round.around_id, adv.id)
                                                        }
                                                        disabled={isDisabled}
                                                        className={`group relative p-4 rounded-2xl border text-left transition-all duration-200
                              ${isDone
                                                                ? "bg-emerald-50/50 border-emerald-100 cursor-default opacity-80"
                                                                : !isConfirmed
                                                                    ? "bg-gray-50 border-gray-200 cursor-not-allowed opacity-70"
                                                                    : status.isActive
                                                                        ? "bg-white border-gray-200 hover:border-[#C1322E] hover:shadow-lg hover:-translate-y-1"
                                                                        : "bg-gray-50 border-gray-100 cursor-not-allowed opacity-60"
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div
                                                                className={`w-12 h-12 rounded-full overflow-hidden flex items-center justify-center shrink-0 transition-colors border
                                 ${isDone ? "bg-emerald-100 text-emerald-600 border-emerald-200" : !isConfirmed ? "bg-gray-200 text-gray-400 border-transparent" : "bg-gray-100 text-gray-500 border-gray-200 group-hover:bg-red-50 group-hover:text-[#C1322E]"}`}
                                                            >
                                                                {isDone ? (
                                                                    <ClipboardCheck size={24} />
                                                                ) : !isConfirmed ? (
                                                                    <Lock size={20} />
                                                                ) : (
                                                                    <User size={24} />
                                                                )}
                                                            </div>
                                                            <div>
                                                                <div className={`text-sm font-bold transition-colors ${!isConfirmed && !isDone ? "text-gray-500" : "text-gray-900 group-hover:text-[#C1322E]"}`}>
                                                                    {adv.fullName}
                                                                </div>
                                                                <div className="text-xs flex items-center gap-1 mt-0.5">
                                                                    {isDone ? (
                                                                        <span className="text-emerald-600 font-bold">
                                                                            ประเมินเสร็จสิ้น
                                                                        </span>
                                                                    ) : !isConfirmed ? (
                                                                        <span className="text-amber-600 font-bold flex items-center gap-1">
                                                                            <AlertCircle size={12} /> รอการยืนยันสถานะ
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-gray-400 group-hover:text-red-400">
                                                                            คลิกเพื่อทำแบบประเมิน
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
