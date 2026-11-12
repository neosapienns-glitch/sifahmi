(() => {
    const allNavigation = [
        { category: "UTAMA" },
        { label: "Dashboard Utama", href: "dashboard.html", icon: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>' },
        { category: "AKADEMIK & SANTRI" },
        { label: "Data Santri", href: "santri.html", icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>' },
        { label: "Mutaba'ah Harian", href: "mutabaah.html", icon: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>' },
        { label: "Evaluasi & Rapor", href: "raport.html", icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>' },
        { category: "KEUANGAN MA'HAD" },
        { label: "Buku Kas Utama", href: "buku-kas.html", icon: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/>' },
        { label: "Infaq & Sedekah", href: "infaq.html", icon: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>' },
        { category: "PENGELOLAAN" },
        { label: "Daftar Akun", href: "daftar-akun.html", icon: '<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0M19 8v6M22 11h-6"/>' }
    ];

    const icon = (content) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${content}</svg>`;
    const currentPage = window.location.pathname.split("/").pop() || "dashboard.html";
    let session = {};
    try { session = JSON.parse(localStorage.getItem("ynhq-supabase-session") || "{}"); } catch (error) {}
    const role = session.user?.user_metadata?.role;
    const navigation = role === "Asatidz"
        ? [
            { category: "UTAMA" },
            { label: "Dashboard Asatidz", href: "dashboard-asatidz.html", icon: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>' },
            { category: "AKADEMIK" },
            allNavigation.find(item => item.href === "mutabaah.html"),
        ]
        : role === "Wali Murid"
            ? [{ category: "UTAMA" }, { label: "Dashboard Wali", href: "dashboard-wali.html", icon: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>' }]
            : allNavigation;
    const aside = document.createElement("aside");
    aside.className = "app-shell-sidebar";
    aside.setAttribute("aria-label", "Navigasi utama");
    aside.innerHTML = `
        <div class="app-sidebar-header">
            <img src="./logo.png" alt="">
            <div class="app-sidebar-brand"><strong>SIFAHMI</strong><span>YNHQ BANDUNG</span></div>
        </div>
        <nav class="app-sidebar-nav"></nav>
        <div class="app-sidebar-footer">
            <button type="button" class="app-logout">
                ${icon('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>')}
                <span>Keluar Sesi Login</span>
            </button>
        </div>`;

    const nav = aside.querySelector(".app-sidebar-nav");
    navigation.forEach((item) => {
        if (item.category) {
            const category = document.createElement("span");
            category.className = "app-nav-category";
            category.textContent = item.category;
            nav.append(category);
            return;
        }

        const link = document.createElement("a");
        link.className = "app-nav-item";
        link.href = item.href;
        link.innerHTML = `${icon(item.icon)}<span>${item.label}</span>`;
        if (item.href === currentPage) {
            link.classList.add("active");
            link.setAttribute("aria-current", "page");
        }
        nav.append(link);
    });

    const overlay = document.createElement("div");
    overlay.className = "app-sidebar-overlay";
    overlay.setAttribute("aria-hidden", "true");

    const content = document.createElement("div");
    content.className = "app-shell-content";
    while (document.body.firstChild) content.append(document.body.firstChild);
    document.body.append(aside, overlay, content);

    const header = content.querySelector("header.top-bar");
    if (header) {
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "app-menu-toggle";
        toggle.setAttribute("aria-label", "Buka menu navigasi");
        toggle.setAttribute("aria-controls", "app-navigation");
        toggle.setAttribute("aria-expanded", "false");
        toggle.innerHTML = icon('<path d="M4 6h16M4 12h16M4 18h16"/>');
        aside.id = "app-navigation";
        header.prepend(toggle);

        const closeMenu = () => {
            aside.classList.remove("is-open");
            overlay.classList.remove("is-visible");
            toggle.setAttribute("aria-expanded", "false");
            toggle.setAttribute("aria-label", "Buka menu navigasi");
        };

        toggle.addEventListener("click", () => {
            if (window.matchMedia("(max-width: 767px)").matches) {
                const isOpen = aside.classList.toggle("is-open");
                overlay.classList.toggle("is-visible", isOpen);
                toggle.setAttribute("aria-expanded", String(isOpen));
                toggle.setAttribute("aria-label", isOpen ? "Tutup menu navigasi" : "Buka menu navigasi");
            } else {
                const isCollapsed = document.body.classList.toggle("app-sidebar-collapsed");
                toggle.setAttribute("aria-expanded", String(!isCollapsed));
                toggle.setAttribute("aria-label", isCollapsed ? "Perluas menu navigasi" : "Ciutkan menu navigasi");
            }
        });
        overlay.addEventListener("click", closeMenu);
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") closeMenu();
        });
    }

    aside.querySelector(".app-logout").addEventListener("click", () => {
        if (window.confirm("Apakah Anda yakin ingin keluar dari sistem?")) {
            localStorage.removeItem("ynhq-supabase-session");
            window.location.href = "login.html";
        }
    });
})();
