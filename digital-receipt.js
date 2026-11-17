(() => {
    "use strict";

    function wrapText(context, value, maxWidth) {
        const words = String(value || "-").split(/\s+/);
        const lines = [];
        let line = "";
        words.forEach(word => {
            if (context.measureText(word).width > maxWidth) {
                if (line) lines.push(line);
                line = "";
                let segment = "";
                for (const character of word) {
                    if (context.measureText(segment + character).width > maxWidth && segment) {
                        lines.push(segment);
                        segment = character;
                    } else {
                        segment += character;
                    }
                }
                line = segment;
                return;
            }
            const candidate = line ? `${line} ${word}` : word;
            if (context.measureText(candidate).width > maxWidth && line) {
                lines.push(line);
                line = word;
            } else {
                line = candidate;
            }
        });
        if (line) lines.push(line);
        return lines.length ? lines : ["-"];
    }

    function roundedRect(context, x, y, width, height, radius) {
        context.beginPath();
        context.moveTo(x + radius, y);
        context.lineTo(x + width - radius, y);
        context.quadraticCurveTo(x + width, y, x + width, y + radius);
        context.lineTo(x + width, y + height - radius);
        context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        context.lineTo(x + radius, y + height);
        context.quadraticCurveTo(x, y + height, x, y + height - radius);
        context.lineTo(x, y + radius);
        context.quadraticCurveTo(x, y, x + radius, y);
        context.closePath();
    }

    window.createSifahmiReceiptJpg = async function(item) {
        const width = 1080;
        const padding = 82;
        const isExpense = item.jenis === "KELUAR";
        const receiptNumber = `KW-KAS-${item.id}`;
        const partyName = isExpense
            ? (item.penerima && item.penerima !== item.kategori ? item.penerima : "-")
            : String(item.donatur || "-").replace(/\s+\([^()]*\)\s*$/, "");
        const paymentText = item.keterangan || item.kategori || "-";
        const measureCanvas = document.createElement("canvas");
        const measureContext = measureCanvas.getContext("2d");
        if (!measureContext) throw new Error("Browser tidak dapat membuat gambar kwitansi.");

        measureContext.font = "bold 27px Arial";
        const wrappedParty = wrapText(measureContext, partyName, width - padding * 2 - 340);
        measureContext.font = "bold 26px Arial";
        const paymentLines = wrapText(measureContext, paymentText, width - padding * 2 - 340);
        const rowStart = 340;
        const partyHeight = Math.max(78, wrappedParty.length * 36 + 34);
        const amountTop = rowStart + partyHeight + 34;
        const paymentTop = amountTop + 112;
        const paymentHeight = Math.max(78, paymentLines.length * 36 + 34);
        const footerTop = Math.max(720, paymentTop + paymentHeight + 48);
        const height = Math.max(1080, footerTop + 310);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Browser tidak dapat membuat gambar kwitansi.");

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        context.textAlign = "center";
        context.fillStyle = "#166534";
        context.font = "bold 30px Arial";
        context.fillText("YAYASAN NUURU HIDAAYATIL QUR'AAN", width / 2, 58);
        context.fillStyle = "#475569";
        context.font = "18px Arial";
        context.fillText("Jl. Jend. AH Nasution, Gg. Jamaras 3, Jatihandap, Bandung 40195", width / 2, 92);

        roundedRect(context, 30, 130, width - 60, height - 160, 34);
        context.strokeStyle = "#334155";
        context.lineWidth = 4;
        context.stroke();

        context.textAlign = "left";
        context.fillStyle = "#1f2937";
        context.font = "bold 36px Arial";
        context.fillText(isExpense ? "BUKTI PENGELUARAN" : "KWITANSI DIGITAL", padding, 218);
        context.fillStyle = "#64748b";
        context.font = "21px Arial";
        context.fillText("SIFAHMI • Bandung", padding, 258);
        context.textAlign = "right";
        context.font = "bold 17px Arial";
        context.fillText("NO. REGISTRASI", width - padding, 195);
        context.fillStyle = "#d97706";
        context.font = "bold 25px Arial";
        context.fillText(receiptNumber, width - padding, 229);

        context.strokeStyle = "#334155";
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(padding, 298);
        context.lineTo(width - padding, 298);
        context.stroke();

        const valueX = padding + 340;
        context.textAlign = "left";
        context.fillStyle = "#475569";
        context.font = "25px Arial";
        context.fillText(isExpense ? "Dibayarkan Kepada" : "Telah Diterima Dari", padding, rowStart + 34);
        context.fillStyle = "#1f2937";
        context.font = "bold 27px Arial";
        wrappedParty.forEach((line, index) => context.fillText(line, valueX, rowStart + 34 + index * 36));

        context.strokeStyle = "#cbd5e1";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(padding, rowStart + partyHeight);
        context.lineTo(width - padding, rowStart + partyHeight);
        context.stroke();

        const amount = new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0,
        }).format(Number(item.nominal) || 0);
        context.fillStyle = "#475569";
        context.font = "25px Arial";
        context.fillText("Uang Sejumlah", padding, amountTop + 48);
        context.font = "bold 31px Arial";
        const amountWidth = Math.min(500, Math.max(220, context.measureText(amount).width + 50));
        roundedRect(context, valueX - 8, amountTop + 7, amountWidth, 62, 16);
        context.fillStyle = "#e9f8f3";
        context.fill();
        context.strokeStyle = "#a7e2d4";
        context.lineWidth = 2;
        context.stroke();
        context.fillStyle = "#168f78";
        context.textAlign = "center";
        context.fillText(amount, valueX - 8 + amountWidth / 2, amountTop + 48);

        context.strokeStyle = "#cbd5e1";
        context.beginPath();
        context.moveTo(padding, amountTop + 86);
        context.lineTo(width - padding, amountTop + 86);
        context.stroke();

        context.textAlign = "left";
        context.fillStyle = "#475569";
        context.font = "25px Arial";
        context.fillText("Untuk Pembayaran", padding, paymentTop + 34);
        context.fillStyle = "#1f2937";
        context.font = "bold 26px Arial";
        paymentLines.forEach((line, index) => context.fillText(line, valueX, paymentTop + 34 + index * 36));

        context.save();
        context.strokeStyle = "#cbd5e1";
        context.lineWidth = 2;
        context.setLineDash([5, 8]);
        context.beginPath();
        context.moveTo(padding, footerTop);
        context.lineTo(width - padding, footerTop);
        context.stroke();
        context.restore();

        const transactionDate = new Date(`${item.tanggal}T00:00:00`);
        const dateLabel = Number.isNaN(transactionDate.getTime())
            ? String(item.tanggal || "-")
            : transactionDate.toLocaleDateString("id-ID", {
                year: "numeric",
                month: "long",
                day: "numeric",
            });
        context.textAlign = "left";
        context.fillStyle = "#64748b";
        context.font = "bold 18px Arial";
        context.fillText("TANGGAL TRANSAKSI", padding, footerTop + 74);
        context.fillStyle = "#1f2937";
        context.font = "bold 25px Arial";
        context.fillText(dateLabel, padding, footerTop + 116);

        context.textAlign = "center";
        context.fillStyle = "#64748b";
        context.font = "bold 17px Arial";
        context.fillText("PENERIMA / BENDAHARA", width - 270, footerTop + 42);
        context.fillStyle = "#1f2937";
        context.font = "bold 24px Arial";
        context.fillText(item.penerima || "Bendahara", width - 270, footerTop + 112);
        context.strokeStyle = "#64748b";
        context.lineWidth = 2;
        context.setLineDash([6, 6]);
        context.beginPath();
        context.moveTo(width - 470, footerTop + 135);
        context.lineTo(width - padding, footerTop + 135);
        context.stroke();
        context.setLineDash([]);
        context.fillStyle = "#94a3b8";
        context.font = "17px Arial";
        context.fillText("Yayasan Nuuru Hidaayatil Qur'aan", width - 270, footerTop + 164);

        const statusText = isExpense ? "✓ DIBAYARKAN & TERVERIFIKASI" : "✓ LUNAS & TERVERIFIKASI";
        context.font = "bold 19px Arial";
        const statusWidth = context.measureText(statusText).width + 36;
        roundedRect(context, padding, footerTop + 160, statusWidth, 54, 14);
        context.fillStyle = "#e9f8f3";
        context.fill();
        context.strokeStyle = "#a7e2d4";
        context.lineWidth = 2;
        context.stroke();
        context.fillStyle = "#168f78";
        context.textAlign = "center";
        context.fillText(statusText, padding + statusWidth / 2, footerTop + 194);

        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (blob) resolve(blob);
                else reject(new Error("Gambar kwitansi gagal dibuat."));
            }, "image/jpeg", 0.94);
        });
    };
})();
