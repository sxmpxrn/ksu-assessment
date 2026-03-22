"use server";

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export async function getAssessmentInitialData() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;
  if (!sessionToken) return { error: "Unauthorized" };

  const supabase = createClient(cookieStore);

  // 1. Get Session
  const { data: sessionData } = await supabase
    .from("user_sessions")
    .select("first_name, last_name, role")
    .eq("session_token_hash", sessionToken)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!sessionData) return { error: "Unauthorized" };

  // 2. Get Student Data & Teachers Join
  const { data: studentData, error: studentError } = await supabase
    .from("students")
    .select(`
      *,
      teachers (
        teacher_id,
        first_name,
        last_name
      )
    `)
    .eq("first_name", sessionData.first_name)
    .eq("last_name", sessionData.last_name)
    .single();

  if (!studentData || studentError) return { error: "Student not found" };

  // Map Advisors
  const advisors = studentData.teachers ? [{
    id: studentData.teachers.teacher_id.toString(), // Convert to string for UI compatibility
    fullName: `${studentData.teachers.first_name} ${studentData.teachers.last_name}`.trim()
  }] : [];

  // Map Student Display Data
  const mappedStudent = {
    ...studentData,
    id: studentData.student_id, // Map for old UI components
    std_faculty: studentData.faculty || "ไม่ระบุคณะ",
    confirm: true // Force confirm true since the old confirmation system is deprecated
  };

  // 3. Get Completed Assessments
  const { data: completedA } = await supabase
    .from("assessment_answer")
    .select("around_id, teacher_id")
    .eq("student_id", studentData.student_id); // using student code

  const completedSet = (completedA || []).map(a => `${a.around_id}-${a.teacher_id}`);

  // 4. Get Active Rounds
  // We need to fetch from assessment_detail to get rounds
  const { data: roundsData } = await supabase
    .from("assessment_detail")
    .select("around_id, start_date, end_date")
    .order("around_id", { ascending: false });

  let rounds: any[] = [];
  if (roundsData) {
     const map = new Map();
     roundsData.forEach((r: any) => {
        if (!map.has(r.around_id)) map.set(r.around_id, r);
     });
     rounds = Array.from(map.values());
  }

  return { studentData: mappedStudent, advisors, completedAssessments: completedSet, rounds };
}

export async function getAssessmentQuestions(aroundId: number) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: headData, error: headError } = await supabase
    .from("assessment_head")
    .select("*")
    .eq("around_id", aroundId)
    .order("section1", { ascending: true });

  const { data: detailData, error: detailError } = await supabase
    .from("assessment_detail")
    .select("*")
    .eq("around_id", aroundId)
    .order("section1", { ascending: true })
    .order("section2", { ascending: true });

  return { 
    headData: headData || [], 
    detailData: detailData || [], 
    error: headError?.message || detailError?.message 
  };
}

export async function checkExistingAssessment(studentId: string, advisorId: string, aroundId: number) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { count, error } = await supabase
    .from("assessment_answer")
    .select("*", { count: "exact", head: true })
    .eq("student_id", studentId)
    .eq("teacher_id", parseInt(advisorId))
    .eq("around_id", aroundId);

  return { isAssessed: !!count && count > 0, error: error?.message };
}

export async function submitAssessmentAction(advisorId: string, aroundId: number, answersPayload: any[]) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;
  if (!sessionToken) return { error: "Unauthorized" };

  const supabase = createClient(cookieStore);

  // 1. Get Session for Student ID
  const { data: sessionData } = await supabase
    .from("user_sessions")
    .select("first_name, last_name")
    .eq("session_token_hash", sessionToken)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!sessionData) return { error: "Unauthorized" };

  const { data: studentData } = await supabase
    .from("students")
    .select("student_id")
    .eq("first_name", sessionData.first_name)
    .eq("last_name", sessionData.last_name)
    .single();

  if (!studentData) return { error: "Student not found" };

  // 2. Prepare payload
  const insertPayload = answersPayload.map(a => ({
    student_id: studentData.student_id,
    teacher_id: parseInt(advisorId),
    around_id: aroundId,
    question_id: a.question_id,
    score_value: a.score_value,
    text_value: a.text_value
  }));

  // 3. Insert into DB
  const { error } = await supabase
    .from("assessment_answer")
    .insert(insertPayload);

  if (error) {
     console.error("Insert answers error:", error);
     if (error.code === '23505') { // Unique constraint violation code in Postgres
        return { error: "คุณได้ส่งคำตอบสำหรับข้อนี้ไปแล้ว (ข้อมูลซ้ำซ้อน)" };
     }
     return { error: error.message };
  }

  return { success: true };
}
