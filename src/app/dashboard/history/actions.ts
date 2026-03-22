"use server";

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export async function getAssessmentHistory() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;
  if (!sessionToken) return { error: "Unauthorized" };

  const supabase = createClient(cookieStore);

  // 1. Get Session for Student
  const { data: sessionData } = await supabase
    .from("user_sessions")
    .select("first_name, last_name")
    .eq("session_token_hash", sessionToken)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!sessionData) return { error: "Unauthorized" };

  // 2. Get Student ID based on name
  const { data: studentData } = await supabase
    .from("students")
    .select("student_id")
    .eq("first_name", sessionData.first_name)
    .eq("last_name", sessionData.last_name)
    .single();

  if (!studentData) return { error: "Student not found" };

  // 3. Fetch Assessment Answers
  const { data: answers } = await supabase
    .from("assessment_answer")
    .select("around_id, teacher_id")
    .eq("student_id", studentData.student_id);

  if (!answers || answers.length === 0) return { history: [] };

  // 4. Group unique around_id + teacher_id
  const uniqueMap = new Map();
  const teacherIds = new Set<number>();
  
  answers.forEach((item: any) => {
    const key = `${item.around_id}-${item.teacher_id}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, { around: item.around_id, teacher_id: item.teacher_id });
      teacherIds.add(item.teacher_id);
    }
  });

  // 5. Fetch teachers from new table
  let teacherMap = new Map<number, string>();
  if (teacherIds.size > 0) {
    const { data: teachersData } = await supabase
      .from("teachers")
      .select("teacher_id, first_name, last_name")
      .in("teacher_id", Array.from(teacherIds));

    if (teachersData) {
      teachersData.forEach((t) => {
        teacherMap.set(t.teacher_id, `${t.first_name} ${t.last_name}`.trim());
      });
    }
  }

  // 6. Combine
  const history = Array.from(uniqueMap.values()).map(item => ({
    around: item.around,
    teacher_id: item.teacher_id,
    teacher_name: teacherMap.get(item.teacher_id) || "ไม่ระบุชื่ออาจารย์",
    status: true
  }));

  // Sort descending
  history.sort((a, b) => b.around - a.around);

  return { history };
}
