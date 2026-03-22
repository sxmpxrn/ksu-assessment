"use client";

import {
    Info,
    Loader2,
    Save,
    User,
    ArrowLeft,
    ClipboardList,
    ClipboardCheck,
} from "lucide-react";
import { parseRoundId, getTermLabel } from "@/utils/round-formatter";

// --- Types ---
export type Section = {
    id: number;
    section1: number;
    head_description: string;
    description: string | null;
    around_id: number;
};

export type Question = {
    id: number;
    type: "scale" | "text" | "head";
    question_text: string;
    start_score: number | null;
    end_score: number | null;
    around_id: number;
    section1: number;
    section2: string;
};

export type Advisor = {
    id: string;
    fullName: string;
};

// --- Props ---
type Props = {
    selectedAround: number;
    selectedAdvisorId: string;
    studentData: any;
    advisors: Advisor[];
    sections: Section[];
    questions: Question[];
    answers: Record<number, string | number>;
    isAlreadyAssessed: boolean;
    isSubmitting: boolean;
    loading: boolean;
    onAnswerChange: (qId: number, value: string | number) => void;
    onSave: () => void;
    onBack: () => void;
};

// --- Component ---
export default function AssessmentForm({
    selectedAround,
    selectedAdvisorId,
    studentData,
    advisors,
    sections,
    questions,
    answers,
    isAlreadyAssessed,
    isSubmitting,
    loading,
    onAnswerChange,
    onSave,
    onBack,
}: Props) {
    const { year, term } = parseRoundId(selectedAround || 0);
    const termLabel = getTermLabel(term);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-500">
                <Loader2 size={40} className="animate-spin mb-4 text-[#C1322E]" />
                <p>กำลังเตรียมข้อมูลแบบประเมิน...</p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-20 font-sans px-4 sm:px-6">
            {/* Back Button */}
            <button
                onClick={onBack}
                className="flex items-center gap-2 text-gray-500 hover:text-black transition-colors font-medium mb-4"
            >
                <ArrowLeft size={18} />
                <span>ย้อนกลับ</span>
            </button>

            {/* MAIN HEADER & GENERAL INFORMATION */}
            <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#C1322E] to-red-400"></div>
                <div className="text-center mb-8 border-b border-gray-100 pb-6">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 tracking-tight">
                        แบบประเมินความพึงพอใจต่ออาจารย์ที่ปรึกษา
                    </h1>
                    <p className="text-gray-600 font-medium">
                        มหาวิทยาลัยกาฬสินธุ์ • Kalasin University
                    </p>
                    <div className="inline-flex items-center gap-2 mt-3 px-4 py-1.5 bg-gray-100 rounded-full text-sm font-semibold text-gray-700">
                        <span>ปีการศึกษา {year}</span>
                        <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                        <span>{termLabel}</span>
                    </div>
                </div>

                {/* General Info Grid */}
                <div>
                    <h2 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
                        <Info size={20} />
                        ข้อมูลทั่วไป (General Information)
                    </h2>

                    {isAlreadyAssessed && (
                        <div className="mb-6 bg-red-50 border border-red-200 p-4 rounded-xl text-red-700 flex items-center gap-3 animate-pulse">
                            <Info size={24} className="shrink-0" />
                            <div className="font-bold">
                                คุณได้ทำการประเมินอาจารย์ท่านนี้ในรอบการประเมินนี้ไปแล้ว
                                ไม่สามารถประเมินซ้ำได้
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-lg border border-gray-100">
                        {/* Advisor Selection */}
                        <div className="flex items-start gap-4">
                            <div className="w-16 h-16 bg-white rounded-full border border-gray-200 flex items-center justify-center text-[#C1322E] shrink-0 overflow-hidden">
                                <User size={32} />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">
                                    อาจารย์ที่ปรึกษา (Advisor)
                                </label>
                                <p className="text-lg font-bold text-gray-900">
                                    {advisors.find((a) => a.id === selectedAdvisorId)?.fullName ||
                                        "ไม่พบข้อมูลอาจารย์"}
                                </p>
                                <p className="text-sm text-gray-600 mt-1">
                                    {studentData?.std_faculty || "มหาวิทยาลัยกาฬสินธุ์"}
                                </p>
                            </div>
                        </div>

                        {/* Student (Evaluator) */}
                        <div className="flex items-start gap-4">
                            <div className="w-16 h-16 bg-white rounded-full border border-gray-200 flex items-center justify-center text-gray-400 shrink-0">
                                <User size={32} />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">
                                    ผู้ประเมิน (Evaluator)
                                </label>
                                <p className="text-lg font-bold text-gray-900">
                                    {studentData?.first_name || "กำลังโหลด..."} {studentData?.last_name || ""}
                                </p>
                                <p className="text-sm text-gray-600">
                                    รหัสนักศึกษา: {studentData?.student_id || "กำลังโหลด..."}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 p-4 bg-yellow-50 text-yellow-800 text-sm border border-yellow-100 rounded-lg flex gap-2">
                        <Info size={16} className="shrink-0 mt-0.5" />
                        <p>
                            คำชี้แจง:
                            ข้อมูลของท่านจะถูกเก็บเป็นความลับและนำไปใช้เพื่อการพัฒนาและปรับปรุงประสิทธิภาพการให้คำปรึกษาเท่านั้น
                        </p>
                    </div>
                </div>
            </div>

            {/* Sections & Questions */}
            <div
                className={`bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden ${isAlreadyAssessed ? "opacity-50 pointer-events-none grayscale" : ""
                    }`}
            >
                {sections.map((section) => {
                    const sectionQuestions = questions
                        .filter((q) => q.section1 === section.section1)
                        .sort((a, b) => {
                            return a.section2.localeCompare(b.section2, undefined, {
                                numeric: true,
                            });
                        });
                    const hasQuestions = sectionQuestions.length > 0;

                    if (!hasQuestions) {
                        return (
                            <div
                                key={section.id}
                                className="bg-indigo-50/50 p-8 rounded-2xl border border-indigo-100 shadow-sm mb-6 mt-10 group"
                            >
                                <div className="flex items-start gap-5">
                                    <div className="p-4 bg-white rounded-2xl text-indigo-600 shadow-sm group-hover:scale-110 transition-transform duration-300">
                                        <ClipboardList size={28} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-indigo-900 mb-2 tracking-tight">
                                            {section.head_description}
                                        </h2>
                                        {section.description && (
                                            <p className="text-indigo-700/70 text-lg leading-relaxed font-semibold">
                                                {section.description}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div
                            key={section.id}
                            className="mb-8 last:mb-0 border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300"
                        >
                            {/* Section Header */}
                            <div className="bg-gradient-to-r from-[#7ca3d5] to-[#5b8bc0] px-6 py-4 md:px-8 border-b border-blue-200">
                                <div className="flex items-start gap-3">
                                    <div className="bg-white/20 p-2 rounded-lg text-white mt-1">
                                        <ClipboardList size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white drop-shadow-sm">
                                            {section.head_description}
                                        </h2>
                                        {section.description && (
                                            <p className="mt-1 text-blue-50 text-sm font-medium leading-relaxed opacity-90">
                                                {section.description}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white divide-y divide-gray-50">
                                {sectionQuestions.map((q) => {
                                    if (q.type === "head") {
                                        return (
                                            <div
                                                key={q.id}
                                                className="py-6 px-6 md:px-8 bg-blue-50/30 border-t border-b border-blue-100/50"
                                            >
                                                <h3 className="text-[#3b5b8d] font-bold text-lg flex items-center gap-3">
                                                    <span className="flex h-2 w-2 rounded-full bg-[#7ca3d5]"></span>
                                                    {q.question_text}
                                                </h3>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div
                                            key={q.id}
                                            className="py-5 px-6 md:px-8 hover:bg-gray-50/80 transition-colors duration-200 group/item"
                                        >
                                            <div
                                                className={`flex flex-col ${q.type === "scale"
                                                    ? "xl:flex-row gap-6 xl:gap-12"
                                                    : "gap-4"
                                                    }`}
                                            >
                                                <div
                                                    className={`${q.type === "scale" ? "xl:w-5/12" : "w-full"
                                                        } flex gap-4`}
                                                >
                                                    <p className="text-gray-800 font-semibold text-base md:text-lg leading-relaxed group-hover/item:text-black transition-colors">
                                                        {q.question_text}
                                                    </p>
                                                </div>

                                                <div
                                                    className={`${q.type === "scale"
                                                        ? "xl:w-7/12 flex items-center justify-start xl:justify-center"
                                                        : "w-full md:pl-10"
                                                        }`}
                                                >
                                                    {q.type === "scale" && (
                                                        <div className="w-full">
                                                            <div className="flex items-center justify-between gap-2 max-w-xl mx-auto">
                                                                <div className="flex-1 flex flex-wrap items-center justify-center gap-2 md:gap-3 bg-gray-50/30 p-3 rounded-2xl border border-gray-100/50">
                                                                    {(() => {
                                                                        const start = q.start_score || 1;
                                                                        const end = q.end_score || 5;
                                                                        const step = start <= end ? 1 : -1;
                                                                        const length = Math.abs(end - start) + 1;
                                                                        return Array.from(
                                                                            { length },
                                                                            (_, i) => start + i * step,
                                                                        );
                                                                    })().map((score) => {
                                                                        const isSelected =
                                                                            Number(answers[q.id]) === score;
                                                                        return (
                                                                            <label
                                                                                key={score}
                                                                                className="cursor-pointer relative group flex-shrink-0"
                                                                            >
                                                                                <input
                                                                                    type="radio"
                                                                                    name={`q-${q.id}`}
                                                                                    value={score}
                                                                                    checked={isSelected}
                                                                                    onChange={() =>
                                                                                        onAnswerChange(q.id, score)
                                                                                    }
                                                                                    className="peer sr-only"
                                                                                />
                                                                                <div
                                                                                    className={`w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center font-bold text-base md:text-lg shadow-sm border transition-all duration-300 transform peer-checked:scale-110
                                      ${isSelected
                                                                                            ? "bg-gradient-to-br from-[#7ca3d5] to-[#5b8bc0] text-white border-transparent shadow-[#7ca3d5]/30 shadow-lg"
                                                                                            : "bg-white text-gray-400 border-gray-200 hover:border-[#7ca3d5] hover:text-[#7ca3d5]"
                                                                                        }`}
                                                                                >
                                                                                    {score}
                                                                                </div>
                                                                            </label>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {q.type === "text" && (
                                                        <div className="w-full relative group/input">
                                                            <div className="absolute inset-0 bg-gradient-to-r from-[#7ca3d5] to-[#5b8bc0] rounded-xl blur opacity-0 group-hover/input:opacity-20 transition-opacity duration-500"></div>
                                                            <textarea
                                                                rows={3}
                                                                placeholder="แสดงความคิดเห็นเพิ่มเติมของคุณอย่างสร้างสรรค์..."
                                                                value={answers[q.id] || ""}
                                                                onChange={(e) =>
                                                                    onAnswerChange(q.id, e.target.value)
                                                                }
                                                                className="relative w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-0 focus:border-[#7ca3d5] outline-none resize-none transition-all placeholder:text-gray-400 shadow-sm"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}

                {/* Submit Bar */}
                <div className="sticky bottom-4 bg-white p-4 rounded-xl border border-gray-200 shadow-xl flex items-center justify-between z-10 max-w-5xl mx-auto m-4">
                    <div className="text-sm font-medium text-gray-500">
                        ความคืบหน้า:{" "}
                        <span className="text-[#C1322E] font-bold">
                            {Object.keys(answers).length}
                        </span>{" "}
                        / {questions.filter((q) => q.type === "scale").length} ข้อ
                    </div>
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={isSubmitting || isAlreadyAssessed}
                        className="px-8 py-2.5 bg-black text-white rounded-lg font-bold shadow-lg hover:bg-gray-800 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="animate-spin" size={18} />
                                กำลังบันทึก...
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                ยืนยันการประเมิน
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
