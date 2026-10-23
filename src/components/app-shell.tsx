"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Inbox, MessageCircle, Settings, Users, Zap } from "lucide-react";
import {
  DashboardButton,
  DashboardMenu,
  DashboardMenuContent,
  DashboardMenuItem,
  DashboardMenuTrigger,
  DashboardPopover,
  DashboardPopoverContent,
  DashboardPopoverTrigger,
  DashboardShell,
  type DashboardShellNavSection,
  type DashboardShellStatusTone,
  type DashboardShellTab,
} from "@/components/block/dashboard-shell";
import { VisitorAvatar } from "@/components/inbox/visitor-avatar";
import { heartbeatAgent, hydrateAgentProfile, useAgentProfile } from "@/lib/agent-profile";
import { DEMO_SITE_KEY } from "@/lib/conversations";
import { getSupabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const SIDEBAR_WIDTH_KEY = "chat-platform:sidebar-width";
const sidebarListeners = new Set<() => void>();
let cachedSidebarWidth: number | undefined;

function readSidebarWidth() {
  if (cachedSidebarWidth !== undefined) return cachedSidebarWidth;
  try {
    const width = Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY));
    cachedSidebarWidth = width >= 180 && width <= 400 ? width : 200;
  } catch {
    cachedSidebarWidth = 200;
  }
  return cachedSidebarWidth;
}

