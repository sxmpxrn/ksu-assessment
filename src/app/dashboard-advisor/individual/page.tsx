"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  FileText,
  Users,
  TrendingUp,
  Loader2,
  Calendar,
  MessageSquare,
  Target,
  Award,
  ChevronRight,
  Download,
  CheckCircle,
  RefreshCw,
} from "lucide-react";
import { formatRoundId } from "@/utils/round-formatter";
import { getAvailableRounds, getAdvisorIndividualStats } from "./actions";

interface AssessmentDomain {
  id: string;
  name: string;
  score: number;
  fullMark: number;
  subject: string;
  A: number;
}

interface AssessmentItem {
  id: number;
  section: string;
  domain: string;
  text: string;
  score: number;
}

interface GroupedFeedback {
  question_id: number;
  question_text: string;
  section: string;
  comments: string[];
}

export default function Overview() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rounds, setRounds] = useState<number[]>([]);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);

  // Data State
  const [overallScore, setOverallScore] = useState(0);
  const [participatedStudents, setParticipatedStudents] = useState(0);
  const [domainData, setDomainData] = useState<AssessmentDomain[]>([]);
  const [questions, setQuestions] = useState<AssessmentItem[]>([]);
  const [groupedFeedback, setGroupedFeedback] = useState<GroupedFeedback[]>([]);
  const [teacherProfile, setTeacherProfile] = useState<any>(null);

  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    const fetchRounds = async () => {
      try {
        const data = await getAvailableRounds();
        setRounds(data);
        if (data.length > 0) {
          if (!selectedRound) {
             setSelectedRound(data[0]);
          }
        } else {
          // If no rounds are available, we should stop loading and show empty state
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch rounds", err);
        setLoading(false);
      }
    };
    fetchRounds();
  }, [selectedRound]);

  const fetchData = async () => {
    if (!selectedRound) return;
    setLoading(true);
    try {
      const result = await getAdvisorIndividualStats(selectedRound);
      if (result.error) {
        if (result.error === "Unauthorized") {
          router.push("/login");
          return;
        }
        console.error(result.error);
        // Set safe defaults on error so it doesn't spin forever
        setOverallScore(0);
        setParticipatedStudents(0);
        setDomainData([]);
        setQuestions([]);
        setGroupedFeedback([]);
        setTeacherProfile(null);
      } else {
        setOverallScore(result.overallScore || 0);
        setParticipatedStudents(result.participatedStudents || 0);
        setDomainData(result.domainData || []);
        setQuestions(result.questions || []);
        setGroupedFeedback(result.groupedFeedback || []);
        if (result.teacherProfile) setTeacherProfile(result.teacherProfile);
      }
    } catch (err) {
      console.error("Error fetching overview data:", err);
      // Ensure we don't crash on render if mapping fails
      setOverallScore(0);
      setParticipatedStudents(0);
      setDomainData([]);
      setQuestions([]);
      setGroupedFeedback([]);
      setTeacherProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedRound) {
      fetchData();
    }
  }, [selectedRound]);


  const getScoreColor = (score: number) => {
    if (score >= 4.5) return "text-emerald-500 bg-emerald-500/10";
    if (score >= 4.0) return "text-sky-500 bg-sky-500/10";
    if (score >= 3.0) return "text-amber-500 bg-amber-500/10";
    return "text-rose-500 bg-rose-500/10";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F8FAFC]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">กำลังประมวลผลข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-12 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px] animate-pulse" />
        <div
          className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px] animate-pulse"
          style={{ animationDelay: "2s" }}
        />
      </div>

      <div className="bg-white/70 backdrop-blur-xl border-b border-white/40 sticky top-0 z-40 px-4 md:px-6 py-4 transition-all shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl text-white shadow-lg shadow-blue-500/20 shrink-0">
              <TrendingUp size={24} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-800 to-slate-600">
                Dashboard การประเมินตนเอง
              </h1>
              <p className="text-slate-400 text-xs md:text-sm font-medium">สถิติและผลการประเมินรายบุคคล (Personal Advisor View)</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto overflow-x-auto pb-1 sm:pb-0">
            <div className="relative group min-w-[150px]">
              <select
                value={selectedRound || ""}
                onChange={(e) => setSelectedRound(Number(e.target.value))}
                className="w-full appearance-none pl-11 pr-10 py-3 bg-white border border-slate-200/60 rounded-2xl text-sm font-bold text-slate-700 shadow-sm hover:border-indigo-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
              >
                {rounds.map((r) => <option key={r} value={r}>{formatRoundId(r)}</option>)}
              </select>
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none rotate-90 group-hover:text-indigo-500 transition-colors" />
            </div>

            <button
              onClick={() => {
                if (selectedRound) {
                  const printData = { overallScore, participatedStudents, domainData, questions, groupedFeedback, teacherProfile, timestamp: Date.now() };
                  localStorage.setItem("printData_advisor_individual", JSON.stringify(printData));
                  const url = `/dashboard-advisor/individual/print?round=${selectedRound}`;
                  window.open(url, "_blank");
                }
              }}
              className="flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:bg-slate-800 hover:shadow-xl active:scale-95 transition-all shrink-0 whitespace-nowrap"
            >
              <Download size={18} />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-8 md:pt-10 space-y-10 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white/80 backdrop-blur-sm p-8 rounded-[2.5rem] border border-white shadow-xl shadow-slate-200/50 relative overflow-hidden group hover:translate-y-[-4px] transition-all duration-500">
            <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-blue-500/10 transition-colors duration-700" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="p-4 bg-blue-50 rounded-2xl text-blue-600 shadow-inner group-hover:scale-110 transition-transform duration-500">
                  <Award size={32} />
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs font-black uppercase tracking-widest px-3 py-1 bg-blue-50 text-blue-600 rounded-full mb-1">
                    Performance
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    Score Rating
                  </span>
                </div>
              </div>
              <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">
                คะแนนเฉลี่ยรวม
              </p>
              <div className="flex items-baseline gap-3 mt-2">
                <h1 className="text-6xl font-black text-slate-900 tracking-tighter transition-all group-hover:text-blue-600">
                  {overallScore.toFixed(2)}
                </h1>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1 text-emerald-500 text-xs font-bold bg-emerald-50 px-2 py-0.5 rounded-lg mt-1">
                    <TrendingUp size={12} />
                    <span>Good</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm p-8 rounded-[2.5rem] border border-white shadow-xl shadow-slate-200/50 relative overflow-hidden group hover:translate-y-[-4px] transition-all duration-500">
            <div className="absolute top-0 right-0 w-48 h-48 bg-violet-500/5 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-violet-500/10 transition-colors duration-700" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="p-4 bg-violet-50 rounded-2xl text-violet-600 shadow-inner group-hover:scale-110 transition-transform duration-500">
                  <Users size={32} />
                </div>
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest px-3 py-1 bg-violet-50 text-violet-700 rounded-full mb-1">
                    <CheckCircle size={14} className="fill-violet-700/20" />
                    Active
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">
                    Participation
                  </span>
                </div>
              </div>
              <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">
                จำนวนผู้ประเมิน (นักศึกษา)
              </p>
              <div className="flex items-baseline gap-3 mt-2">
                <h1 className="text-6xl font-black text-slate-900 tracking-tighter transition-all group-hover:text-violet-600">
                  {participatedStudents.toLocaleString()}
                </h1>
                <div className="flex flex-col">
                  <span className="text-xl text-slate-300 font-bold">
                    Students
                  </span>
                </div>
              </div>

              <div className="mt-8">
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-violet-400 to-indigo-600 rounded-full transition-all duration-1000 ease-out animate-pulse"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-[2.5rem] border border-white p-10 shadow-xl shadow-slate-200/50 flex flex-col group transition-all duration-500">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-xl text-blue-600">
                    <TrendingUp size={20} />
                  </div>
                  จุดแข็ง-จุดอ่อน (รายด้าน)
                </h3>
                <p className="text-slate-400 text-sm mt-1 font-medium">
                  วิเคราะห์คะแนนเฉลี่ยในแต่ละด้านของการประเมิน
                </p>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center min-h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart
                  cx="50%"
                  cy="50%"
                  outerRadius="80%"
                  data={domainData}
                >
                  <PolarGrid stroke="#E2E8F0" strokeDasharray="4 4" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: "#94A3B8", fontSize: 13, fontWeight: 700 }}
                  />
                  <PolarRadiusAxis
                    domain={[0, 5]}
                    tick={false}
                    axisLine={false}
                  />
                  <Radar
                    name="Level Score"
                    dataKey="A"
                    stroke="#4F46E5"
                    strokeWidth={3}
                    fill="#4F46E5"
                    fillOpacity={0.15}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "24px",
                      border: "none",
                      boxShadow: "0 25px 50px -12px rgb(0 0 0 / 0.15)",
                      padding: "16px 20px",
                      background: "rgba(255, 255, 255, 0.9)",
                      backdropFilter: "blur(10px)",
                    }}
                    itemStyle={{ color: "#4F46E5", fontWeight: 800 }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-[2.5rem] border border-white p-10 shadow-xl shadow-slate-200/50 flex flex-col group transition-all duration-500">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
                    <Target size={20} />
                  </div>
                  วิเคราะห์รายประเด็น
                </h3>
                <p className="text-slate-400 text-sm mt-1 font-medium">
                  เปรียบเทียบผลลัพธ์ในหัวข้อคำถามย่อยทั้งหมด
                </p>
              </div>
            </div>

            {(() => {
              const sortedQuestions = [...questions].sort((a, b) => {
                const parseSection = (s: string) => s.split(".").map(Number);
                const aParts = parseSection(a.section);
                const bParts = parseSection(b.section);
                for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                  const valA = aParts[i] || 0;
                  const valB = bParts[i] || 0;
                  if (valA !== valB) return valA - valB;
                }
                return 0;
              });
              return (
                <>
                  <div className="flex-1 flex items-center justify-center min-h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart
                        cx="50%"
                        cy="50%"
                        outerRadius="75%"
                        data={sortedQuestions.map((q, i) => ({
                          subject: (i + 1).toString(),
                          A: q.score,
                          fullText: q.text,
                        }))}
                      >
                        <PolarGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                        <PolarAngleAxis
                          dataKey="subject"
                          tick={{ fill: "#64748B", fontSize: 11, fontWeight: 600 }}
                        />
                        <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
                        <Radar
                          name="Score"
                          dataKey="A"
                          stroke="#6366F1"
                          strokeWidth={3}
                          fill="#6366F1"
                          fillOpacity={0.2}
                        />
                        <Tooltip labelFormatter={(v, p) => `ข้อที่ ${v}: ${p[0]?.payload?.fullText}`} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-[2.5rem] border border-white shadow-xl shadow-slate-200/50 overflow-hidden group">
          <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600">
                  <FileText size={22} />
                </div>
                การวิเคราะห์เชิงลึก
              </h3>
              <p className="text-slate-400 text-sm mt-1 font-medium italic">
                ตารางรวมผลคะแนนแยกตามหัวข้อและประเด็นคำถามย่อย
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <div className="px-3 py-1 bg-white rounded-lg shadow-sm text-[10px] font-black uppercase text-indigo-600">
                  Rows: {questions.length}
                </div>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-8 py-5 font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] w-1/2">
                    หัวข้อและข้อคำถาม
                  </th>
                  <th className="px-8 py-5 font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] text-center w-40">
                    เกณฑ์คะแนน
                  </th>
                  <th className="px-8 py-5 font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] text-center w-32">
                    คะแนนเฉลี่ย
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {Object.entries(
                  questions.reduce((acc, q) => {
                    if (!acc[q.domain]) acc[q.domain] = [];
                    acc[q.domain].push(q);
                    return acc;
                  }, {} as Record<string, AssessmentItem[]>)
                ).map(([domain, domainQuestions], idx) => (
                  <React.Fragment key={domain}>
                    <tr className="bg-indigo-50/30">
                      <td colSpan={3} className="px-8 py-5">
                        <span className="text-sm font-black text-slate-800 uppercase tracking-tight">
                          {domain}
                        </span>
                      </td>
                    </tr>
                    {domainQuestions.map((q, i) => (
                      <tr key={`${idx}-${i}`} className="hover:bg-white group transition-all duration-300">
                        <td className="px-10 py-5 pl-16">
                          <div className="flex items-start gap-4">
                            <p className="text-slate-500 text-sm leading-relaxed font-medium group-hover:text-slate-900 transition-colors">
                              {q.text}
                            </p>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="w-full bg-slate-100/60 rounded-full h-2 overflow-hidden shadow-inner flex items-center px-0.5">
                            <div
                              className={`h-1 rounded-full transition-all duration-1000 ease-out shadow-sm ${
                                q.score >= 4.5 ? "bg-emerald-500 shadow-emerald-200"
                                : q.score >= 4.0 ? "bg-indigo-500 shadow-indigo-200"
                                : q.score >= 3.0 ? "bg-amber-500 shadow-amber-200" : "bg-rose-500 shadow-rose-200"
                              }`}
                              style={{ width: `${(q.score / 5) * 100}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <div className={`inline-flex items-center justify-center min-w-[3rem] px-3 py-1.5 rounded-2xl text-xs font-black shadow-sm group-hover:scale-110 transition-transform ${getScoreColor(q.score)}`}>
                            {q.score.toFixed(2)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {groupedFeedback.length > 0 && (
          <div className="bg-white/80 backdrop-blur-sm rounded-[2.5rem] border border-white shadow-xl shadow-slate-200/50 overflow-hidden group">
            <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                  <div className="p-2 bg-rose-100 rounded-xl text-rose-600">
                    <MessageSquare size={22} />
                  </div>
                  ข้อเสนอแนะเพิ่มเติม
                </h3>
                <p className="text-slate-400 text-sm mt-1 font-medium italic">
                  ความคิดเห็นและข้อเสนอแนะจากผู้ประเมิน
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <div className="px-3 py-1 bg-white rounded-lg shadow-sm text-[10px] font-black uppercase text-indigo-600">
                    Topics: {groupedFeedback.length}
                  </div>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto custom-scrollbar max-h-[600px] overflow-y-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                  <tr className="border-b border-slate-100">
                    <th className="px-8 py-5 font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] w-1/3">
                      ประเด็นคำถาม
                    </th>
                    <th className="px-8 py-5 font-black text-slate-400 text-[10px] uppercase tracking-[0.2em]">
                      ข้อเสนอแนะ
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {groupedFeedback.map((group) => (
                    <tr key={group.question_id} className="hover:bg-rose-50/10 transition-colors">
                      <td className="px-8 py-6 align-top">
                        <p className="text-sm font-bold text-slate-700 leading-relaxed max-w-[300px]">
                          {group.question_text}
                        </p>
                      </td>
                      <td className="px-8 py-6 align-top">
                        <div className="space-y-3">
                          {group.comments.map((comment, i) => (
                            <div key={i} className="flex gap-3">
                              <div className="p-3 bg-slate-50 rounded-2xl rounded-tl-none border border-slate-100 text-sm text-slate-600 leading-relaxed font-medium whitespace-pre-wrap w-full hover:bg-white hover:shadow-sm transition-all">
                                {comment}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
}
