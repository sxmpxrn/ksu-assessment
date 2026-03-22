import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const VALID_TOKEN = process.env.LDAP_TOKEN || "YOUR_TOKEN";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password, token } = body;

    // ตรวจ token
    if (token !== VALID_TOKEN) {
      return NextResponse.json({
        status: "fail",
        message: "Invalid token",
      });
    }

    // ตรวจ username / password
    if ((username !== "a1234" && username !== "b1234" && username !== "c1234" && username !== "d1234") || password !== "1234") {
      return NextResponse.json({
        status: "fail",
        message: "Invalid username or password",
      });
    }

    const loginTimestamp = Math.floor(Date.now() / 1000);

    const loginTime = new Date()
      .toISOString()
      .replace("T", " ")
      .substring(0, 19);

    const sessionId = crypto.randomBytes(5).toString("hex");

    const expires = loginTimestamp + 86400;

    const payload = {
      username,
      login_time: loginTimestamp,
      session_id: sessionId,
      ip_address: "127.0.0.1",
      user_agent: req.headers.get("user-agent"),
      expires,
    };

    const tokenData = Buffer.from(
      JSON.stringify(payload)
    ).toString("base64");

    const finalToken =
      tokenData +
      "|" +
      loginTimestamp +
      "|" +
      crypto.randomBytes(10).toString("hex");

    let firstName = "Demo";
    let lastName = "User";

    if (username === "b1234") {
       firstName = "banana";
       lastName = "01";
    } else if (username === "c1234") {
       firstName = "cat";
       lastName = "01";
    } else if (username === "d1234") {
       firstName = "dog";
       lastName = "01";
    }

    return NextResponse.json({
      status: "ok",
      message: "Welcome to system",
      token: finalToken,
      user: {
        username: username,
        first_name: firstName,
        last_name: lastName,
        email: `${username}@example.com`,
        phone: "000-000-000",
        title: "Mock User",
        department: "IT Department",
        organizational_unit: "Information Technology",
        login_time: loginTime,
        login_timestamp: loginTimestamp,
      },
    });

  } catch (error) {
    console.error("LDAP API error:", error);

    return NextResponse.json({
      status: "fail",
      message: "Internal LDAP error",
    });
  }
}