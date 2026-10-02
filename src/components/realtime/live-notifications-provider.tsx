"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/src/lib/supabase/browser";
import {
  getLastPlayDiagnostic,
  installIvoireAudioUnlock,
  isIvoireAudioUnlocked,
  listenForCrossTabSoundClaims,
  markPlayedNotification,
  playNotificationEvent,
} from "@/src/lib/audio/ivoire-tones";
import type { InboxItem } from "@/src/lib/notifications/inbox-item";

export type LiveConnection = "offline" | "reconnecting" | "live";

export type RealtimeProbe = {
  supabaseUrl: "configured" | "missing";
  supabaseHost: string;
  authUser: "authenticated" | "missing";
  jwtAttached: "yes" | "no";
  channelName: string;
  channelStatus: string;
  lastDbEventAt: string | null;
  lastDbTable: string | null;
  lastDbEventType: string | null;
  lastDbIdShort: string | null;
  lastUiUpdateAt: string | null;
};

export function emptyProbe(): RealtimeProbe {
  return {
    supabaseUrl: "missing",
    supabaseHost: "—",
    authUser: "missing",
    jwtAttached: "no",
    channelName: "—",
    channelStatus: "IDLE",
    lastDbEventAt: null,
    lastDbTable: null,
    lastDbEventType: null,
    lastDbIdShort: null,
    lastUiUpdateAt: null,
  };
}

export type LiveToast = {
  id: string;
  title: string;
  message: string;
  href?: string;
  label?: string;
};

export type LastPlayState = {
  at: string;
  cue: string;
  result: "resolved" | "rejected" | "not_called";
  reason?: string;
};

