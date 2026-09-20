"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logout } from "@/actions/auth-actions";
import { api, Level, useData } from "./ui";
const nav = [
  { label: "Dashboard", icon: "◫", href: "/dashboard" },
  {
    label: "Study", icon: "☷", links: [
      ["My subjects", "/study"], ["Assignments", "/assignments"], ["Timetable", "/timetable"], ["Mistakes", "/mistakes"],
    ],
  },
  {
    label: "Test Papers", icon: "▤", links: [
      ["My papers", "/papers"], ["Create paper", "/papers/create"], ["Results", "/results"],
    ],
  },
  {
    label: "Study Groups", icon: "♧", links: [
      ["Groups", "/groups"], ["Friends & chats", "/friends"], ["Challenges", "/challenges"],
    ],
  },
  {
    label: "Community", icon: "↗", links: [
      ["Community papers", "/community"], ["Leaderboard", "/leaderboard"],
    ],
  },
  { label: "Progress", icon: "▥", href: "/profile" },
  {
    label: "More", icon: "◇", links: [
      ["Minigames", "/minigames"], ["Settings", "/settings"],
    ],
  },
];
export default function Shell({ user, children }) {
  const path = usePathname(),
    { data, reload } = useData("dashboard"),
    [notifications, setNotifications] = useState(false),
    [mobile, setMobile] = useState(false),
    [openSections, setOpenSections] = useState({}),
    [query, setQuery] = useState("");
  useEffect(() => {
    setMobile(false);
    setOpenSections({});
    reload();
  }, [path, reload]);
  useEffect(() => {
    const timer = setInterval(reload, 60000);
    return () => clearInterval(timer);
  }, [reload]);
  useEffect(() => {
    const close = (event) => {
      if (event.key === "Escape") {
        setNotifications(false);
        setMobile(false);
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);
  const s = data?.stats;
  const unread = data?.notifications.filter((n) => !n.is_read).length || 0;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      {mobile && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobile(false)} />}
      <aside id="primary-navigation" className={"sidebar " + (mobile ? "is-open" : "")}>
        <Link className="brand" href="/dashboard">
          r
          <span>
            Revision
            <br />
            Club<span className="brand-dot">.</span>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          {nav.map((item) => {
            const active = item.href
              ? path.startsWith(item.href)
              : item.links.some(([, href]) => path.startsWith(href));
            if (item.href) return (
              <Link key={item.label} className={`nav-link nav-primary ${active ? "active" : ""}`} aria-current={active ? "page" : undefined} href={item.href}>
                <span className="nav-icon">{item.icon}</span>{item.label}
                {active && <span className="nav-active-dot" />}
              </Link>
            );
            const isOpen = Boolean(openSections[item.label]);
            return (
              <div className={`nav-section ${active ? "has-active-route" : ""}`} key={item.label}>
                <button
                  type="button"
                  className="nav-link nav-disclosure"
                  aria-expanded={isOpen}
                  aria-controls={`nav-${item.label.toLowerCase().replaceAll(" ", "-")}`}
                  onClick={() => setOpenSections((current) => ({ ...current, [item.label]: !current[item.label] }))}
                >
                  <span className="nav-icon">{item.icon}</span>{item.label}<span className="nav-chevron" aria-hidden="true">⌄</span>
                </button>
                {isOpen && (
                  <div className="nav-submenu" id={`nav-${item.label.toLowerCase().replaceAll(" ", "-")}`}>
                    {item.links.map(([label, href]) => (
                      <Link key={href} className={`nav-sublink ${path.startsWith(href) ? "active" : ""}`} aria-current={path.startsWith(href) ? "page" : undefined} href={href}>{label}</Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-note">
          <span>GROW AT YOUR OWN PACE</span>
          <p>
            A little better
            <br />
            than yesterday.
          </p>
          <div>✦</div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-toggle"
            aria-label="Toggle menu"
            aria-controls="primary-navigation"
            aria-expanded={mobile}
            onClick={() => setMobile(!mobile)}
          >
            ☰
          </button>
          <form className="search" action="/search" role="search">
            <span>⌕</span>
            <input
              name="q"
              aria-label="Search site"
              placeholder="Search papers, people, groups…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd>↵</kbd>
          </form>
          <div className="account-tools">
            <div className="notification-wrap">
              <button
                className="icon-button notification-button"
                aria-label={`Notifications, ${unread} unread`}
                aria-expanded={notifications}
                onClick={() => setNotifications(!notifications)}
              >
                <span aria-hidden="true">♢</span>{unread > 0 && <i />}
              </button>
              {notifications && (
                <section className="notification-panel" aria-label="Notification center" role="region">
                  <div className="section-heading">
                    <h3>Your notifications</h3>
                    <div className="actions">
                      {unread > 0 && (
                        <button
                          className="text-button"
                          onClick={async () => {
                            await api("action", { action: "notificationsReadAll" });
                            reload();
                          }}
                        >
                          Mark all read
                        </button>
                      )}
                      {!!data?.notifications.some((n) => n.is_read) && (
                        <button
                          className="text-button"
                          onClick={async () => {
                            await api("action", { action: "notificationsClearRead" });
                            reload();
                          }}
                        >
                          Clear read
                        </button>
                      )}
                    </div>
                  </div>
                  {!data?.notifications.length && (
                    <p className="muted">
                      All caught up. We’ll keep you posted.
                    </p>
                  )}
                  {data?.notifications.map((n) => (
                    <div className={`notification-item ${n.is_read ? "read" : ""}`} key={n.id}>
                      <Link
                        href={n.href}
                        onClick={async () => {
                          await api("action", { action: "notification", id: n.id });
                          setNotifications(false);
                          reload();
                        }}
                      >
                        <b>{n.title}</b>
                        <small>{n.body}</small>
                      </Link>
                      <button
                        className="icon-button"
                        aria-label={`Delete notification: ${n.title}`}
                        onClick={async () => {
                          await api("action", { action: "notificationDelete", id: n.id });
                          reload();
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </section>
              )}
            </div>
            <div className="topbar-divider" />
            <Link className="account" href="/profile">
              <span className="avatar">
                {user.avatar_url ? (
                  <Image unoptimized width={36} height={36} src={user.avatar_url} alt="" />
                ) : (
                  user.username?.[0]?.toUpperCase()
                )}
              </span>
              <span className="account-name">
                {user.username}
                <small>{s?.league || "Rookie"} league</small>
              </span>
              <Level level={s?.level} league={s?.league} />
            </Link>
            <form action={logout}>
              <button className="icon-button logout" aria-label="Sign out">
                ↪
              </button>
            </form>
          </div>
        </header>
        <main id="main" className="content" tabIndex={-1}>
          {children}
        </main>
        <footer className="app-footer">
          <span>REVISION CLUB</span>
          <span>Small steps. Stronger understanding.</span>
        </footer>
      </div>
    </div>
  );
}
