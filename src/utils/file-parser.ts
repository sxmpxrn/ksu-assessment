import * as XLSX from "xlsx";

/**
 * Parses a buffer (either CSV or XLSX) into an array of objects
 * headers are derived from the first row natively by XLSX.
 */
export async function parseFileBuffer(buffer: Buffer, fileName: string): Promise<any[]> {
  const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || fileName.endsWith(".xlsm");
  
  if (isExcel) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    // Convert to array of objects, keeping empty cells as empty strings
    return XLSX.utils.sheet_to_json(worksheet, { defval: "" });
  } else {
    // For CSV, XLSX handles string parsing well including most encodings
    // We assume UTF-8 for text conversion.
    const text = buffer.toString("utf-8");
    // Strip BOM if present
    const cleanText = text.startsWith("\uFEFF") ? text.slice(1) : text;
    
    const workbook = XLSX.read(cleanText, { type: "string" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(worksheet, { defval: "" });
  }
}
