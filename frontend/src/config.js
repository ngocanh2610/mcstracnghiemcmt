const DEFAULT_API = "http://localhost:4000";

export function getApiBase() {
  if (typeof window === "undefined") return DEFAULT_API;

  const envBase = import.meta?.env?.VITE_API_BASE;
  const protocol = window.location.protocol || "http:";
  const hostname = window.location.hostname || "localhost";

  if (envBase) {
    return envBase;
  }

  if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "0.0.0.0") {
    return `${protocol}//${hostname}:4000`;
  }

  return `${protocol}//${window.location.hostname || "localhost"}:4000`;
}

export const API = getApiBase();