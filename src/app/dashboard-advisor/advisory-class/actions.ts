"use server";

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export async function getAdvisoryData() {
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
    .select("*")
    .eq("first_name", sessionData.first_name)
    .eq("last_name", sessionData.last_name)
    .single();

  if (!teacherData) return { error: "Advisor not found" };

  const { data: studentsData } = await supabase
    .from("students")
    .select("code_room")
    .eq("teacher_id", teacherData.teacher_id);

  const roomsMap = new Map();
  if (studentsData) {
    studentsData.forEach(s => {
      if (s.code_room && !roomsMap.has(s.code_room)) {
        roomsMap.set(s.code_room, { room_code: s.code_room, major_name: teacherData.major || "ไม่ระบุสาขา" });
      }
    });
  }

  if (roomsMap.size === 0 && teacherData.code_room) {
    roomsMap.set(teacherData.code_room, { room_code: teacherData.code_room, major_name: teacherData.major || "ไม่ระบุสาขา" });
  }

  return { 
    teacherId: teacherData.teacher_id,
    myRooms: Array.from(roomsMap.values())
  };
}

export async function getStudentsInRoom(teacherId: number, roomCode: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data, error } = await supabase
    .from("students")
    .select("student_id, first_name, last_name, code_room, major")
    .eq("code_room", roomCode)
    .order("student_id");
    
  if (error) return { error: error.message };
  return { students: data };
}
