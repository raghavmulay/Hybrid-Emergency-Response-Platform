/** Backend sends UTC timestamps without a Z suffix — append it so the browser parses them as UTC. */
export function parseUTC(ts: string | null | undefined): Date | null {
  if (!ts) return null;
  return new Date(ts.endsWith("Z") ? ts : ts + "Z");
}

export function formatDateTime(ts: string | null | undefined): string {
  const d = parseUTC(ts);
  return d ? d.toLocaleString() : "—";
}

export function formatTime(ts: string | null | undefined): string {
  const d = parseUTC(ts);
  return d ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
}
