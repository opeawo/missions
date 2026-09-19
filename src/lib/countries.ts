const COUNTRIES: Record<string, string> = {
  US: "United States",
  NG: "Nigeria",
  GB: "United Kingdom",
  DE: "Germany",
  FR: "France",
  CA: "Canada",
  IN: "India",
  KE: "Kenya",
  GH: "Ghana",
  ZA: "South Africa",
  BR: "Brazil",
  MX: "Mexico",
  NL: "Netherlands",
  SE: "Sweden",
  AU: "Australia",
  SG: "Singapore",
  JP: "Japan",
  KR: "South Korea",
  ES: "Spain",
  IT: "Italy",
  PL: "Poland",
  PT: "Portugal",
  IE: "Ireland",
  AE: "United Arab Emirates",
  PH: "Philippines",
  PK: "Pakistan",
  BD: "Bangladesh",
  AR: "Argentina",
  CO: "Colombia",
  CL: "Chile",
};

export const COUNTRY_OPTIONS = Object.entries(COUNTRIES)
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function countryName(code: string | null | undefined): string | null {
  if (!code) return null;
  return COUNTRIES[code.toUpperCase()] ?? code;
}
