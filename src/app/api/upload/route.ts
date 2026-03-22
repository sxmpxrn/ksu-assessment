import { NextRequest, NextResponse } from "next/server";
import { parseFileBuffer } from "@/utils/file-parser";
import { processName, removePrefix } from "@/utils/name-processor";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase admin client for backend operations
// Use SERVICE_ROLE_KEY to bypass RLS since this is a protected backend import process.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const mappingStr = formData.get("mapping") as string | null;
    
    if (!file) {
      return NextResponse.json({ error: "No file provided in form data." }, { status: 400 });
    }

    const mapping = mappingStr ? JSON.parse(mappingStr) : null;
    
    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Parse File (CSV or Excel)
    const rows = await parseFileBuffer(buffer, file.name);
    
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "File is empty or could not be parsed." }, { status: 400 });
    }

    let successCount = 0;
    let errorCount = 0;
    
    // Create Import Log Entry
    const { data: logData, error: logError } = await supabase
      .from("import_logs")
      .insert({ file_name: file.name, total_rows: rows.length })
      .select("import_id")
      .single();
      
    if (logError) {
      console.error("Failed to create import log:", logError);
      throw new Error("Unable to initialize import process.");
    }
    
    const importId = logData.import_id;

    // Process rows sequentially to prevent overwhelming the DB connection pool.
    // In a massive file scenario (e.g. >10k rows), consider a batch processing approach 
    // or utilizing a background worker.
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        try {
            // Apply column mapping or use default standard column names
            const sFull = mapping ? row[mapping.student_fullname] : row.student_fullname;
            const sFirst = mapping ? row[mapping.student_firstname] : row.student_firstname;
            const sLast = mapping ? row[mapping.student_lastname] : row.student_lastname;
            
            const tFull = mapping ? row[mapping.teacher_fullname] : row.teacher_fullname;
            const tFirst = mapping ? row[mapping.teacher_firstname] : row.teacher_firstname;
            const tLast = mapping ? row[mapping.teacher_lastname] : row.teacher_lastname;

            const room = mapping ? row[mapping.room] : row.room;
            const major = mapping ? row[mapping.major] : row.major;
            const faculty = mapping ? row[mapping.faculty] : row.faculty;
            const studentId = mapping ? row[mapping.student_id] : row.student_id;

            // Skip rows missing essential data
            const hasStudentName = sFull || sFirst;
            const hasTeacherName = tFull || tFirst;
            if (!hasStudentName || !hasTeacherName || !studentId) {
                errorCount++;
                continue;
            }

            // 1. Process Teacher Name
            let finalTFirst = "";
            let finalTLast = "";
            if (tFull) {
                const processed = processName(String(tFull));
                finalTFirst = processed.firstName;
                finalTLast = processed.lastName;
            } else {
                finalTFirst = removePrefix(String(tFirst || ""));
                finalTLast = String(tLast || "").trim();
            }

            // 2. Find existing teacher or insert new one
            // Using check-then-insert prevents the sequence (teacher_id) skipping issue
            // that is common with upsert when conflicts occur.
            let teacherId;
            const { data: existingTeacher, error: findError } = await supabase
              .from("teachers")
              .select("teacher_id")
              .eq("first_name", finalTFirst)
              .eq("last_name", finalTLast)
              .eq("code_room", room)
              .maybeSingle();

            if (findError) {
              throw findError;
            }

            if (existingTeacher) {
              teacherId = existingTeacher.teacher_id;
            } else {
              const { data: newTeacher, error: insertError } = await supabase
                .from("teachers")
                .insert({
                  first_name: finalTFirst,
                  last_name: finalTLast,
                  code_room: room,
                  major: major,
                  faculty: faculty
                })
                .select("teacher_id")
                .single();

              if (insertError) throw insertError;
              teacherId = newTeacher.teacher_id;
            }

            // 3. Process Faculty, Major, Room Hierarchy
            let facultyId = null;
            if (faculty) {
                const { data: exFaculty, error: errFac } = await supabase
                    .from("faculties")
                    .select("id")
                    .eq("faculty_name", String(faculty))
                    .maybeSingle();
                
                if (errFac) throw errFac;
                if (exFaculty) {
                    facultyId = exFaculty.id;
                } else {
                    const { data: newFac, error: insFac } = await supabase
                        .from("faculties")
                        .insert({ faculty_name: String(faculty) })
                        .select("id")
                        .single();
                    if (insFac) throw insFac;
                    facultyId = newFac.id;
                }
            }

            let majorId = null;
            if (major) {
                const { data: exMajor, error: errMaj } = await supabase
                    .from("majors")
                    .select("id")
                    .eq("major_name", String(major))
                    .eq("faculty_id", facultyId) // facultyId can be null, which is fine based on schema
                    .maybeSingle();

                if (errMaj) throw errMaj;
                if (exMajor) {
                    majorId = exMajor.id;
                } else {
                    const { data: newMaj, error: insMaj } = await supabase
                        .from("majors")
                        .insert({ major_name: String(major), faculty_id: facultyId })
                        .select("id")
                        .single();
                    if (insMaj) throw insMaj;
                    majorId = newMaj.id;
                }
            }

            let roomId = null;
            if (room) {
                const { data: exRoom, error: errRoom } = await supabase
                    .from("rooms")
                    .select("id")
                    .eq("room_code", String(room))
                    .eq("major_id", majorId) // majorId can be null, which is fine based on schema
                    .maybeSingle();

                if (errRoom) throw errRoom;
                if (exRoom) {
                    roomId = exRoom.id;
                } else {
                    const { data: newRoom, error: insRoom } = await supabase
                        .from("rooms")
                        .insert({ room_code: String(room), major_id: majorId })
                        .select("id")
                        .single();
                    if (insRoom) throw insRoom;
                    roomId = newRoom.id;
                }
            }

            // 4. Process Student Name
            let finalSFirst = "";
            let finalSLast = "";
            if (sFull) {
                const processed = processName(String(sFull));
                finalSFirst = processed.firstName;
                finalSLast = processed.lastName;
            } else {
                finalSFirst = removePrefix(String(sFirst || ""));
                finalSLast = String(sLast || "").trim();
            }

            // 5. Insert/Upsert Student linked to the teacher
            const { error: sError } = await supabase
              .from("students")
              .upsert({
                student_id: String(studentId),
                first_name: finalSFirst,
                last_name: finalSLast,
                code_room: room,
                major: major,
                faculty: faculty,
                teacher_id: teacherId
              }, { 
                 onConflict: "student_id" 
              });

            if (sError) throw sError;
            
            successCount++;
            
          } catch (rowErr) {
            console.error(`Error importing row ${i + 1}:`, rowErr);
            errorCount++;
          }
    }

    // Update Import Log with final results
    await supabase
      .from("import_logs")
      .update({ success_rows: successCount, error_rows: errorCount })
      .eq("import_id", importId);

    return NextResponse.json({
      import_id: importId,
      total_rows: rows.length,
      success_rows: successCount,
      error_rows: errorCount
    });

  } catch (error: any) {
    console.error("Upload handler error:", error);
    return NextResponse.json({ error: error.message || "An unexpected error occurred" }, { status: 500 });
  }
}
