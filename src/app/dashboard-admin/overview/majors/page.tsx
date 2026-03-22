"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
    LabelList
} from 'recharts';
import {
    FileText,
    TrendingUp,
    CheckCircle,
    Loader2,
    Calendar,
    Target,
    Award,
    ChevronRight,
    Download,
    Building2
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { formatRoundId } from '@/utils/round-formatter';

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

export default function Overview() {
    const [loading, setLoading] = useState(true);
    const [rounds, setRounds] = useState<number[]>([]);
    const [selectedRound, setSelectedRound] = useState<number | null>(null);

    // Data State
    const [overallScore, setOverallScore] = useState(0);
    const [participatedStudents, setParticipatedStudents] = useState(0);
    const [participatedTeachers, setParticipatedTeachers] = useState(0);
    const [totalStudentsInSystem, setTotalStudentsInSystem] = useState(0);
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
    const [chartData, setChartData] = useState<EntityScore[]>([]);

    const [supabase] = useState(() => createClient());

    const fetchData = useCallback(async () => {
        if (!selectedRound) return;
        setLoading(true);
        try {
            // 🚀 ดึงข้อมูลจากตารางสรุปผล (Summary Tables) เป็นหลัก
            const [
                { data: heads },
                { data: details },
                { data: avgMajorData, error: avgError },
                { data: facultiesData },
                { data: majorsData },
                { data: teachersData },
                { data: avgTeacherData }
            ] = await Promise.all([
                supabase.from('assessment_head').select('*').eq('around_id', selectedRound).order('section1', { ascending: true }),
                supabase.from('assessment_detail').select('*').eq('around_id', selectedRound).order('id', { ascending: true }),
                supabase.from('avg_major').select('*').eq('around_id', selectedRound),
                supabase.from('faculties').select('id, faculty_name'),
                supabase.from('majors').select('id, major_name, faculty_id'),
                supabase.from('teachers').select('id, title_name, first_name, last_name, major_id'),
                selectedMajor
                    ? supabase.from('avg_teacher').select('*').eq('around_id', selectedRound)
                    : Promise.resolve({ data: null, error: null })
            ]);

            if (avgError) throw avgError;

            // --- 1. เตรียม Map ข้อมูลพื้นฐาน ---
            const facultyMap = new Map(facultiesData?.map(f => [f.id, f.faculty_name] as [number, string]));
            const majorMap = new Map(majorsData?.map(m => [m.id, m.major_name] as [number, string]));
            const majorToFaculty = new Map(majorsData?.map(m => [m.id, m.faculty_id] as [number, number]));
            const teacherMap = new Map(teachersData?.map(t => [t.id, `${t.title_name || ''}${t.first_name} ${t.last_name}`.trim()] as [string, string]));

            if (facultiesData) setFaculties(facultiesData.map(f => ({ id: f.id, name: f.faculty_name })));
            if (majorsData) setMajors(majorsData.map(m => ({ id: m.id, name: m.major_name, faculty_id: m.faculty_id })));

            // --- 2. กรองข้อมูลตาม Filter (Faculty / Major) ---
            const filteredAvgData = avgMajorData?.filter((row: any) => {
                if (selectedMajor) return row.major_id === selectedMajor;
                if (selectedFaculty) return majorToFaculty.get(row.major_id) === selectedFaculty;
                return true;
            }) || [];

            // --- 3. คำนวณคะแนนเฉลี่ย (Weighted Average Logic) ---
            const questionStats = new Map<number, { weightedSum: number; totalResp: number }>();
            const majorSummary = new Map<number, { weightedSum: number; totalResp: number }>();
            let grandWeightedSum = 0;
            let grandTotalResp = 0;

            filteredAvgData.forEach((row: any) => {
                const avg = Number(row.total_score);
                const count = Number(row.respondent_count);
                const qId = row.question_id;
                const mId = row.major_id;
                const weightedScore = avg * count;

                if (!questionStats.has(qId)) questionStats.set(qId, { weightedSum: 0, totalResp: 0 });
                questionStats.get(qId)!.weightedSum += weightedScore;
                questionStats.get(qId)!.totalResp += count;

                if (!majorSummary.has(mId)) majorSummary.set(mId, { weightedSum: 0, totalResp: 0 });
                majorSummary.get(mId)!.weightedSum += weightedScore;
                majorSummary.get(mId)!.totalResp += count;

                grandWeightedSum += weightedScore;
                grandTotalResp += count;
            });

            // --- 4. จัดเตรียมข้อมูลสำหรับ UI ---

            // 4.1 ข้อมูลกราฟแท่ง
            let computedChartData: EntityScore[] = [];
            if (selectedMajor && avgTeacherData) {
                // กรณีเลือกสาขา ให้โชว์คะแนนรายอาจารย์
                const teacherStats = new Map<string, { weightedSum: number; totalResp: number }>();
                (avgTeacherData as any[]).forEach(row => {
                    const tId = row.teacher_id;
                    const avg = Number(row.total_score);
                    const count = Number(row.respondent_count);
                    if (!teacherStats.has(tId)) teacherStats.set(tId, { weightedSum: 0, totalResp: 0 });
                    teacherStats.get(tId)!.weightedSum += avg * count;
                    teacherStats.get(tId)!.totalResp += count;
                });

                computedChartData = Array.from(teacherStats.entries()).map(([tId, s]) => ({
                    name: teacherMap.get(tId) || 'ไม่ระบุชื่อ',
                    score: s.totalResp > 0 ? Number((s.weightedSum / s.totalResp).toFixed(2)) : 0
                }));
            } else {
                // กรณีทั่วไป โชว์คะแนนรายสาขา
                computedChartData = Array.from(majorSummary.entries()).map(([mId, s]) => ({
                    name: majorMap.get(mId) || `สาขา ${mId}`,
                    score: s.totalResp > 0 ? Number((s.weightedSum / s.totalResp).toFixed(2)) : 0
                }));
            }
            setChartData(computedChartData.sort((a, b) => b.score - a.score));

            // 4.2 ข้อมูลรายข้อและรายด้าน
            const domainMap = new Map(heads?.map((h: any) => [h.section1, h.head_description || h.description] as [number, string]));
            const detailTitleMap = new Map(
                details?.filter((d: any) => d.type !== 'score')
                    .map((d: any) => [`${d.section1}-${Math.floor(Number(d.section2))}`, d.detail] as [string, string])
            );

            const processedQuestions: AssessmentItem[] = details?.filter((d: any) => d.type === 'score').map((d: any) => {
                const stats = questionStats.get(d.id) || { weightedSum: 0, totalResp: 0 };
                const avg = stats.totalResp > 0 ? stats.weightedSum / stats.totalResp : 0;
                const domainKey = Math.floor(Number(d.section2));
                const domainName = detailTitleMap.get(`${d.section1}-${domainKey}`) || domainMap.get(d.section1) || `ด้านที่ ${domainKey}`;
                return {
                    id: d.id,
                    section: d.section2.toString(),
                    domain: domainName,
                    text: d.detail,
                    score: Number(avg.toFixed(2))
                };
            }) || [];

            // 4.3 คำนวณ Domain Radar
            const domainScores = new Map<string, { sum: number; count: number }>();
            processedQuestions.forEach(q => {
                if (!domainScores.has(q.domain)) domainScores.set(q.domain, { sum: 0, count: 0 });
                domainScores.get(q.domain)!.sum += q.score;
                domainScores.get(q.domain)!.count += 1;
            });

            const finalDomainData: AssessmentDomain[] = Array.from(domainScores.entries()).map(([name, s]) => ({
                id: name,
                name: name,
                subject: name.length > 15 ? name.substring(0, 15) + '...' : name,
                score: s.count > 0 ? Number((s.sum / s.count).toFixed(2)) : 0,
                fullMark: 5,
                A: s.count > 0 ? Number((s.sum / s.count).toFixed(2)) : 0
            }));

            // --- 5. อัปเดต State สุดท้าย ---
            setOverallScore(grandTotalResp > 0 ? Number((grandWeightedSum / grandTotalResp).toFixed(2)) : 0);
            setParticipatedTeachers(computedChartData.length);
            setTotalTeachersInSystem(teachersData?.length || 0);
            setDomainData(finalDomainData);
            setQuestions(processedQuestions);
            setStrengths([...processedQuestions].sort((a, b) => b.score - a.score).slice(0, 3));
            setWeaknesses([...processedQuestions].sort((a, b) => a.score - b.score).slice(0, 3));

        } catch (err) {
            console.error("Error fetching overview data:", err);
        } finally {
            setLoading(false);
        }
    }, [selectedRound, selectedFaculty, selectedMajor, supabase]);

    useEffect(() => {
        const fetchRounds = async () => {
            const { data, error } = await supabase
                .from('assessment_head')
                .select('around_id')
                .order('around_id', { ascending: false });

            if (data) {
                const uniqueRounds = Array.from(new Set(data.map(item => item.around_id)));
                setRounds(uniqueRounds);
                if (uniqueRounds.length > 0 && !selectedRound) {
                    setSelectedRound(uniqueRounds[0]);
                }
            }
            if (error) console.error("Error fetching rounds:", error);
        };
        fetchRounds();
    }, [selectedRound, supabase]);

    useEffect(() => {
        if (faculties.length > 0 && !selectedFaculty) {
            setSelectedFaculty(faculties[0].id);
        }
    }, [faculties, selectedFaculty]);

    useEffect(() => {
        if (selectedFaculty && majors.length > 0) {
            const availableMajors = majors.filter(m => m.faculty_id === selectedFaculty);
            if (availableMajors.length > 0) {
                const currentIsValid = availableMajors.some(m => m.id === selectedMajor);
                if (!currentIsValid) {
                    setSelectedMajor(availableMajors[0].id);
                }
            } else {
                setSelectedMajor(null);
            }
        }
    }, [selectedFaculty, majors, selectedMajor]);

    useEffect(() => {
        if (selectedRound) {
            fetchData();
        }
    }, [fetchData, selectedRound, selectedMajor, selectedFaculty]);

    const getScoreColor = (score: number) => {
        if (score >= 4.5) return 'text-emerald-500 bg-emerald-500/10';
        if (score >= 4.0) return 'text-sky-500 bg-sky-500/10';
        if (score >= 3.0) return 'text-amber-500 bg-amber-500/10';
        return 'text-rose-500 bg-rose-500/10';
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
            {/* Background Decorative Elements */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            {/* Nav Header */}
            <div className="bg-white/70 backdrop-blur-xl border-b border-white/40 sticky top-0 z-40 px-4 md:px-6 py-4 transition-all shadow-sm">
                <div className="max-w-7xl mx-auto flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl text-white shadow-lg shadow-blue-500/20 shrink-0">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-800 to-slate-600">
                                Dashboard สาขาวิชา
                            </h1>
                            <p className="text-slate-400 text-xs md:text-sm font-medium">สถิติและผลการประเมินประจำปี (รายสาขา)</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto overflow-x-auto pb-1 sm:pb-0">

                        <div className="relative group min-w-[200px]">
                            <select
                                value={selectedFaculty || ''}
                                onChange={(e) => {
                                    setSelectedFaculty(e.target.value ? Number(e.target.value) : null);
                                    setSelectedMajor(null);
                                }}
                                className="w-full appearance-none pl-11 pr-10 py-3 bg-white border border-slate-200/60 rounded-2xl text-sm font-bold text-slate-700 shadow-sm hover:border-indigo-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
                            >
                                {faculties.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none rotate-90 group-hover:text-indigo-500 transition-colors" />
                        </div>

                        <div className="relative group min-w-[200px]">
                            <select
                                value={selectedMajor || ''}
                                onChange={(e) => setSelectedMajor(e.target.value ? Number(e.target.value) : null)}
                                className="w-full appearance-none pl-11 pr-10 py-3 bg-white border border-slate-200/60 rounded-2xl text-sm font-bold text-slate-700 shadow-sm hover:border-indigo-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
                            >
                                {majors
                                    .filter(m => !selectedFaculty || m.faculty_id === selectedFaculty)
                                    .map(m => <option key={m.id} value={m.id}>{m.name}</option>)
                                }
                            </select>
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none rotate-90 group-hover:text-indigo-500 transition-colors" />
                        </div>

                        <div className="relative group min-w-[200px]">
                            <select
                                value={selectedRound || ''}
                                onChange={(e) => setSelectedRound(Number(e.target.value))}
                                className="w-full appearance-none pl-11 pr-10 py-3 bg-white border border-slate-200/60 rounded-2xl text-sm font-bold text-slate-700 shadow-sm hover:border-indigo-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
                            >
                                {rounds.map(r => <option key={r} value={r}>{formatRoundId(r)}</option>)}
                            </select>
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none rotate-90 group-hover:text-indigo-500 transition-colors" />
                        </div>

                        <button
                            onClick={() => {
                                if (selectedRound) {
                                    const printData = {
                                        overallScore,
                                        participatedTeachers,
                                        totalTeachersInSystem,
                                        domainData,
                                        questions,
                                        chartData,
                                        selectedFaculty,
                                        selectedMajor,
                                        timestamp: Date.now()
                                    };
                                    localStorage.setItem('printData_majors', JSON.stringify(printData));
                                    const url = `/dashboard-admin/overview/majors/print?round=${selectedRound}${selectedFaculty ? `&faculty=${selectedFaculty}` : ''}${selectedMajor ? `&major=${selectedMajor}` : ''}`;
                                    window.open(url, '_blank');
                                }
                            }}
                            className="flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:bg-slate-800 hover:shadow-xl hover:shadow-slate-900/20 active:scale-95 transition-all w-full sm:w-auto shrink-0 whitespace-nowrap"
                        >
                            <Download size={18} />
                            <span>Export Data</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 md:px-8 pt-8 md:pt-10 space-y-10 relative z-10">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                                        <span>Good</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-3xl bg-slate-50 border border-slate-100/50 group-hover:bg-blue-50/50 transition-colors">
                                    <p className="text-[10px] font-black text-slate-400 uppercase">Growth</p>
                                    <p className="text-sm font-bold text-slate-700">Stable</p>
                                </div>
                                <div className="p-4 rounded-3xl bg-slate-50 border border-slate-100/50 group-hover:bg-blue-50/50 transition-colors">
                                    <p className="text-[10px] font-black text-slate-400 uppercase">Status</p>
                                    <p className="text-sm font-bold text-slate-700">Excellent</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/80 backdrop-blur-sm p-8 rounded-[2.5rem] border border-white shadow-xl shadow-slate-200/50 relative overflow-hidden group hover:translate-y-[-4px] transition-all duration-500">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-violet-500/5 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-violet-500/10 transition-colors duration-700" />
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-8">
                                <div className="p-4 bg-violet-50 rounded-2xl text-violet-600 shadow-inner group-hover:scale-110 transition-transform duration-500">
                                    <Building2 size={32} />
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-bold text-slate-400">Assessment Coverage</span>
                                </div>
                            </div>
                            <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Respondent Count</p>
                            <div className="flex items-baseline gap-3 mt-2">
                                <h1 className="text-6xl font-black text-slate-900 tracking-tighter transition-all group-hover:text-violet-600">
                                    {participatedTeachers.toLocaleString()}
                                </h1>
                                <div className="flex flex-col">
                                    <span className="text-xl text-slate-300 font-bold">/ {totalTeachersInSystem.toLocaleString()}</span>
                                    <span className="text-xs font-bold text-slate-400 mt-1">Total Mentors</span>
                                </div>
                            </div>

                            <div className="mt-8">
                                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5">
                                    <div
                                        className="h-full bg-gradient-to-r from-violet-400 to-indigo-600 rounded-full transition-all duration-1000 ease-out"
                                        style={{ width: `${(participatedTeachers / (totalTeachersInSystem || 1)) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Radar Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Domain Radar */}
                    <div className="bg-white/80 backdrop-blur-sm rounded-[2.5rem] border border-white p-10 shadow-xl shadow-slate-200/50 flex flex-col group transition-all duration-500">
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 rounded-xl text-blue-600">
                                        <TrendingUp size={20} />
                                    </div>
                                    จุดแข็ง-จุดอ่อน (รายด้าน)
                                </h3>
                                <p className="text-slate-400 text-sm mt-1 font-medium">วิเคราะห์คะแนนเฉลี่ยในแต่ละด้านของการประเมิน</p>
                            </div>
                        </div>
                        <div className="flex-1 flex items-center justify-center min-h-[380px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={domainData}>
                                    <PolarGrid stroke="#E2E8F0" strokeDasharray="4 4" />
                                    <PolarAngleAxis
                                        dataKey="subject"
                                        tick={{ fill: '#94A3B8', fontSize: 13, fontWeight: 700 }}
                                    />
                                    <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
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
                                            borderRadius: '24px',
                                            border: 'none',
                                            boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)',
                                            padding: '16px 20px',
                                            background: 'rgba(255, 255, 255, 0.9)',
                                            backdropFilter: 'blur(10px)'
                                        }}
                                        itemStyle={{ color: '#4F46E5', fontWeight: 800 }}
                                    />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-10 pt-8 border-t border-slate-50 grid grid-cols-1 gap-6">
                            {domainData.map((d, i) => (
                                <div key={i} className="flex items-start gap-4 group/item">
                                    <div>
                                        <p className="text-sm text-slate-600 font-bold group-hover/item:text-slate-900 transition-colors uppercase leading-tight">{d.name}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Question Radar */}
                    <div className="bg-white/80 backdrop-blur-sm rounded-[2.5rem] border border-white p-10 shadow-xl shadow-slate-200/50 flex flex-col group transition-all duration-500">
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                                    <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
                                        <Target size={20} />
                                    </div>
                                    วิเคราะห์รายประเด็น
                                </h3>
                                <p className="text-slate-400 text-sm mt-1 font-medium">เปรียบเทียบผลลัพธ์ในหัวข้อคำถามย่อยทั้งหมด</p>
                            </div>
                        </div>

                        {(() => {
                            const sortedQuestions = [...questions].sort((a, b) => {
                                const parseSection = (s: string) => s.split('.').map(Number);
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
                                            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={sortedQuestions.map((q, i) => ({ subject: (i + 1).toString(), A: q.score, fullText: q.text }))}>
                                                <PolarGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                                                <PolarAngleAxis
                                                    dataKey="subject"
                                                    tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }}
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

                {/* Faculty Stats Section */}
                <div className="bg-white/80 backdrop-blur-sm p-10 rounded-[2.5rem] border border-white shadow-xl shadow-slate-200/50 group">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                <div className="p-2.5 bg-orange-100 rounded-2xl text-orange-600 shadow-inner">
                                    <Building2 size={24} />
                                </div>
                                {selectedMajor ? 'ผลการประเมินรายอาจารย์' : 'ผลการประเมินรายสาขาวิชา'}
                            </h3>
                            <p className="text-slate-400 text-sm mt-1 font-medium">
                                {selectedMajor
                                    ? 'จัดลำดับผลการประเมินอาจารย์ในสาขาวิชา'
                                    : 'จัดลำดับผลการประเมินแยกตามสาขาวิชา'}
                            </p>
                        </div>
                    </div>

                    {chartData.length > 0 ? (
                        <div className="w-full" style={{ height: `${Math.max(chartData.length * 100, 480)}px` }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={chartData.map((d, i) => ({ ...d, rank: i + 1 }))}
                                    layout="vertical"
                                    margin={{ top: 0, right: 60, left: 220, bottom: 0 }}
                                    barGap={10}
                                >
                                    <CartesianGrid strokeDasharray="6 6" horizontal={true} vertical={false} stroke="#F1F5F9" />
                                    <XAxis type="number" domain={[0, 5.5]} hide />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        width={220}
                                        tick={({ x, y, payload, index }) => {
                                            const text = payload.value || "";
                                            const maxLength = 30;
                                            const lines = [];
                                            for (let i = 0; i < text.length; i += maxLength) {
                                                lines.push(text.substring(i, i + maxLength));
                                            }
                                            const displayLines = lines.slice(0, 2);
                                            if (lines.length > 2) displayLines[1] += "...";

                                            return (
                                                <g transform={`translate(10,${y})`}>
                                                    <text
                                                        x={0}
                                                        y={-12}
                                                        className="fill-slate-400 text-[9px] font-black uppercase tracking-widest"
                                                        textAnchor="start"
                                                    >
                                                        RANK {index + 1}
                                                    </text>
                                                    {displayLines.map((line, i) => (
                                                        <text
                                                            key={i}
                                                            x={0}
                                                            y={6 + (i * 14)}
                                                            className="fill-slate-700 text-xs font-bold uppercase tracking-tight"
                                                            textAnchor="start"
                                                        >
                                                            {line}
                                                        </text>
                                                    ))}
                                                </g>
                                            );
                                        }}
                                        axisLine={false}
                                        tickLine={false}
                                    />

                                    <Tooltip
                                        cursor={{ fill: '#F8FAFC', radius: 4 }}
                                        contentStyle={{
                                            borderRadius: 16,
                                            border: 'none',
                                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                            padding: '12px 16px',
                                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                            backdropFilter: 'blur(4px)'
                                        }}
                                        formatter={(value: any) => [`${Number(value).toFixed(2)} Points`, 'Score']}
                                        labelStyle={{ color: '#1e293b', fontWeight: 700, marginBottom: '4px' }}
                                    />

                                    <defs>
                                        <linearGradient id="scoreGradient" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#FB923C" />
                                            <stop offset="100%" stopColor="#EA580C" />
                                        </linearGradient>
                                    </defs>

                                    <Bar
                                        dataKey="score"
                                        fill="url(#scoreGradient)"
                                        radius={[0, 100, 100, 0]}
                                        barSize={18}
                                        className="cursor-pointer transition-all hover:brightness-110"
                                    >
                                        <LabelList
                                            dataKey="score"
                                            position="right"
                                            offset={10}
                                            fill="#64748B"
                                            fontSize={11}
                                            fontWeight={800}
                                            formatter={(val: any) => Number(val).toFixed(2)}
                                        />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[300px] flex flex-col items-center justify-center text-slate-300">
                            <div className="relative mb-6">
                                <Building2 size={64} className="opacity-10" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Loader2 size={24} className="animate-spin text-slate-200" />
                                </div>
                            </div>
                            <p className="font-bold text-slate-400 uppercase tracking-widest text-xs">No Data Available</p>
                        </div>
                    )}
                </div>

                {/* Detailed Table */}
                <div className="bg-white/80 backdrop-blur-sm rounded-[2.5rem] border border-white shadow-xl shadow-slate-200/50 overflow-hidden group">
                    <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600">
                                    <FileText size={22} />
                                </div>
                                การวิเคราะห์เชิงลึก
                            </h3>
                            <p className="text-slate-400 text-sm mt-1 font-medium italic">ตารางรวมผลคะแนนแยกตามหัวข้อและประเด็นคำถามย่อย</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                <div className="px-3 py-1 bg-white rounded-lg shadow-sm text-[10px] font-black uppercase text-indigo-600">Rows: {questions.length}</div>
                            </div>
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
                                                <div className="flex items-center gap-4">
                                                    <span className="text-sm font-black text-slate-800 uppercase tracking-tight">
                                                        {domain}
                                                    </span>
                                                </div>
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
                                                            className={`h-1 rounded-full transition-all duration-1000 ease-out shadow-sm ${q.score >= 4.5 ? 'bg-emerald-500 shadow-emerald-200' :
                                                                q.score >= 4.0 ? 'bg-indigo-500 shadow-indigo-200' :
                                                                    q.score >= 3.0 ? 'bg-amber-500 shadow-amber-200' : 'bg-rose-500 shadow-rose-200'
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

            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }

                .custom-scrollbar-dark::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar-dark::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); }
                .custom-scrollbar-dark::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
                .custom-scrollbar-dark::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
            `}</style>
        </div >
    );
}