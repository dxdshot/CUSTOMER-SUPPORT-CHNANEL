"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
const REPOSITORY_URL = "https://github.com/dxdshot/CUSTOMER-SUPPORT-CHNANEL";
const sidebarListeners = new Set<() => void>();
let cachedSidebarWidth: number | undefined;

function GitHubMark() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4 fill-current text-[#181717] dark:text-[#f0f6fc]">
      <path d="M8 0C3.58 0 0 3.64 0 8.13c0 3.59 2.29 6.64 5.47 7.71.4.08.55-.18.55-.39 0-.19-.01-.83-.01-1.51-2.01.38-2.53-.5-2.69-.96-.09-.23-.48-.96-.82-1.15-.28-.15-.68-.53-.01-.54.63-.01 1.08.59 1.23.83.72 1.23 1.87.88 2.33.67.07-.53.28-.88.51-1.08-1.78-.21-3.64-.91-3.64-4.02 0-.89.31-1.62.82-2.19-.08-.21-.36-1.04.08-2.16 0 0 .67-.22 2.2.84A7.45 7.45 0 0 1 8 3.9c.68 0 1.36.09 2 .27 1.53-1.06 2.2-.84 2.2-.84.44 1.12.16 1.95.08 2.16.51.57.82 1.3.82 2.19 0 3.12-1.87 3.81-3.65 4.02.29.25.54.73.54 1.49 0 1.08-.01 1.95-.01 2.22 0 .22.15.47.55.39A8.15 8.15 0 0 0 16 8.13C16 3.64 12.42 0 8 0Z" />
    </svg>
  );
}

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

const liveNavigation: DashboardShellNavSection[] = [
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

/*
 * The demo mirrors the live routes under /demo. Settings and widget edits stay
 * in memory, so a visitor's changes reset on refresh.
 */
const demoHref = (href: string) => href.replace(/^\/dashboard/, "/demo");
const demoNavigation: DashboardShellNavSection[] = liveNavigation.map((section) => ({
  ...section,
  items: section.items.map((item) => ({
    ...item,
    id: demoHref(item.id),
    href: item.href ? demoHref(item.href) : undefined,
  })),
}));

export type NotificationRow = { id: string; title: string; detail: string; unread: boolean };

const NO_NOTIFICATIONS: NotificationRow[] = [];

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
  demo = false,
  demoUnread = 0,
  demoNotifications = NO_NOTIFICATIONS,
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
  /** Public demo: local data only, no live workspace writes. */
  demo?: boolean;
  demoUnread?: number;
  demoNotifications?: NotificationRow[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const sidebarWidth = useSyncExternalStore(subscribeSidebarWidth, readSidebarWidth, () => 200);
  const profile = useAgentProfile();
  const [profileReady, setProfileReady] = useState(false);
  const [unread, setUnread] = useState(demo ? demoUnread : 0);
  const [notifications, setNotifications] = useState<NotificationRow[]>(
    demo ? demoNotifications : NO_NOTIFICATIONS,
  );

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
    if (demo) return;
    if (!profileReady || profile.id === "server") return;
    heartbeatAgent(profile);
    const beat = window.setInterval(() => heartbeatAgent(profile), 30_000);
    return () => window.clearInterval(beat);
  }, [profileReady, profile, demo]);

  useEffect(() => {
    if (demo) return;
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
  }, [demo]);

  const navigation = demo ? demoNavigation : liveNavigation;
  const inboxId = demo ? "/demo" : "/dashboard";
  const navigationWithUnread = navigation.map((section) => ({
    ...section,
    items: section.items.map((item) =>
      item.id === inboxId ? { ...item, count: unread || undefined } : item,
    ),
  }));

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
  };

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
            <a
              href={REPOSITORY_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Open repository on GitHub"
              className="inline-flex size-[30px] shrink-0 cursor-pointer items-center justify-center rounded-md text-(--obsidian-dashboard-shell-text-subtle) outline-none transition-[background-color,color,box-shadow,scale] duration-150 ease-[cubic-bezier(0.25,1,0.5,1)] hover:bg-(--obsidian-dashboard-shell-muted) hover:text-(--obsidian-dashboard-shell-foreground) active:scale-[0.97] active:duration-75 focus-visible:ring-2 focus-visible:ring-(--obsidian-dashboard-shell-ring) motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              <GitHubMark />
            </a>
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
                        href={demo ? `/demo?conversation=${encodeURIComponent(notification.id)}` : `/dashboard?conversation=${encodeURIComponent(notification.id)}`}
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
                  {profile.name} · {demo ? "demo mode" : "local profile"}
                </p>
                <DashboardMenuItem asChild>
                  <Link href={demo ? "/demo/settings" : "/dashboard/settings"}>Edit profile</Link>
                </DashboardMenuItem>
                {!demo && (
                  <DashboardMenuItem onSelect={() => void signOut()}>Sign out</DashboardMenuItem>
                )}
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