type LiveContextValue = {
  role: "guest" | "customer" | "admin";
  connection: LiveConnection;
  unread: number;
  items: InboxItem[];
  toasts: LiveToast[];
  soundsEnabled: boolean;
  audioUnlocked: boolean;
  dashboardTick: number;
  lastEvent: { at: string; eventType: string } | null;
  lastPlay: LastPlayState | null;
  probe: RealtimeProbe;
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
  const [dashboardTick, setDashboardTick] = useState(0);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [lastEvent, setLastEvent] = useState<{ at: string; eventType: string } | null>(null);
  const [lastPlay, setLastPlay] = useState<LastPlayState | null>(null);
  const [probe, setProbe] = useState<RealtimeProbe>(emptyProbe);
  const soundsRef = useRef(initialSounds);
  const userIdRef = useRef<string | null>(null);
  const roleRef = useRef(initialRole);
  const connectionRef = useRef<LiveConnection>(initialRole === "guest" ? "offline" : "reconnecting");
  const ingestRef = useRef<(row: InboxItem, audience: "admin" | "customer") => void>(() => undefined);

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
    const now = new Date().toISOString();
    setLastEvent({ at: now, eventType: row.event_type });
    setProbe((current) => ({ ...current, lastUiUpdateAt: now }));
    if (row.order_id) {
      setOrderTicks((current) => ({ ...current, [row.order_id as string]: Date.now() }));
    }
    if (audience === "admin") setDashboardTick(Date.now());
    if (!row.read_at) {
      pushToast({
        id: `${row.kind}-${row.id}`,
        title: audience === "admin" ? row.title : row.kind === "order" ? "Order update" : row.title,
        message: audience === "admin" ? (row.message.split("\n")[0] ?? row.message) : (row.message || row.title),
        href: audience === "admin" ? row.action_href || "/admin" : hrefForCustomer(row),
        label: audience === "admin" ? "View" : row.kind === "order" ? "View Order" : row.action_label || "View",
      });
      if (soundsRef.current) {
        void playNotificationEvent(row.event_type, row.id).then(() => {
          setLastPlay(getLastPlayDiagnostic());
          setAudioUnlocked(isIvoireAudioUnlocked());
        });
      } else {
        setLastPlay({ at: new Date().toISOString(), cue: row.event_type, result: "not_called", reason: "sounds_off" });
      }
    }
  }, [mergeItems, pushToast]);

  useEffect(() => {
    ingestRef.current = ingestLive;
  }, [ingestLive]);
  useEffect(() => installIvoireAudioUnlock(), []);
  useEffect(() => {
    const sync = () => setAudioUnlocked(isIvoireAudioUnlocked());
    sync();
    window.addEventListener("pointerdown", sync, { capture: true });
    return () => window.removeEventListener("pointerdown", sync, true);
  }, []);
  useEffect(() => listenForCrossTabSoundClaims((id) => markPlayedNotification(id)), []);

  useEffect(() => {
    const client = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof client.channel> | null = null;
    let retryTimer: number | undefined;
    let runId = 0;

    function hostFromUrl(url: string) {
      try {
        return new URL(url).host;
      } catch {
        return "invalid";
      }
    }

    function noteChange(table: string, eventType: string, id?: string) {
      setProbe((current) => ({
        ...current,
        lastDbEventAt: new Date().toISOString(),
        lastDbTable: table,
        lastDbEventType: eventType,
        lastDbIdShort: id ? id.slice(0, 8) : current.lastDbIdShort,
      }));
    }

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

    const scheduleRetry = () => {
      window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(() => {
        if (!cancelled && connectionRef.current !== "live") void start();
      }, 2500);
    };

    async function start() {
      const thisRun = ++runId;
      let url = "";
      try {
        url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
      } catch {
        url = "";
      }
      setProbe((current) => ({
        ...current,
        supabaseUrl: url ? "configured" : "missing",
        supabaseHost: url ? hostFromUrl(url) : "—",
        channelStatus: "CONNECTING",
      }));
      const { data: sessionData } = await client.auth.getSession();
      const session = sessionData.session;
      if (cancelled || thisRun !== runId) return;
      if (!session?.user || !session.access_token) {
        setRole("guest");
        setConnection("offline");
        setProbe((current) => ({
          ...current,
          authUser: "missing",
          jwtAttached: "no",
          channelName: "—",
          channelStatus: "NO_SESSION",
        }));
        return;
      }
      let jwtAttached: "yes" | "no" = "no";
      try {
        const realtime = client.realtime as { setAuth?: (token?: string) => Promise<unknown> };
        if (typeof realtime.setAuth === "function") {
          await realtime.setAuth(session.access_token);
        }
        jwtAttached = "yes";
      } catch {
        jwtAttached = "no";
      }
      if (cancelled || thisRun !== runId) return;
      const { data: profile } = await client
        .from("profiles")
        .select("role, notification_sounds, admin_notification_sounds")
        .eq("id", session.user.id)
        .maybeSingle();
      if (cancelled || thisRun !== runId) return;
      const nextRole = profile?.role === "admin" ? "admin" : "customer";
      setRole(nextRole);
      roleRef.current = nextRole;
      const enabled = nextRole === "admin" ? profile?.admin_notification_sounds !== false : profile?.notification_sounds !== false;
      setSoundsEnabled(enabled);
      soundsRef.current = enabled;
      userIdRef.current = session.user.id;
      setConnection("reconnecting");
      await reconcile(nextRole, session.user.id);
      if (cancelled || thisRun !== runId) return;
      if (channel) {
        await client.removeChannel(channel);
        channel = null;
      }
      const channelName = nextRole === "admin" ? `admin-live-${session.user.id}` : `customer-live-${session.user.id}`;
      setProbe((current) => ({
        ...current,
        authUser: "authenticated",
        jwtAttached,
        channelName,
        channelStatus: "SUBSCRIBING",
      }));

      const next = client.channel(channelName);
      if (nextRole === "admin") {
        next
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_notifications" }, (payload) => {
            const row = payload.new as Parameters<typeof adminItem>[0];
            noteChange("admin_notifications", "INSERT", row?.id);
            if (row?.id) ingestRef.current(adminItem(row), "admin");
          })
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "admin_notifications" }, (payload) => {
            const row = payload.new as { id: string; read_at: string | null };
            noteChange("admin_notifications", "UPDATE", row?.id);
            setItems((current) => current.map((item) => (item.id === row.id ? { ...item, read_at: row.read_at } : item)));
          });
      } else {
        next
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "customer_notifications" }, (payload) => {
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
            noteChange("customer_notifications", "INSERT", row?.id);
            if (row.user_id && row.user_id !== session.user.id) return;
            if (!row.id) return;
            ingestRef.current({
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
          })
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "customer_notifications" }, (payload) => {
            const row = payload.new as { id: string; read_at: string | null; user_id?: string };
            noteChange("customer_notifications", "UPDATE", row?.id);
            if (row.user_id && row.user_id !== session.user.id) return;
            setItems((current) => current.map((item) => (item.id === row.id ? { ...item, read_at: row.read_at } : item)));
          })
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
            noteChange("customer_announcements", payload.eventType, row?.id);
            const previous = payload.old as { status?: string } | undefined;
            const newlyPublished =
              Boolean(row.id) &&
              row.status === "published" &&
              !row.archived_at &&
              (payload.eventType === "INSERT" || previous?.status !== "published");
            if (!newlyPublished || !row.id) return;
            ingestRef.current({
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
          });
      }
      channel = next.subscribe((status, err) => {
        const label = err ? `${status}:${err.message ?? "error"}` : status;
        setProbe((current) => ({ ...current, channelStatus: label, jwtAttached, authUser: "authenticated", channelName }));
        if (status === "SUBSCRIBED") {
          connectionRef.current = "live";
          setConnection("live");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          connectionRef.current = "reconnecting";
          setConnection("reconnecting");
          scheduleRetry();
        }
      });
    }

    void start();
    const { data: authListener } = client.auth.onAuthStateChange((event, session) => {
      if (session?.access_token) {
        const realtime = client.realtime as { setAuth?: (token?: string) => Promise<unknown> };
        if (typeof realtime.setAuth === "function") void realtime.setAuth(session.access_token);
        setProbe((current) => ({ ...current, jwtAttached: "yes", authUser: "authenticated" }));
      }
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        if (connectionRef.current !== "live") void start();
      }
    });

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
      runId += 1;
      window.clearTimeout(retryTimer);
      authListener.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", restartIfNeeded);
      if (channel) void client.removeChannel(channel);
    };
  }, [mergeItems]);

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
      audioUnlocked,
      dashboardTick,
      lastEvent,
      lastPlay,
      probe,
      orderTicks,
      markItemRead,
      markAllRead,
      dismissToast: (id: string) => setToasts((current) => current.filter((item) => item.id !== id)),
    }),
    [role, connection, unread, items, toasts, soundsEnabled, audioUnlocked, dashboardTick, lastEvent, lastPlay, probe, orderTicks, markItemRead, markAllRead],
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
      audioUnlocked: false,
      dashboardTick: 0,
      lastEvent: null,
      lastPlay: null,
      probe: emptyProbe(),
      orderTicks: {} as Record<string, number>,
      markItemRead: () => undefined,
      markAllRead: () => undefined,
      dismissToast: () => undefined,
    };
  }
  return value;
}
