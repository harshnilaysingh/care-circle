export function isEligibleAccountAge(value) {
  const age = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  return Number.isInteger(age) && age >= 13 && age <= 120;
}

