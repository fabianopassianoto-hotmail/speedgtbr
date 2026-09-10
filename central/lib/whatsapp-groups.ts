export const GENERAL_WHATSAPP_GROUP_URL =
  "https://chat.whatsapp.com/Jz9Zg4z1q302rXOlaI8KKk";

const DEFAULT_DIVISION_GROUPS: Record<string, string> = {
  A: "https://chat.whatsapp.com/ImrTHHzRHIQGkR8EWxMyCN",
  B: "https://chat.whatsapp.com/C8ew4ceVlso6eb5zsslz7f",
  C: "https://chat.whatsapp.com/C8ew4ceVlso6eb5zsslz7f",
  ACESSO: "https://chat.whatsapp.com/GJGDoPbPMtUGtKgMmknET9",
};

export function defaultDivisionGroupUrl(
  code: string,
  name?: string | null,
): string | null {
  const normalizedCode = normalize(code);
  if (DEFAULT_DIVISION_GROUPS[normalizedCode]) {
    return DEFAULT_DIVISION_GROUPS[normalizedCode];
  }
  if (normalize(name ?? "").includes("ACESSO")) {
    return DEFAULT_DIVISION_GROUPS.ACESSO;
  }
  return null;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}
