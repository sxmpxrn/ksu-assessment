"use client";

import React, { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  UploadCloud,
  FileSpreadsheet,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronDown,
  Database,
  ArrowRight,
  RefreshCcw,
  Check,
  Eye,
  TableProperties,
  MousePointerSquareDashed
} from "lucide-react";
import { processName, removePrefix } from "@/utils/name-processor";

// ─── Types ────────────────────────────────────────────────────────────────────
type ColumnMapping = Record<string, string>; // csvHeader → dbColumn

interface ParsedData {
  headers: string[];
  rows: string[][];
  fileObj: File | null;
}

interface ImportResult {
  import_id?: string;
  total_rows: number;
  success_rows: number;
  error_rows: number;
  error?: string;
}

// ─── DB Column Definitions ────────────────────────────────────────────────────
const DB_COLUMNS = [
  { value: "", label: "— ข้ามคอลัมน์นี้ —" },
  { value: "student_id", label: "รหัสนักศึกษา (Student ID)" },
  { value: "student_fullname", label: "ชื่อ-สกุลนักศึกษา (Student Full Name)" },
  { value: "student_firstname", label: "ชื่อนักศึกษา (Student First Name)" },
  { value: "student_lastname", label: "นามสกุลนักศึกษา (Student Last Name)" },
  { value: "teacher_fullname", label: "ชื่อ-สกุลอาจารย์ที่ปรึกษา (Advisor Full Name)" },
  { value: "teacher_firstname", label: "ชื่ออาจารย์ที่ปรึกษา (Advisor First Name)" },
  { value: "teacher_lastname", label: "นามสกุลอาจารย์ที่ปรึกษา (Advisor Last Name)" },
  { value: "room", label: "ห้องเรียน (Room)" },
  { value: "faculty", label: "คณะ (Faculty)" },
  { value: "major", label: "สาขา (Major)" },
];

const PREVIEW_ROWS = 5;

// ─── Helper Functions ────────────────────────────────────────────────────────
function guessColumn(header: string): string {
  const lh = header.toLowerCase().replace(/\s+/g, "");
  const keywords: Record<string, string[]> = {
    student_id: ["รหัส", "id", "student_id", "studentid", "code"],
    student_fullname: ["ชื่อ-สกุลนักศึกษา", "ชื่อ-สกุล", "ชื่อนามสกุล", "name", "fullname"],
    student_firstname: ["ชื่อนักศึกษา", "ชื่อ", "firstname", "first_name"],
    student_lastname: ["นามสกุลนักศึกษา", "นามสกุล", "lastname", "last_name", "surname"],
    teacher_fullname: ["ชื่อ-สกุลอาจารย์", "ชื่อ-สกุลที่ปรึกษา", "อาจารย์", "advisor", "teacher", "ที่ปรึกษา"],
    teacher_firstname: ["ชื่ออาจารย์", "ชื่อที่ปรึกษา"],
    teacher_lastname: ["นามสกุลอาจารย์", "นามสกุลที่ปรึกษา"],
    room: ["ห้อง", "room", "class"],
    faculty: ["คณะ", "faculty"],
    major: ["สาขา", "major", "branch", "หลักสูตร"],
  };
  for (const [dbCol, kws] of Object.entries(keywords)) {
    if (kws.some((kw) => lh.includes(kw.toLowerCase()))) return dbCol;
  }
  return "";
}

