import { createClient } from "@/utils/supabase/server"; // ✅ ใช้ Server Client
import { cookies } from "next/headers";
import Link from "next/link";
import { formatRoundId } from "@/utils/round-formatter";
import {
  Calendar,
  Clock,
  Layout,
  AlignLeft,
  GripVertical,
  ArrowLeft,
  RefreshCcw,
  FileText
} from "lucide-react";
import ViewDatePicker from "../components/ViewDatePicker";

type QuestionType = "scale" | "text" | "head";
type SectionType = "questions" | "description";

interface Question {
  id: string;
  text: string;
  type: QuestionType;
  section: string;
  parentId?: string;
}

interface Section {
  id: string;
  type: SectionType;
  title: string;
  description: string;
}

// ✅ ถอด "use client" ออก และใช้เป็น async Server Component
export default async function AssessmentView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const around_id = id;

  // 1. สร้าง Supabase Server Client
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // 2. ดึงข้อมูลพื้นฐาน (ปีการศึกษา/ภาคเรียน) จาก ID
  let academicYear = new Date().getFullYear() + 543;
  let term = "1";
  if (around_id.length >= 5) {
    academicYear = parseInt(around_id.substring(0, 4));
    term = around_id.substring(4);
  }

  // 3. ดึงข้อมูลจากฐานข้อมูลพร้อมกัน (Parallel Fetching เพื่อความเร็ว)
  const [headResponse, detailResponse] = await Promise.all([
    supabase
      .from("assessment_head")
      .select("*")
      .eq("around_id", parseInt(around_id))
      .order("section1", { ascending: true }),
    supabase
      .from("assessment_detail")
      .select("*")
      .eq("around_id", parseInt(around_id))
      .order("section1", { ascending: true }) // Sort section2 in JavaScript
  ]);

  if (headResponse.error) console.error("Head Error:", headResponse.error);
  if (detailResponse.error) console.error("Detail Error:", detailResponse.error);

  const hData = headResponse.data || [];
  let dData = detailResponse.data || [];

  // Process dData and ensure section2 is sorted numerically (e.g. 1.2 before 1.10)
  if (dData.length > 0) {
    dData.sort((a: any, b: any) => {
      if (a.section1 !== b.section1) return a.section1 - b.section1;
      const aParts = String(a.section2).split('.').map(Number);
      const bParts = String(b.section2).split('.').map(Number);
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = aParts[i] || 0;
        const bVal = bParts[i] || 0;
        if (aVal !== bVal) return aVal - bVal;
      }
      return 0;
    });
  }

  // 4. จัดเตรียมข้อมูล (Data Processing)
  let startDate: Date | null = null;
  let endDate: Date | null = null;
  let minScore = 1;
  let maxScore = 5;

  if (dData.length > 0) {
    const first = dData[0];
    if (first.start_date) startDate = new Date(first.start_date);
    if (first.end_date) endDate = new Date(first.end_date);

    const scoreRow = dData.find((d: any) => d.type === 'score' || d.type === 'scale');
    if (scoreRow) {
      if (scoreRow.min_score !== null) minScore = scoreRow.min_score;
      if (scoreRow.max_score !== null) maxScore = scoreRow.max_score;
    }
  }

  // Map Sections
  const sectionIdMap: Record<number, string> = {};
  const mappedSections: Section[] = hData.map((h: any) => {
    const frontendId = `sec-${h.section1}`; // ใช้ ID ที่คาดเดาได้แทน Math.random()
    sectionIdMap[h.section1] = frontendId;
    const hasQuestions = dData.some((d: any) => d.section1 === h.section1);

    return {
      id: frontendId,
      type: hasQuestions ? "questions" : "description",
      title: h.head_description || "",
      description: h.description || ""
    };
  });

  // Map Questions
  const mappedQuestions: Question[] = [];
  const headMap: Record<string, string> = {};
  let lastHeadId: string | undefined;

  // Process Heads first
  dData.forEach((d: any) => {
    if (d.type === 'head') {
      const sectionFrontendId = sectionIdMap[d.section1];
      if (sectionFrontendId) {
        const s2Str = String(d.section2).split('.')[0];
        const newHeadId = `head-${d.section1}-${s2Str}`;
        const key = `${d.section1}-${s2Str}`;
        headMap[key] = newHeadId;

        mappedQuestions.push({
          id: newHeadId,
          text: d.detail || "",
          type: 'head',
          section: sectionFrontendId,
        });
      }
    }
  });

  // Process Children Questions
  dData.forEach((d: any, index: number) => {
    const s2Str = String(d.section2);

    if (d.type === 'head') {
      const s2Key = s2Str.split('.')[0];
      const key = `${d.section1}-${s2Key}`;
      lastHeadId = headMap[key];
      return;
    }

    if (d.type !== 'head') {
      const sectionFrontendId = sectionIdMap[d.section1];
      if (sectionFrontendId) {
        let parentId: string | undefined;

        if (s2Str.includes('.')) {
          const parts = s2Str.split('.');
          const parentTopicNum = parts[0];
          const parentKey = `${d.section1}-${parentTopicNum}`;
          parentId = headMap[parentKey];
        }

        if (!parentId) parentId = lastHeadId;

        if (parentId) {
          mappedQuestions.push({
            id: `q-${d.section1}-${s2Str}-${index}`,
            text: d.detail || "",
            type: d.type === 'score' ? 'scale' : d.type,
            section: sectionFrontendId,
            parentId: parentId
          });
        }
      }
    }
  });

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-10 font-sans text-gray-800">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <Link href="/dashboard-admin" className="text-gray-500 hover:text-ksu flex items-center gap-1 text-sm font-medium transition-colors">
              <ArrowLeft size={16} />
              กลับไปแดชบอร์ด
            </Link>

            {/* ✅ เปลี่ยนปุ่ม Recreate ให้เป็น Link เพื่อให้ทำงานแบบ Server Component ได้ */}
            <Link
              href={`/dashboard-admin/assessment-create?recreate_from=${around_id}`}
              className="flex items-center gap-2 text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all"
            >
              <RefreshCcw size={16} />
              Recreate (สร้างใหม่จากรอบนี้)
            </Link>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
            <Layout className="text-ksu" size={32} />
            รายละเอียดแบบประเมิน
          </h1>
          <p className="text-gray-500 mt-2 text-lg">
            {formatRoundId(around_id)} (View Only)
          </p>
        </div>

        <div className="space-y-8">
          {/* 1. Context Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-linear-to-r from-gray-50 to-white">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Clock size={18} className="text-gray-400" />
                ข้อมูลรอบการประเมิน
              </h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">ปีการศึกษา</label>
                <input
                  type="number"
                  defaultValue={academicYear}
                  disabled
                  className="w-full bg-gray-100 border border-gray-300 text-gray-500 text-sm rounded-xl block p-3 shadow-sm cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">ภาคการศึกษา</label>
                <select
                  defaultValue={term}
                  disabled
                  className="w-full bg-gray-100 border border-gray-300 text-gray-500 text-sm rounded-xl block p-3 shadow-sm cursor-not-allowed"
                >
                  <option value="1">ภาคเรียนที่ 1</option>
                  <option value="2">ภาคเรียนที่ 2</option>
                  <option value="3">ภาคเรียนฤดูร้อน</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Calendar size={16} className="text-gray-400" /> วันที่เริ่มต้น
                </label>
                <div className="w-full">
                  <ViewDatePicker date={startDate} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Calendar size={16} className="text-gray-400" /> วันที่สิ้นสุด
                </label>
                <div className="w-full">
                  <ViewDatePicker date={endDate} />
                </div>
              </div>
              {/* Global Score Settings */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">คะแนนเริ่มต้น (สเกล)</label>
                <input
                  type="number"
                  defaultValue={minScore}
                  disabled
                  className="w-full bg-gray-100 border border-gray-300 text-gray-500 text-sm rounded-xl block p-3 shadow-sm cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">คะแนนสุดท้าย (สเกล)</label>
                <input
                  type="number"
                  defaultValue={maxScore}
                  disabled
                  className="w-full bg-gray-100 border border-gray-300 text-gray-500 text-sm rounded-xl block p-3 shadow-sm cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* 2. Sections Container */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <AlignLeft size={24} className="text-ksu" />
                ส่วนของแบบประเมิน (Sections)
              </h2>
            </div>

            {mappedSections.map((section, index) => (
              <div key={section.id} className="space-y-4">
                <div
                  className={`rounded-2xl shadow-md border overflow-hidden relative ${section.type === "questions"
                    ? "bg-white border-gray-200"
                    : "bg-blue-50/30 border-blue-100"
                    }`}
                >
                  {/* Section Header */}
                  <div className={`${section.type === 'questions' ? 'bg-gray-50' : 'bg-blue-50/50'} border-b border-gray-100 p-5 flex items-start gap-4`}>
                    <div className={`${section.type === 'questions' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'} font-bold rounded-lg w-10 h-10 flex items-center justify-center shrink-0 text-lg`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div className="w-full bg-transparent border-0 border-b-2 border-gray-200 text-lg font-bold text-gray-900 px-0 py-2">
                          {section.title}
                        </div>

                        {section.type === 'description' && (
                          <div className="w-full bg-white border border-blue-200/50 rounded-lg px-4 py-3 text-base text-gray-700 shadow-sm whitespace-pre-wrap">
                            {section.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Questions in this Section */}
                  {section.type === 'questions' && (
                    <div className="p-6 bg-white space-y-4">
                      {mappedQuestions
                        .filter(q => q.section === section.id && q.type === "head")
                        .map((head, hIndex) => (
                          <div key={head.id} className="border border-blue-200 rounded-xl overflow-hidden bg-blue-50/5 mb-4">
                            {/* Topic Header */}
                            <div className="p-4 bg-blue-50/30 flex items-start gap-3 border-b border-blue-100">
                              <div className="pt-3 text-blue-300">
                                <GripVertical size={16} />
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between items-start mb-3">
                                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                                    หัวข้อ (Topic) ที่ {index + 1}.{hIndex + 1}
                                  </span>
                                </div>
                                <div className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm font-bold text-gray-800">
                                  {head.text}
                                </div>
                              </div>
                            </div>

                            {/* Children Questions */}
                            <div className="p-4 space-y-3 bg-white">
                              {mappedQuestions
                                .filter(q => q.parentId === head.id)
                                .map((child, cIndex) => (
                                  <div key={child.id} className="flex items-start gap-3 pl-4 border-l-2 border-gray-100 transition-colors hover:border-ksu/50 group">
                                    <div className="pt-3 text-gray-300 group-hover:text-ksu/50">
                                      <GripVertical size={14} />
                                    </div>
                                    <div className="flex-1 rounded-lg p-3 bg-gray-50 border border-gray-100 group-hover:border-ksu/30">
                                      <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-medium text-gray-400">
                                          ข้อที่ {index + 1}.{hIndex + 1}.{cIndex + 1}
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                        <div className="md:col-span-8">
                                          <div className="w-full bg-white border border-gray-200 rounded px-2 py-1.5 text-sm">
                                            {child.text}
                                          </div>
                                        </div>
                                        <div className="md:col-span-4">
                                          <div className="w-full bg-gray-100 border border-gray-200 rounded px-2 py-1.5 text-sm text-gray-600 flex items-center gap-2">
                                            <FileText size={14} className="text-gray-400" />
                                            {child.type === 'scale' ? 'สเกลวัดระดับ (1-N)' : 'ข้อความ (ปลายเปิด)'}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Visual hint for Description Section */}
                  {section.type === 'description' && (
                    <div className="px-6 py-3 bg-blue-50/20 text-center text-sm text-blue-400 italic">
                      ส่วนนี้สำหรับแสดงข้อความเท่านั้น (ไม่มีคำถาม)
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}