importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp(Object.fromEntries(new URL(self.location).searchParams));
firebase.messaging();

function resolveSafeNotificationPath(rawPath) {
  const fallback = "/panel";
  if (typeof rawPath !== "string") return fallback;
  const candidate = rawPath.trim();
  if (!candidate || candidate === "#" || candidate.startsWith("//")) return fallback;
  if (!candidate.startsWith("/")) return fallback;
  if (/^(?:javascript:|data:|blob:|about:|mailto:)/i.test(candidate)) return fallback;
  try {
    const url = new URL(candidate, self.location.origin);
    if (url.origin !== self.location.origin) return fallback;
    if (!url.pathname.startsWith("/")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const d = e.notification.data || {};
  const path = resolveSafeNotificationPath((d.FCM_MSG && d.FCM_MSG.data && d.FCM_MSG.data.path) || d.path || "/panel");
  const url = new URL(path, self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
