(() => {
    const container = document.getElementById("app-notifications");
    if (!container) return;

    const SESSION_KEY = "ynhq-supabase-session";
    container.innerHTML = `
        <section class="app-notification-card" aria-labelledby="app-notification-title">
            <header class="app-notification-header">
                <div>
                    <h2 id="app-notification-title">Notifikasi</h2>
                    <p class="app-notification-count" data-notification-count>Memuat...</p>
                </div>
                <button type="button" class="app-notification-refresh" data-notification-refresh>Muat ulang</button>
            </header>
            <p class="app-notification-status" data-notification-status role="status"></p>
            <div class="app-notification-list" data-notification-list></div>
            <nav class="app-notification-pagination" aria-label="Halaman notifikasi">
                <button type="button" data-notification-prev disabled>Lebih baru</button>
                <span data-notification-page aria-live="polite">Halaman 1</span>
                <button type="button" data-notification-next disabled>Lebih lama</button>
            </nav>
        </section>`;

    const list = container.querySelector("[data-notification-list]");
    const count = container.querySelector("[data-notification-count]");
    const status = container.querySelector("[data-notification-status]");
    const previousPage = container.querySelector("[data-notification-prev]");
    const nextPage = container.querySelector("[data-notification-next]");
    const pageLabel = container.querySelector("[data-notification-page]");
    const isAdministrator = document.body.dataset.dashboardRole === "Administrator"
        || /(?:^|\/)dashboard\.html$/i.test(window.location.pathname);
    const pageSize = isAdministrator ? 5 : 3;
    let currentPage = 0;
    let hasNextPage = false;
    container.querySelector(".app-notification-pagination").hidden = !isAdministrator;

    const style = document.createElement("style");
    style.textContent = `
        .app-notification-card{padding:18px;border:1px solid #e2e8f0;border-radius:16px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,.05)}
        .app-notification-header{display:flex;align-items:center;justify-content:space-between;gap:12px}
        .app-notification-header h2{font-size:15px}
        .app-notification-count,.app-notification-status{margin-top:4px;color:#64748b;font-size:11px}
        .app-notification-refresh,.app-notification-read,.app-notification-delete{padding:7px 10px;border:1px solid #d1d5db;border-radius:9px;background:#fff;color:#1b5e20;font:inherit;font-size:11px;font-weight:700;cursor:pointer}
        .app-notification-delete{color:#a93226}
        .app-notification-list{display:grid;gap:8px;margin-top:12px}
        .app-notification-pagination{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px}
        .app-notification-pagination button{padding:7px 10px;border:1px solid #d1d5db;border-radius:9px;background:#fff;color:#1b5e20;font:inherit;font-size:11px;font-weight:700;cursor:pointer}
        .app-notification-pagination button:disabled{opacity:.45;cursor:not-allowed}
        .app-notification-pagination span{color:#64748b;font-size:11px}
        .app-notification-item{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:12px;border:1px solid #edf1f5;border-radius:11px;background:#f8fafc}
        .app-notification-item.unread{border-color:#bbf7d0;background:#f0fdf4}
        .app-notification-item h3{font-size:12px}
        .app-notification-item p{margin-top:4px;color:#475569;font-size:11px;line-height:1.55}
        .app-notification-item time{display:block;margin-top:6px;color:#94a3b8;font-size:10px}
        .app-notification-empty{color:#64748b;font-size:12px;line-height:1.6}
        @media(max-width:520px){.app-notification-item{flex-direction:column}.app-notification-read,.app-notification-delete{align-self:flex-start}}
    `;
    document.head.append(style);

    let session;
    try {
        session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch (error) {
        session = null;
    }

    // Meminta izin Web Notifications API agar muncul di bilah status ponsel
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }

    function showStatus(message, isError = false) {
        status.textContent = message;
        status.style.color = isError ? "#a93226" : "";
    }

    async function api(path, options = {}) {
        if (!session?.supabase_url || !session.supabase_anon_key || !session.access_token) {
            throw new Error("Sesi tidak lengkap. Silakan keluar dan masuk kembali.");
        }
        const response = await fetch(`${session.supabase_url}/rest/v1/${path}`, {
            method: options.method || "GET",
            headers: {
                apikey: session.supabase_anon_key,
                Authorization: `Bearer ${session.access_token}`,
                "Content-Type": "application/json",
                Prefer: options.prefer || "return=representation",
            },
            body: options.body ? JSON.stringify(options.body) : undefined,
        });
        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            throw new Error(errorBody.message || errorBody.hint || "Notifikasi tidak dapat dimuat.");
        }
        return response.status === 204 ? null : response.json();
    }

    // Melacak notifikasi baru untuk memicu banner sistem di bilah notifikasi ponsel
    let lastNotifIds = new Set();
    
    function triggerPhoneNotification(title, bodyText) {
        if ("Notification" in window && Notification.permission === "granted") {
            try {
                if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.ready.then(registration => {
                        registration.showNotification(title, {
                            body: bodyText,
                            icon: "./logo.png",
                            badge: "./logo.png",
                            vibrate: [200, 100, 200]
                        });
                    });
                } else {
                    new Notification(title, { body: bodyText, icon: "./logo.png" });
                }
            } catch (e) {
                console.error("Gagal memunculkan notifikasi sistem:", e);
            }
        }
    }

    function renderNotifications(notifications) {
        const unreadCount = notifications.filter(notification => !notification.read_at).length;
        count.textContent = `${unreadCount} belum dibaca • ${notifications.length} notifikasi`;
        pageLabel.textContent = `Halaman ${currentPage + 1}`;
        previousPage.disabled = currentPage === 0;
        nextPage.disabled = !hasNextPage;
        
        // Deteksi notifikasi unread baru untuk memunculkan notifikasi ponsel (bila ada data baru)
        notifications.forEach(notification => {
            if (!notification.read_at && !lastNotifIds.has(notification.id) && lastNotifIds.size > 0) {
                triggerPhoneNotification(notification.title, notification.message);
            }
            lastNotifIds.add(notification.id);
        });

        list.replaceChildren();
        if (!notifications.length) {
            const empty = document.createElement("p");
            empty.className = "app-notification-empty";
            empty.textContent = "Belum ada notifikasi.";
            list.append(empty);
            return;
        }

        notifications.forEach(notification => {
            const item = document.createElement("article");
            item.className = `app-notification-item${notification.read_at ? "" : " unread"}`;
            const content = document.createElement("div");
            const title = document.createElement("h3");
            title.textContent = notification.title;
            const message = document.createElement("p");
            message.textContent = notification.message;
            const createdAt = document.createElement("time");
            const date = new Date(notification.created_at);
            createdAt.textContent = Number.isNaN(date.getTime())
                ? "Waktu tidak tersedia"
                : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
            content.append(title, message, createdAt);
            item.append(content);

            if (!notification.read_at) {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "app-notification-read";
                button.dataset.notificationRead = notification.id;
                button.textContent = "Tandai dibaca";
                item.append(button);
            }
            if (isAdministrator || (notification.read_at && document.body.dataset.dashboardRole === "Wali Murid")) {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "app-notification-delete";
                button.dataset.notificationDelete = notification.id;
                button.textContent = "Hapus";
                item.append(button);
            }
            list.append(item);
        });
    }

    async function loadNotifications() {
        showStatus("");
        try {
            const notifications = await api(
                `app_notifications?select=id,title,message,created_at,read_at&order=created_at.desc&limit=${pageSize + 1}&offset=${currentPage * pageSize}`
            );
            if (!notifications.length && currentPage > 0) {
                currentPage -= 1;
                await loadNotifications();
                return;
            }
            hasNextPage = notifications.length > pageSize;
            renderNotifications(notifications.slice(0, pageSize));
        } catch (error) {
            showStatus(error.message, true);
        }
    }

    container.addEventListener("click", async event => {
        const refreshButton = event.target.closest("[data-notification-refresh]");
        if (refreshButton) {
            await loadNotifications();
            return;
        }

        const previousButton = event.target.closest("[data-notification-prev]");
        if (previousButton && currentPage > 0) {
            currentPage -= 1;
            await loadNotifications();
            return;
        }

        const nextButton = event.target.closest("[data-notification-next]");
        if (nextButton && hasNextPage) {
            currentPage += 1;
            await loadNotifications();
            return;
        }

        const readButton = event.target.closest("[data-notification-read]");
        if (readButton) {
            readButton.disabled = true;
            try {
                await api(
                    `app_notifications?id=eq.${encodeURIComponent(readButton.dataset.notificationRead)}&read_at=is.null`,
                    {
                        method: "PATCH",
                        body: { read_at: new Date().toISOString() },
                        prefer: "return=minimal",
                    }
                );
                await loadNotifications();
            } catch (error) {
                readButton.disabled = false;
                showStatus(error.message, true);
            }
            return;
        }

        const deleteButton = event.target.closest("[data-notification-delete]");
        if (!deleteButton) return;
        if (!window.confirm("Hapus notifikasi ini?")) return;
        deleteButton.disabled = true;
        try {
            await api(
                `app_notifications?id=eq.${encodeURIComponent(deleteButton.dataset.notificationDelete)}${isAdministrator ? "" : "&read_at=not.is.null"}`,
                {
                    method: "DELETE",
                    prefer: "return=minimal",
                }
            );
            await loadNotifications();
        } catch (error) {
            deleteButton.disabled = false;
            showStatus(error.message, true);
        }
    });

    loadNotifications();
    window.setInterval(() => {
        if (document.visibilityState === "visible") loadNotifications();
    }, 30000);
})();
