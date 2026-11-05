"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { Context } from "@/context";
import { isNotifySoundOn, setNotifySoundOn, playNotifySound } from "../utils/notifySound";
import "./notification-bell.scss";

const ICONS: Record<string, string> = {
  deposit: "💰", withdrawal: "🏦", win: "🏆", security: "🔒", system: "🔔", admin: "🛎️",
};

const timeAgo = (iso: string) => {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

/** Bell + dropdown. Works in the game header and the admin top bar (reads everything from Context). */
export default function NotificationBell({ align = "right" }: { align?: "left" | "right" }) {
  const { isAuthenticated, notifications, unreadCount, markNotificationRead, markAllNotificationsRead, clearNotifications, refreshNotifications } =
    React.useContext(Context);
  const [open, setOpen] = React.useState(false);
  const [soundOn, setSoundOn] = React.useState(true);
  React.useEffect(() => { setSoundOn(isNotifySoundOn()); }, []);
  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setNotifySoundOn(next);
    if (next) playNotifySound("default", true); // preview, also unlocks audio
  };
  const [, tick] = React.useReducer((x: number) => x + 1, 0);
  const wrap = React.useRef<HTMLDivElement>(null);
  const router = useRouter();

  React.useEffect(() => {
    if (!open) return;
    refreshNotifications();
    const onDown = (e: MouseEvent | TouchEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const iv = setInterval(tick, 30_000); // keep "5m ago" fresh while open
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      clearInterval(iv);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!isAuthenticated) return null;

  return (
    <div className="nbell" ref={wrap}>
      <button
        type="button"
        className={`nbell__btn ${unreadCount > 0 ? "nbell__btn--active" : ""}`}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unreadCount > 0 && <span className="nbell__badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>

      {open && (
        <div className={`nbell__panel nbell__panel--${align}`} role="dialog" aria-label="Notifications">
          <div className="nbell__head">
            <strong>Notifications</strong>
            <div className="nbell__head-actions">
              <button type="button" className="nbell__sound" onClick={toggleSound} aria-pressed={soundOn} title={soundOn ? "Sound on - click to mute" : "Sound off - click to turn on"}>
                {soundOn ? "🔊" : "🔇"}
              </button>
              <button type="button" onClick={markAllNotificationsRead} disabled={unreadCount === 0}>Mark all read</button>
              <button type="button" onClick={clearNotifications} disabled={notifications.length === 0}>Clear</button>
            </div>
          </div>

          <div className="nbell__list">
            {notifications.length === 0 ? (
              <div className="nbell__empty">
                <span aria-hidden="true">🔔</span>
                <p>You&apos;re all caught up</p>
                <small>Deposits, withdrawals and big wins show up here.</small>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  type="button"
                  key={n.id}
                  className={`nbell__item ${n.read ? "" : "nbell__item--unread"}`}
                  onClick={() => {
                    if (!n.read) markNotificationRead(n.id);
                    if (n.link) { setOpen(false); router.push(n.link); }
                  }}
                >
                  <span className="nbell__icon" aria-hidden="true">{ICONS[n.type] ?? "🔔"}</span>
                  <span className="nbell__text">
                    <span className="nbell__title">{n.title}</span>
                    {n.message && <span className="nbell__msg">{n.message}</span>}
                    <span className="nbell__time">{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="nbell__dot" aria-hidden="true" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
