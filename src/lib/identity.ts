"use client";

const KEY_PREFIX = "tahadi:player:";
const CLIENT_KEY = "tahadi:client-id";

/**
 * معرّف ثابت للجهاز يُحفظ في localStorage.
 * لو أعاد اللاعب فتح الصفحة يرجع لنفس الفريق ونفس النقاط.
 */
export function getClientId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(CLIENT_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `c_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.localStorage.setItem(CLIENT_KEY, id);
  }
  return id;
}

export interface StoredPlayer {
  playerId: string;
  name: string;
  team: string;
  category: string;
}

export function rememberPlayer(code: string, player: StoredPlayer) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_PREFIX + code.toUpperCase(), JSON.stringify(player));
}

export function recallPlayer(code: string): StoredPlayer | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY_PREFIX + code.toUpperCase());
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredPlayer;
  } catch {
    return null;
  }
}

export function forgetPlayer(code: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY_PREFIX + code.toUpperCase());
}

/** رمز الغرفة الذي أنشأه هذا المتصفّح كمقدّم */
export function rememberHostRoom(code: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("tahadi:host-room", code.toUpperCase());
}

export function recallHostRoom(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("tahadi:host-room");
}
