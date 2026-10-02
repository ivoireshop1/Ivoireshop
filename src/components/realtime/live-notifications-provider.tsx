"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/src/lib/supabase/browser";
import {
  installIvoireAudioUnlock,
  listenForCrossTabSoundClaims,
  markPlayedNotification,
  playNotificationEvent,
} from "@/src/lib/audio/ivoire-tones";
import type { InboxItem } from "@/src/lib/notifications/inbox-item";

export type LiveConnection = "offline" | "reconnecting" | "live";

export type LiveToast = {
  id: string;
  title: string;
  message: string;
  href?: string;
  label?: string;
};

type LiveContextValue = {
  role: "guest" | "customer" | "admin";
  connection: LiveConnection;
  unread: number;
  items: InboxItem[];
  toasts: LiveToast[];
  soundsEnabled: boolean;
  orderTicks: Record<string, number>;
  markItemRead: (item: InboxItem) => void;
  markAllRead: () => void;
  dismissToast: (id: string) => void;
};

const LiveContext = createContext<LiveContextValue | null>(null);

function hrefForCustomer(item: InboxItem) {
  if (item.kind === "order" && item.order_id) return `/account/orders/${item.order_id}`;
  return item.action_href || "/account/notifications";
}

function hrefForAdmin(row: { target_path?: string | null; order_id?: string | null }) {
  if (row.target_path) return row.target_path;
  if (row.order_id) return `/admin/orders/${row.order_id}`;
  return "/admin";
}

function adminItem(row: {
  id: string;
  event_type: string;
  title: string;
  message: string;
  order_id?: string | null;
  target_path?: string | null;
  created_at: string;
  read_at: string | null;
}): InboxItem {
  return {
    id: row.id,
    kind: "order",
    title: row.title,
    message: row.message,
    created_at: row.created_at,
    read_at: row.read_at,
    order_id: row.order_id,
    event_type: row.event_type,
    action_href: hrefForAdmin(row),
    action_label: "View",
  };
}

