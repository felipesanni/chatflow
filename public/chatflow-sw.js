self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const payload = event.data?.json?.() ?? {};
  const title = typeof payload.title === "string" && payload.title.trim() ? payload.title.trim() : "Nova mensagem";
  const body =
    typeof payload.body === "string" && payload.body.trim()
      ? payload.body.trim()
      : "Voce recebeu uma nova mensagem.";
  const icon = typeof payload.icon === "string" && payload.icon.trim() ? payload.icon.trim() : "/favicon.ico";
  const badge = typeof payload.badge === "string" && payload.badge.trim() ? payload.badge.trim() : "/favicon.ico";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag: typeof payload.tag === "string" ? payload.tag : undefined,
      data: payload.data && typeof payload.data === "object" ? payload.data : {},
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  const targetUrl = event.notification?.data?.url || "/";
  event.notification.close();

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientList) {
      const currentUrl = new URL(client.url);
      const desiredUrl = new URL(targetUrl, self.location.origin);
      if (currentUrl.origin === desiredUrl.origin) {
        await client.focus();
        client.postMessage({
          type: "chatflow-notification-open-ticket",
          url: desiredUrl.pathname + desiredUrl.search,
        });
        return;
      }
    }

    await self.clients.openWindow(targetUrl);
  })());
});
