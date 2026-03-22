"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
    Tooltip,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    LabelList,
} from "recharts";
import {
    FileText,
    Users,
    TrendingUp,
    AlertCircle,
    CheckCircle,
    Loader2,
    Calendar,
    MessageSquare,
    Target,
    Award,
    ChevronRight,
    Download,
    Building2,
    RefreshCw,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { formatRoundId } from "@/utils/round-formatter";

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

interface EntityScore {
    name: string;
    score: number;
}

interface MajorOption {
    id: number;
    name: string;
    faculty_id: number;
}

interface FacultyOption {
    id: number;
    name: string;
}

interface TeacherOption {
    id: string;
    name: string;
    major_id?: number;
}

interface GroupedFeedback {
    question_id: number;
    question_text: string;
    section: string;
    comments: string[];
}

export default function AdminIndividualPage() {
    const [loading, setLoading] = useState(true);
    const [rounds, setRounds] = useState<number[]>([]);
    const [selectedRound, setSelectedRound] = useState<number | null>(null);

    // Data State
    const [overallScore, setOverallScore] = useState(0);
    const [participatedStudents, setParticipatedStudents] = useState(0);
    const [participatedTeachers, setParticipatedTeachers] = useState(0);
    const [totalTeachersInSystem, setTotalTeachersInSystem] = useState(0);
    const [domainData, setDomainData] = useState<AssessmentDomain[]>([]);
    const [questions, setQuestions] = useState<AssessmentItem[]>([]);
    const [weaknesses, setWeaknesses] = useState<AssessmentItem[]>([]);
    const [strengths, setStrengths] = useState<AssessmentItem[]>([]);

    // Filter State
    const [faculties, setFaculties] = useState<FacultyOption[]>([]);
    const [selectedFaculty, setSelectedFaculty] = useState<number | null>(null);
    const [majors, setMajors] = useState<MajorOption[]>([]);
    const [selectedMajor, setSelectedMajor] = useState<number | null>(null);
    const [teachers, setTeachers] = useState<TeacherOption[]>([]);
    const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);

    const [peerData, setPeerData] = useState<(EntityScore & { isCurrent: boolean })[]>([]);
    const [groupedFeedback, setGroupedFeedback] = useState<GroupedFeedback[]>([]);

    const [supabase] = useState(() => createClient());
    const [isCalculating, setIsCalculating] = useState(false);

    // ── fetchData ────────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        if (!selectedRound) return;
        setLoading(true);
        try {
            const [
                { data: heads, error: headError },
                { data: details, error: detailError },
                { data: avgData, error: avgError },
                { data: facultiesData },
                { data: majorsData },
                { data: teachersData },
                { data: commentsData },
            ] = await Promise.all([
                supabase.from("assessment_head").select("*").eq("around_id", selectedRound).order("section1", { ascending: true }),
                supabase.from("assessment_detail").select("*").eq("around_id", selectedRound).order("id", { ascending: true }),
                supabase.from("avg_teacher").select("*").eq("around_id", selectedRound),
                supabase.from("faculties").select("id, faculty_name"),
                supabase.from("majors").select("id, major_name, faculty_id"),
                supabase.from("teachers").select("id, title_name, first_name, last_name, major_id"),
                selectedTeacher
                    ? supabase
                        .from("assessment_answer")
                        .select("id, text_value, question_id")
                        .eq("around_id", selectedRound)
                        .eq("teacher_id", selectedTeacher)
                        .not("text_value", "is", null)
                        .neq("text_value", "NULL")
                        .neq("text_value", "")
                    : Promise.resolve({ data: null, error: null }),
            ]);

            if (headError) throw headError;
            if (detailError) throw detailError;
            if (avgError) throw avgError;

            // ── 1. Maps พื้นฐาน ──────────────────────────────────────────────────
            if (facultiesData) setFaculties(facultiesData.map((f) => ({ id: f.id, name: f.faculty_name })));

            const majorToFaculty = new Map<number, number>();
            if (majorsData) {
                setMajors(majorsData.map((m) => ({ id: m.id, name: m.major_name, faculty_id: m.faculty_id })));
                majorsData.forEach((m) => majorToFaculty.set(m.id, m.faculty_id));
            }

            const teacherMap = new Map<string, string>();
            const teacherMajorMap = new Map<string, number>();
            if (teachersData) {
                const mapped = teachersData.map((t) => {
                    const fullName = `${t.title_name || ""}${t.first_name} ${t.last_name}`.trim();
                    teacherMap.set(t.id, fullName);
                    if (t.major_id) teacherMajorMap.set(t.id, t.major_id);
                    return { id: t.id, name: fullName, major_id: t.major_id };
                });
                mapped.sort((a, b) => a.name.localeCompare(b.name));
                setTeachers(mapped);
                setTotalTeachersInSystem(mapped.length);
            }

            // ── 2. โครงสร้างแบบประเมิน ───────────────────────────────────────────
            const detailMap = new Map<number, any>();
            const domainLabelMap = new Map<number, string>();
            details?.forEach((d: any) => {
                detailMap.set(d.id, d);
                if (d.type === "head") {
                    domainLabelMap.set(Math.floor(Number(d.section2)), d.detail);
                }
            });

            // ── 3. กรอง avg_teacher ตาม filter ──────────────────────────────────
            const filteredAvg = (avgData || []).filter((row: any) => {
                const tMajorId = teacherMajorMap.get(row.teacher_id);
                if (selectedTeacher) return row.teacher_id === selectedTeacher;
                if (selectedMajor) return tMajorId === selectedMajor;
                if (selectedFaculty) return tMajorId !== undefined && majorToFaculty.get(tMajorId) === selectedFaculty;
                return true;
            });

            // ── 4. Weighted Average ─────────────────────────────────────────────
            const questionStats = new Map<number, { weightedSum: number; totalResp: number }>();
            const teacherStats = new Map<string, { weightedSum: number; totalResp: number }>();
            let globalWeightedSum = 0;
            let globalTotalResp = 0;

            filteredAvg.forEach((row: any) => {
                const qId = Number(row.question_id);
                const tId = row.teacher_id;
                const avg = Number(row.total_score);
                const cnt = Number(row.respondent_count);
                const weighted = avg * cnt;

                if (!questionStats.has(qId)) questionStats.set(qId, { weightedSum: 0, totalResp: 0 });
                questionStats.get(qId)!.weightedSum += weighted;
                questionStats.get(qId)!.totalResp += cnt;

                if (!teacherStats.has(tId)) teacherStats.set(tId, { weightedSum: 0, totalResp: 0 });
                teacherStats.get(tId)!.weightedSum += weighted;
                teacherStats.get(tId)!.totalResp += cnt;

                globalWeightedSum += weighted;
                globalTotalResp += cnt;
            });

            // ── 5. processedQuestions + domainScores ─────────────────────────────
            const domainScores = new Map<number, { weightedSum: number; totalResp: number }>();
            const processedQuestions: AssessmentItem[] = [];

            details?.filter((d: any) => d.type === "score").forEach((d: any) => {
                const stats = questionStats.get(d.id) || { weightedSum: 0, totalResp: 0 };
                const avg = stats.totalResp > 0 ? stats.weightedSum / stats.totalResp : 0;
                const domainKey = Math.floor(Number(d.section2));
                const domainName = domainLabelMap.get(domainKey) || `ด้านที่ ${domainKey}`;

                if (!domainScores.has(domainKey)) domainScores.set(domainKey, { weightedSum: 0, totalResp: 0 });
                const dS = domainScores.get(domainKey)!;
                dS.weightedSum += stats.weightedSum;
                dS.totalResp += stats.totalResp;

                processedQuestions.push({
                    id: d.id,
                    section: d.section2.toString(),
                    domain: domainName,
                    text: d.detail,
                    score: Number(avg.toFixed(2)),
                });
            });

            // ── 6. Domain Data ───────────────────────────────────────────────────
            const finalDomainData: AssessmentDomain[] = Array.from(domainScores.entries())
                .map(([key, stats]) => {
                    const avg = stats.totalResp > 0 ? stats.weightedSum / stats.totalResp : 0;
                    const name = domainLabelMap.get(key) || `ด้านที่ ${key}`;
                    return { id: key.toString(), name, subject: name, score: Number(avg.toFixed(2)), fullMark: 5, A: Number(avg.toFixed(2)) };
                })
                .sort((a, b) => Number(a.id) - Number(b.id));

            // ── 7. Peer Comparison ───────────────────────────────────────────────
            let finalPeerData: (EntityScore & { isCurrent: boolean })[] = [];
            if (selectedTeacher) {
                const currentMajorId = teacherMajorMap.get(selectedTeacher);
                if (currentMajorId !== undefined) {
                    const peerAggr = new Map<string, { weightedSum: number; totalResp: number }>();
                    (avgData || []).forEach((row: any) => {
                        if (teacherMajorMap.get(row.teacher_id) !== currentMajorId) return;
                        if (!peerAggr.has(row.teacher_id)) peerAggr.set(row.teacher_id, { weightedSum: 0, totalResp: 0 });
                        const p = peerAggr.get(row.teacher_id)!;
                        p.weightedSum += Number(row.total_score) * Number(row.respondent_count);
                        p.totalResp += Number(row.respondent_count);
                    });
                    finalPeerData = Array.from(peerAggr.entries())
                        .map(([tId, s]) => ({
                            name: teacherMap.get(tId) || `Teacher ${tId}`,
                            score: s.totalResp > 0 ? Number((s.weightedSum / s.totalResp).toFixed(2)) : 0,
                            isCurrent: tId === selectedTeacher,
                        }))
                        .sort((a, b) => b.score - a.score);
                }
            }

            // ── 8. Comments ──────────────────────────────────────────────────────
            if (commentsData) {
                const feedbackMap = new Map<number, GroupedFeedback>();
                (commentsData as any[]).forEach((c) => {
                    if (!c.text_value?.trim()) return;
                    const detailRow = detailMap.get(c.question_id);
                    if (!feedbackMap.has(c.question_id)) {
                        feedbackMap.set(c.question_id, {
                            question_id: c.question_id,
                            question_text: detailRow?.detail || `คำถามรหัส ${c.question_id}`,
                            section: detailRow?.section2?.toString() || "-",
                            comments: [],
                        });
                    }
                    feedbackMap.get(c.question_id)!.comments.push(c.text_value);
                });
                setGroupedFeedback(
                    Array.from(feedbackMap.values()).sort((a, b) =>
                        a.section.localeCompare(b.section, undefined, { numeric: true })
                    )
                );
            } else {
                setGroupedFeedback([]);
            }

            // ── 9. Update States ─────────────────────────────────────────────────
            const finalOverall = globalTotalResp > 0 ? globalWeightedSum / globalTotalResp : 0;
            const numScoreQ = details?.filter((d: any) => d.type === "score").length || 1;
            const estimatedRespondents = selectedTeacher
                ? (questionStats.values().next().value?.totalResp || 0)
                : Math.round(globalTotalResp / numScoreQ);

            setOverallScore(Number(finalOverall.toFixed(2)));
            setParticipatedStudents(estimatedRespondents);
            setParticipatedTeachers(teacherStats.size);
            setDomainData(finalDomainData);
            setQuestions(processedQuestions);
            setPeerData(finalPeerData);
            const sortedItems = [...processedQuestions].sort((a, b) => b.score - a.score);
            setStrengths(sortedItems.slice(0, 3));
            setWeaknesses(sortedItems.slice(-3).reverse());
        } catch (err) {
            console.error("Error fetching individual data:", err);
        } finally {
            setLoading(false);
        }
    }, [selectedRound, selectedFaculty, selectedMajor, selectedTeacher, supabase]);

    // ── Effects ──────────────────────────────────────────────────────────────
    useEffect(() => {
        const fetchRounds = async () => {
            const { data, error } = await supabase.from("assessment_head").select("around_id").order("around_id", { ascending: false });
            if (data) {
                const uniqueRounds = Array.from(new Set(data.map((item) => item.around_id)));
                setRounds(uniqueRounds);
                if (uniqueRounds.length > 0 && !selectedRound) setSelectedRound(uniqueRounds[0]);
            }
            if (error) console.error("Error fetching rounds:", error);
        };
        fetchRounds();
    }, [selectedRound, supabase]);

    // Initialize selectedFaculty once faculties are loaded
    useEffect(() => {
        if (faculties.length > 0 && !selectedFaculty) {
            setSelectedFaculty(faculties[0].id);
        }
    }, [faculties, selectedFaculty]);

    // Auto-select major when faculty changes
    useEffect(() => {
        if (selectedFaculty && majors.length > 0) {
            const available = majors.filter((m) => m.faculty_id === selectedFaculty);
            if (available.length > 0) {
                const isValid = available.some((m) => m.id === selectedMajor);
                if (!isValid) setSelectedMajor(available[0].id);
            } else {
                setSelectedMajor(null);
            }
        } else if (!selectedFaculty) {
            setSelectedMajor(null);
        }
    }, [selectedFaculty, majors]);

    // Auto-select teacher when major changes
    useEffect(() => {
        if (selectedMajor && teachers.length > 0) {
            const available = teachers.filter((t) => t.major_id === selectedMajor);
            if (available.length > 0) {
                const isValid = available.some((t) => t.id === selectedTeacher);
                if (!isValid) setSelectedTeacher(available[0].id);
            } else {
                setSelectedTeacher(null);
            }
        } else if (!selectedMajor) {
            setSelectedTeacher(null);
        }
    }, [selectedMajor, teachers]);

    useEffect(() => {
        if (selectedRound) fetchData();
    }, [fetchData, selectedRound, selectedFaculty, selectedMajor, selectedTeacher]);

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
            {/* Background */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "2s" }} />
            </div>

            {/* Nav Header */}
            <div className="bg-white/70 backdrop-blur-xl border-b border-white/40 sticky top-0 z-40 px-4 md:px-6 py-4 shadow-sm">
                <div className="max-w-7xl mx-auto flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl text-white shadow-lg shadow-blue-500/20 shrink-0">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-800 to-slate-600">
                                Dashboard อาจารย์รายบุคคล
                            </h1>
                            <p className="text-slate-400 text-xs md:text-sm font-medium">สถิติและผลการประเมินรายบุคคล (Admin View)</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto overflow-x-auto pb-1 sm:pb-0">
                        {/* Faculty Dropdown */}
                        <div className="relative group min-w-[170px]">
                            <select
                                value={selectedFaculty || ""}
                                onChange={(e) => { setSelectedFaculty(e.target.value ? Number(e.target.value) : null); setSelectedMajor(null); setSelectedTeacher(null); }}
                                className="w-full appearance-none pl-11 pr-10 py-3 bg-white border border-slate-200/60 rounded-2xl text-sm font-bold text-slate-700 shadow-sm hover:border-indigo-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
                            >
                                {faculties.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none rotate-90 group-hover:text-indigo-500 transition-colors" />
                        </div>

                        {/* Major Dropdown */}
                        <div className="relative group min-w-[170px]">
                            <select
                                value={selectedMajor || ""}
                                onChange={(e) => { setSelectedMajor(e.target.value ? Number(e.target.value) : null); setSelectedTeacher(null); }}
                                className="w-full appearance-none pl-11 pr-10 py-3 bg-white border border-slate-200/60 rounded-2xl text-sm font-bold text-slate-700 shadow-sm hover:border-indigo-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
                            >
                                {majors.filter((m) => !selectedFaculty || m.faculty_id === selectedFaculty).map((m) => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none rotate-90 group-hover:text-indigo-500 transition-colors" />
                        </div>

                        {/* Teacher Dropdown */}
                        <div className="relative group min-w-[180px]">
                            <select
                                value={selectedTeacher || ""}
                                onChange={(e) => setSelectedTeacher(e.target.value || null)}
                                className="w-full appearance-none pl-11 pr-10 py-3 bg-white border border-slate-200/60 rounded-2xl text-sm font-bold text-slate-700 shadow-sm hover:border-indigo-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
                            >
                                {teachers.filter((t) => !selectedMajor || t.major_id === selectedMajor).map((t) => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                            <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none rotate-90 group-hover:text-indigo-500 transition-colors" />
                        </div>

                        {/* Round Dropdown */}
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

                        {/* Export Button */}
                        <button
                            onClick={() => {
                                if (selectedRound) {
                                    const printData = { overallScore, participatedStudents, domainData, questions, strengths, weaknesses, peerData, groupedFeedback, selectedTeacher, timestamp: Date.now() };
                                    localStorage.setItem("printData_admin_individual", JSON.stringify(printData));
                                    const url = `/dashboard-admin/overview/individual/print?round=${selectedRound}${selectedTeacher ? `&teacher=${selectedTeacher}` : ""}`;
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
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Overall Score Card */}
                    <div className="bg-white/80 backdrop-blur-sm p-8 rounded-[2.5rem] border border-white shadow-xl shadow-slate-200/50 relative overflow-hidden group hover:translate-y-[-4px] transition-all duration-500">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-blue-500/10 transition-colors duration-700" />
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-8">
                                <div className="p-4 bg-blue-50 rounded-2xl text-blue-600 shadow-inner group-hover:scale-110 transition-transform duration-500">
                                    <Award size={32} />
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-xs font-black uppercase tracking-widest px-3 py-1 bg-blue-50 text-blue-600 rounded-full mb-1">Performance</span>
                                    <span className="text-[10px] font-bold text-slate-400">Score Rating</span>
                                </div>
                            </div>
                            <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">คะแนนเฉลี่ยรวม</p>
                            <div className="flex items-baseline gap-3 mt-2">
                                <h1 className="text-6xl font-black text-slate-900 tracking-tighter transition-all group-hover:text-blue-600">
                                    {overallScore.toFixed(2)}
                                </h1>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-1 text-emerald-500 text-xs font-bold bg-emerald-50 px-2 py-0.5 rounded-lg mt-1">
                                        <TrendingUp size={12} />
                                        <span>Score / 5</span>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-8 grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-3xl bg-slate-50 border border-slate-100/50 group-hover:bg-blue-50/50 transition-colors">
                                    <p className="text-[10px] font-black text-slate-400 uppercase">อาจารย์</p>
                                    <p className="text-sm font-bold text-slate-700">{participatedTeachers} คน</p>
                                </div>
                                <div className="p-4 rounded-3xl bg-slate-50 border border-slate-100/50 group-hover:bg-blue-50/50 transition-colors">
                                    <p className="text-[10px] font-black text-slate-400 uppercase">Total</p>
                                    <p className="text-sm font-bold text-slate-700">{totalTeachersInSystem} คน</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Respondents Card */}
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
                                    <span className="text-[10px] font-bold text-slate-400">Participation</span>
                                </div>
                            </div>
                            <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">จำนวนผู้ประเมิน (ประมาณ)</p>
                            <div className="flex items-baseline gap-3 mt-2">
                                <h1 className="text-6xl font-black text-slate-900 tracking-tighter transition-all group-hover:text-violet-600">
                                    {participatedStudents.toLocaleString()}
                                </h1>
                                <div className="flex flex-col">
                                    <span className="text-xl text-slate-300 font-bold">Students</span>
                                </div>
                            </div>
                            <div className="mt-8">
                                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5">
                                    <div className="h-full bg-gradient-to-r from-violet-400 to-indigo-600 rounded-full transition-all duration-1000 ease-out animate-pulse" style={{ width: "100%" }} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Strengths & Weaknesses */}
                {(strengths.length > 0 || weaknesses.length > 0) && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-emerald-50/50 backdrop-blur-sm p-8 rounded-[2.5rem] border border-emerald-100/50 shadow-lg shadow-emerald-100/20 group transition-all duration-500 hover:shadow-emerald-200/40">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600"><TrendingUp size={20} /></div>
                                <h3 className="text-lg font-black text-slate-800">จุดแข็ง (Top 3 Strengths)</h3>
                            </div>
                            <div className="space-y-4">
                                {strengths.map((item, i) => (
                                    <div key={i} className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-100/50 flex items-center justify-between gap-4 transition-transform hover:scale-[1.02]">
                                        <p className="text-sm font-bold text-slate-700 line-clamp-2">{item.text}</p>
                                        <span className="flex-shrink-0 text-lg font-black text-emerald-600">{item.score.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-rose-50/50 backdrop-blur-sm p-8 rounded-[2.5rem] border border-rose-100/50 shadow-lg shadow-rose-100/20 group transition-all duration-500 hover:shadow-rose-200/40">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-rose-100 rounded-xl text-rose-600"><AlertCircle size={20} /></div>
                                <h3 className="text-lg font-black text-slate-800">สิ่งที่ควรพัฒนา (Improvements)</h3>
                            </div>
                            <div className="space-y-4">
                                {weaknesses.map((item, i) => (
                                    <div key={i} className="bg-white p-4 rounded-2xl shadow-sm border border-rose-100/50 flex items-center justify-between gap-4 transition-transform hover:scale-[1.02]">
                                        <p className="text-sm font-bold text-slate-700 line-clamp-2">{item.text}</p>
                                        <span className="flex-shrink-0 text-lg font-black text-rose-600">{item.score.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Radar Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Domain Radar */}
                    <div className="bg-white/80 backdrop-blur-sm rounded-[2.5rem] border border-white p-10 shadow-xl shadow-slate-200/50 flex flex-col group transition-all duration-500">
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 rounded-xl text-blue-600"><TrendingUp size={20} /></div>
                                    จุดแข็ง-จุดอ่อน (รายด้าน)
                                </h3>
                                <p className="text-slate-400 text-sm mt-1 font-medium">วิเคราะห์คะแนนเฉลี่ยในแต่ละด้านของการประเมิน</p>
                            </div>
                        </div>
                        <div className="flex-1 flex items-center justify-center min-h-[380px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={domainData}>
                                    <PolarGrid stroke="#E2E8F0" strokeDasharray="4 4" />
                                    <PolarAngleAxis dataKey="subject" tick={{ fill: "#94A3B8", fontSize: 13, fontWeight: 700 }} />
                                    <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
                                    <Radar name="Level Score" dataKey="A" stroke="#4F46E5" strokeWidth={3} fill="#4F46E5" fillOpacity={0.15} />
                                    <Tooltip contentStyle={{ borderRadius: "24px", border: "none", boxShadow: "0 25px 50px -12px rgb(0 0 0 / 0.15)", padding: "16px 20px", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(10px)" }} itemStyle={{ color: "#4F46E5", fontWeight: 800 }} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-10 pt-8 border-t border-slate-50 grid grid-cols-1 gap-6">
                            {domainData.map((d, i) => (
                                <div key={i} className="flex items-start gap-4 group/item">
                                    <p className="text-sm text-slate-600 font-bold group-hover/item:text-slate-900 transition-colors uppercase leading-tight">{d.name}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Question Radar */}
                    <div className="bg-white/80 backdrop-blur-sm rounded-[2.5rem] border border-white p-10 shadow-xl shadow-slate-200/50 flex flex-col group transition-all duration-500">
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                                    <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600"><Target size={20} /></div>
                                    วิเคราะห์รายประเด็น
                                </h3>
                                <p className="text-slate-400 text-sm mt-1 font-medium">เปรียบเทียบผลลัพธ์ในหัวข้อคำถามย่อยทั้งหมด</p>
                            </div>
                        </div>
                        {(() => {
                            const sortedQuestions = [...questions].sort((a, b) => {
                                const parseSection = (s: string) => s.split(".").map(Number);
                                const aParts = parseSection(a.section);
                                const bParts = parseSection(b.section);
                                for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                                    const diff = (aParts[i] || 0) - (bParts[i] || 0);
                                    if (diff !== 0) return diff;
                                }
                                return 0;
                            });
                            return (
                                <>
                                    <div className="flex-1 flex items-center justify-center min-h-[350px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={sortedQuestions.map((q, i) => ({ subject: (i + 1).toString(), A: q.score, fullText: q.text }))}>
                                                <PolarGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                                                <PolarAngleAxis dataKey="subject" tick={{ fill: "#64748B", fontSize: 11, fontWeight: 600 }} />
                                                <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
                                                <Radar name="Score" dataKey="A" stroke="#6366F1" strokeWidth={3} fill="#6366F1" fillOpacity={0.2} />
                                                <Tooltip labelFormatter={(v, p) => `ข้อที่ ${v}: ${p[0]?.payload?.fullText}`} />
                                            </RadarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="mt-8 pt-6 border-t border-slate-100">
                                        <div className="space-y-3">
                                            {sortedQuestions.map((q, i) => (
                                                <div key={i} className="flex items-start gap-3 text-sm group hover:bg-slate-50 p-2 rounded-lg transition-colors">
                                                    <span className="text-slate-600 group-hover:text-slate-900 transition-colors">{q.text}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>

                {/* Peer Comparison Bar Chart */}
                {peerData.length > 0 && (
                    <div className="bg-white/80 backdrop-blur-sm rounded-[2.5rem] border border-white p-10 shadow-xl shadow-slate-200/50">
                        <div className="mb-8">
                            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                                <div className="p-2 bg-amber-100 rounded-xl text-amber-600"><Users size={20} /></div>
                                เปรียบเทียบในสาขาเดียวกัน (Peer Comparison)
                            </h3>
                            <p className="text-slate-400 text-sm mt-1 font-medium">คะแนนเฉลี่ยของอาจารย์ทุกคนในสาขาเดียวกัน</p>
                        </div>
                        <ResponsiveContainer width="100%" height={Math.max(200, peerData.length * 48)}>
                            <BarChart data={peerData} layout="vertical" margin={{ left: 20, right: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                                <XAxis type="number" domain={[0, 5]} tick={{ fill: "#94A3B8", fontSize: 11 }} />
                                <YAxis type="category" dataKey="name" width={140} tick={{ fill: "#64748B", fontSize: 12, fontWeight: 600 }} />
                                <Tooltip contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }} />
                                <Bar dataKey="score" radius={[0, 8, 8, 0]}>
                                    {peerData.map((entry, index) => (
                                        <rect key={index} fill={entry.isCurrent ? "#4F46E5" : "#E0E7FF"} />
                                    ))}
                                    <LabelList dataKey="score" position="right" style={{ fill: "#64748B", fontSize: 12, fontWeight: 700 }} formatter={((v: unknown) => (typeof v === "number" ? v.toFixed(2) : String(v ?? ""))) as any} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Detailed Table */}
                <div className="bg-white/80 backdrop-blur-sm rounded-[2.5rem] border border-white shadow-xl shadow-slate-200/50 overflow-hidden group">
                    <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600"><FileText size={22} /></div>
                                การวิเคราะห์เชิงลึก
                            </h3>
                            <p className="text-slate-400 text-sm mt-1 font-medium italic">ตารางรวมผลคะแนนแยกตามหัวข้อและประเด็นคำถามย่อย</p>
                        </div>
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            <div className="px-3 py-1 bg-white rounded-lg shadow-sm text-[10px] font-black uppercase text-indigo-600">Rows: {questions.length}</div>
                        </div>
                    </div>
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[900px]">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-8 py-5 font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] w-1/2">หัวข้อและข้อคำถาม</th>
                                    <th className="px-8 py-5 font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] text-center w-40">เกณฑ์คะแนน</th>
                                    <th className="px-8 py-5 font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] text-center w-32">คะแนนเฉลี่ย</th>
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
                                                <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{domain}</span>
                                            </td>
                                        </tr>
                                        {domainQuestions.map((q, i) => (
                                            <tr key={`${idx}-${i}`} className="hover:bg-white group transition-all duration-300">
                                                <td className="px-10 py-5 pl-16">
                                                    <p className="text-slate-500 text-sm leading-relaxed font-medium group-hover:text-slate-900 transition-colors">{q.text}</p>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="w-full bg-slate-100/60 rounded-full h-2 overflow-hidden shadow-inner flex items-center px-0.5">
                                                        <div
                                                            className={`h-1 rounded-full transition-all duration-1000 ease-out shadow-sm ${q.score >= 4.5 ? "bg-emerald-500" : q.score >= 4.0 ? "bg-indigo-500" : q.score >= 3.0 ? "bg-amber-500" : "bg-rose-500"}`}
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

                {/* Comments */}
                {groupedFeedback.length > 0 && (
                    <div className="bg-white/80 backdrop-blur-sm rounded-[2.5rem] border border-white shadow-xl shadow-slate-200/50 overflow-hidden group">
                        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                                    <div className="p-2 bg-rose-100 rounded-xl text-rose-600"><MessageSquare size={22} /></div>
                                    ข้อเสนอแนะเพิ่มเติม
                                </h3>
                                <p className="text-slate-400 text-sm mt-1 font-medium italic">ความคิดเห็นและข้อเสนอแนะจากผู้ประเมิน</p>
                            </div>
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                <div className="px-3 py-1 bg-white rounded-lg shadow-sm text-[10px] font-black uppercase text-indigo-600">Topics: {groupedFeedback.length}</div>
                            </div>
                        </div>
                        <div className="overflow-x-auto custom-scrollbar max-h-[600px] overflow-y-auto">
                            <table className="w-full text-left border-collapse min-w-[700px]">
                                <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                                    <tr className="border-b border-slate-100">
                                        <th className="px-8 py-5 font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] w-1/3">ประเด็นคำถาม</th>
                                        <th className="px-8 py-5 font-black text-slate-400 text-[10px] uppercase tracking-[0.2em]">ข้อเสนอแนะ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {groupedFeedback.map((group) => (
                                        <tr key={group.question_id} className="hover:bg-rose-50/10 transition-colors">
                                            <td className="px-8 py-6 align-top">
                                                <p className="text-sm font-bold text-slate-700 leading-relaxed max-w-[300px]">{group.question_text}</p>
                                            </td>
                                            <td className="px-8 py-6 align-top">
                                                <div className="space-y-3">
                                                    {group.comments.map((comment, i) => (
                                                        <div key={i} className="p-3 bg-slate-50 rounded-2xl rounded-tl-none border border-slate-100 text-sm text-slate-600 leading-relaxed font-medium whitespace-pre-wrap hover:bg-white hover:shadow-sm transition-all">
                                                            {comment}
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