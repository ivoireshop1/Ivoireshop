export type AnnouncementStatus = "draft" | "scheduled" | "published" | "expired" | "archived";

export type CustomerAnnouncement = {
  id: string;
  title: string;
  message: string;
  action_label: string | null;
  action_href: string | null;
  audience: string;
  status: AnnouncementStatus;
  starts_at: string | null;
  ends_at: string | null;
  published_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AnnouncementStatusSource = {
  status: AnnouncementStatus | string;
  starts_at: string | null;
  ends_at: string | null;
  published_at: string | null;
  archived_at: string | null;
};

export function sanitizeAnnouncementPath(value: string) {
  const path = value.trim();
  if (!path) return null;
  if (path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") && !path.includes("://")) {
    return path.slice(0, 200);
  }
  try {
    const url = new URL(path);
    if (url.protocol !== "https:") return null;
    return url.toString().slice(0, 400);
  } catch {
    return null;
  }
}

export function toDatetimeLocalValue(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function displayAnnouncementStatus(row: AnnouncementStatusSource, now = new Date()) {
  if (row.status === "archived" || row.archived_at) return "archived" as const;
  if (row.status === "draft") return "draft" as const;
  if (row.ends_at && new Date(row.ends_at) <= now) return "expired" as const;
  if (row.starts_at && new Date(row.starts_at) > now) return "scheduled" as const;
  if (row.status === "published" || row.published_at) return "published" as const;
  return row.status;
}
