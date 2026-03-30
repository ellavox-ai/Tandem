"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./auth-provider";
import Link from "next/link";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  interview_needed: { icon: "🎙️", color: "var(--warning)" },
  claim_expiring: { icon: "⏰", color: "var(--warning)" },
  interview_completed: { icon: "✅", color: "var(--success)" },
  auto_pushed: { icon: "🚀", color: "var(--accent)" },
  push_failed: { icon: "❌", color: "var(--danger)" },
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=20");
      const data = await res.json();
      if (data.notifications) {
        setNotifications(data.notifications);
        setUnreadCount(data.notifications.filter((n: Notification) => !n.read).length);
      }
    } catch {
      // silent fail
    }
  }, []);

  // Initial fetch + poll every 30s
  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

  // Close panel on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const markAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // silent fail
    }
  };

  const markRead = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // silent fail
    }
  };

  return (
    <div ref={panelRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-2 text-[var(--foreground-tertiary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
        title="Notifications"
      >
        <svg
          className="w-[18px] h-[18px]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-[340px] max-h-[420px] rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl shadow-black/40 overflow-hidden animate-[fadeIn_0.15s_ease-out] z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <h3 className="text-[13px] font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11px] text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[360px]">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <svg
                  className="w-8 h-8 mx-auto mb-2 text-[var(--foreground-tertiary)] opacity-40"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                  />
                </svg>
                <p className="text-[12px] text-[var(--foreground-tertiary)]">
                  No notifications yet
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const typeInfo = TYPE_ICONS[n.type] || {
                  icon: "📌",
                  color: "var(--foreground-tertiary)",
                };

                const content = (
                  <div
                    className={`flex gap-3 px-4 py-3 border-b border-[var(--border)] transition-colors hover:bg-[var(--surface-hover)] cursor-pointer ${
                      !n.read ? "bg-[var(--accent-muted)]/30" : ""
                    }`}
                    onClick={() => {
                      if (!n.read) markRead(n.id);
                      setOpen(false);
                    }}
                  >
                    <span className="text-base shrink-0 mt-0.5">
                      {typeInfo.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-[12px] leading-tight ${
                            !n.read
                              ? "font-semibold text-[var(--foreground)]"
                              : "font-medium text-[var(--foreground-secondary)]"
                          }`}
                        >
                          {n.title}
                        </p>
                        {!n.read && (
                          <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0 mt-1" />
                        )}
                      </div>
                      {n.body && (
                        <p className="text-[11px] text-[var(--foreground-tertiary)] mt-0.5 line-clamp-2 leading-relaxed">
                          {n.body}
                        </p>
                      )}
                      <p className="text-[10px] text-[var(--foreground-tertiary)] mt-1 opacity-60">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                  </div>
                );

                return n.link ? (
                  <Link key={n.id} href={n.link} className="block">
                    {content}
                  </Link>
                ) : (
                  <div key={n.id}>{content}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
