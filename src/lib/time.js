export function nowIso() {
  return new Date().toISOString();
}

export function addHours(isoString, hours) {
  const date = new Date(isoString);
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString();
}

export function compareIso(a, b) {
  return new Date(a).getTime() - new Date(b).getTime();
}