export function LiveNotificationsProvider({
  children,
  initialRole = "guest",
  initialItems = [],
  initialSounds = true,
}: {
  children: ReactNode;
  initialRole?: "guest" | "customer" | "admin";
  initialItems?: InboxItem[];
  initialSounds?: boolean;
}) {
  const [role, setRole] = useState(initialRole);
  const [connection, setConnection] = useState<LiveConnection>(initialRole === "guest" ? "offline" : "reconnecting");
  const [items, setItems] = useState<InboxItem[]>(initialItems);
  const [toasts, setToasts] = useState<LiveToast[]>([]);
  const [soundsEnabled, setSoundsEnabled] = useState(initialSounds);
  const [orderTicks, setOrderTicks] = useState<Record<string, number>>({});
  const soundsRef = useRef(initialSounds);
  const userIdRef = useRef<string | null>(null);
  const roleRef = useRef(initialRole);
  const connectionRef = useRef<LiveConnection>(initialRole === "guest" ? "offline" : "reconnecting");

  useEffect(() => {
    soundsRef.current = soundsEnabled;
  }, [soundsEnabled]);
  useEffect(() => {
    roleRef.current = role;
  }, [role]);
  useEffect(() => {
    connectionRef.current = connection;
  }, [connection]);

  const pushToast = useCallback((toast: LiveToast) => {
    setToasts((current) => [...current.filter((item) => item.id !== toast.id), toast].slice(-4));
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== toast.id));
    }, 7000);
  }, []);

  const mergeItems = useCallback((incoming: InboxItem[]) => {
    setItems((current) => {
      const next = [...current];
      for (const row of incoming) {
        const index = next.findIndex((item) => item.id === row.id && item.kind === row.kind);
        if (index >= 0) next[index] = { ...next[index], ...row };
        else next.unshift(row);
      }
      return next.slice(0, 80);
    });
  }, []);

  const ingestLive = useCallback((row: InboxItem, audience: "admin" | "customer") => {
    mergeItems([row]);
    if (row.order_id) {
      setOrderTicks((current) => ({ ...current, [row.order_id as string]: Date.now() }));
    }
    if (!row.read_at) {
      pushToast({
        id: `${row.kind}-${row.id}`,
        title: row.title,
        message: audience === "admin" ? (row.message.split("\n")[0] ?? row.message) : row.message,
        href: audience === "admin" ? row.action_href || "/admin" : hrefForCustomer(row),
        label: audience === "admin" ? "View" : row.kind === "order" ? "View Order" : row.action_label || "View",
      });
      if (soundsRef.current) void playNotificationEvent(row.event_type, row.id);
    }
  }, [mergeItems, pushToast]);

  useEffect(() => installIvoireAudioUnlock(), []);
  useEffect(() => listenForCrossTabSoundClaims((id) => markPlayedNotification(id)), []);

  useEffect(() => {
    const client = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof client.channel> | null = null;

    async function reconcile(nextRole: "admin" | "customer", userId: string) {
      if (nextRole === "admin") {
        const { data: rows } = await client
          .from("admin_notifications")
          .select("id, event_type, title, message, order_id, target_path, created_at, read_at")
          .order("created_at", { ascending: false })
          .limit(40);
        if (!cancelled && rows) mergeItems(rows.map(adminItem));
        return;
      }
      const { data: notes } = await client
        .from("customer_notifications")
        .select("id, order_id, event_type, title, message, confirmation_code, read_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(40);
      if (!cancelled && notes) {
        mergeItems(notes.map((row) => ({
          id: row.id,
          kind: "order" as const,
          title: row.title,
          message: row.message,
          created_at: row.created_at,
          read_at: row.read_at,
          order_id: row.order_id,
          confirmation_code: row.confirmation_code,
          event_type: row.event_type,
        })));
      }
    }

    async function start() {
      const { data } = await client.auth.getUser();
      if (cancelled || !data.user) {
        setRole("guest");
        setConnection("offline");
        return;
      }
      const { data: profile } = await client
        .from("profiles")
        .select("role, notification_sounds, admin_notification_sounds")
        .eq("id", data.user.id)
        .maybeSingle();
      const nextRole = profile?.role === "admin" ? "admin" : "customer";
      setRole(nextRole);
      roleRef.current = nextRole;
      const enabled = nextRole === "admin" ? profile?.admin_notification_sounds !== false : profile?.notification_sounds !== false;
      setSoundsEnabled(enabled);
      soundsRef.current = enabled;
      userIdRef.current = data.user.id;
      setConnection("reconnecting");
      await reconcile(nextRole, data.user.id);
      if (cancelled) return;
      if (channel) {
        await client.removeChannel(channel);
        channel = null;
      }

      if (nextRole === "admin") {
        channel = client
          .channel(`admin-live-${data.user.id}`)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_notifications" }, (payload) => {
            ingestLive(adminItem(payload.new as Parameters<typeof adminItem>[0]), "admin");
          })
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "admin_notifications" }, (payload) => {
            const row = payload.new as { id: string; read_at: string | null };
            setItems((current) => current.map((item) => (item.id === row.id ? { ...item, read_at: row.read_at } : item)));
          })
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              connectionRef.current = "live";
              setConnection("live");
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              connectionRef.current = "reconnecting";
              setConnection("reconnecting");
            }
          });
        return;
      }

      channel = client
        .channel(`customer-live-${data.user.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "customer_notifications", filter: `user_id=eq.${data.user.id}` },
          (payload) => {
            const row = payload.new as {
              id: string;
              order_id?: string | null;
              event_type: string;
              title: string;
              message: string;
              confirmation_code?: string | null;
              read_at: string | null;
              created_at: string;
              user_id?: string;
            };
            if (row.user_id && row.user_id !== data.user.id) return;
            ingestLive({
              id: row.id,
              kind: "order",
              title: row.title,
              message: row.message,
              created_at: row.created_at,
              read_at: row.read_at,
              order_id: row.order_id,
              confirmation_code: row.confirmation_code,
              event_type: row.event_type,
            }, "customer");
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "customer_notifications", filter: `user_id=eq.${data.user.id}` },
          (payload) => {
            const row = payload.new as { id: string; read_at: string | null };
            setItems((current) => current.map((item) => (item.id === row.id ? { ...item, read_at: row.read_at } : item)));
          },
        )
        .on("postgres_changes", { event: "*", schema: "public", table: "customer_announcements" }, (payload) => {
          const row = payload.new as {
            id?: string;
            title?: string;
            message?: string;
            action_label?: string | null;
            action_href?: string | null;
            status?: string;
            published_at?: string | null;
            created_at?: string;
            archived_at?: string | null;
          };
          const previous = payload.old as { status?: string } | undefined;
          const newlyPublished =
            Boolean(row.id) &&
            row.status === "published" &&
            !row.archived_at &&
            (payload.eventType === "INSERT" || previous?.status !== "published");
          if (!newlyPublished || !row.id) return;
          ingestLive({
            id: row.id,
            kind: "announcement",
            title: row.title ?? "Announcement",
            message: row.message ?? "",
            created_at: row.published_at || row.created_at || new Date().toISOString(),
            read_at: null,
            event_type: "announcement",
            action_label: row.action_label,
            action_href: row.action_href,
          }, "customer");
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            connectionRef.current = "live";
            setConnection("live");
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            connectionRef.current = "reconnecting";
            setConnection("reconnecting");
          }
        });
    }

    void start();

    const restartIfNeeded = () => {
      if (document.visibilityState !== "visible") return;
      if (connectionRef.current === "live") return;
      void start();
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const userId = userIdRef.current;
      const currentRole = roleRef.current;
      if (userId && (currentRole === "admin" || currentRole === "customer")) {
        void reconcile(currentRole, userId);
      }
      restartIfNeeded();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", restartIfNeeded);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", restartIfNeeded);
      if (channel) void client.removeChannel(channel);
    };
  }, [ingestLive, mergeItems]);

  const markItemRead = useCallback((item: InboxItem) => {
    const client = createClient();
    setItems((current) => current.map((row) => (row.id === item.id ? { ...row, read_at: row.read_at ?? new Date().toISOString() } : row)));
    if (role === "admin") {
      void client.from("admin_notifications").update({ read_at: new Date().toISOString() }).eq("id", item.id).is("read_at", null);
      return;
    }
    if (item.kind === "announcement") {
      const userId = userIdRef.current;
      if (!userId) return;
      void client.from("customer_announcement_reads").upsert({
        announcement_id: item.id,
        user_id: userId,
        read_at: new Date().toISOString(),
      }, { onConflict: "announcement_id,user_id" });
      return;
    }
    void client.from("customer_notifications").update({ read_at: new Date().toISOString() }).eq("id", item.id).is("read_at", null);
  }, [role]);

  const markAllRead = useCallback(() => {
    const client = createClient();
    const stamp = new Date().toISOString();
    setItems((current) => current.map((row) => ({ ...row, read_at: row.read_at ?? stamp })));
    if (role === "admin") {
      void client.from("admin_notifications").update({ read_at: stamp }).is("read_at", null);
      return;
    }
    const userId = userIdRef.current;
    void client.rpc("mark_customer_notifications_read", { p_order_id: null });
    if (userId) {
      const unreadAnnouncements = items.filter((item) => item.kind === "announcement" && !item.read_at);
      if (unreadAnnouncements.length) {
        void client.from("customer_announcement_reads").upsert(
          unreadAnnouncements.map((item) => ({
            announcement_id: item.id,
            user_id: userId,
            read_at: stamp,
          })),
          { onConflict: "announcement_id,user_id" },
        );
      }
    }
  }, [items, role]);

  const unread = items.filter((item) => !item.read_at && !item.dismissed_at).length;
  const value = useMemo(
    () => ({
      role,
      connection,
      unread,
      items,
      toasts,
      soundsEnabled,
      orderTicks,
      markItemRead,
      markAllRead,
      dismissToast: (id: string) => setToasts((current) => current.filter((item) => item.id !== id)),
    }),
    [role, connection, unread, items, toasts, soundsEnabled, orderTicks, markItemRead, markAllRead],
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLiveNotifications() {
  const value = useContext(LiveContext);
  if (!value) {
    return {
      role: "guest" as const,
      connection: "offline" as const,
      unread: 0,
      items: [] as InboxItem[],
      toasts: [] as LiveToast[],
      soundsEnabled: false,
      orderTicks: {} as Record<string, number>,
      markItemRead: () => undefined,
      markAllRead: () => undefined,
      dismissToast: () => undefined,
    };
  }
  return value;
}
