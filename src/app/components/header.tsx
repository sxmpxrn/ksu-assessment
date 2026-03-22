"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  Home,
  FileText,
  User,
  Bell,
  LogOut,
  LogIn,
  Settings,
  PieChart,
  UserPlus,
} from "lucide-react";
import Image from "next/image";
import { logout } from "@/app/components/action";

// --- กำหนดเมนูสำหรับแต่ละ Role ---
const studentNavItems = [
  { label: "แดชบอร์ด", href: "/dashboard", icon: Home },
  { label: "ประเมินอาจารย์", href: "/dashboard/assessment-advisor", icon: FileText },
  { label: "ประวัติการประเมิน", href: "/dashboard/history", icon: Bell },
];

const advisorNavItems = [
  { label: "แดชบอร์ด", href: "/dashboard-advisor", icon: Home },
  { label: "ห้องเรียนที่ดูแล", href: "/dashboard-advisor/advisory-class", icon: User },
  { label: "สถานะการประเมิน", href: "/dashboard-advisor/individual", icon: FileText },
];

const adminNavItems = [
  { label: "แดชบอร์ดแอดมิน", href: "/dashboard-admin", icon: Home },
  { label: "จัดการผู้ใช้", href: "/dashboard-admin/users", icon: User },
  { label: "ตั้งค่าระบบ", href: "/dashboard-admin/settings", icon: Settings },
];

const executiveNavItems = [
  { label: "แดชบอร์ดผู้บริหาร", href: "/executives-dashboard", icon: Home },
  { label: "รายงานภาพรวม", href: "/executives-dashboard/reports", icon: PieChart },
];

const getNavItemsByRole = (role?: string) => {
  switch (role) {
    case "student": return studentNavItems;
    case "advisor": return advisorNavItems;
    case "admin": return adminNavItems;
    case "executives": return executiveNavItems;
    default: return [];
  }
};

export default function Header({
  variant = "default",
  user,
}: {
  variant?: "default" | "admin";
  user?: {
    name: string;
    id: string;
    type: string;
    role: string;
  } | null;
} = {}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = async () => {
    if (confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
      await logout();
      window.location.href = "/login";
    }
  };

  // ซ่อน Header ในหน้า Print หรือหน้า Admin บางส่วน
  if (
    (variant !== "admin" && (pathname?.startsWith("/admin") || pathname?.startsWith("/dashboard-admin"))) ||
    pathname?.endsWith("/print") 
  ) {
    return null;
  }

  // ใช้ user.role จาก Prop ตรงๆ ไม่ผ่าน State
  const currentNavItems = getNavItemsByRole(user?.role);

  // ฟังก์ชันช่วยเช็คสถานะ Active
  const checkIsActive = (href: string) => {
    // ถัาเป็นหน้าแดชบอร์ดหลัก ต้องเป็น path นั้นเป๊ะๆ (ป้องกันการทับซ้อนกับหน้าย่อย)
    const isRootDashboard = ["/dashboard", "/dashboard-advisor", "/dashboard-admin", "/executives-dashboard"].includes(href);
    if (isRootDashboard) {
      return pathname === href;
    }
    // ถ้าเป็นหน้าย่อย ให้เช็คว่า path ตรง หรือเริ่มต้นด้วย path นั้น
    return pathname === href || pathname?.startsWith(`${href}/`);
  };

  return (
    <>
      <header
        className={`${
          variant === "default" ? "fixed top-0 left-0 right-0" : "sticky top-0"
        } z-50 transition-all duration-300 font-sans ${
          isScrolled
            ? "bg-white/80 backdrop-blur-md border-b border-ksu/20 shadow-md py-3"
            : "bg-white/60 backdrop-blur-md border-b border-white/50 py-4 shadow-sm"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 md:px-10 flex items-center justify-between">
          
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 relative flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
              <Image src="/logo.png" alt="KSU Logo" width={40} height={40} className="object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold text-gray-800 leading-tight group-hover:text-ksu transition-colors">
                KSU <span className="text-ksu">Assessment</span>
              </span>
              <span className="text-[10px] text-gray-500 font-medium tracking-wider uppercase">
                Kalasin University
              </span>
            </div>
          </Link>

          {currentNavItems.length > 0 && (
            <nav className="hidden md:flex items-center gap-1 bg-gray-50/50 p-1.5 rounded-full border border-white">
              {currentNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = checkIsActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-ksu text-white shadow-md"
                        : "text-gray-600 hover:text-ksu hover:bg-white"
                    }`}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}

          <div className="flex items-center gap-4">
            {user ? (
              <div className="hidden md:flex items-center gap-3 pl-2 pr-1 py-1 rounded-full border border-gray-200 bg-white shadow-sm group">
                <div className="flex flex-col items-end px-2">
                  <span className="text-xs font-black text-gray-800 tracking-tight">
                    {user.name || "Loading..."}
                  </span>
                  <span className="text-[10px] text-ksu font-bold uppercase tracking-wider">
                    {user.role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-10 h-10 rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white border border-red-100 transition-all flex items-center justify-center shadow-xs group/logout"
                  title="ออกจากระบบ"
                >
                  <LogOut size={18} className="transition-transform group-hover/logout:scale-110" />
                </button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link
                  href="/login"
                  className="flex items-center gap-2 px-6 py-2.5 bg-ksu text-white rounded-full font-black text-sm shadow-lg shadow-ksu/20 hover:shadow-ksu/40 hover:scale-105 active:scale-95 transition-all"
                >
                  <LogIn size={18} />
                  <span>เข้าสู่ระบบ</span>
                </Link>
              </div>
            )}

            <button
              className="md:hidden p-2 text-gray-600 hover:bg-ksu/10 hover:text-ksu rounded-md transition-colors"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
          </div>
        </div>
      </header>

      {variant === "default" && <div className="h-24"></div>}

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
          <div className="fixed inset-y-0 right-0 w-[280px] bg-white shadow-2xl flex flex-col animate-slide-in-right">
            
            <div className="p-6 border-b border-gray-100 bg-ksu/5">
              <div className="flex items-center justify-between mb-6">
                <span className="text-lg font-bold text-ksu">เมนูหลัก</span>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-white border-2 border-ksu flex items-center justify-center shadow-lg shadow-ksu/10">
                    <User className="text-ksu w-7 h-7" />
                  </div>
                  <div>
                    <div className="font-black text-gray-900 leading-tight">{user.name}</div>
                    <div className="text-xs text-ksu font-bold mt-0.5 uppercase">{user.role}</div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <Link href="/login" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center justify-center gap-3 p-3 bg-ksu text-white rounded-xl shadow-lg shadow-ksu/20 active:scale-95 transition-all">
                    <LogIn size={20} />
                    <span className="font-black">เข้าสู่ระบบ</span>
                  </Link>
                  <Link href="/register" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center justify-center gap-3 p-3 bg-white text-ksu border border-ksu rounded-xl shadow-lg shadow-ksu/10 active:scale-95 transition-all">
                    <UserPlus size={20} />
                    <span className="font-black">สมัครสมาชิก</span>
                  </Link>
                </div>
              )}
            </div>

            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
              {currentNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = checkIsActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive
                        ? "bg-ksu text-white shadow-md"
                        : "text-gray-600 hover:bg-ksu/10 hover:text-ksu"
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {user && (
              <div className="p-6 border-t border-gray-100">
                <button onClick={handleLogout} className="w-full py-4 rounded-2xl bg-red-50 text-red-600 font-black flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xs">
                  <LogOut size={20} />
                  ออกจากระบบ
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}