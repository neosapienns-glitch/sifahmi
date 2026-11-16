(() => {
    const VERSION_KEY = "ynhq-app-version";
    let runningVersion = null;
    let checking = false;
    let hasReportedError = false;

    try {
        runningVersion = sessionStorage.getItem(VERSION_KEY);
    } catch (error) {
        console.warn("Penyimpanan versi aplikasi tidak tersedia:", error);
    }

    async function checkForUpdates() {
        if (checking) return;
        checking = true;
        try {
            const response = await fetch(`./app-version.json?_=${Date.now()}`, { cache: "no-store" });
            if (!response.ok) throw new Error(`Pemeriksaan versi gagal (HTTP ${response.status}).`);
            const release = await response.json();
            if (typeof release.version !== "string" || !release.version.trim()) {
                throw new Error("Nomor versi aplikasi tidak valid.");
            }

            hasReportedError = false;
            if (runningVersion === null) {
                runningVersion = release.version;
                try {
                    sessionStorage.setItem(VERSION_KEY, runningVersion);
                } catch (error) {
                    console.warn("Versi aplikasi tidak dapat disimpan:", error);
                }
                return;
            }

            if (release.version !== runningVersion) {
                try {
                    sessionStorage.setItem(VERSION_KEY, release.version);
                } catch (error) {
                    console.warn("Versi aplikasi tidak dapat disimpan:", error);
                }
                window.location.reload();
            }
        } catch (error) {
            if (!hasReportedError) {
                console.error("Pemeriksaan pembaruan aplikasi gagal:", error);
                hasReportedError = true;
            }
        } finally {
            checking = false;
        }
    }

    checkForUpdates();
    window.setInterval(() => {
        if (document.visibilityState === "visible") checkForUpdates();
    }, 60000);
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdates();
    });
})();
