"use server";

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export async function getAvailableRounds() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data } = await supabase.from("assessment_head").select("around_id").order("around_id", { ascending: false });
    if (data) {
        return Array.from(new Set(data.map((item) => item.around_id)));
    }
    return [];
}

export async function getAdvisorIndividualStats(roundId: number) {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;
    if (!sessionToken) return { error: "Unauthorized" };

    const supabase = createClient(cookieStore);

    const { data: sessionData } = await supabase
        .from("user_sessions")
        .select("first_name, last_name")
        .eq("session_token_hash", sessionToken)
        .gt("expires_at", new Date().toISOString())
        .single();
    if (!sessionData) return { error: "Unauthorized" };

    const { data: teacherData } = await supabase
        .from("teachers")
        .select("teacher_id, first_name, last_name, major, faculty")
        .eq("first_name", sessionData.first_name)
        .eq("last_name", sessionData.last_name)
        .single();

    if (!teacherData) return { error: "Teacher not found" };
    const myTeacherId = teacherData.teacher_id;

    // 1. Fetch Structure
    const { data: heads } = await supabase.from("assessment_head").select("*").eq("around_id", roundId).order("section1");
    const { data: details } = await supabase.from("assessment_detail").select("*").eq("around_id", roundId).order("id");

    const domainMap = new Map<number, string>();
    heads?.forEach((h) => domainMap.set(h.section1, h.head_description || `ด้านที่ ${h.section1}`));
    const detailTitleMap = new Map<string, string>();
    const validQuestionsList: any[] = [];
    details?.forEach((d) => {
        const sec2Num = Number(d.section2);
        if (d.type === "score") {
            validQuestionsList.push(d);
        } else if (Number.isInteger(sec2Num)) {
            detailTitleMap.set(`${d.section1}-${sec2Num}`, d.detail);
        }
    });

    // 2. Fetch Answers
    const { data: rawAnswers } = await supabase
        .from("assessment_answer")
        .select("question_id, score_value, student_id, text_value")
        .eq("around_id", roundId)
        .eq("teacher_id", myTeacherId);

    const uniqueStudents = new Set<string>();
    const questionStats = new Map<number, { sum: number; count: number }>();
    let globalSum = 0;
    let globalCount = 0;
    const feedbackMap = new Map<number, any>();

    const questionDetailMap = new Map<number, { text: string }>();
    details?.forEach((d) => questionDetailMap.set(d.id, { text: d.detail }));

    rawAnswers?.forEach((row) => {
        if (row.student_id) uniqueStudents.add(row.student_id);

        if (row.score_value !== null && row.score_value !== undefined) {
            const score = Number(row.score_value);
            if (!questionStats.has(row.question_id)) questionStats.set(row.question_id, { sum: 0, count: 0 });
            const qs = questionStats.get(row.question_id)!;
            qs.sum += score;
            qs.count += 1;
            globalSum += score;
            globalCount += 1;
        }

        if (row.text_value && String(row.text_value).trim() !== "" && String(row.text_value) !== "NULL") {
             const qInfo = questionDetailMap.get(row.question_id);
             const sectionVal = details?.find((d) => d.id === row.question_id)?.section2 || "-";
             if (!feedbackMap.has(row.question_id)) {
                 feedbackMap.set(row.question_id, {
                     question_id: row.question_id,
                     question_text: qInfo?.text || `Question ${row.question_id}`,
                     section: sectionVal.toString(),
                     comments: [],
                 });
             }
             feedbackMap.get(row.question_id).comments.push(row.text_value);
        }
    });

    const participatedStudents = uniqueStudents.size;
    const overallScore = globalCount > 0 ? globalSum / globalCount : 0;

    // 3. Process Domain Data
    const domainScores = new Map<number, { sum: number; count: number }>();
    const domainNames = new Map<number, string>();
    const processedQuestions: any[] = [];

    validQuestionsList.forEach((d) => {
        const stats = questionStats.get(d.id) || { sum: 0, count: 0 };
        const avg = stats.count > 0 ? stats.sum / stats.count : 0;
        const section2Val = Number(d.section2);
        const domainKey = Math.floor(section2Val);
        const sectionName = detailTitleMap.get(`${d.section1}-${domainKey}`) || domainMap.get(d.section1) || `ด้านที่ ${domainKey}`;
        
        domainNames.set(domainKey, sectionName);
        if (!domainScores.has(domainKey)) domainScores.set(domainKey, { sum: 0, count: 0 });
        
        const dS = domainScores.get(domainKey)!;
        dS.sum += stats.sum;
        dS.count += stats.count;

        processedQuestions.push({
            id: d.id,
            section: d.section2.toString(),
            domain: sectionName,
            text: d.detail,
            score: Number(avg.toFixed(2)),
        });
    });

    const domainData = Array.from(domainScores.entries()).map(([domainKey, stats]) => {
        const avg = stats.count > 0 ? stats.sum / stats.count : 0;
        return {
            id: domainKey.toString(),
            name: domainNames.get(domainKey) || `ด้านที่ ${domainKey}`,
            subject: domainNames.get(domainKey) || `ด้านที่ ${domainKey}`,
            score: Number(avg.toFixed(2)),
            fullMark: 5,
            A: Number(avg.toFixed(2)),
        };
    }).sort((a, b) => Number(a.id) - Number(b.id));

    const sortedItems = [...processedQuestions].sort((a, b) => b.score - a.score);
    const strengths = sortedItems.slice(0, 3);
    const weaknesses = sortedItems.slice(-3).reverse();
    const groupedFeedback = Array.from(feedbackMap.values()).sort((a, b) => a.section.localeCompare(b.section, undefined, { numeric: true }));

    return {
        overallScore,
        participatedStudents,
        domainData,
        questions: processedQuestions,
        strengths,
        weaknesses,
        groupedFeedback,
        teacherProfile: {
            first_name: teacherData.first_name,
            last_name: teacherData.last_name,
            major: teacherData.major || "ไม่ระบุสาขา",
            faculty: teacherData.faculty || "ไม่ระบุคณะ"
        }
    };
}
