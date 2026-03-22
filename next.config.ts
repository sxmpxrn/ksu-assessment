import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false, // ป้องกันช่องโหว่ Information Leakage ของ Next.js
};

export default nextConfig;