import { createHash } from "crypto"
// นำเข้า NextResponse สำหรับสร้าง HTTP response ใน Next.js
import { NextResponse } from "next/server"
// นำเข้า cookies() สำหรับอ่านและเขียน cookie ฝั่ง server
import { cookies } from "next/headers"
// นำเข้าฟังก์ชันสร้าง Supabase client สำหรับ server-side
import { createClient } from "@/utils/supabase/server"
// นำเข้า SignJWT และ jwtVerify สำหรับสร้างและตรวจสอบ JSON Web Token (JWT)
import { SignJWT, jwtVerify } from "jose"
// นำเข้า zod สำหรับ validate ข้อมูลที่รับเข้ามา
import { z } from "zod"

/* ---------------------------
   Validation Schemas
--------------------------- */

// กำหนด schema สำหรับตรวจสอบข้อมูล login
const loginSchema = z.object({
  // username ต้องมีความยาว 3-50 ตัวอักษร และใช้ได้เฉพาะตัวอักษร ตัวเลข . _ -
  username: z.string().min(4).max(25).regex(/^[a-zA-Z0-9._-]+$/),
  // password ต้องมีความยาว 4-18 ตัวอักษร
  password: z.string().min(4).max(18),
  // captcha field
  captchaAnswer: z.string().min(1, "กรุณากรอกคำตอบ CAPTCHA"),
  captchaToken: z.string().min(1, "CAPTCHA token missing")
})

// กำหนด schema สำหรับตรวจสอบ response ที่ได้จาก LDAP server
const ldapSchema = z.object({
  // status ต้องเป็น "ok" หรือ "fail" เท่านั้น
  status: z.enum(["ok", "fail"]),
  // รับข้อมูล user เผื่อ LDAP ตอบกลับมา (เช่น ชื่อ-สกุล)
  user: z.object({
    username: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    email: z.string().optional()
  }).optional()
})

/* ---------------------------
   Utility Functions
--------------------------- */

// ฟังก์ชันหน่วงเวลาแบบสุ่ม (200-600ms) เพื่อป้องกัน timing attack
const sleepRandom = () =>
  new Promise((res) => setTimeout(res, 200 + Math.random() * 400))

// ฟังก์ชันดึง IP address ของ client จริง
function getClientIP(req: Request) {
  // ลองอ่านจาก header x-forwarded-for (ใช้เมื่อผ่าน proxy หรือ load balancer)
  const forwarded = req.headers.get("x-forwarded-for")
  // ลองอ่านจาก header x-real-ip (ใช้เมื่อผ่าน nginx)
  const real = req.headers.get("x-real-ip")

  // ถ้ามี x-forwarded-for ให้เอา IP แรกสุด (ซ้ายสุด = ต้นทางจริง)
  if (forwarded) return forwarded.split(",")[0].trim()
  // ถ้ามี x-real-ip ให้ใช้ค่านั้น
  if (real) return real

  // ถ้าไม่มีทั้งคู่ ให้คืนค่า default
  return "0.0.0.0"
}

/* ---------------------------
   LDAP Authentication
--------------------------- */

// ฟังก์ชันตรวจสอบ username/password กับ LDAP server
async function ldapAuth(username: string, password: string) {

  // กำหนด Base URL: ใช้ SITE_URL ถ้ามี ถ้าไม่มีให้ใช้ localhost
  const baseUrl = process.env.SITE_URL || "http://localhost:3000"

  // สร้าง AbortController สำหรับยกเลิก request ถ้าใช้เวลานานเกินไป
  const controller = new AbortController()
  // ตั้ง timeout 5 วินาที — ถ้านานกว่านี้จะ abort request อัตโนมัติ
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {

    // ส่ง POST request ไปยัง LDAP API endpoint
    const res = await fetch(`${baseUrl}/api/ldap`, {
      method: "POST",
      headers: {
        // บอก server ว่า body เป็น JSON
        "Content-Type": "application/json",
        // ระบุ origin ของ request เพื่อให้ server ตรวจสอบ CORS
        "Origin": baseUrl
      },
      // ส่ง signal เพื่อให้ AbortController ยกเลิก request ได้
      signal: controller.signal,
      // แปลง object เป็น JSON string สำหรับส่งไปใน body
      body: JSON.stringify({
        username,   // ชื่อผู้ใช้
        password,   // รหัสผ่าน
        token: process.env.LDAP_TOKEN  // token สำหรับยืนยันว่า request มาจากระบบที่น่าเชื่อถือ
      })
    })

    // ถ้า HTTP status ไม่ใช่ 2xx แสดงว่า LDAP server มีปัญหา
    if (!res.ok) {
      throw new Error("เซิร์ฟเวอร์ LDAP เกิดข้อผิดพลาด")
    }

    // แปลง response body เป็น JSON object
    const data = await res.json()

    // ตรวจสอบว่า response ตรงตาม schema ที่กำหนดไว้
    const parsed = ldapSchema.safeParse(data)

    // ถ้า response ไม่ตรง schema (ไม่มี field status หรือค่าผิด) ให้ throw error
    if (!parsed.success) {
      throw new Error("ได้รับข้อมูลตอบกลับจาก LDAP ไม่ถูกต้อง")
    }

    // คืนค่าข้อมูลที่ผ่านการ validate แล้ว
    return parsed.data

  } finally {
    // ล้าง timeout ทุกครั้ง (ทั้ง success และ error) เพื่อไม่ให้ memory leak
    clearTimeout(timeout)
  }
}

