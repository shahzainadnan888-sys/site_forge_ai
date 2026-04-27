import { DEFAULT_SIGNUP_CREDITS } from "@/lib/credit-economy";

const SESSION_KEY = "siteforge-session";
const USERS_KEY = "siteforge-users";
const BONUS_ACCOUNT_EMAIL = "shahzainadnan1010@gmail.com";
const BONUS_ACCOUNT_CREDITS = 10_000;
const BONUS_10K_GRANTED_KEY = "siteforge-bonus-10k-once";

type StoredUser = {
  fullName: string;
  email: string;
  password: string;
  credits: number;
  avatarDataUrl?: string;
};

type Session = {
  fullName?: string;
  email?: string;
  credits?: number;
  avatarDataUrl?: string;
};

function loadUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredUser[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function isBonus10kOneTimeComplete(): boolean {
  try {
    return localStorage.getItem(BONUS_10K_GRANTED_KEY) === "1";
  } catch {
    return true;
  }
}

function setBonus10kOneTimeComplete() {
  try {
    localStorage.setItem(BONUS_10K_GRANTED_KEY, "1");
  } catch {
    // ignore
  }
}

export function getInitialCreditsForEmail(email: string): number {
  if (email.trim().toLowerCase() === BONUS_ACCOUNT_EMAIL) return BONUS_ACCOUNT_CREDITS;
  return DEFAULT_SIGNUP_CREDITS;
}

/**
 * One-time promotional grant for the configured bonus account only.
 * There is intentionally no recurring/daily refill logic.
 */
export function applyBonusAccountCredits(): void {
  if (typeof window === "undefined") return;
  if (isBonus10kOneTimeComplete()) return;

  const target = BONUS_ACCOUNT_EMAIL;
  let changed = false;
  try {
    const users = loadUsers();
    const idx = users.findIndex((u) => u.email.toLowerCase() === target);
    if (idx >= 0) {
      users[idx] = { ...users[idx], credits: BONUS_ACCOUNT_CREDITS };
      saveUsers(users);
      changed = true;
    }

    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Session;
      if (s.email?.trim().toLowerCase() === target) {
        localStorage.setItem(
          SESSION_KEY,
          JSON.stringify({ ...s, credits: BONUS_ACCOUNT_CREDITS })
        );
        changed = true;
      }
    }

    if (changed) {
      setBonus10kOneTimeComplete();
      emitSiteforgeSessionUpdate();
    }
  } catch {
    // ignore
  }
}

export const SITEFORGE_SESSION_EVENT = "sf-siteforge-session";

export function emitSiteforgeSessionUpdate() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SITEFORGE_SESSION_EVENT));
}
