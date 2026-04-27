import { emitSiteforgeSessionUpdate } from "@/lib/siteforge-credits";

const SESSION_KEY = "siteforge-session";
const USERS_KEY = "siteforge-users";

type Session = {
  fullName?: string;
  email?: string;
  credits?: number;
  avatarDataUrl?: string;
};

type StoredUser = {
  fullName: string;
  email: string;
  password: string;
  credits: number;
  avatarDataUrl?: string;
};

function loadUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    if (!Array.isArray(parsed)) return [];
    return parsed as StoredUser[];
  } catch {
    return [];
  }
}

function saveUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

const MAX_INPUT_BYTES = 2 * 1024 * 1024;
/** Keep under server inline Firestore cap (~900k) so avatar upload works without Firebase Storage. */
const MAX_OUTPUT_DATA_URL = 880_000;

/**
 * Resizes a chosen image to a small JPEG data URL for localStorage. Runs in the browser only.
 */
export function fileToResizedJpegDataUrl(
  file: File,
  maxEdge = 256,
  quality = 0.85
): Promise<string> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Not in browser"));
  }
  if (file.size > MAX_INPUT_BYTES) {
    return Promise.reject(new Error("File is too large. Use an image under 2 MB."));
  }
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("Please select an image file (PNG, JPEG, or WebP)."));
  }
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width < 1 || height < 1) {
        reject(new Error("Invalid image."));
        return;
      }
      if (width > maxEdge || height > maxEdge) {
        if (width >= height) {
          height = Math.round((height * maxEdge) / width);
          width = maxEdge;
        } else {
          width = Math.round((width * maxEdge) / height);
          height = maxEdge;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not process the image."));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrl.length > MAX_OUTPUT_DATA_URL) {
        reject(new Error("Image is still too large after processing. Try a smaller or simpler file."));
        return;
      }
      resolve(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read that image."));
    };
    img.src = objectUrl;
  });
}

/**
 * Saves the profile image for the current session user and the matching `siteforge-users` entry.
 * Pass `undefined` to remove the photo.
 */
export function saveProfileAvatarDataUrl(dataUrl: string | undefined): void {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return;
  let session: Session;
  try {
    session = JSON.parse(raw) as Session;
  } catch {
    return;
  }
  const email = session.email?.trim().toLowerCase();
  if (!email) return;

  const nextSession: Session = { ...session };
  if (dataUrl) {
    nextSession.avatarDataUrl = dataUrl;
  } else {
    delete nextSession.avatarDataUrl;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));

  const users = loadUsers();
  const idx = users.findIndex((u) => u.email.toLowerCase() === email);
  if (idx >= 0) {
    if (dataUrl) {
      users[idx] = { ...users[idx], avatarDataUrl: dataUrl };
    } else {
      const { avatarDataUrl, ...u } = users[idx];
      users[idx] = u;
    }
    saveUsers(users);
  }
  emitSiteforgeSessionUpdate();
}