/* ---------------------------
   Login API
--------------------------- */

// handler หลักสำหรับ POST /api/auth/login
export async function POST(req: Request) {

  // ดึง cookie store สำหรับอ่าน/เขียน cookie
  const cookieStore = await cookies()
  // สร้าง Supabase client โดยใช้ cookie store ที่ได้
  const supabase = createClient(cookieStore)

  // ดึง IP address ของ client
  const ip = getClientIP(req)
  // ดึง User-Agent (ชื่อ browser/app ที่ส่ง request มา) — ใช้ "unknown" ถ้าไม่มี
  const userAgent = req.headers.get("user-agent") || "unknown"
  // ดึง origin header เพื่อตรวจสอบ CSRF
  const origin = req.headers.get("origin")
  
  // กำหนด Expected Origin: ใช้ SITE_URL ถ้ามี ถ้าไม่มีให้ใช้ origin ของ request เอง (สำหรับ dev)
  const expectedOrigin = process.env.SITE_URL || (origin?.includes("localhost") ? origin : null)

  // ตรวจสอบ CSRF — ถ้า origin ไม่ตรงกับ domain ที่อนุญาต ให้ปฏิเสธ
  if (origin && expectedOrigin && origin !== expectedOrigin) {
    return NextResponse.json({ error: "ไม่อนุญาตให้เข้าถึง (CSRF Error)" }, { status: 403 })
  }

  // ดึงขนาดของ request body จาก header
  const contentLength = req.headers.get("content-length")
  // ถ้าข้อมูลใหญ่กว่า 5,000 bytes ให้ปฏิเสธ เพื่อป้องกัน DoS attack
  if (contentLength && Number(contentLength) > 5000) {
    return NextResponse.json({ error: "ข้อมูลที่ส่งมามีขนาดใหญ่เกินไป" }, { status: 413 })
  }

  // ประกาศตัวแปร body สำหรับเก็บข้อมูลที่ parse แล้ว
  let body

  try {
    // แปลง request body จาก JSON string เป็น object
    body = await req.json()
  } catch {
    // ถ้า parse ไม่ได้ แสดงว่า body ไม่ใช่ JSON ที่ถูกต้อง
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 })
  }

  // ดึง username ออกมาจาก body (ใช้สำหรับ log กรณี validate ล้มเหลว)
  const { username } = body || {}

  try {

    /* ---------------------------
       Validate Input
    --------------------------- */

    // ตรวจสอบว่า body ตรงตาม loginSchema ที่กำหนดไว้
    const validation = loginSchema.safeParse(body)

    // ถ้าข้อมูลไม่ผ่าน validate
    if (!validation.success) {

      // บันทึก log ว่ามีการพยายาม login ที่ไม่ถูกต้อง (suspicious = true)
      await logAttempt(
        supabase,
        ip,
        username || "unknown",  // ถ้าไม่มี username ให้ใช้ "unknown"
        true,                   // suspicious = true (น่าสงสัย)
        userAgent
      )

      // หน่วงเวลาแบบสุ่มเพื่อป้องกัน brute force และ timing attack
      await sleepRandom()

      // ส่ง error กลับไป (ใช้ message กลางๆ ไม่บอกว่า username หรือ password ผิด)
      return NextResponse.json(
        { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" },
        { status: 400 }
      )
    }

    // แปลง username เป็นตัวพิมพ์เล็กทั้งหมดเพื่อความ consistent
    const normalizedUser = validation.data.username.toLowerCase()
    // ดึง password จากข้อมูลที่ผ่าน validate แล้ว
    const password = validation.data.password

    /* ---------------------------
       CAPTCHA Validation
    --------------------------- */
    try {
      const { payload } = await jwtVerify(
        validation.data.captchaToken,
        new TextEncoder().encode(process.env.JWT_SECRET || "default_captcha_secret_key_12345!")
      )

      if (payload.answer !== validation.data.captchaAnswer) {
        return NextResponse.json(
          { error: "คำตอบ CAPTCHA ไม่ถูกต้อง" },
          { status: 400 }
        )
      }
    } catch (err) {
      return NextResponse.json(
        { error: "CAPTCHA หมดอายุหรือไม่ถูกต้อง กรุณารีเฟรชหน้าเว็บ" },
        { status: 400 }
      )
    }

    /* ---------------------------
       Rate Limit Check (Logic)
    --------------------------- */

    // เช็คจำนวนครั้งที่ IP นี้พยายาม Login ใน 15 นาทีล่าสุด
    const { count: ipAttempts } = await supabase
      .from("login_attempts")
      .select("*", { count: "exact", head: true })
      .eq("ip_address", ip)
      .gt("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString())

    // เช็คจำนวนครั้งที่ Username นี้ถูกพยายามเข้าถึงใน 15 นาทีล่าสุด
    const { count: userAttempts } = await supabase
      .from("login_attempts")
      .select("*", { count: "exact", head: true })
      .eq("username_attempted", normalizedUser)
      .gt("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString())

    // ถ้า IP พยายามเกิน 5 ครั้ง หรือ username ถูกพยายามเกิน 10 ครั้ง ให้บล็อก
    if ((ipAttempts || 0) > 5 || (userAttempts || 0) > 10) {
      return NextResponse.json(
        { error: "พยายามล็อกอินมากเกินไป กรุณาลองใหม่ในอีก 15 นาที" },
        { status: 429 } // Too Many Requests
      )
    }

    /* ---------------------------
       LDAP Authentication
    --------------------------- */

    // ประกาศตัวแปรสำหรับเก็บ response จาก LDAP
    let ldapData

    try {
      // ส่ง username/password ไปตรวจสอบกับ LDAP server
      ldapData = await ldapAuth(normalizedUser, password)
    } catch (ldapErr) {

      // log error ที่ได้รับจาก LDAP สำหรับ debug
      console.error("LDAP Error:", ldapErr)

      // ส่ง error กลับไปว่าระบบยืนยันตัวตนใช้งานไม่ได้
      return NextResponse.json(
        { error: "ระบบยืนยันตัวตนไม่พร้อมใช้งานในขณะนี้" },
        { status: 503 }
      )
    }

    // ตรวจสอบว่า LDAP ยืนยันตัวตนสำเร็จหรือไม่
    const isSuccess = ldapData.status === "ok"

    // ถ้า LDAP ยืนยันตัวตนไม่สำเร็จ (username/password ผิด)
    if (!isSuccess) {

      // บันทึก log เฉพาะเมื่อ login ล้มเหลว (LDAP status ไม่ใช่ "ok")
      await logAttempt(
        supabase,
        ip,
        normalizedUser,
        true,         // suspicious = true (login ไม่สำเร็จ)
        userAgent
      )

      // หน่วงเวลาแบบสุ่มเพื่อป้องกัน brute force
      await sleepRandom()

      // ส่ง error กลับไป (401 = Unauthorized)
      return NextResponse.json(
        { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" },
        { status: 401 }
      )
    }

    let userRole = "unregistered" // กำหนดค่าเริ่มต้นสำหรับคนที่ไม่มีรายชื่อในระบบ

    const ldapFirst = ldapData.user?.first_name?.trim()
    const ldapLast = ldapData.user?.last_name?.trim()

    // ค้นหาในตารางนักศึกษา, อาจารย์, ผู้ดูแลระบบ ว่าชื่อ-นามสกุลตรงกับ Role ไหน
    if (ldapFirst && ldapLast) {
      // 1. ตรวจสอบในตารางนักศึกษา (students) -> ได้สิทธิ์ student
      const { data: studentData } = await supabase
        .from("students")
        .select("student_id")
        .eq("first_name", ldapFirst)
        .eq("last_name", ldapLast)
        .single()

      if (studentData) {
        userRole = "student"
      } else {
        // 2. ตรวจสอบในตารางอาจารย์ (teachers) -> ได้สิทธิ์ advisor
        const { data: teacherData } = await supabase
          .from("teachers")
          .select("teacher_id")
          .eq("first_name", ldapFirst)
          .eq("last_name", ldapLast)
          .single()

        if (teacherData) {
          userRole = "advisor"
        } else {
          // 3. ตรวจสอบในตารางผู้ดูแลระบบ (admins) -> ได้สิทธิ์ admin
          // (ถ้าไม่มีตาราง admins ให้เปลี่ยนชื่อตารางตามจริง แต่จากโครงสร้างถือว่ามี)
          const { data: adminData } = await supabase
            .from("admins")
            .select("*")
            .eq("first_name", ldapFirst)
            .eq("last_name", ldapLast)
            .single()

          if (adminData) {
            userRole = "admin"
          }
        }
      }
    } else {
      // หากไม่มีชื่อส่งมาจาก LDAP หรือค้นหาไม่เจอ ให้ลองหา Role จากตาราง profiles สำรอง
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("username", normalizedUser)
        .single()

      if (profile?.role) {
        userRole = profile.role
      }
    }

    // สร้าง JWT token โดยฝัง payload เป็น { username, role }
    const token = await new SignJWT({
      username: normalizedUser,
      role: userRole
    })
      .setProtectedHeader({ alg: "HS256" })   // กำหนด algorithm เป็น HMAC-SHA256
      .setIssuedAt()                           // บันทึกเวลาที่สร้าง token
      .setIssuer("yourdomain.com")             // ระบุว่า token ออกโดยใคร
      .setAudience("auth")                     // ระบุว่า token ใช้สำหรับอะไร
      .setExpirationTime("8h")                 // กำหนดให้ token หมดอายุใน 8 ชั่วโมง
      .sign(
        // เข้ารหัส JWT ด้วย secret key จาก environment variable
        new TextEncoder().encode(
          process.env.JWT_SECRET
        )
      )

    // สร้าง JSON response กลับไปว่า login สำเร็จ
    const response = NextResponse.json({
      success: true,
      role: userRole
    })

    // 🌟 เข้ารหัส Token ด้วย SHA-256 
    const tokenHash = createHash("sha256").update(token).digest("hex")

    // 🌟 เวลาหมดอายุของ Session (8 ชั่วโมง)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 8)

    const fn = ldapFirst || ""
    const ln = ldapLast || ""

    // 🌟 ลบ Session ของผู้ใช้นี้ที่ค้างเก่าออกก่อน (ล็อกอินซ้อนไม่ได้)
    if (fn || ln) {
      await supabase.from("user_sessions").delete().match({ first_name: fn, last_name: ln })
    }

    // 🌟 บันทึก Session ลงตาราง user_sessions (Stateful Session)
    const { error: sessionError } = await supabase.from("user_sessions").insert({
      first_name: fn,
      last_name: ln,
      role: userRole,
      session_token_hash: tokenHash,
      ip_address: ip,
      user_agent: userAgent,
      expires_at: expiresAt.toISOString()
    })

    if (sessionError) {
      console.error("Session DB Error:", sessionError.message)
    }

    // เซ็ต cookie "session_token" ที่เป็น Token Hash เอาไว้
    response.cookies.set({
      name: "session_token",      // ชื่อ cookie
      value: tokenHash,           // ค่า cookie คือ Hash ที่ได้

      httpOnly: true,             // ป้องกัน JavaScript ใน browser อ่าน cookie ได้ (ป้องกัน XSS)
      secure: true,               // ส่ง cookie ผ่าน HTTPS เท่านั้น
      sameSite: "lax",            // ป้องกัน CSRF บางส่วน (lax = อนุญาต GET แต่บล็อก cross-site POST)
      path: "/",                  // ใช้ cookie ได้กับทุก path ใน domain
      maxAge: 60 * 60 * 8         // อายุ cookie = 8 ชั่วโมง (หน่วยเป็นวินาที)
    })

    // ส่ง response กลับไปพร้อม cookie ที่เซ็ตไว้
    return response

  } catch (error) {

    // log error ที่ไม่คาดคิดสำหรับ debug
    console.error("Auth Error:", error)

    // ส่ง error กลับไปว่ามีปัญหาภายในเซิร์ฟเวอร์ (500 = Internal Server Error)
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" },
      { status: 500 }
    )
  }
}

/* ---------------------------
   Login Attempt Logging
--------------------------- */

// ฟังก์ชันบันทึกประวัติการพยายาม login ลงใน Supabase
async function logAttempt(
  supabase: any,          // Supabase client
  ip: string,             // IP address ของ client
  username: string,       // username ที่ถูกใช้
  suspicious: boolean,    // true = น่าสงสัย, false = ปกติ
  ua: string              // User-Agent string
) {

  // insert ข้อมูลการพยายาม login ลงในตาราง login_attempts ใน Supabase
  await supabase.from("login_attempts").insert([
    {
      ip_address: ip,               // IP ของ client
      username_attempted: username, // username ที่ใช้ login
      is_suspicious: suspicious,    // บ่งชี้ว่าน่าสงสัยหรือไม่
      user_agent: ua                // ข้อมูล browser/app ที่ใช้
    }
  ])
}