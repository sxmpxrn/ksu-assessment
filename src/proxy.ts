import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  // 1. สร้างรหัส Nonce แบบสุ่มทุกครั้งที่มี Request เข้ามา
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  // 2. สร้าง CSP Header โดยลบ 'unsafe-eval' ออก และแทนที่ 'unsafe-inline' ด้วย Nonce
  // เพิ่ม object-src และ base-uri ตามที่ผู้ใช้ต้องการ
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://*.supabase.co;
    style-src 'self' 'nonce-${nonce}' 'unsafe-inline';
    img-src 'self' blob: data: https://*.supabase.co;
    font-src 'self' data: https://fonts.gstatic.com;
    connect-src 'self' https://*.supabase.co;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim();

  // 3. แนบ Nonce ไปกับ Request
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_ANON_KEY; 

  const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const { pathname } = request.nextUrl;
  const rawUrl = request.url;

  // 1. ดักจับการแฮกหา Directory ในไฟล์ Static (ใช้ Raw URL ดิบๆ ก่อนโดนตัด)
  if (rawUrl.includes('/_next/static/') && rawUrl.endsWith('/')) {
    return new NextResponse('Not Found', { status: 404 });
  }

  // 4. แยกการทำงาน: ให้ Header ทำงานทุกหน้า แต่ Auth Logic ทำเฉพาะหน้าเว็บ
  const isInternal = 
    pathname.startsWith('/api') || 
    pathname.startsWith('/_next') || 
    pathname.includes('.');

  // Auth logic (only for non-internal routes)
  if (!isInternal) {
    const sessionToken = request.cookies.get("session_token")?.value;
    let userRole = null;

    if (sessionToken) {
      const { data } = await supabase
        .from("user_sessions")
        .select("role")
        .eq("session_token_hash", sessionToken)
        .gt("expires_at", new Date().toISOString())
        .single();
      
      if (data?.role) {
        userRole = data.role;
      }
    }

    const isPublicRoute = pathname === "/" || pathname === "/import-student-list" || pathname === "/login" || pathname === "/register";
    const isWaitingRoute = pathname === "/waiting-for-confirm";

    if (!userRole) {
      if (!isPublicRoute) {
        response = NextResponse.redirect(new URL("/login", request.url));
      }
    } else {
      const isConfirmed = userRole !== "unregistered";
      const getRoleFolder = (role: string) => {
        switch (role) {
          case "admin": return "dashboard-admin";
          case "advisor": return "dashboard-advisor";
          case "executives": return "executives-dashboard";
          case "student": return "dashboard";
          default: return "login";
        }
      };

      if (!isConfirmed) {
        if (!isWaitingRoute) {
          response = NextResponse.redirect(new URL("/waiting-for-confirm", request.url));
        }
      } else {
        if (isPublicRoute || isWaitingRoute) {
          response = NextResponse.redirect(new URL(`/${getRoleFolder(userRole)}`, request.url));
        }

        const pathSegments = pathname.split('/').filter(Boolean);
        const rootFolder = pathSegments[0];

        if (
          (rootFolder === 'dashboard-admin' && userRole !== 'admin') ||
          (rootFolder === 'dashboard-advisor' && userRole !== 'advisor') ||
          (rootFolder === 'executives-dashboard' && userRole !== 'executives') ||
          (rootFolder === 'dashboard' && userRole !== 'student')
        ) {
          response = NextResponse.redirect(new URL(`/${getRoleFolder(userRole)}`, request.url));
        }
      }
    }
  }

  // 5. นำ Header ยัดใส่ Response ก่อนส่งกลับ
  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return response;
}

export const config = {
  // 6. [สำคัญ] ห้ามมี _next/static ใน matcher เพื่อให้ middleware ทำงานกับ path นี้ด้วย
  matcher: [
    '/((?!_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};