// ─── Main Page Component ──────────────────────────────────────────────────────
export default function ImportStudentListPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<"csv" | "excel" | null>(null);
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── 1. Upload & Parsing ─────────────────────────────────────────────────────
  const handleFileUpload = useCallback((f: File) => {
    setError(null);
    const isExcel = f.name.endsWith(".xlsx") || f.name.endsWith(".xls");
    const isCSV = f.name.endsWith(".csv");

    if (!isExcel && !isCSV) {
      setError("กรุณาอัปโหลดไฟล์ .csv, .xlsx หรือ .xls เท่านั้น");
      return;
    }

    setFileType(isExcel ? "excel" : "csv");
    setFile(f);

    const reader = new FileReader();

    const processData = (rawHeaders: string[], rawRows: any[][]) => {
      if (rawHeaders.length === 0) {
        setError("ไม่พบข้อมูลคอลัมน์ในไฟล์ที่อัปโหลด");
        setFile(null);
        return;
      }
      setParsed({ headers: rawHeaders, rows: rawRows, fileObj: f });
      
      const autoMap: ColumnMapping = {};
      rawHeaders.forEach((h) => {
        autoMap[h] = guessColumn(h);
      });
      setMapping(autoMap);
      setStep(2); // Go to mapping step
    };

    if (isExcel) {
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          const workbook = XLSX.read(buffer, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const raw = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[sheetName], { header: 1, defval: "" });
          const h = (raw[0] as string[]).map((col) => String(col ?? "").trim());
          const r = raw.slice(1).filter((row) => row.some((c) => String(c).trim() !== "")).map((row) => h.map((_, i) => String(row[i] ?? "").trim()));
          processData(h, r);
        } catch (err) {
          setError(`ไม่สามารถอ่านไฟล์ Excel ได้: ${err instanceof Error ? err.message : ""}`);
          setFile(null);
        }
      };
      reader.readAsArrayBuffer(f);
    } else {
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const clean = text.startsWith("\uFEFF") ? text.slice(1) : text;
          const workbook = XLSX.read(clean, { type: "string" });
          const sheetName = workbook.SheetNames[0];
          const raw = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[sheetName], { header: 1, defval: "" });
          const h = (raw[0] as string[]).map((col) => String(col ?? "").trim());
          const r = raw.slice(1).filter((row) => row.some((c) => String(c).trim() !== "")).map((row) => h.map((_, i) => String(row[i] ?? "").trim()));
          processData(h, r);
        } catch {
          setError("ไม่สามารถอ่านไฟล์ CSV ได้ กรุณาตรวจสอบ encoding (UTF-8)");
          setFile(null);
        }
      };
      reader.readAsText(f, "utf-8");
    }
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]);
  };
  const handleReset = () => {
    setStep(1);
    setFile(null);
    setFileType(null);
    setParsed(null);
    setMapping({});
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── 2. Mapping Submission ───────────────────────────────────────────────────
  const submitImport = async () => {
    const activeMappings = Object.entries(mapping).filter(([, v]) => v !== "");
    if (activeMappings.length === 0) {
      setError("กรุณาเลือกฟิลด์ฐานข้อมูลที่ต้องการอย่างน้อย 1 คอลัมน์");
      return;
    }

    setStep(3);
    setIsImporting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file!);
      
      // We flip the mapping: DB_COLUMN -> CSV_HEADER
      // so backend knows which csv column contains which data
      const invertedMapping: Record<string, string> = {};
      for (const [csvHeader, dbCol] of Object.entries(mapping)) {
        if (dbCol) invertedMapping[dbCol] = csvHeader;
      }
      formData.append("mapping", JSON.stringify(invertedMapping));

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to import data");
      }

      setResult({
        import_id: data.import_id,
        total_rows: data.total_rows,
        success_rows: data.success_rows,
        error_rows: data.error_rows,
      });

    } catch (err) {
      setResult({
        total_rows: parsed?.rows.length || 0,
        success_rows: 0,
        error_rows: parsed?.rows.length || 0,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsImporting(false);
    }
  };

  // ── Render Helpers ──────────────────────────────────────────────────────────
  const StepsIndicator = () => (
    <div className="flex items-center justify-center sm:justify-start w-full mb-10 overflow-hidden">
      <div className="flex items-center gap-2 sm:gap-4 text-sm font-medium">
        {/* Step 1 */}
        <div className={`flex items-center gap-2 ${step >= 1 ? "text-ksu" : "text-gray-400"}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${step === 1 ? "border-ksu bg-ksu/10" : step > 1 ? "bg-ksu border-ksu text-white" : "border-gray-300"}`}>
            {step > 1 ? <Check size={16} /> : "1"}
          </div>
          <span className="hidden sm:inline-block">อัปโหลดไฟล์</span>
        </div>
        <div className={`w-8 sm:w-16 h-0.5 rounded-full ${step >= 2 ? "bg-ksu" : "bg-gray-200"}`} />
        
        {/* Step 2 */}
        <div className={`flex items-center gap-2 ${step >= 2 ? "text-ksu" : "text-gray-400"}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${step === 2 ? "border-ksu bg-ksu/10" : step > 2 ? "bg-ksu border-ksu text-white" : "border-gray-300"}`}>
            {step > 2 ? <Check size={16} /> : "2"}
          </div>
          <span className="hidden sm:inline-block">ตรวจสอบข้อมูล</span>
        </div>
        <div className={`w-8 sm:w-16 h-0.5 rounded-full ${step >= 3 ? "bg-ksu" : "bg-gray-200"}`} />
        
        {/* Step 3 */}
        <div className={`flex items-center gap-2 ${step >= 3 ? "text-ksu" : "text-gray-400"}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${step === 3 ? "border-ksu bg-ksu/10 text-ksu" : "border-gray-300"}`}>
            3
          </div>
          <span className="hidden sm:inline-block">เสร็จสิ้น</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 md:p-10 font-sans text-gray-800 bg-gray-50/30 min-h-screen">
      <div className="max-w-5xl mx-auto">
        
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 flex items-center gap-3">
            <Database className="text-ksu" size={32} />
            นำเข้าข้อมูลระบบ
          </h1>
          <p className="text-gray-500 mt-2 text-sm max-w-2xl leading-relaxed">
            อัปโหลดรายชื่อนักศึกษาและอาจารย์ที่ปรึกษา เข้าสู่ระบบฐานข้อมูลอย่างรวดเร็ว รองรับไฟล์นามสกุล Excel (.xlsx) และ CSV
          </p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mb-6 flex items-start gap-4 p-4 rounded-xl bg-red-50/80 border border-red-100 text-red-700 animate-in fade-in slide-in-from-top-4">
            <AlertCircle size={20} className="shrink-0 mt-0.5 text-red-500" />
            <div className="flex-1">
              <h4 className="font-semibold text-sm">เกิดข้อผิดพลาด</h4>
              <p className="text-sm opacity-90">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="opacity-50 hover:opacity-100"><X size={18} /></button>
          </div>
        )}

        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/40 p-6 md:p-10 transition-all duration-500">
          <StepsIndicator />

          {/* ─────────────────────────────────────────────────────────────────
              STEP 1: UPLOAD 
             ───────────────────────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="animate-in fade-in zoom-in-95 duration-300 flex flex-col items-center">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative w-full max-w-2xl flex flex-col items-center justify-center gap-6 p-12 md:p-20 rounded-3xl border-2 border-dashed cursor-pointer transition-all duration-300 overflow-hidden ${
                  isDragging
                    ? "border-ksu bg-ksu/5 scale-[1.02]"
                    : "border-gray-200 bg-gray-50/50 hover:border-ksu hover:bg-white hover:shadow-lg hover:shadow-ksu/5"
                }`}
              >
                <div className={`absolute inset-0 bg-linear-to-tr from-ksu/5 to-transparent opacity-0 transition-opacity duration-500 ${isDragging ? "opacity-100" : "group-hover:opacity-100"}`} />
                
                <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onFileChange} />

                <div className="relative">
                  <div className="absolute -inset-4 bg-ksu/20 blur-2xl rounded-full opacity-0 scale-50 transition-all duration-500 group-hover:opacity-100 group-hover:scale-100" />
                  <div className="w-20 h-20 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center relative z-10 transition-transform duration-300 group-hover:-translate-y-2">
                    <CloudUploadIcon className="text-ksu" />
                  </div>
                </div>

                <div className="text-center relative z-10 space-y-2">
                  <h3 className="text-xl font-bold text-gray-800">คลิกเพื่ออัปโหลดไฟล์ หรือลากไฟล์มาวาง</h3>
                  <p className="text-gray-500 text-sm">
                    รองรับไฟล์ <span className="font-semibold text-emerald-600">.xlsx</span>, <span className="font-semibold text-emerald-600">.xls</span> หรือ <span className="font-semibold text-blue-500">.csv</span> ที่มีขนาดไม่เกิน 5MB
                  </p>
                </div>
              </div>

              {/* Template download hint */}
              <div className="mt-8 flex items-center gap-3 text-sm text-gray-500 bg-gray-50 px-6 py-3 rounded-2xl border border-gray-100">
                <FileSpreadsheet size={18} className="text-gray-400" />
                <p>ตารางควรมีคอลัมน์อย่างน้อย: <span className="font-medium text-gray-700">รหัสนักศึกษา, ชื่อสกุล, คณะ, สาขา, ชื่อที่ปรึกษา</span></p>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────
              STEP 2: MAPPING & PREVIEW
             ───────────────────────────────────────────────────────────────── */}
          {step === 2 && parsed && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500 space-y-8">
              
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-ksu/5 p-6 rounded-3xl border border-ksu/10">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl shadow-sm bg-white flex items-center justify-center border border-gray-100`}>
                    {fileType === "excel" ? <FileSpreadsheet size={28} className="text-emerald-500" /> : <FileText size={28} className="text-blue-500" />}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">{file?.name}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{parsed.rows.length.toLocaleString()} แถว &bull; {parsed.headers.length} คอลัมน์</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleReset} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-100 transition-colors text-sm flex items-center gap-2">
                    <RefreshCcw size={16} /> เปลี่ยนไฟล์
                  </button>
                  <button onClick={submitImport} className="px-6 py-2.5 rounded-xl bg-ksu text-white font-bold hover:bg-ksu-dark shadow-md shadow-ksu/30 transition-all text-sm flex items-center gap-2 hover:-translate-y-0.5">
                    นำเข้าข้อมูล <ArrowRight size={16} />
                  </button>
                </div>
              </div>

              <div className="grid lg:grid-cols-12 gap-8">
                {/* Left Col: Mapping */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TableProperties size={20} className="text-ksu" />
                    <h3 className="font-bold text-gray-800 text-lg">จับคู่คอลัมน์ (Mapping)</h3>
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed mb-4">
                    ระบบพยายามจับคู่ชื่อคอลัมน์อัตโนมัติ กรุณาตรวจสอบและปรับเปลี่ยนให้ตรงกับข้อมูลจริง
                  </p>

                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {parsed.headers.map((header, idx) => {
                      const isMapped = !!mapping[header];
                      return (
                        <div key={idx} className={`p-4 rounded-2xl border transition-all ${isMapped ? "bg-white border-ksu/20 shadow-sm shadow-ksu/5" : "bg-gray-50/50 border-gray-100"}`}>
                          <div className="flex items-center justify-between gap-4 mb-3 text-sm">
                            <span className="font-semibold text-gray-700 truncate line-clamp-1" title={header}>{header}</span>
                            {isMapped && <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full lowercase tracking-wider">MAPPED</span>}
                          </div>
                          <div className="relative">
                            <select
                              value={mapping[header] ?? ""}
                              onChange={(e) => setMapping((prev) => ({ ...prev, [header]: e.target.value }))}
                              className="w-full appearance-none pl-4 pr-10 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-ksu/40 focus:border-ksu transition-all cursor-pointer font-medium"
                            >
                              {DB_COLUMNS.map((col) => (
                                <option key={col.value} value={col.value}>{col.label}</option>
                              ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          </div>
                          
                          {/* Sample snippet */}
                          <div className="mt-2 text-xs text-gray-400 font-mono truncate">
                            Ex: {parsed.rows.slice(0, 2).map((r) => r[idx]).filter(Boolean).join(", ")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Col: Preview */}
                <div className="lg:col-span-7 bg-white border border-gray-200 shadow-sm rounded-3xl overflow-hidden flex flex-col">
                  <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Eye size={18} className="text-gray-400" /> ตัวอย่างข้อมูล 
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">แสดงผลลัพธ์ของ 5 แถวแรกหลังจากจัดกลุ่มแล้ว</p>
                    </div>
                  </div>

                  <div className="p-0 overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="bg-white border-b border-gray-100 text-xs text-gray-400 font-semibold uppercase tracking-wider">
                          <th className="px-6 py-4 w-12 text-center">#</th>
                          {/* Render only mapped columns in preview to keep it clean */}
                          {DB_COLUMNS.filter(c => c.value).map(dbcol => {
                            // Find if any CSV header is mapped to this dbcol
                            const matchedHeader = parsed.headers.find(h => mapping[h] === dbcol.value);
                            return (
                              <th key={dbcol.value} className="px-6 py-4 whitespace-nowrap min-w-[150px]">
                                <div className="flex flex-col gap-1">
                                  <span className="text-gray-800">{dbcol.label.split("(")[0].trim()}</span>
                                  {matchedHeader ? (
                                    <span className="text-ksu text-[10px] lowercase px-2 py-0.5 bg-ksu/10 rounded-full w-fit max-w-full truncate">{matchedHeader}</span>
                                  ) : (
                                    <span className="text-gray-300 text-[10px] font-normal italic">- ว่าง -</span>
                                  )}
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 bg-gray-50/20">
                        {parsed.rows.slice(0, PREVIEW_ROWS).map((row, ri) => (
                          <tr key={ri} className="hover:bg-white transition-colors">
                            <td className="px-6 py-4 text-center text-gray-300 font-mono text-xs">{ri + 1}</td>
                            {DB_COLUMNS.filter(c => c.value).map(dbcol => {
                              const matchedHeaderIdx = parsed.headers.findIndex(h => mapping[h] === dbcol.value);
                              const cellValue = matchedHeaderIdx >= 0 ? row[matchedHeaderIdx] : "";
                              
                              let displayValue: React.ReactNode = cellValue;
                              if (cellValue && typeof cellValue === 'string') {
                                if (dbcol.value.endsWith("_fullname")) {
                                  const { firstName, lastName } = processName(cellValue);
                                  displayValue = (
                                    <div className="flex items-center gap-1.5">
                                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-md text-xs font-medium" title="First Name">{firstName}</span>
                                      {lastName && <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md text-xs font-medium" title="Last Name">{lastName}</span>}
                                    </div>
                                  );
                                } else if (dbcol.value.endsWith("_firstname")) {
                                  displayValue = <span className="text-blue-700">{removePrefix(cellValue)}</span>;
                                }
                              }

                              return (
                                <td key={dbcol.value} className="px-6 py-4 text-gray-700 max-w-[200px] truncate" title={String(cellValue)}>
                                  {displayValue || <span className="text-gray-200">—</span>}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {parsed.rows.length > PREVIEW_ROWS && (
                    <div className="bg-gray-50 text-center py-3 border-t border-gray-100 text-xs text-gray-500 font-medium">
                      + อีก {(parsed.rows.length - PREVIEW_ROWS).toLocaleString()} แถว
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────
              STEP 3: IMPORTING & RESULT
             ───────────────────────────────────────────────────────────────── */}
          {step === 3 && (
            <div className="animate-in slide-in-from-bottom-8 fade-in duration-500 flex flex-col items-center justify-center py-10 min-h-[400px]">
              
              {isImporting ? (
                <div className="text-center space-y-6 flex flex-col items-center">
                  <div className="relative">
                     <div className="absolute inset-0 bg-ksu blur-xl rounded-full opacity-20 animate-pulse" />
                     <Loader2 size={64} className="text-ksu animate-spin relative z-10" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800 tracking-tight">กำลังนำเข้าข้อมูลหลังบ้าน...</h2>
                    <p className="text-gray-500 mt-2 text-sm max-w-sm mx-auto">
                      ประมวลผลข้อมูล ตัดคำนำหน้า เช็คความซ้ำซ้อน และบันทึกลงฐานข้อมูล โปรดรอสักครู่
                    </p>
                  </div>
                </div>
              ) : result ? (
                <div className="w-full max-w-2xl bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 p-8 md:p-12 text-center overflow-hidden relative">
                  
                  {/* Result Header */}
                  {result.error ? (
                    <div className="w-20 h-20 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                      <AlertCircle size={40} />
                    </div>
                  ) : result.error_rows === 0 ? (
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                       <div className="absolute inset-0 bg-emerald-400 blur-xl opacity-20" />
                       <CheckCircle2 size={40} className="relative z-10" />
                    </div>
                  ) : (
                    <div className="w-20 h-20 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
                      <AlertCircle size={40} />
                    </div>
                  )}

                  <h2 className="text-2xl font-black text-gray-800 mb-2">
                    {result.error ? "เกิดข้อผิดพลาดในการนำเข้า" : "สรุปผลการนำเข้าข้อมูล"}
                  </h2>
                  <p className="text-gray-500 text-sm mb-10">ระบบได้ตรวจสอบและบันทึกข้อมูลของคุณเรียบร้อยแล้ว</p>

                  <div className="grid grid-cols-2 gap-4 mb-10">
                    <div className="bg-emerald-50/50 border border-emerald-100 px-6 py-8 rounded-3xl">
                      <p className="text-emerald-700 font-semibold mb-1">นำเข้าสำเร็จ</p>
                      <p className="text-5xl font-black text-emerald-500 drop-shadow-xs">{result.success_rows}</p>
                      <p className="text-xs text-emerald-600/60 mt-2 font-medium">รายการ</p>
                    </div>
                    <div className={`border px-6 py-8 rounded-3xl ${result.error_rows > 0 ? "bg-red-50/50 border-red-100" : "bg-gray-50 border-gray-100"}`}>
                      <p className={`font-semibold mb-1 ${result.error_rows > 0 ? "text-red-700" : "text-gray-500"}`}>ข้อมูลที่ไม่สมบูรณ์</p>
                      <p className={`text-5xl font-black drop-shadow-xs ${result.error_rows > 0 ? "text-red-500" : "text-gray-400"}`}>{result.error_rows}</p>
                      <p className={`text-xs mt-2 font-medium ${result.error_rows > 0 ? "text-red-600/60" : "text-gray-400"}`}>รายการ</p>
                    </div>
                  </div>

                  {result.error && (
                    <div className="bg-red-50 text-red-600 text-sm p-4 rounded-xl text-left border border-red-100 mb-8 font-mono">
                      {result.error}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button onClick={handleReset} className="px-8 py-3.5 rounded-2xl bg-gray-900 text-white font-bold hover:bg-gray-800 shadow-lg shadow-gray-900/20 transition-all">
                      นำเข้าไฟล์ใหม่
                    </button>
                    <button onClick={() => window.location.href='/dashboard-admin/overview'} className="px-8 py-3.5 rounded-2xl bg-white border-2 border-gray-200 text-gray-700 font-bold hover:border-gray-300 hover:bg-gray-50 transition-all">
                      กลับสู่แดชบอร์ด
                    </button>
                  </div>

                </div>
              ) : null}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function CloudUploadIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
       <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
       <path d="M12 12v9" />
       <path d="m8 16 4-4 4 4" />
    </svg>
  );
}
