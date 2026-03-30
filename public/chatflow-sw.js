self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const payload = event.data?.json?.() ?? {};
  const title = typeof payload.title === "string" && payload.title.trim() ? payload.title.trim() : "Nova mensagem";

  event.waitUntil(
    self.registration.showNotification(title, {
      body:
        typeof payload.body === "string" && payload.body.trim()
          ? payload.body.trim()
          : "Você recebeu uma nova mensagem.",
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