function subscribeSidebarWidth(notify: () => void) {
  sidebarListeners.add(notify);
  const onStorage = (event: StorageEvent) => {
    if (event.key === SIDEBAR_WIDTH_KEY || event.key === null) {
      cachedSidebarWidth = undefined;
      notify();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    sidebarListeners.delete(notify);
    window.removeEventListener("storage", onStorage);
  };
}

function saveSidebarWidth(width: number) {
  cachedSidebarWidth = width;
  try {
    window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
  } catch {
    // Resizing remains available when the browser blocks storage.
  }
  sidebarListeners.forEach((notify) => notify());
}

const navigation: DashboardShellNavSection[] = [
  {
    id: "main",
    items: [
      { id: "/dashboard", label: "Inbox", icon: Inbox, href: "/dashboard" },
      { id: "/dashboard/visitors", label: "Live visitors", icon: Users, href: "/dashboard/visitors" },
      { id: "/dashboard/canned-responses", label: "Canned responses", icon: Zap, href: "/dashboard/canned-responses" },
      { id: "/dashboard/widget", label: "Widget", icon: MessageCircle, href: "/dashboard/widget" },
      { id: "/dashboard/settings", label: "Settings", icon: Settings, href: "/dashboard/settings" },
    ],
  },
];

type NotificationRow = { id: string; title: string; detail: string; unread: boolean };

export function AppShell({
  title,
  status,
  statusTone = "success",
  tabs,
  tab,
  onTabChange,
  filters,
  toolbarActions,
  children,
}: {
  title: ReactNode;
  status?: string;
  statusTone?: DashboardShellStatusTone;
  tabs?: DashboardShellTab[];
  tab?: string;
  onTabChange?: (value: string) => void;
  filters?: ReactNode;
  toolbarActions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const sidebarWidth = useSyncExternalStore(subscribeSidebarWidth, readSidebarWidth, () => 200);
  const profile = useAgentProfile();
  const [profileReady, setProfileReady] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);

  useEffect(() => {
    let active = true;
    void hydrateAgentProfile().finally(() => {
      if (active) setProfileReady(true);
    });
    const refresh = () => {
      if (document.visibilityState === "visible") void hydrateAgentProfile();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    if (!profileReady || profile.id === "server") return;
    heartbeatAgent(profile);
    const beat = window.setInterval(() => heartbeatAgent(profile), 30_000);
    return () => window.clearInterval(beat);
  }, [profileReady, profile]);

  useEffect(() => {
    const client = getSupabase();
    if (!client) return;
    let cancelled = false;
    let siteId: string | undefined;
    let timer: number | undefined;
    const load = async () => {
      if (!siteId) {
        const { data: site } = await client
          .from("sites")
          .select("id")
          .eq("site_key", DEMO_SITE_KEY)
          .maybeSingle();
        if (!site || cancelled) return;
        siteId = site.id;
      }
      const { data } = await client
        .from("conversations")
        .select("id, visitor_name, last_message, unread_count")
        .eq("site_id", siteId)
        .order("updated_at", { ascending: false })
        .limit(30);
      if (cancelled || !data) return;
      const rows = data as {
        id: string;
        visitor_name: string | null;
        last_message: string | null;
        unread_count: number | null;
      }[];
      setUnread(rows.reduce((sum, row) => sum + (row.unread_count ?? 0), 0));
      setNotifications(
        rows
          .filter((row) => (row.unread_count ?? 0) > 0)
          .slice(0, 5)
          .map((row) => {
            const count = row.unread_count ?? 0;
            return {
              id: row.id,
              title: `${row.visitor_name?.trim() || "A visitor"} sent ${count} new ${count === 1 ? "message" : "messages"}`,
              detail: row.last_message || "Waiting for a reply",
              unread: true,
            };
          }),
      );
    };
    void load();
    const channel = client
      .channel("app-unread")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            const before = payload.old;
            const after = payload.new;
            if (before.unread_count === after.unread_count && before.last_message === after.last_message) return;
          }
          window.clearTimeout(timer);
          timer = window.setTimeout(() => void load(), 250);
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      void client.removeChannel(channel);
    };
  }, []);

  const navigationWithUnread = navigation.map((section) => ({
    ...section,
    items: section.items.map((item) =>
      item.id === "/dashboard" ? { ...item, count: unread || undefined } : item,
    ),
  }));

  return (
    <div className="h-dvh">
      <DashboardShell
        brand={{ name: "Chat Platform" }}
        navigation={navigationWithUnread}
        linkComponent={Link}
        activeItemId={pathname}
        title={title}
        status={status}
        statusTone={statusTone}
        sidebarWidth={sidebarWidth}
        onSidebarWidthChange={saveSidebarWidth}
        tabs={tabs}
        tab={tab}
        onTabChange={onTabChange}
        filters={filters}
        toolbarActions={toolbarActions}
        headerActions={
          <>
            <DashboardPopover>
              <DashboardPopoverTrigger asChild>
                <DashboardButton variant="ghost" size="icon" aria-label="Notifications">
                  <span className="relative flex items-center justify-center">
                    <Bell aria-hidden />
                    {unread > 0 && (
                      <span aria-hidden className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-(--obsidian-dashboard-shell-danger)" />
                    )}
                  </span>
                </DashboardButton>
              </DashboardPopoverTrigger>
              <DashboardPopoverContent align="end" className="w-80 p-0">
                <p className="border-b border-(--obsidian-dashboard-shell-border) px-3 py-2.5 text-xs font-medium text-(--obsidian-dashboard-shell-foreground)">
                  Notifications
                </p>
                <ul className="flex flex-col p-1">
                  {notifications.length === 0 ? (
                    <li className="px-2.5 py-3 text-[11.5px] leading-4 text-(--obsidian-dashboard-shell-text-subtle)">
                      You&rsquo;re all caught up.
                    </li>
                  ) : (
                    notifications.map((notification) => (
                    <li key={notification.id}>
                      <Link
                        href={`/dashboard?conversation=${encodeURIComponent(notification.id)}`}
                        className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-(--obsidian-dashboard-shell-menu-highlight)"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "mt-1.5 size-1.5 shrink-0 rounded-full",
                            notification.unread ? "bg-(--obsidian-dashboard-shell-accent)" : "bg-(--obsidian-dashboard-shell-border-strong)",
                          )}
                        />
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-xs leading-snug text-(--obsidian-dashboard-shell-foreground)">{notification.title}</span>
                          <span className="text-[11px] leading-4 text-(--obsidian-dashboard-shell-text-subtle)">{notification.detail}</span>
                        </span>
                      </Link>
                    </li>
                    ))
                  )}
                </ul>
              </DashboardPopoverContent>
            </DashboardPopover>

            <DashboardMenu>
              <DashboardMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Account"
                  suppressHydrationWarning
                  className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-(--obsidian-dashboard-shell-ring)"
                >
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt=""
                      className="size-7 rounded-full object-cover"
                    />
                  ) : (
                    <VisitorAvatar name={profile.name} size="sm" />
                  )}
                </button>
              </DashboardMenuTrigger>
              <DashboardMenuContent align="end" className="min-w-56">
                <p className="px-2.5 py-1.5 text-xs leading-4 text-(--obsidian-dashboard-shell-text-muted)">
                  {profile.name} · local profile
                </p>
                <DashboardMenuItem asChild>
                  <Link href="/dashboard/settings">Edit profile</Link>
                </DashboardMenuItem>
              </DashboardMenuContent>
            </DashboardMenu>
          </>
        }
      >
        {children}
      </DashboardShell>
    </div>
  );
}
