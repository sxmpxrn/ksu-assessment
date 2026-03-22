import { NextResponse } from "next/server";
import { SignJWT } from "jose";

export async function GET() {
  try {
    // สุ่มตัวเลข 2 ตัวสำหรับการบวกเลข
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    
    // คำนวณคำตอบ
    const answer = (num1 + num2).toString();
    const question = `${num1} + ${num2}`;

    // สร้าง JWT Token เพื่อเก็บคำตอบที่ถูกต้อง โดยมีอายุ 5 นาที
    const token = await new SignJWT({ answer })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode(process.env.JWT_SECRET || "default_captcha_secret_key_12345!"));

    // ส่งคำถามและ Token กลับไปให้ Client
    return NextResponse.json({
      question,
      token,
    });
  } catch (error) {
    console.error("Captcha Error:", error);
    return NextResponse.json(
      { error: "ไม่สามารถสร้าง CAPTCHA ได้" },
      { status: 500 }
    );
  }
}
