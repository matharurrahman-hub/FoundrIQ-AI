import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./use-auth";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  role: string | null;
  avatar_url: string | null;
  dark_mode: boolean;
  compact_layout: boolean;
  keyboard_shortcuts: boolean;
  ai_autopilot: boolean;
  notify_blueprints: boolean;
  notify_weekly_reports: boolean;
  notify_product_updates: boolean;
  notify_marketing: boolean;
  created_at?: string | null;
};

export type ProfileUpdate = Partial<Omit<Profile, "id">>;

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const CHANGE_EVENT = "foundriq:profile-changed";

function storageKey(userId: string) {
  return `foundriq:profile:v1:${userId}`;
}

function defaultProfile(userId: string, email: string | null, fullName: string | null, createdAt: string | null): Profile {
  const name = (fullName || (email ? email.split("@")[0] : null)) ?? null;
  const [first = null, ...rest] = (name ?? "").split(" ");
  return {
    id: userId,
    email,
    full_name: name,
    first_name: first || null,
    last_name: rest.length ? rest.join(" ") : null,
    company: null,
    role: null,
    avatar_url: null,
    dark_mode: true,
    compact_layout: false,
    keyboard_shortcuts: true,
    ai_autopilot: true,
    notify_blueprints: true,
    notify_weekly_reports: true,
    notify_product_updates: true,
    notify_marketing: false,
    created_at: createdAt,
  };
}

function readProfile(userId: string): Profile | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as Profile;
  } catch {
    return null;
  }
}

function writeProfile(p: Profile) {
  try {
    localStorage.setItem(storageKey(p.id), JSON.stringify(p));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch { /* ignore */ }
}

async function fileToCompressedDataUrl(file: File): Promise<string> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("Could not read the image."));
    fr.readAsDataURL(file);
  });
  // Downscale via canvas to keep localStorage small.
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not decode the image."));
    el.src = dataUrl;
  });
  const MAX = 384;
  const scale = Math.min(1, MAX / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function useProfile() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [updating, setUpdating] = useState(false);

  // Load / seed profile whenever the signed-in user changes.
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const existing = readProfile(userId);
    if (existing) {
      // Keep email + created_at in sync with the auth user.
      const merged: Profile = {
        ...existing,
        email: existing.email ?? user?.email ?? null,
        created_at: existing.created_at ?? user?.created_at ?? null,
      };
      setProfile(merged);
      if (merged.email !== existing.email || merged.created_at !== existing.created_at) {
        writeProfile(merged);
      }
    } else {
      const seeded = defaultProfile(
        userId,
        user?.email ?? null,
        (user?.user_metadata?.full_name as string) ??
          (user?.user_metadata?.name as string) ??
          null,
        user?.created_at ?? null,
      );
      writeProfile(seeded);
      setProfile(seeded);
    }
  }, [userId, user?.email, user?.created_at]);

  // Cross-tab / same-tab reactivity.
  useEffect(() => {
    if (!userId) return;
    const sync = () => {
      const next = readProfile(userId);
      if (next) setProfile(next);
    };
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [userId]);

  const update = useCallback(
    async (patch: ProfileUpdate) => {
      if (!userId) throw new Error("Not signed in");
      setUpdating(true);
      try {
        const current = readProfile(userId) ?? profile;
        if (!current) throw new Error("Profile not ready");
        const next: Profile = { ...current, ...patch, id: userId };
        // Keep name parts consistent.
        if (patch.full_name !== undefined) {
          const [first = null, ...rest] = (patch.full_name ?? "").split(" ");
          next.first_name = first || null;
          next.last_name = rest.length ? rest.join(" ") : null;
        }
        writeProfile(next);
        setProfile(next);
        return next;
      } finally {
        setUpdating(false);
      }
    },
    [userId, profile],
  );

  const uploadAvatar = useCallback(
    async (file: File) => {
      if (!userId) throw new Error("Not signed in");
      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error("Only PNG, JPG or WEBP images are allowed.");
      }
      if (file.size > MAX_AVATAR_BYTES) {
        throw new Error("Image must be under 5MB.");
      }
      const dataUrl = await fileToCompressedDataUrl(file);
      return update({ avatar_url: dataUrl });
    },
    [userId, update],
  );

  const removeAvatar = useCallback(async () => {
    return update({ avatar_url: null });
  }, [update]);

  const refetch = useCallback(async () => {
    if (!userId) return null;
    const next = readProfile(userId);
    if (next) setProfile(next);
    return next;
  }, [userId]);

  return {
    profile,
    loading: authLoading || (Boolean(userId) && !profile),
    error: null as Error | null,
    update,
    updating,
    uploadAvatar,
    removeAvatar,
    refetch,
  };
}

/** Accepts a data URL, http(s) URL or blob URL. */
export function useAvatarUrl(pathOrUrl: string | null | undefined) {
  if (!pathOrUrl) return null;
  return pathOrUrl;
}
