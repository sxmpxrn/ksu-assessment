"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

import AdvisorDashboard from "./_components/AdvisorDashboard";
import AssessmentForm from "./_components/AssessmentForm";
import type { Section, Question } from "./_components/AssessmentForm";
import type { AssessmentRound, Advisor } from "./_components/AdvisorDashboard";
import {
  getAssessmentInitialData,
  getAssessmentQuestions,
  checkExistingAssessment,
  submitAssessmentAction
} from "./actions";

// --- Main Page (Orchestrator) ---
export default function AssessmentAdvisorPage() {
  const router = useRouter();

  const [view, setView] = useState<"dashboard" | "form">("dashboard");

  // --- User State ---
  const [studentData, setStudentData] = useState<any>(null);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [selectedAdvisorId, setSelectedAdvisorId] = useState<string | null>(null);
  const [userDataLoading, setUserDataLoading] = useState(true);
  const [isAlreadyAssessed, setIsAlreadyAssessed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Dashboard State ---
  const [rounds, setRounds] = useState<AssessmentRound[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [completedAssessments, setCompletedAssessments] = useState<string[]>([]);

  // --- Form State ---
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedAround, setSelectedAround] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, string | number>>({});

  // --- Fetch Initial Data (User, Advisors, Rounds, Completed) ---
  const fetchUserData = useCallback(async () => {
    setUserDataLoading(true);
    try {
      const res = await getAssessmentInitialData();
      if (res.error) {
         if (res.error === "Unauthorized") {
            router.push("/login");
            return;
         }
         console.error(res.error);
         alert("ไม่สามารถดึงข้อมูลประจำตัวของคุณได้");
         return;
      }
      if (res.studentData) setStudentData(res.studentData);
      if (res.advisors) setAdvisors(res.advisors);
      if (res.completedAssessments) setCompletedAssessments(res.completedAssessments);
      if (res.rounds) setRounds(res.rounds as any);
    } catch (err) {
      console.error(err);
    } finally {
      setUserDataLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchUserData(); }, [fetchUserData]);

  // --- Check if already assessed ---
  useEffect(() => {
    const checkExisting = async () => {
      if (studentData?.student_id && selectedAdvisorId && selectedAround) {
        const { isAssessed, error } = await checkExistingAssessment(
          studentData.student_id,
          selectedAdvisorId,
          selectedAround
        );
        setIsAlreadyAssessed(isAssessed || false);
      }
    };
    checkExisting();
  }, [studentData?.student_id, selectedAdvisorId, selectedAround]);

  // --- Fetch Form Data ---
  const fetchAssessmentData = async (aroundId: number) => {
    setLoading(true);
    try {
      const { headData, detailData, error } = await getAssessmentQuestions(aroundId);
      
      if (error) throw new Error(error);

      const mappedSections: Section[] = (headData || []).map((h: any) => ({
        id: h.id,
        section1: h.section1,
        head_description: h.head_description || "",
        description: h.description || "",
        around_id: h.around_id,
      }));

      const processedQuestions: Question[] = (detailData || []).map((d: any) => ({
        id: d.id,
        type: d.type === "score" ? "scale" : d.type,
        question_text: d.detail,
        start_score: d.min_score,
        end_score: d.max_score,
        around_id: d.around_id,
        section1: d.section1,
        section2: d.section2,
      }));

      setSections(mappedSections);
      setQuestions(processedQuestions);
      setView("form");
    } catch (error) {
      console.error("Error fetching assessment details:", error);
      alert("ไม่สามารถโหลดข้อมูลแบบประเมินได้");
      setSelectedAround(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAround) fetchAssessmentData(selectedAround);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAround]);

  // --- Handlers ---
  const handleSelectRound = (roundId: number, advisorId: string) => {
    setSelectedAdvisorId(advisorId);
    setSelectedAround(roundId);
    setAnswers({});
    setIsAlreadyAssessed(false);
  };

  const handleBack = () => {
    setView("dashboard");
    setSelectedAround(null);
    setSelectedAdvisorId(null);
    fetchUserData(); // refresh completed list
  };

  const handleAnswerChange = (qId: number, value: string | number) => {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  };

  const handleSave = async () => {
    if (!selectedAround || !selectedAdvisorId || !studentData) return;

    const scaleQuestions = questions.filter((q) => q.type === "scale");
    const unansweredCount = scaleQuestions.filter((q) => !answers[q.id]).length;

    if (unansweredCount > 0) {
      alert(`กรุณาตอบคำถามให้ครบทุกข้อ (ยังเหลือ ${unansweredCount} ข้อ)`);
      return;
    }

    if (isAlreadyAssessed) {
      alert("ท่านได้ทำการประเมินอาจารย์ท่านนี้ในรอบนี้ไปแล้ว");
      return;
    }

    setIsSubmitting(true);
    try {
      const answersPayload = questions.map((q) => {
        let score_value = null;
        let text_value = null;
        if (q.type === "scale") {
          score_value = answers[q.id] ? Number(answers[q.id]) : null;
        } else {
          text_value = answers[q.id] ? String(answers[q.id]) : "";
        }
        return { question_id: q.id, score_value, text_value };
      });

      const { error } = await submitAssessmentAction(
        selectedAdvisorId,
        selectedAround,
        answersPayload
      );

      if (error) {
        console.error("Database validation error:", error);
        alert(`เกิดข้อผิดพลาด: ${error}`);
        if (error.includes("ส่งคำตอบสำหรับข้อนี้ไปแล้ว") || error.includes("ซ้ำซ้อน")) {
          setIsAlreadyAssessed(true);
        }
        return;
      }

      alert("บันทึกข้อมูลการประเมินเรียบร้อยแล้ว");
      handleBack();
    } catch (err: any) {
      console.error("Save exception:", err);
      alert("เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Render ---
  if (view === "dashboard") {
    return (
      <AdvisorDashboard
        studentData={studentData}
        advisors={advisors}
        rounds={rounds}
        completedAssessments={completedAssessments}
        userDataLoading={userDataLoading}
        dashboardLoading={dashboardLoading}
        onSelectRound={handleSelectRound}
      />
    );
  }

  return (
    <AssessmentForm
      selectedAround={selectedAround!}
      selectedAdvisorId={selectedAdvisorId!}
      studentData={studentData}
      advisors={advisors}
      sections={sections}
      questions={questions}
      answers={answers}
      isAlreadyAssessed={isAlreadyAssessed}
      isSubmitting={isSubmitting}
      loading={loading}
      onAnswerChange={handleAnswerChange}
      onSave={handleSave}
      onBack={handleBack}
    />
  );
}