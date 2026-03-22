export const NAME_PREFIXES = [
  "นางสาว",
  "อาจารย์",
  "นาย",
  "นาง",
  "ดร.",
  "ผศ.ดร.",
  "รศ.ดร.",
  "ศ.ดร.",
  "ผศ.",
  "รศ.",
  "ศ.",
  "อ."
];

export function removePrefix(name: string): string {
  let cleanName = name.trim();
  const sortedPrefixes = [...NAME_PREFIXES].sort((a, b) => b.length - a.length);

  for (const prefix of sortedPrefixes) {
    if (cleanName.startsWith(prefix)) {
      cleanName = cleanName.substring(prefix.length).trim();
      break; 
    }
  }
  return cleanName;
}

export function processName(fullName: string) {
  if (!fullName) return { firstName: "", lastName: "" };
  
  let cleanName = removePrefix(fullName);

  // Split by whitespace
  const parts = cleanName.split(/\s+/).filter(Boolean);
  
  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }
  
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  // First word is first name, last word is last name
  const firstName = parts[0];
  const lastName = parts[parts.length - 1];

  return { firstName, lastName };
}
