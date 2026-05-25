export function formatUrlForDisplay(input: string): string {
  if (!input) return "";

  try {
    const url = new URL(input);
    const host = url.host.replace(/^www\./i, "");
    const path = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
    return `${host}${path}${url.search}${url.hash}`;
  } catch {
    return input
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/\/+$/, "");
  }
}
