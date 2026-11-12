(() => {
    const SESSION_KEY = "ynhq-supabase-session";
    const roleRequired = document.body.dataset.dashboardRole;
    const dateText = new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(new Date());

    function showMessage(element, text, isError = false) {
        element.textContent = text;
        element.classList.toggle("error", isError);
        element.classList.add("visible");
    }

    function escapeFilter(value) {
        return encodeURIComponent(String(value));
    }

    function createHistoryItem(title, details, date) {
        const item = document.createElement("article");
        item.className = "history-item";
        const heading = document.createElement("h4");
        heading.textContent = title;
        const description = document.createElement("p");
        description.textContent = details || "Tidak ada rincian tambahan.";
        const time = document.createElement("time");
        time.textContent = date || "Tanggal tidak tersedia";
        item.append(heading, description, time);
        return item;
    }

    async function start() {
        const historyContainer = document.getElementById("guardian-history");
        const teacherRoster = document.getElementById("teacher-roster");
        const teacherHistory = document.getElementById("teacher-history");
        const credentialsMessage = document.getElementById("credentials-message");
        let session;
        try {
            session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
        } catch (error) {
            session = null;
        }

        if (!session?.access_token || !session.user?.id || !session.supabase_url || !session.supabase_anon_key) {
            window.location.replace("login.html");
            return;
        }

        const api = async (path, options = {}) => {
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
                throw new Error(errorBody.message || errorBody.hint || "Data tidak dapat dimuat.");
            }
            return response.status === 204 ? null : response.json();
        };

        let profile;
        try {
            const rows = await api(`profiles?select=id,nama_lengkap,role,santri_nis,kelas_diampu,username&id=eq.${escapeFilter(session.user.id)}`);
            profile = rows?.[0] || {};
        } catch (error) {
            document.querySelector("main.container").prepend(Object.assign(document.createElement("p"), {
                className: "empty",
                textContent: `Profil gagal dimuat: ${error.message}`,
            }));
            return;
        }
        const metadata = session.user.user_metadata || {};
        profile.role ||= metadata.role;
        profile.nama_lengkap ||= metadata.full_name;
        profile.santri_nis ||= metadata.santri_nis;
        profile.kelas_diampu ||= metadata.kelas_diampu;
        profile.username ||= metadata.username;

        if (profile.role !== roleRequired) {
            window.location.replace(profile.role === "Asatidz" ? "dashboard-asatidz.html" :
                profile.role === "Wali Murid" ? "dashboard-wali.html" : "dashboard.html");
            return;
        }

        document.getElementById("dashboard-date")?.replaceChildren(document.createTextNode(dateText));
        document.getElementById("welcome-title").textContent =
            `Assalamu'alaikum, ${profile.nama_lengkap || (roleRequired === "Asatidz" ? "Asatidz" : "Wali Santri")}`;
        document.getElementById("new-username").value = profile.username || profile.santri_nis || "";

        const credentialForm = document.getElementById("credentials-form");
        credentialForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (!credentialForm.reportValidity()) return;
            const newPassword = document.getElementById("new-password").value;
            if (newPassword !== document.getElementById("confirm-password").value) {
                showMessage(credentialsMessage, "Password dan konfirmasi password tidak cocok.", true);
                return;
            }
            const button = credentialForm.querySelector("button");
            button.disabled = true;
            credentialsMessage.classList.remove("visible");
            try {
                const response = await fetch(`${session.supabase_url}/functions/v1/manage-user`, {
                    method: "POST",
                    headers: {
                        apikey: session.supabase_anon_key,
                        Authorization: `Bearer ${session.access_token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        action: "update-credentials",
                        username: document.getElementById("new-username").value.trim(),
                        password: newPassword,
                    }),
                });
                const result = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(result.error || "Kredensial gagal diperbarui.");
                showMessage(credentialsMessage, result.message || "Kredensial berhasil diperbarui.");
                document.getElementById("new-password").value = "";
                document.getElementById("confirm-password").value = "";
                profile.username = document.getElementById("new-username").value.trim();
            } catch (error) {
                showMessage(credentialsMessage, error.message, true);
            } finally {
                button.disabled = false;
            }
        });

        if (roleRequired === "Asatidz") {
            await loadTeacherDashboard(profile, api, session, teacherRoster, teacherHistory);
        } else {
            await loadGuardianDashboard(profile, api, session, historyContainer);
        }
    }

    async function loadTeacherDashboard(profile, api, session, roster, history) {
        const className = profile.kelas_diampu;
        if (!className) {
            document.getElementById("teacher-class").textContent = "Kelas belum ditetapkan";
            roster.innerHTML = '<p class="empty">Hubungi administrator untuk menetapkan kelas tanggung jawab.</p>';
            history.innerHTML = "";
            return;
        }

        document.getElementById("teacher-name").textContent = profile.nama_lengkap || "Asatidz";
        document.getElementById("teacher-class").textContent = `Kelas ${className}`;
        document.getElementById("roster-class").textContent = className;
        document.getElementById("open-mutabaah").href = `mutabaah.html?kelas=${encodeURIComponent(className)}`;

        const substituteKey = `ynhq-substitute-${session.user.id}-${className}`;
        const substituteInput = document.getElementById("substitute-name");
        substituteInput.value = localStorage.getItem(substituteKey) || "";
        document.getElementById("substitute-form").addEventListener("submit", (event) => {
            event.preventDefault();
            const name = substituteInput.value.trim();
            if (name) localStorage.setItem(substituteKey, name);
            else localStorage.removeItem(substituteKey);
            showMessage(document.getElementById("substitute-message"),
                name ? `Nama pengganti "${name}" tersimpan pada perangkat ini.` : "Nama pengganti dihapus; catatan akan memakai nama akun Anda.");
        });

        try {
            let students = await api(`santri?select=nis,nama_lengkap,kelas,program,status&kelas=eq.${encodeURIComponent(className)}&order=nama_lengkap.asc`);
            if (!students.length) {
                students = await api(`santri?select=nis,nama_lengkap,kelas,program,status&program=eq.${encodeURIComponent(className)}&order=nama_lengkap.asc`);
            }
            const activeStudents = students.filter(student => !student.status || student.status === "Aktif");
            document.getElementById("teacher-student-count").textContent = activeStudents.length;
            roster.replaceChildren();
            if (!activeStudents.length) {
                roster.innerHTML = '<p class="empty">Belum ada santri aktif di kelas ini.</p>';
            } else {
                activeStudents.forEach(student => {
                    const row = document.createElement("div");
                    row.className = "list-item";
                    const name = document.createElement("strong");
                    name.textContent = student.nama_lengkap || "Santri";
                    const nis = document.createElement("span");
                    nis.textContent = `NIS ${student.nis || "—"}`;
                    row.append(name, nis);
                    roster.append(row);
                });
            }

            const [summaryResult, records] = await Promise.all([
                api("rpc/teacher_class_summary", { method: "POST", body: {} }),
                api(`mutabaah?select=nama_santri,nama_pengampu,tanggal,kehadiran,sabaq_surat,tahsin_catatan&kelas=eq.${encodeURIComponent(className)}&order=tanggal.desc&limit=5`),
            ]);
            const summary = Array.isArray(summaryResult) ? summaryResult[0] : summaryResult;
            const attendanceTotal = Number(summary?.total_kehadiran) || 0;
            const present = Number(summary?.total_hadir) || 0;
            document.getElementById("teacher-record-count").textContent = Number(summary?.total_mutabaah) || 0;
            document.getElementById("teacher-present-rate").textContent =
                attendanceTotal ? `${Math.round(present / attendanceTotal * 100)}%` : "—";
            history.replaceChildren();
            if (!records.length) {
                history.innerHTML = '<p class="empty">Belum ada catatan mutaba\'ah di kelas ini.</p>';
            } else {
                records.forEach(record => {
                    const summary = [record.kehadiran, record.sabaq_surat, record.tahsin_catatan,
                        record.nama_pengampu ? `Pengampu: ${record.nama_pengampu}` : ""]
                        .filter(Boolean).join(" • ");
                    history.append(createHistoryItem(record.nama_santri || "Santri", summary, record.tanggal));
                });
            }
        } catch (error) {
            roster.innerHTML = `<p class="empty">Data kelas gagal dimuat: ${error.message}</p>`;
            history.replaceChildren();
        }
    }

    async function loadGuardianDashboard(profile, api, session, container) {
        if (!profile.santri_nis) {
            container.innerHTML = '<p class="empty">Akun belum dihubungkan dengan NIS santri. Hubungi administrator.</p>';
            return;
        }
        const nis = String(profile.santri_nis);
        document.getElementById("guardian-nis").textContent = `NIS ${nis}`;
        document.getElementById("student-nis").textContent = `NIS: ${nis}`;
        try {
            const students = await api(`santri?select=nis,nama_lengkap,kelas,program,status&nis=eq.${escapeFilter(nis)}&limit=1`);
            const student = students[0];
            if (!student) throw new Error("Data santri terhubung tidak ditemukan.");
            document.getElementById("welcome-title").textContent = `Assalamu'alaikum, Wali ${student.nama_lengkap}`;
            document.getElementById("student-class").textContent = `Kelas: ${student.kelas || student.program || "—"}`;

            const summary = await api("rpc/guardian_infaq_summary", { method: "POST", body: {} });
            const infaqSummary = Array.isArray(summary) ? summary[0] : summary;
            document.getElementById("infaq-total").textContent = formatRupiah(infaqSummary?.total_nominal || 0);
            document.getElementById("infaq-month").textContent = formatRupiah(infaqSummary?.total_bulan_ini || 0);
            document.getElementById("infaq-count").textContent = Number(infaqSummary?.jumlah_transaksi || 0);

            const selector = document.getElementById("guardian-history-kind");
            const loadHistory = () => loadGuardianHistory(selector.value, nis, api, container);
            selector.addEventListener("change", loadHistory);
            await loadHistory();
        } catch (error) {
            container.innerHTML = `<p class="empty">Data wali santri gagal dimuat: ${error.message}</p>`;
        }
    }

    async function loadGuardianHistory(kind, nis, api, container) {
        container.innerHTML = '<p class="empty">Memuat riwayat...</p>';
        try {
            let endpoint;
            if (kind === "raport") {
                endpoint = `raport?select=semester,tahun_ajaran,rata_rata_akhir,capaian_tahfidz,catatan_pengampu,tanggal_cetak&santri_nis=eq.${escapeFilter(nis)}&order=tanggal_cetak.desc&limit=5`;
            } else if (kind === "infaq") {
                endpoint = `infaq?select=tanggal,nominal,kategori,metode,catatan,nama_pembayar&santri_nis=eq.${escapeFilter(nis)}&order=tanggal.desc&limit=5`;
            } else {
                endpoint = `mutabaah?select=tanggal,kelas,kehadiran,sabaq_surat,sabaq_baris,sabaq_nilai,tahsin_catatan,nama_pengampu&santri_nis=eq.${escapeFilter(nis)}&order=tanggal.desc&limit=5`;
            }
            const records = await api(endpoint);
            container.replaceChildren();
            if (!records.length) {
                const empty = document.createElement("p");
                empty.className = "empty";
                empty.textContent = "Belum ada riwayat untuk kategori ini.";
                container.append(empty);
                return;
            }

            records.forEach(record => {
                let heading;
                let detail;
                let date;
                if (kind === "raport") {
                    heading = `Rapor ${record.semester || ""} ${record.tahun_ajaran || ""}`.trim();
                    detail = [
                        record.rata_rata_akhir == null ? "" : `Nilai akhir: ${record.rata_rata_akhir}`,
                        record.capaian_tahfidz ? `Capaian: ${record.capaian_tahfidz}` : "",
                        record.catatan_pengampu ? `Catatan: ${record.catatan_pengampu}` : "",
                    ].filter(Boolean).join("\n");
                    date = record.tanggal_cetak;
                } else if (kind === "infaq") {
                    heading = `${record.kategori || "Infaq"} — ${formatRupiah(record.nominal || 0)}`;
                    detail = [record.metode ? `Metode: ${record.metode}` : "", record.catatan || ""].filter(Boolean).join(" • ");
                    date = record.tanggal;
                } else {
                    heading = `${record.kelas || "Mutaba'ah"} — ${record.kehadiran || "Catatan belajar"}`;
                    detail = [
                        record.sabaq_surat ? `Setoran: ${record.sabaq_surat}` : "",
                        record.sabaq_baris ? `${record.sabaq_baris} baris` : "",
                        record.sabaq_nilai == null ? "" : `Nilai: ${record.sabaq_nilai}`,
                        record.tahsin_catatan || "",
                        record.nama_pengampu ? `Pengampu: ${record.nama_pengampu}` : "",
                    ].filter(Boolean).join(" • ");
                    date = record.tanggal;
                }
                container.append(createHistoryItem(heading, detail, date));
            });
        } catch (error) {
            container.replaceChildren();
            const failure = document.createElement("p");
            failure.className = "empty";
            failure.textContent = `Riwayat gagal dimuat: ${error.message}`;
            container.append(failure);
        }
    }

    function formatRupiah(value) {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0,
        }).format(Number(value) || 0);
    }

    start().catch(error => {
        const main = document.querySelector("main.container");
        if (main) {
            const message = document.createElement("p");
            message.className = "empty";
            message.textContent = `Dashboard gagal dimuat: ${error.message}`;
            main.prepend(message);
        }
    });
})();
