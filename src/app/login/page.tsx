"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { User, Lock, AlertCircle, Loader2, ChevronRight, RefreshCw, Calculator } from "lucide-react";

export default function LoginForm() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaQuestion, setCaptchaQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCaptcha = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/captcha");
      const data = await res.json();
      if (data.token) {
        setCaptchaQuestion(data.question);
        setCaptchaToken(data.token);
        setCaptchaAnswer("");
      }
    } catch (err) {
      console.error("Failed to fetch captcha", err);
    }
  }, []);

  useEffect(() => {
    fetchCaptcha();
  }, [fetchCaptcha]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username,
          password: password,
          captchaAnswer: captchaAnswer,
          captchaToken: captchaToken,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      }

      // 🌟 ดึงค่า role จาก API ล่าสุด (API /api/auth/login คืนค่ามาเป็น data.role แล้ว)
      const userRole = data.role;

      // 🌟 บังคับ Refresh ข้อมูลฝั่ง Client เพื่อให้ Header รับรู้ว่า Login แล้ว
      router.refresh();

      // 🌟 กำหนดเป้าหมายหน้าปลายทาง
      let targetPath = "/";
      if (userRole === "student") targetPath = "/dashboard";
      else if (userRole === "advisor") targetPath = "/dashboard-advisor";
      else if (userRole === "admin") targetPath = "/dashboard-admin";
      else if (userRole === "executives") targetPath = "/executives-dashboard";
      else if (userRole === "unregistered") targetPath = "/waiting-for-confirm";
      else targetPath = "/waiting-for-confirm";

      /**
       * ✅ แก้ปัญหา Header ไม่เปลี่ยน: 
       * ใช้ window.location.href แทน router.push 
       * เพื่อให้หน้าเว็บโหลดใหม่ทั้งหมดพร้อม Session ล่าสุด
       */
      window.location.href = targetPath;

    } catch (err: any) {
      setError(err.message);
      fetchCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 font-sans selection:bg-ksu/30 overflow-hidden relative">
      {/* Background Ornaments */}
      <div className="fixed inset-0 overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-ksu/20 rounded-full blur-[100px] animate-pulse"></div>
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-400/20 rounded-full blur-[100px] animate-pulse"
          style={{ animationDelay: "3s" }}
        ></div>
        <div
          className="absolute top-[20%] right-[20%] w-[30%] h-[30%] bg-sky-300/20 rounded-full blur-[80px] animate-pulse"
          style={{ animationDelay: "1.5s" }}
        ></div>
      </div>

      <div className="w-full max-w-lg">
        {/* Brand/Logo Section */}
        <div className="text-center mb-8 animate-fade-up">
          <div className="inline-flex items-center justify-center mb-6 group transition-transform hover:scale-110 duration-500">
            <Image
              src="/logo.png"
              alt="KSU Logo"
              width={100}
              height={100}
              className="object-contain drop-shadow-xl"
            />
          </div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-2">เข้าสู่ระบบ</h1>
          <p className="text-gray-500 font-medium">ระบบบริหารจัดการประเมินผลนักศึกษา</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/70 backdrop-blur-2xl border border-white/80 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 p-8 md:p-12 animate-fade-up delay-200 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-ksu via-emerald-400 to-ksu"></div>

          <form onSubmit={handleLogin} className="space-y-6">
            {/* Username Field */}
            <div className="space-y-2 group">
              <label className="text-sm font-bold text-gray-400 uppercase tracking-widest ml-1 transition-colors group-focus-within:text-ksu">
                ชื่อผู้ใช้งาน / รหัสนักศึกษา / รหัสอาจารย์
              </label>
              <div className="relative">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-ksu">
                  <User size={20} />
                </div>
                <input
                  name="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="กรอกไอดีผู้ใช้"
                  required
                  className="w-full h-16 pl-14 pr-5 bg-gray-50/50 border-2 border-transparent rounded-2xl outline-none transition-all focus:border-ksu focus:bg-white focus:shadow-lg focus:shadow-ksu/5 font-semibold text-gray-800 placeholder:text-gray-300"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2 group">
              <label className="text-sm font-bold text-gray-400 uppercase tracking-widest ml-1 transition-colors group-focus-within:text-ksu">
                รหัสผ่าน (เลขบัตรประชาชน)
              </label>
              <div className="relative">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-ksu">
                  <Lock size={20} />
                </div>
                <input
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="กรอกเลขบัตรประชาชน"
                  required
                  className="w-full h-16 pl-14 pr-5 bg-gray-50/50 border-2 border-transparent rounded-2xl outline-none transition-all focus:border-ksu focus:bg-white focus:shadow-lg focus:shadow-ksu/5 font-semibold text-gray-800 placeholder:text-gray-300"
                />
              </div>
            </div>

            {/* CAPTCHA Field */}
            <div className="space-y-2 group">
              <label className="text-sm font-bold text-gray-400 uppercase tracking-widest ml-1 transition-colors group-focus-within:text-ksu flex justify-between items-center pr-2">
                <span>ป้องกันบอท: {captchaQuestion ? `${captchaQuestion} = ?` : "กำลังโหลด..."}</span>
                <button
                  type="button"
                  onClick={fetchCaptcha}
                  className="text-xs flex items-center gap-1 text-gray-400 hover:text-ksu transition-colors cursor-pointer"
                >
                  <RefreshCw size={14} /> เปลี่ยนคำถาม
                </button>
              </label>
              <div className="relative">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-ksu">
                  <Calculator size={20} />
                </div>
                <input
                  name="captcha"
                  type="text"
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                  placeholder="ผลลัพธ์การบวกเลข"
                  required
                  className="w-full h-16 pl-14 pr-5 bg-gray-50/50 border-2 border-transparent rounded-2xl outline-none transition-all focus:border-ksu focus:bg-white focus:shadow-lg focus:shadow-ksu/5 font-semibold text-gray-800 placeholder:text-gray-300"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-100 p-4 rounded-xl text-red-600 text-sm font-bold animate-in zoom-in-95 duration-300">
                <AlertCircle size={20} className="shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-16 bg-gradient-to-r from-ksu to-ksu-dark text-white rounded-2xl font-black text-lg shadow-xl shadow-ksu/20 hover:shadow-2xl hover:shadow-ksu/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed group"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={24} />
                  <span>กำลังตรวจสอบ...</span>
                </>
              ) : (
                <>
                  <span>เข้าสู่ระบบ</span>
                  <ChevronRight size={24} className="transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-gray-100 text-center">
            <p className="text-gray-400 text-sm font-medium">หากพบปัญหาในการเข้าสู่ระบบ กรุณาติดต่อฝ่ายไอที</p>
          </div>
        </div>
      </div>
    </div>
  );
}