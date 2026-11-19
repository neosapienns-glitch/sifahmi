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

    function createGuardianHistoryItem(kind, record) {
        const item = document.createElement("article");
        item.className = "history-item";
        const time = document.createElement("time");
        const date = kind === "raport" ? record.tanggal_cetak : record.tanggal;
        time.textContent = `Tanggal: ${date || "Tidak tersedia"}`;
        item.append(time);

        const details = [];
        if (kind === "raport") {
            const heading = document.createElement("h4");
            heading.textContent = `Rapor ${record.semester || ""} ${record.tahun_ajaran || ""}`.trim();
            item.append(heading);
            if (record.rata_rata_akhir != null) details.push(`Nilai akhir: ${record.rata_rata_akhir}`);
            if (record.capaian_tahfidz) details.push(`Capaian: ${record.capaian_tahfidz}`);
            if (record.catatan_pengampu) details.push(`Catatan pengampu: ${record.catatan_pengampu}`);
        } else {
            const teacher = document.createElement("p");
            teacher.className = "history-teacher";
            teacher.textContent = `Pengampu: ${record.nama_pengampu || "Tidak tercantum"}`;
            item.append(teacher);

            if (record.kelas) details.push(`Kelas: ${record.kelas}`);
            if (record.kehadiran) details.push(`Kehadiran: ${record.kehadiran}`);
            if (record.catatan_kehadiran) details.push(`Alasan tidak hadir: ${record.catatan_kehadiran}`);
            if (record.sabaq_surat) {
                details.push(`Hafalan baru: ${record.sabaq_surat} (${record.sabaq_baris || 0} baris${record.sabaq_nilai == null ? "" : `, nilai ${record.sabaq_nilai}`})`);
            }
            if (record.sabaq_catatan) details.push(`Catatan Ustadz (hafalan baru): ${record.sabaq_catatan}`);
            if (record.setoran_surat) {
                details.push(`Murojaah: ${record.setoran_surat} (${record.setoran_baris || 0} baris${record.setoran_nilai == null ? "" : `, nilai ${record.setoran_nilai}`})`);
            }
            if (record.setoran_catatan) details.push(`Catatan Ustadz (murojaah): ${record.setoran_catatan}`);
            if (record.tahsin_catatan) details.push(`Tahsin: ${record.tahsin_catatan}`);
        }

        if (details.length) {
            const list = document.createElement("ul");
            list.className = "history-details";
            details.forEach(detail => {
                const line = document.createElement("li");
                line.textContent = detail;
                list.append(line);
            });
            item.append(list);
        } else {
            const empty = document.createElement("p");
            empty.className = "history-detail-empty";
            empty.textContent = "Tidak ada rincian tambahan.";
            item.append(empty);
        }
        return item;
    }

    async function start() {
        const historyContainer = document.getElementById("guardian-history");
        const teacherRoster = document.getElementById("teacher-roster");
        const teacherHistory = document.getElementById("teacher-history");
        const credentialsMessage = document.getElementById("credentials-message");
        const credentialsPage = document.body.dataset.dashboardPage === "credentials";
        const guardianInfaqPage = document.body.dataset.dashboardPage === "guardian-infaq";
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

        const invalidRole = credentialsPage
            ? !["Asatidz", "Wali Murid"].includes(profile.role)
            : guardianInfaqPage
                ? profile.role !== "Wali Murid"
                : profile.role !== roleRequired;
        if (invalidRole) {
            window.location.replace(profile.role === "Asatidz" ? "dashboard-asatidz.html" :
                profile.role === "Wali Murid" ? "dashboard-wali.html" : "dashboard.html");
            return;
        }

        document.getElementById("dashboard-date")?.replaceChildren(document.createTextNode(dateText));
        const welcomeTitle = document.getElementById("welcome-title");
        if (welcomeTitle) {
            welcomeTitle.textContent =
                `Assalamu'alaikum, ${profile.nama_lengkap || (profile.role === "Asatidz" ? "Asatidz" : "Wali Santri")}`;
        }
        const usernameInput = document.getElementById("new-username");
        if (usernameInput) usernameInput.value = profile.username || profile.santri_nis || "";

        const credentialForm = document.getElementById("credentials-form");
        credentialForm?.addEventListener("submit", async (event) => {
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

        if (credentialsPage) {
            document.getElementById("account-name").textContent = profile.nama_lengkap || profile.username || "Pengguna";
            return;
        }

        if (guardianInfaqPage) {
            await loadGuardianInfaq(profile, api);
            return;
        }

        if (roleRequired === "Asatidz") {
            await loadTeacherDashboard(profile, api, session, teacherRoster, teacherHistory);
        } else {
            await loadGuardianDashboard(profile, api, historyContainer);
        }
    }

    async function loadTeacherDashboard(profile, api, session, roster, history) {
        const className = profile.kelas_diampu;
        const infaqStudentSelect = document.getElementById("teacher-infaq-student");
        const infaqForm = document.getElementById("teacher-infaq-form");
        const infaqMessage = document.getElementById("teacher-infaq-message");
        const receiptModal = document.getElementById("teacher-infaq-receipt");
        const receiptImage = document.getElementById("teacher-infaq-receipt-image");
        const infaqDateInput = document.getElementById("teacher-infaq-date");
        let receiptBlob = null;
        let receiptObjectUrl = "";
        let receiptItem = null;
        let infaqRosterLoaded = false;
        const localDateString = () => {
            const date = new Date();
            return [
                date.getFullYear(),
                String(date.getMonth() + 1).padStart(2, "0"),
                String(date.getDate()).padStart(2, "0"),
            ].join("-");
        };
        infaqDateInput.value = localDateString();

        const closeReceipt = () => {
            receiptModal.hidden = true;
            if (receiptObjectUrl) URL.revokeObjectURL(receiptObjectUrl);
            receiptObjectUrl = "";
            receiptBlob = null;
        };
        document.getElementById("teacher-infaq-receipt-close").addEventListener("click", closeReceipt);
        receiptModal.addEventListener("click", event => {
            if (event.target === receiptModal) closeReceipt();
        });

        infaqForm.addEventListener("submit", async event => {
            event.preventDefault();
            if (!infaqForm.reportValidity()) return;

            const selectedStudent = infaqStudentSelect.selectedOptions[0];
            const nominal = Number(document.getElementById("teacher-infaq-amount").value);
            if (!selectedStudent?.value || !Number.isSafeInteger(nominal) || nominal < 1) {
                showMessage(infaqMessage, "Pilih santri dan masukkan nominal infaq yang valid.", true);
                return;
            }

            const submitButton = document.getElementById("teacher-infaq-submit");
            submitButton.disabled = true;
            submitButton.textContent = "Menyimpan ke Buku Kas...";
            infaqMessage.classList.remove("visible");
            const donor = `${selectedStudent.dataset.nama || "Santri"} (${selectedStudent.value})`;
            const notes = document.getElementById("teacher-infaq-note").value.trim();
            let savedItem;
            try {
                const result = await api("buku_kas", {
                    method: "POST",
                    body: {
                        tanggal: infaqDateInput.value,
                        jenis: "INFAQ",
                        kategori: "Infaq Santri",
                        donatur: donor,
                        penerima: profile.nama_lengkap?.trim() || "Asatidz",
                        nominal,
                        keterangan: notes ? `Infaq Santri: ${notes}` : "Infaq Santri",
                    },
                });
                savedItem = Array.isArray(result) ? result[0] : result;
            } catch (error) {
                showMessage(infaqMessage, `Infaq gagal disimpan ke Buku Kas: ${error.message}`, true);
                submitButton.disabled = false;
                submitButton.textContent = "Simpan ke Buku Kas & Buat Struk";
                return;
            }
            if (!savedItem?.id) {
                showMessage(infaqMessage, "Transaksi terkirim, tetapi nomor Buku Kas tidak diterima. Periksa Buku Kas Admin sebelum mencoba menyimpan ulang.", true);
                submitButton.disabled = false;
                submitButton.textContent = "Simpan ke Buku Kas & Buat Struk";
                return;
            }

            infaqForm.reset();
            infaqDateInput.value = localDateString();
            try {
                receiptItem = savedItem;
                receiptBlob = await window.createSifahmiReceiptJpg(savedItem);
                if (receiptObjectUrl) URL.revokeObjectURL(receiptObjectUrl);
                receiptObjectUrl = URL.createObjectURL(receiptBlob);
                receiptImage.src = receiptObjectUrl;
                receiptModal.hidden = false;
                document.getElementById("teacher-infaq-receipt-close").focus();
                showMessage(infaqMessage, "Infaq tercatat di Buku Kas. Preview struk digital siap dibagikan.");
            } catch (error) {
                showMessage(infaqMessage, `Infaq tersimpan di Buku Kas, tetapi struk gagal dibuat: ${error.message}`, true);
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = "Simpan ke Buku Kas & Buat Struk";
            }
        });

        document.getElementById("teacher-infaq-download").addEventListener("click", () => {
            if (!receiptBlob || !receiptItem) return;
            const link = document.createElement("a");
            link.href = receiptObjectUrl;
            link.download = `Kwitansi-KW-KAS-${String(receiptItem.id).replace(/[^a-zA-Z0-9_-]/g, "")}.jpg`;
            document.body.append(link);
            link.click();
            link.remove();
        });
        document.getElementById("teacher-infaq-share").addEventListener("click", async () => {
            if (!receiptBlob || !receiptItem) return;
            const fileName = `Kwitansi-KW-KAS-${String(receiptItem.id).replace(/[^a-zA-Z0-9_-]/g, "")}.jpg`;
            const message = `Assalamu'alaikum, berikut bukti penerimaan ${receiptItem.kategori} dari ${receiptItem.donatur} sebesar Rp ${Number(receiptItem.nominal).toLocaleString("id-ID")} yang diterima oleh ${receiptItem.penerima}. Nomor kwitansi KW-KAS-${receiptItem.id}, tanggal ${receiptItem.tanggal}.`;
            try {
                if (typeof File === "function" && navigator.share && navigator.canShare) {
                    const file = new File([receiptBlob], fileName, { type: "image/jpeg" });
                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({ files: [file], title: `Kwitansi KW-KAS-${receiptItem.id}`, text: message });
                        return;
                    }
                }
                document.getElementById("teacher-infaq-download").click();
                window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
                showMessage(infaqMessage, "JPG diunduh. Lampirkan file tersebut pada percakapan WhatsApp yang dibuka.");
            } catch (error) {
                if (error.name !== "AbortError") showMessage(infaqMessage, `Struk tidak dapat dibagikan: ${error.message}`, true);
            }
        });

        if (!className) {
            document.getElementById("teacher-class").textContent = "Kelas belum ditetapkan";
            roster.innerHTML = '<p class="empty">Hubungi administrator untuk menetapkan kelas tanggung jawab.</p>';
            history.innerHTML = "";
            infaqStudentSelect.innerHTML = '<option value="">Kelas belum ditetapkan</option>';
            infaqStudentSelect.disabled = true;
            document.getElementById("teacher-infaq-submit").disabled = true;
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

        const refreshTeacherData = async () => {
            try {
                const students = await api(`santri?select=nis,nama_lengkap,kelas,status&kelas=eq.${encodeURIComponent(className)}&order=nama_lengkap.asc`);
                const activeStudents = students.filter(student => !student.status || student.status === "Aktif");
                infaqRosterLoaded = true;
                infaqStudentSelect.replaceChildren(new Option(
                    activeStudents.length ? "-- Pilih santri --" : "Belum ada santri aktif di kelas ini",
                    ""
                ));
                activeStudents.forEach(student => {
                    const option = new Option(`${student.nama_lengkap || "Santri"} (NIS ${student.nis || "—"})`, student.nis);
                    option.dataset.nama = student.nama_lengkap || "Santri";
                    infaqStudentSelect.append(option);
                });
                infaqStudentSelect.disabled = activeStudents.length === 0;
                document.getElementById("teacher-infaq-submit").disabled = activeStudents.length === 0;
                infaqMessage.classList.remove("visible");
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
                    api(`rpc/read_mutabaah?select=nama_santri,nama_pengampu,tanggal,kelas,kehadiran,catatan_kehadiran,sabaq_surat,sabaq_baris,sabaq_nilai,sabaq_catatan,setoran_surat,setoran_baris,setoran_nilai,setoran_catatan,tahsin_catatan&p_kelas=${encodeURIComponent(className)}&order=tanggal.desc&limit=5`),
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
                        const item = createGuardianHistoryItem("mutabaah", record);
                        const student = document.createElement("h4");
                        student.textContent = record.nama_santri || "Santri";
                        item.insertBefore(student, item.children[1]);
                        history.append(item);
                    });
                }
            } catch (error) {
                document.getElementById("teacher-student-count").textContent = "—";
                document.getElementById("teacher-record-count").textContent = "—";
                document.getElementById("teacher-present-rate").textContent = "—";
                roster.innerHTML = `<p class="empty">Data kelas gagal dimuat: ${error.message}</p>`;
                history.replaceChildren();
                if (!infaqRosterLoaded) {
                    infaqStudentSelect.replaceChildren(new Option("Data santri gagal dimuat", ""));
                    infaqStudentSelect.disabled = true;
                    document.getElementById("teacher-infaq-submit").disabled = true;
                    showMessage(infaqMessage, `Daftar santri gagal dimuat: ${error.message}`, true);
                }
            }
        };
        await refreshTeacherData();
        window.addEventListener("pageshow", event => {
            if (event.persisted) refreshTeacherData();
        });
        window.addEventListener("focus", refreshTeacherData);
    }

    async function loadGuardianDashboard(profile, api, container) {
        if (!profile.santri_nis) {
            container.innerHTML = '<p class="empty">Akun belum dihubungkan dengan NIS santri. Hubungi administrator.</p>';
            return;
        }
        const nis = String(profile.santri_nis);
        const selector = document.getElementById("guardian-history-kind");
        const previousButton = document.getElementById("guardian-history-prev");
        const nextButton = document.getElementById("guardian-history-next");
        const pageLabel = document.getElementById("guardian-history-page");
        let currentPage = 0;
        const loadHistory = () => loadGuardianHistory(
            selector.value, nis, api, container, currentPage, previousButton, nextButton, pageLabel
        );
        try {
            selector.addEventListener("change", () => {
                currentPage = 0;
                loadHistory();
            });
            previousButton.addEventListener("click", () => {
                if (currentPage > 0) {
                    currentPage -= 1;
                    loadHistory();
                }
            });
            nextButton.addEventListener("click", () => {
                currentPage += 1;
                loadHistory();
            });
            await loadHistory();
        } catch (error) {
            container.innerHTML = `<p class="empty">Data wali santri gagal dimuat: ${error.message}</p>`;
        }
    }

    async function loadGuardianInfaq(profile, api) {
        const monthList = document.getElementById("infaq-month-list");
        if (!profile.santri_nis) {
            monthList.innerHTML = '<p class="empty">Akun belum dihubungkan dengan NIS santri. Hubungi administrator.</p>';
            return;
        }
        try {
            const monthlyPayments = await api("rpc/guardian_infaq_monthly_summary", { method: "POST", body: {} });
            renderGuardianInfaq(monthlyPayments);
        } catch (error) {
            monthList.replaceChildren();
            const failure = document.createElement("p");
            failure.className = "empty";
            failure.textContent = `Catatan infaq gagal dimuat: ${error.message}`;
            monthList.append(failure);
        }
    }

    function renderGuardianInfaq(monthlyPayments) {
        const months = [
            "Januari", "Februari", "Maret", "April", "Mei", "Juni",
            "Juli", "Agustus", "September", "Oktober", "November", "Desember",
        ];
        const now = new Date();
        const currentYear = now.getFullYear();
        const payments = Array.isArray(monthlyPayments) ? monthlyPayments : [];
        const byMonth = new Map(payments.map(payment => [
            `${payment.tahun}-${payment.bulan}`,
            { nominal: Number(payment.total_nominal) || 0, count: Number(payment.jumlah_transaksi) || 0 },
        ]));
        const years = [...new Set([currentYear, ...payments.map(payment => Number(payment.tahun)).filter(Number.isInteger)])]
            .sort((a, b) => b - a);
        const yearSelect = document.getElementById("infaq-year");
        const monthList = document.getElementById("infaq-month-list");
        const previousButton = document.getElementById("infaq-previous");
        const nextButton = document.getElementById("infaq-next");
        const pageLabel = document.getElementById("infaq-page-label");
        years.forEach(year => {
            const option = document.createElement("option");
            option.value = String(year);
            option.textContent = String(year);
            yearSelect.append(option);
        });
        yearSelect.value = String(currentYear);

        const total = payments.reduce((sum, payment) => sum + (Number(payment.total_nominal) || 0), 0);
        const count = payments.reduce((sum, payment) => sum + (Number(payment.jumlah_transaksi) || 0), 0);
        const currentPayment = byMonth.get(`${currentYear}-${now.getMonth() + 1}`);
        document.getElementById("infaq-total").textContent = formatRupiah(total);
        document.getElementById("infaq-month").textContent = formatRupiah(currentPayment?.nominal || 0);
        document.getElementById("infaq-count").textContent = count;

        let currentPage = 0;
        const renderPage = () => {
            const year = Number(yearSelect.value);
            const visibleMonths = year === currentYear ? months.slice(0, now.getMonth() + 1) : months;
            const pages = Math.ceil(visibleMonths.length / 6);
            const start = currentPage * 6;
            monthList.replaceChildren();
            visibleMonths.slice(start, start + 6).forEach((month, index) => {
                const monthNumber = start + index + 1;
                const payment = byMonth.get(`${year}-${monthNumber}`) || { nominal: 0, count: 0 };
                const isPaid = payment.count > 0;
                const row = document.createElement("article");
                row.className = `month-item${isPaid ? " is-paid" : ""}`;
                const info = document.createElement("div");
                info.className = "month-info";
                const check = document.createElement("span");
                check.className = "month-check";
                check.setAttribute("aria-label", isPaid ? "Sudah lunas" : "Belum lunas");
                check.textContent = isPaid ? "✓" : "";
                const labels = document.createElement("div");
                const heading = document.createElement("strong");
                heading.textContent = month;
                const transactionCount = document.createElement("small");
                transactionCount.textContent = isPaid ? `${payment.count} transaksi tercatat` : "Belum ada pembayaran tercatat";
                labels.append(heading, transactionCount);
                info.append(check, labels);
                const amount = document.createElement("div");
                amount.className = "month-payment";
                const amountText = document.createElement("strong");
                amountText.textContent = formatRupiah(payment.nominal);
                const status = document.createElement("span");
                status.className = "month-status";
                status.textContent = isPaid ? "Lunas" : "Belum lunas";
                amount.append(amountText, status);
                row.append(info, amount);
                monthList.append(row);
            });
            previousButton.disabled = currentPage === 0;
            nextButton.disabled = currentPage >= pages - 1;
            pageLabel.textContent = `Halaman ${currentPage + 1} dari ${pages}`;
        };
        yearSelect.addEventListener("change", () => {
            currentPage = 0;
            renderPage();
        });
        previousButton.addEventListener("click", () => {
            if (currentPage > 0) {
                currentPage -= 1;
                renderPage();
            }
        });
        nextButton.addEventListener("click", () => {
            const year = Number(yearSelect.value);
            const visibleMonthCount = year === currentYear ? now.getMonth() + 1 : months.length;
            if (currentPage < Math.ceil(visibleMonthCount / 6) - 1) {
                currentPage += 1;
                renderPage();
            }
        });
        renderPage();
    }

    async function loadGuardianHistory(kind, nis, api, container, page, previousButton, nextButton, pageLabel) {
        container.innerHTML = '<p class="empty">Memuat riwayat...</p>';
        previousButton.disabled = true;
        nextButton.disabled = true;
        pageLabel.textContent = `Memuat halaman ${page + 1}...`;
        try {
            let endpoint;
            if (kind === "raport") {
                endpoint = `raport?select=semester,tahun_ajaran,rata_rata_akhir,capaian_tahfidz,catatan_pengampu,tanggal_cetak&santri_nis=eq.${escapeFilter(nis)}&order=tanggal_cetak.desc&limit=7&offset=${page * 6}`;
            } else {
                endpoint = `rpc/read_mutabaah?select=tanggal,kelas,kehadiran,catatan_kehadiran,sabaq_surat,sabaq_baris,sabaq_nilai,sabaq_catatan,setoran_surat,setoran_baris,setoran_nilai,setoran_catatan,tahsin_catatan,nama_pengampu&p_santri_nis=${escapeFilter(nis)}&order=tanggal.desc&limit=7&offset=${page * 6}`;
            }
            const results = await api(endpoint);
            const hasOlderRecords = results.length > 6;
            const records = results.slice(0, 6);
            container.replaceChildren();
            if (!records.length) {
                const empty = document.createElement("p");
                empty.className = "empty";
                empty.textContent = "Belum ada riwayat untuk kategori ini.";
                container.append(empty);
            } else {
                records.forEach(record => container.append(createGuardianHistoryItem(kind, record)));
            }
            previousButton.disabled = page === 0;
            nextButton.disabled = !hasOlderRecords;
            pageLabel.textContent = `Halaman ${page + 1}`;
        } catch (error) {
            container.replaceChildren();
            const failure = document.createElement("p");
            failure.className = "empty";
            failure.textContent = `Riwayat gagal dimuat: ${error.message}`;
            container.append(failure);
            previousButton.disabled = page === 0;
            nextButton.disabled = true;
            pageLabel.textContent = `Halaman ${page + 1}`;
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
