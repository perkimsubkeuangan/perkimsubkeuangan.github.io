// ============================================================================
// MODUL BAP LS - DISPERKIMTAN KABUPATEN BLITAR
// Tampilan & Rumus Identik 100% dengan BAP_LS_2026_DISPERKIMTAN.xlsx
// ============================================================================

(function () {
  const NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const NAMA_BULAN = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  // Konverter Angka ke Terbilang Bahasa Indonesia (untuk tanggal & tahun BAP)
  function angkaKeTerbilang(n) {
    n = Math.floor(Math.abs(Number(n) || 0));
    const satuan = [
      "", "Satu", "Dua", "Tiga", "Empat", "Lima",
      "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"
    ];
    if (n === 0) return "Nol";
    if (n < 12) return satuan[n];
    if (n < 20) return satuan[n - 10] + " Belas";
    if (n < 100) {
      const puluh = Math.floor(n / 10);
      const sisa = n % 10;
      return satuan[puluh] + " Puluh" + (sisa > 0 ? " " + angkaKeTerbilang(sisa) : "");
    }
    if (n < 200) return "Seratus" + (n - 100 > 0 ? " " + angkaKeTerbilang(n - 100) : "");
    if (n < 1000) {
      const ratus = Math.floor(n / 100);
      const sisa = n % 100;
      return satuan[ratus] + " Ratus" + (sisa > 0 ? " " + angkaKeTerbilang(sisa) : "");
    }
    if (n < 2000) return "Seribu" + (n - 1000 > 0 ? " " + angkaKeTerbilang(n - 1000) : "");
    if (n < 1000000) {
      const ribu = Math.floor(n / 1000);
      const sisa = n % 1000;
      return angkaKeTerbilang(ribu) + " Ribu" + (sisa > 0 ? " " + angkaKeTerbilang(sisa) : "");
    }
    return String(n);
  }

  // Format angka gaya spreadsheet BAP (jika 0 atau kosong tampil "-")
  function fmtSheetRp(val) {
    const num = Math.round(Number(val) || 0);
    if (num <= 0) return "-";
    return num.toLocaleString("id-ID");
  }

  // Format tanggal YYYY-MM-DD -> "02 Januari 2026"
  function fmtTanggalIndoPanjang(isoDate) {
    if (!isoDate) return "-";
    const parts = String(isoDate).split("-");
    if (parts.length !== 3) return isoDate;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d) || !NAMA_BULAN[m]) return isoDate;
    return String(d).padStart(2, "0") + " " + NAMA_BULAN[m] + " " + y;
  }

  // Parse tanggal lokal tanpa bug geser zona waktu (-1 hari)
  function parseLocalDate(isoDate) {
    if (!isoDate) return null;
    const parts = String(isoDate).split("-");
    if (parts.length !== 3) return null;
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Sinkron Nilai Kontrak Awal -> Nilai Kontrak Termasuk Addendum
  window.syncNilaiKontrakAkhir = function () {
    const awal = Number(document.getElementById("bap-nilai-awal").value) || 0;
    const akhirEl = document.getElementById("bap-nilai-kontrak");
    if (!akhirEl.dataset.manualEdited || Number(akhirEl.value) === 0) {
      akhirEl.value = awal;
    }
    window.renderBapPreview();
  };

  // Saat tahap (sheet) berubah, sesuaikan persentase default & kolom form II.8
  window.onBapTahapChange = function () {
    const tahap = document.getElementById("bap-tahap").value;
    const persenEl = document.getElementById("bap-persen");

    if (tahap === "UM" || tahap === "UM JASA") {
      persenEl.value = 30;
    } else {
      persenEl.value = 100;
    }

    document.getElementById("bap-active-sheet-badge").textContent = "Sheet: " + tahap;

    // Tampilkan/sembunyikan grup input sesuai struktur sheet
    const grpUm = document.getElementById("grp-jaminan-um");
    const grpPem = document.getElementById("grp-jaminan-pemeliharaan");
    const grpBaPem = document.getElementById("grp-ba-pemeriksaan");
    const grpBast = document.getElementById("grp-bast");

    grpUm.style.display = (tahap === "UM" || tahap === "I (100)") ? "block" : "none";
    grpPem.style.display = (tahap === "I (100)" || tahap === "100") ? "block" : "none";
    grpBaPem.style.display = (tahap === "UM JASA") ? "block" : "none";
    grpBast.style.display = (tahap === "I (100)" || tahap === "100" || tahap === "100 JASA") ? "block" : "none";

    window.renderBapPreview();
  };

  // Membangun baris Bagian II.8 persis 100% dengan masing-masing sheet spreadsheet
  function buildBagianII8Html(tahap, d) {
    const uraianText = escapeHtml(d.uraian || "[Uraian_Pekerjaan]");

    // 1. SHEET: UM
    if (tahap === "UM") {
      return `
        <tr>
          <td></td>
          <td class="col-num">8.</td>
          <td class="col-sub">a.</td>
          <td colspan="3">
            <table style="width:100%; border-collapse:collapse;">
              <tr>
                <td style="width:45%;" class="bap-bold">Pembayaran Uang Muka</td>
                <td>Dengan Jaminan Uang Muka oleh :</td>
              </tr>
              <tr>
                <td></td>
                <td class="bap-bold">${escapeHtml(d.penjaminUm || "[Penjamin_Uang_Muka]")}</td>
              </tr>
              <tr>
                <td>Nomor : ${escapeHtml(d.noJamUm || "[No_Jaminan_UM]")}</td>
                <td>Tanggal : ${escapeHtml(d.tglJamUmFmt || "[Tgl_Jaminan_UM]")}</td>
              </tr>
              <tr>
                <td>Sebesar : Rp ${fmtSheetRp(d.nilaiJamUm)}</td>
                <td>berlaku dari tanggal &nbsp;${escapeHtml(d.berlakuUm || "[Masa_Berlaku_UM]")}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td></td>
          <td></td>
          <td class="col-sub">b.</td>
          <td colspan="3">
            <table style="width:100%; border-collapse:collapse;">
              <tr>
                <td style="width:45%;">Pembayaran Termyn Ke ……………</td>
                <td>Sesuai Berita Acara …………………………………..</td>
              </tr>
              <tr>
                <td>tanggal : -</td>
                <td>Nomor : -</td>
              </tr>
              <tr>
                <td colspan="2">Yang Menyatakan bahwa prestasi kemajuan fisik pekerjaan telah mencapai …….. %.</td>
              </tr>
            </table>
          </td>
        </tr>
      `;
    }

    // 2. SHEET: I (100)
    if (tahap === "I (100)") {
      return `
        <tr>
          <td></td>
          <td class="col-num">8.</td>
          <td class="col-sub">a.</td>
          <td colspan="3">
            <table style="width:100%; border-collapse:collapse;">
              <tr>
                <td style="width:45%;" class="bap-bold">Pembayaran Uang Muka</td>
                <td>Dengan Jaminan Uang Muka oleh :</td>
              </tr>
              <tr>
                <td></td>
                <td>${escapeHtml(d.penjaminUm || "-")}</td>
              </tr>
              <tr>
                <td>Nomor : ${escapeHtml(d.noJamUm || "-")}</td>
                <td>Tanggal : ${escapeHtml(d.tglJamUmFmt || "-")}</td>
              </tr>
              <tr>
                <td>Sebesar : Rp ${fmtSheetRp(d.nilaiJamUm)}</td>
                <td>berlaku dari tanggal &nbsp;${escapeHtml(d.berlakuUm || "-")}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td></td>
          <td></td>
          <td class="col-sub">b.</td>
          <td colspan="3">
            <table style="width:100%; border-collapse:collapse;">
              <tr>
                <td style="width:45%;" class="bap-bold">Pembayaran Termyn I (100%)</td>
                <td>Dengan Jaminan Pemeliharaan oleh :</td>
              </tr>
              <tr>
                <td></td>
                <td class="bap-bold">${escapeHtml(d.penjaminPem || "[Penjamin_Pemeliharaan]")}</td>
              </tr>
              <tr>
                <td>Nomor : ${escapeHtml(d.noJamPem || "[No_Jaminan_Pemeliharaan]")}</td>
                <td>Tanggal : ${escapeHtml(d.tglJamPemFmt || "[Tgl_Jaminan_Pemeliharaan]")}</td>
              </tr>
              <tr>
                <td>Sebesar : Rp ${fmtSheetRp(d.nilaiJamPem)}</td>
                <td>berlaku dari tanggal &nbsp;${escapeHtml(d.berlakuPem || "[Masa_Berlaku_Pemeliharaan]")}</td>
              </tr>
              <tr>
                <td colspan="2">Sesuai dengan Berita Acara Serah Terima Pekerjaan (BAST):</td>
              </tr>
              <tr>
                <td>tanggal : ${escapeHtml(d.tglBastFmt || "[Tgl_BAST]")}</td>
                <td>Nomor : ${escapeHtml(d.noBast || "[No_BAST]")}</td>
              </tr>
              <tr>
                <td colspan="2">Yang Menyatakan bahwa prestasi kemajuan fisik pekerjaan telah mencapai &nbsp;<strong>100%</strong></td>
              </tr>
            </table>
          </td>
        </tr>
      `;
    }

    // 3. SHEET: 100
    if (tahap === "100") {
      return `
        <tr>
          <td></td>
          <td class="col-num">8.</td>
          <td class="col-sub">a.</td>
          <td colspan="3">
            <table style="width:100%; border-collapse:collapse;">
              <tr>
                <td style="width:45%;" class="bap-bold">Pembayaran Termyn (100%)</td>
                <td>Dengan Jaminan Pemeliharaan oleh :</td>
              </tr>
              <tr>
                <td></td>
                <td class="bap-bold">${escapeHtml(d.penjaminPem || "[Penjamin_Pemeliharaan]")}</td>
              </tr>
              <tr>
                <td>Nomor : ${escapeHtml(d.noJamPem || "[No_Jaminan_Pemeliharaan]")}</td>
                <td>Tanggal : ${escapeHtml(d.tglJamPemFmt || "[Tgl_Jaminan_Pemeliharaan]")}</td>
              </tr>
              <tr>
                <td>Sebesar : Rp ${fmtSheetRp(d.nilaiJamPem)}</td>
                <td>berlaku dari tanggal : &nbsp;${escapeHtml(d.berlakuPem || "[Masa_Berlaku_Pemeliharaan]")}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td></td>
          <td></td>
          <td class="col-sub">b.</td>
          <td colspan="3">
            <table style="width:100%; border-collapse:collapse;">
              <tr>
                <td style="width:45%;" class="bap-bold">Pembayaran Termyn 100%</td>
                <td>Sesuai Berita Acara Serah Terima Pekerjaan (BAST)</td>
              </tr>
              <tr>
                <td>tanggal : ${escapeHtml(d.tglBastFmt || "[Tgl_BAST]")}</td>
                <td>Nomor : ${escapeHtml(d.noBast || "[No_BAST]")}</td>
              </tr>
              <tr>
                <td colspan="2">Yang Menyatakan bahwa prestasi kemajuan fisik pekerjaan telah mencapai &nbsp;<strong>100%</strong></td>
              </tr>
            </table>
          </td>
        </tr>
      `;
    }

    // 4. SHEET: UM JASA
    if (tahap === "UM JASA") {
      return `
        <tr>
          <td></td>
          <td class="col-num">8.</td>
          <td class="col-sub">a.</td>
          <td colspan="3">
            <table style="width:100%; border-collapse:collapse;">
              <tr>
                <td style="width:45%;" class="bap-bold">Pembayaran Uang Muka</td>
                <td>Sesuai Berita Acara Pemeriksaan</td>
              </tr>
              <tr>
                <td>tanggal : ${escapeHtml(d.tglBaPemFmt || "[Tgl_BA_Pemeriksaan]")}</td>
                <td>Nomor : ${escapeHtml(d.noBaPem || "[No_BA_Pemeriksaan]")}</td>
              </tr>
              <tr>
                <td colspan="2">Yang Menyatakan bahwa Pihak Kedua Telah menyusun data pada laporan pendahuluan yang sesuai dengan kondisi di lapangan</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td></td>
          <td></td>
          <td class="col-sub">b.</td>
          <td colspan="3">
            <table style="width:100%; border-collapse:collapse;">
              <tr>
                <td style="width:45%;">Pembayaran Termyn Ke ……………</td>
                <td>Sesuai Berita Acara …………………………………..</td>
              </tr>
              <tr>
                <td>tanggal : -</td>
                <td>Nomor : -</td>
              </tr>
              <tr>
                <td colspan="2">Yang Menyatakan bahwa prestasi kemajuan fisik pekerjaan telah mencapai …….. %.</td>
              </tr>
            </table>
          </td>
        </tr>
      `;
    }

    // 5. SHEET: 100 JASA
    return `
      <tr>
        <td></td>
        <td class="col-num">8.</td>
        <td class="col-sub">a.</td>
        <td colspan="3">
          <table style="width:100%; border-collapse:collapse;">
            <tr>
              <td style="width:45%;" class="bap-bold">Pembayaran Termyn 100%</td>
              <td>Sesuai Berita Acara Serah Terima Pekerjaan (BAST)</td>
            </tr>
            <tr>
              <td>tanggal : ${escapeHtml(d.tglBastFmt || "[Tgl_BAST]")}</td>
              <td>Nomor : ${escapeHtml(d.noBast || "[No_BAST]")}</td>
            </tr>
            <tr>
              <td colspan="2">Yang Menyatakan bahwa Pihak Kedua Telah Menyerahkan Hasil Pekerjaan sesuai dengan Dokumen ${uraianText} (Laporan Akhir)</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td></td>
        <td></td>
        <td class="col-sub">b.</td>
        <td colspan="3">
          <table style="width:100%; border-collapse:collapse;">
            <tr>
              <td style="width:45%;">Pembayaran Termyn Ke ……………</td>
              <td>Sesuai Berita Acara …………………………………..</td>
            </tr>
            <tr>
              <td>tanggal : -</td>
              <td>Nomor : -</td>
            </tr>
            <tr>
              <td colspan="2">Yang Menyatakan bahwa prestasi kemajuan fisik pekerjaan telah mencapai …….. %.</td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }

  // Helper pemecah Nilai Bruto -> Nilai Fisik (DPP) & PPN 11%
  function hitungDppPpn(bruto, isPpn) {
    const total = Math.round(Number(bruto) || 0);
    if (total <= 0) return { dpp: 0, ppn: 0, total: 0 };
    if (!isPpn) return { dpp: total, ppn: 0, total: total };
    const dpp = Math.round(total / 1.11);
    const ppn = total - dpp;
    return { dpp: dpp, ppn: ppn, total: total };
  }

  // Render seluruh preview dokumen BAP secara real-time
  window.renderBapPreview = function () {
    const tahap = document.getElementById("bap-tahap").value;
    const tglBapIso = document.getElementById("bap-tanggal").value;
    const nomorBap = document.getElementById("bap-nomor").value.trim();

    // Tanggal BAP -> Hari, Tanggal Terbilang, Bulan, Tahun Terbilang
    const dt = parseLocalDate(tglBapIso);
    if (dt) {
      document.getElementById("pv-hari").textContent = NAMA_HARI[dt.getDay()];
      document.getElementById("pv-tgl-terbilang").textContent = angkaKeTerbilang(dt.getDate());
      document.getElementById("pv-bulan").textContent = NAMA_BULAN[dt.getMonth()];
      document.getElementById("pv-tahun-terbilang").textContent = angkaKeTerbilang(dt.getFullYear());
      document.getElementById("pv-tanggal-bap-ttd").textContent = fmtTanggalIndoPanjang(tglBapIso);
    } else {
      document.getElementById("pv-hari").textContent = "[Hari]";
      document.getElementById("pv-tgl-terbilang").textContent = "[Tanggal_Terbilang]";
      document.getElementById("pv-bulan").textContent = "[Bulan]";
      document.getElementById("pv-tahun-terbilang").textContent = "Dua Ribu Dua Puluh Enam";
      document.getElementById("pv-tanggal-bap-ttd").textContent = "[Tanggal_BAP]";
    }

    document.getElementById("pv-nomor-bap").textContent = nomorBap || "[Nomor_BAP]";

    // Bagian I: Pihak Pertama & Pihak Kedua
    const ppkNama = document.getElementById("bap-ppk-nama").value.trim() || "ANTONIUS NANANG ADI PUTRANTO, ST., MT.";
    const ppkPangkat = document.getElementById("bap-ppk-pangkat").value.trim() || "Pembina Tk. I";
    const ppkNip = document.getElementById("bap-ppk-nip").value.trim() || "NIP. 19780714 200212 1 006";

    document.getElementById("pv-ppk-nama").textContent = ppkNama;
    document.getElementById("pv-ttd-ppk").textContent = ppkNama;
    document.getElementById("pv-ttd-pangkat").textContent = ppkPangkat;
    document.getElementById("pv-ttd-nip").textContent = ppkNip;

    document.getElementById("pv-kegiatan").textContent = document.getElementById("bap-kegiatan").value.trim() || "[Nama_Kegiatan]";
    document.getElementById("pv-subkegiatan").textContent = document.getElementById("bap-subkegiatan").value.trim() || "[Nama_Sub_Kegiatan]";

    const direktur = document.getElementById("bap-direktur").value.trim() || "[Nama_Direktur]";
    const jabPenyedia = document.getElementById("bap-jabatan-penyedia").value.trim() || "[Jabatan_Penyedia]";
    const perusahaan = document.getElementById("bap-perusahaan").value.trim() || "[Nama_Perusahaan]";
    const alamatPenyedia = document.getElementById("bap-alamat-penyedia").value.trim() || "[Alamat_Perusahaan]";

    document.getElementById("pv-direktur").textContent = direktur;
    document.getElementById("pv-jabatan-penyedia").textContent = jabPenyedia;
    document.getElementById("pv-perusahaan").textContent = perusahaan;
    document.getElementById("pv-alamat-penyedia").textContent = alamatPenyedia;
    document.getElementById("pv-ttd-direktur").textContent = direktur;
    document.getElementById("pv-ttd-jabatan").textContent = jabPenyedia;

    // Bagian II.3 - II.7
    document.getElementById("pv-no-kontrak").textContent = document.getElementById("bap-no-kontrak").value.trim() || "[Nomor_Kontrak]";
    const tglKontrakIso = document.getElementById("bap-tgl-kontrak").value;
    document.getElementById("pv-tgl-kontrak").textContent = tglKontrakIso ? fmtTanggalIndoPanjang(tglKontrakIso) : "[Tanggal_Kontrak]";

    const nilaiAwal = Number(document.getElementById("bap-nilai-awal").value) || 0;
    const nilaiKontrak = Number(document.getElementById("bap-nilai-kontrak").value) || 0;
    document.getElementById("pv-nilai-awal").textContent = fmtSheetRp(nilaiAwal);
    document.getElementById("pv-nilai-kontrak").textContent = fmtSheetRp(nilaiKontrak);

    const noAdd = document.getElementById("bap-no-addendum").value.trim() || "-";
    const tglAddIso = document.getElementById("bap-tgl-addendum").value;
    document.getElementById("pv-no-addendum").textContent = noAdd;
    document.getElementById("pv-tgl-addendum").textContent = tglAddIso ? fmtTanggalIndoPanjang(tglAddIso) : "-";

    const uraian = document.getElementById("bap-uraian").value.trim();
    document.getElementById("pv-uraian").textContent = uraian || "[Uraian_Pekerjaan]";

    // Bagian II.8 (Dinamis sesuai sheet)
    const dII8 = {
      uraian: uraian,
      penjaminUm: document.getElementById("bap-penjamin-um").value.trim(),
      noJamUm: document.getElementById("bap-no-jam-um").value.trim(),
      tglJamUmFmt: document.getElementById("bap-tgl-jam-um").value ? fmtTanggalIndoPanjang(document.getElementById("bap-tgl-jam-um").value) : "",
      nilaiJamUm: Number(document.getElementById("bap-nilai-jam-um").value) || 0,
      berlakuUm: document.getElementById("bap-berlaku-um").value.trim(),
      penjaminPem: document.getElementById("bap-penjamin-pem").value.trim(),
      noJamPem: document.getElementById("bap-no-jam-pem").value.trim(),
      tglJamPemFmt: document.getElementById("bap-tgl-jam-pem").value ? fmtTanggalIndoPanjang(document.getElementById("bap-tgl-jam-pem").value) : "",
      nilaiJamPem: Number(document.getElementById("bap-nilai-jam-pem").value) || 0,
      berlakuPem: document.getElementById("bap-berlaku-pem").value.trim(),
      noBaPem: document.getElementById("bap-no-bapem").value.trim(),
      tglBaPemFmt: document.getElementById("bap-tgl-bapem").value ? fmtTanggalIndoPanjang(document.getElementById("bap-tgl-bapem").value) : "",
      noBast: document.getElementById("bap-no-bast").value.trim(),
      tglBastFmt: document.getElementById("bap-tgl-bast").value ? fmtTanggalIndoPanjang(document.getElementById("bap-tgl-bast").value) : ""
    };
    document.getElementById("pv-bagian-ii8").innerHTML = buildBagianII8Html(tahap, dII8);

    // Bagian III: Perhitungan Pembayaran
    const persen = Number(document.getElementById("bap-persen").value) || 0;
    const brutoTahap = Math.round((persen / 100) * nilaiKontrak);
    const potRetensi = Math.round(Number(document.getElementById("bap-pot-retensi").value) || 0);
    const potUm = Math.round(Number(document.getElementById("bap-pot-um").value) || 0);
    const totalPotongan = potRetensi + potUm;
    const bayarBapIni = Math.max(0, brutoTahap - totalPotongan);

    document.getElementById("pv-persen-1").textContent = persen + "%";
    document.getElementById("pv-persen-2").textContent = persen + "%";
    document.getElementById("pv-nilai-kali").textContent = fmtSheetRp(nilaiKontrak);
    document.getElementById("pv-bruto-tahap").textContent = fmtSheetRp(brutoTahap);
    document.getElementById("pv-pot-retensi").textContent = fmtSheetRp(potRetensi);
    document.getElementById("pv-pot-um").textContent = fmtSheetRp(potUm);
    document.getElementById("pv-pot-total").textContent = fmtSheetRp(totalPotongan);
    document.getElementById("pv-pembayaran-bap-ini").textContent = fmtSheetRp(bayarBapIni);

    // Bagian III.2: Sumber Pembayaran (DAK / DAU)
    const sumber = document.getElementById("bap-sumber-dana").value;
    if (sumber === "DAK") {
      document.getElementById("pv-dak-left").textContent = "-";
      document.getElementById("pv-dak-right").textContent = fmtSheetRp(bayarBapIni);
      document.getElementById("pv-dau-left").textContent = "-";
      document.getElementById("pv-dau-right").textContent = "-";
    } else {
      document.getElementById("pv-dak-left").textContent = "-";
      document.getElementById("pv-dak-right").textContent = "-";
      document.getElementById("pv-dau-left").textContent = "-";
      document.getElementById("pv-dau-right").textContent = fmtSheetRp(bayarBapIni);
    }
    document.getElementById("pv-sumber-total").textContent = fmtSheetRp(bayarBapIni);

    // Bagian IV: Rekapitulasi Pembayaran Kontrak (5 Baris x 3 Kolom Angka)
    const isPpn = document.getElementById("bap-ppn-mode").value === "PPN11";
    const bayarLalu = Math.round(Number(document.getElementById("bap-bayar-lalu").value) || 0);
    const totalSdIni = bayarLalu + bayarBapIni;
    const sisaKontrak = Math.max(0, nilaiKontrak - totalSdIni);

    const r1 = hitungDppPpn(nilaiKontrak, isPpn);
    const r2 = hitungDppPpn(bayarLalu, isPpn);
    const r3 = hitungDppPpn(bayarBapIni, isPpn);
    const r4 = hitungDppPpn(totalSdIni, isPpn);
    const r5 = hitungDppPpn(sisaKontrak, isPpn);

    const setRow = (idx, obj) => {
      document.getElementById(`rk-${idx}-dpp`).textContent = fmtSheetRp(obj.dpp);
      document.getElementById(`rk-${idx}-ppn`).textContent = fmtSheetRp(obj.ppn);
      document.getElementById(`rk-${idx}-jml`).textContent = fmtSheetRp(obj.total);
    };
    setRow(1, r1);
    setRow(2, r2);
    setRow(3, r3);
    setRow(4, r4);
    setRow(5, r5);

    // Bagian V: Rekening
    document.getElementById("pv-bank").textContent = document.getElementById("bap-bank").value.trim() || "[Nama_Bank]";
    document.getElementById("pv-rekening").textContent = document.getElementById("bap-rekening").value.trim() || "[No_Rekening]";

    // Helper Pajak Non-Cetak (Untuk Verifikator / Bendahara)
    const isJasa = tahap === "UM JASA" || tahap === "100 JASA";
    const tarifPph = isJasa ? 0.02 : 0.0175;
    const labelPph = isJasa ? "PPh Pasal 23 (2%)" : "PPh Pasal 4(2) Konstruksi (1,75%)";
    const nilaiPph = Math.round(r3.dpp * tarifPph);
    const transferBersih = Math.max(0, bayarBapIni - r3.ppn - nilaiPph);

    document.getElementById("bap-tax-summary-text").innerHTML =
      `DPP: <strong>Rp ${r3.dpp.toLocaleString("id-ID")}</strong> &nbsp;|&nbsp; ` +
      `PPN 11%: <strong>Rp ${r3.ppn.toLocaleString("id-ID")}</strong> &nbsp;|&nbsp; ` +
      `${labelPph}: <strong>Rp ${nilaiPph.toLocaleString("id-ID")}</strong> &nbsp;|&nbsp; ` +
      `Perkiraan Transfer Bersih ke Rekening Penyedia: <strong>Rp ${transferBersih.toLocaleString("id-ID")}</strong>`;
  };

  // Cetak / Simpan PDF (Hanya lembar F4 BAP)
  window.cetakDokumenBap = function () {
    window.renderBapPreview();
    window.print();
  };

  // Simpan Data BAP ke Backend Apps Script
  window.simpanBapKeServer = async function () {
    const nomorBap = document.getElementById("bap-nomor").value.trim();
    const tglBap = document.getElementById("bap-tanggal").value;
    const perusahaan = document.getElementById("bap-perusahaan").value.trim();
    const nilaiKontrak = Number(document.getElementById("bap-nilai-kontrak").value) || 0;

    if (!nomorBap || !tglBap || !perusahaan || nilaiKontrak <= 0) {
      alert("Lengkapi Nomor BAP, Tanggal BAP, Nama Perusahaan, dan Nilai Kontrak terlebih dahulu.");
      return;
    }

    const tahap = document.getElementById("bap-tahap").value;
    const persen = Number(document.getElementById("bap-persen").value) || 0;
    const brutoTahap = Math.round((persen / 100) * nilaiKontrak);
    const potRetensi = Math.round(Number(document.getElementById("bap-pot-retensi").value) || 0);
    const potUm = Math.round(Number(document.getElementById("bap-pot-um").value) || 0);
    const bayarBapIni = Math.max(0, brutoTahap - (potRetensi + potUm));

    const payload = {
      action: "simpanBap",
      token: typeof sessionToken !== "undefined" ? sessionToken : localStorage.getItem("sessionToken") || "",
      data: {
        tahap: tahap,
        nomorBap: nomorBap,
        tanggalBap: tglBap,
        kegiatan: document.getElementById("bap-kegiatan").value.trim(),
        subKegiatan: document.getElementById("bap-subkegiatan").value.trim(),
        perusahaan: perusahaan,
        direktur: document.getElementById("bap-direktur").value.trim(),
        jabatanPenyedia: document.getElementById("bap-jabatan-penyedia").value.trim(),
        alamatPenyedia: document.getElementById("bap-alamat-penyedia").value.trim(),
        bank: document.getElementById("bap-bank").value.trim(),
        rekening: document.getElementById("bap-rekening").value.trim(),
        noKontrak: document.getElementById("bap-no-kontrak").value.trim(),
        tglKontrak: document.getElementById("bap-tgl-kontrak").value,
        nilaiKontrakAwal: Number(document.getElementById("bap-nilai-awal").value) || 0,
        noAddendum: document.getElementById("bap-no-addendum").value.trim() || "-",
        tglAddendum: document.getElementById("bap-tgl-addendum").value || "",
        nilaiKontrak: nilaiKontrak,
        uraianPekerjaan: document.getElementById("bap-uraian").value.trim(),
        persenTahap: persen,
        potonganRetensi: potRetensi,
        pengembalianUm: potUm,
        pembayaranLalu: Number(document.getElementById("bap-bayar-lalu").value) || 0,
        nilaiBapIni: bayarBapIni,
        sumberDana: document.getElementById("bap-sumber-dana").value,
        kenaPpn: document.getElementById("bap-ppn-mode").value === "PPN11",
        penjaminUm: document.getElementById("bap-penjamin-um").value.trim(),
        noJamUm: document.getElementById("bap-no-jam-um").value.trim(),
        tglJamUm: document.getElementById("bap-tgl-jam-um").value,
        nilaiJamUm: Number(document.getElementById("bap-nilai-jam-um").value) || 0,
        berlakuUm: document.getElementById("bap-berlaku-um").value.trim(),
        penjaminPem: document.getElementById("bap-penjamin-pem").value.trim(),
        noJamPem: document.getElementById("bap-no-jam-pem").value.trim(),
        tglJamPem: document.getElementById("bap-tgl-jam-pem").value,
        nilaiJamPem: Number(document.getElementById("bap-nilai-jam-pem").value) || 0,
        berlakuPem: document.getElementById("bap-berlaku-pem").value.trim(),
        noBaPemeriksaan: document.getElementById("bap-no-bapem").value.trim(),
        tglBaPemeriksaan: document.getElementById("bap-tgl-bapem").value,
        noBast: document.getElementById("bap-no-bast").value.trim(),
        tglBast: document.getElementById("bap-tgl-bast").value
      }
    };

    const url = typeof API_URL !== "undefined" ? API_URL : (window.CONFIG && window.CONFIG.API_URL);
    if (!url) {
      alert("API_URL belum terkonfigurasi.");
      return;
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.status === "success" || json.ok) {
        alert("Data BAP berhasil disimpan!");
        if (typeof window.loadDaftarBap === "function") window.loadDaftarBap();
      } else {
        alert("Gagal menyimpan BAP: " + (json.message || "Terjadi kesalahan."));
      }
    } catch (err) {
      alert("Koneksi ke server gagal: " + err.message);
    }
  };

  // Muat daftar BAP tersimpan
  window.loadDaftarBap = async function () {
    const tbody = document.getElementById("bap-history-tbody");
    if (!tbody) return;
    const url = typeof API_URL !== "undefined" ? API_URL : (window.CONFIG && window.CONFIG.API_URL);
    if (!url) return;

    try {
      const token = typeof sessionToken !== "undefined" ? sessionToken : localStorage.getItem("sessionToken") || "";
      const res = await fetch(`${url}?action=getDaftarBap&token=${encodeURIComponent(token)}`);
      const json = await res.json();
      const rows = json.data || json.bapList || [];
      window._cachedBapList = rows;

      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#64748b;">Belum ada data BAP tersimpan.</td></tr>';
        return;
      }

      tbody.innerHTML = rows.map((r, idx) => {
        const sudahSpj = Boolean(r.sudahSpj || r.statusSpj === "SUDAH");
        return `
          <tr>
            <td><strong>${escapeHtml(r.nomorBap || "-")}</strong></td>
            <td>${escapeHtml(fmtTanggalIndoPanjang(r.tanggalBap || ""))}</td>
            <td>${escapeHtml(r.tahap || "-")}</td>
            <td>${escapeHtml(r.perusahaan || "-")}</td>
            <td>${escapeHtml(r.subKegiatan || "-")}</td>
            <td>Rp ${(Number(r.nilaiBapIni) || 0).toLocaleString("id-ID")}</td>
            <td>${sudahSpj ? '<span style="color:#16a34a;font-weight:700;">Sudah SPJ</span>' : '<span style="color:#d97706;font-weight:700;">Belum SPJ</span>'}</td>
            <td>
              <button type="button" class="bap-btn bap-btn-primary" style="padding:4px 8px;font-size:11px;" onclick="muatBapKeForm(${idx})">Muat / Cetak</button>
            </td>
          </tr>
        `;
      }).join("");
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#dc2626;">Gagal memuat daftar BAP.</td></tr>';
    }
  };

  // Muat ulang baris BAP lama ke form & preview agar bisa dicetak ulang kapan saja
  window.muatBapKeForm = function (idx) {
    const r = (window._cachedBapList || [])[idx];
    if (!r) return;

    document.getElementById("bap-tahap").value = r.tahap || "I (100)";
    window.onBapTahapChange();

    document.getElementById("bap-nomor").value = r.nomorBap || "";
    document.getElementById("bap-tanggal").value = r.tanggalBap || "";
    document.getElementById("bap-kegiatan").value = r.kegiatan || "";
    document.getElementById("bap-subkegiatan").value = r.subKegiatan || "";
    document.getElementById("bap-perusahaan").value = r.perusahaan || "";
    document.getElementById("bap-direktur").value = r.direktur || "";
    document.getElementById("bap-jabatan-penyedia").value = r.jabatanPenyedia || "Direktur";
    document.getElementById("bap-alamat-penyedia").value = r.alamatPenyedia || "";
    document.getElementById("bap-bank").value = r.bank || "Bank Jatim";
    document.getElementById("bap-rekening").value = r.rekening || "";
    document.getElementById("bap-no-kontrak").value = r.noKontrak || "";
    document.getElementById("bap-tgl-kontrak").value = r.tglKontrak || "";
    document.getElementById("bap-nilai-awal").value = r.nilaiKontrakAwal || r.nilaiKontrak || 0;
    document.getElementById("bap-no-addendum").value = r.noAddendum || "-";
    document.getElementById("bap-tgl-addendum").value = r.tglAddendum || "";
    document.getElementById("bap-nilai-kontrak").value = r.nilaiKontrak || 0;
    document.getElementById("bap-uraian").value = r.uraianPekerjaan || "";
    document.getElementById("bap-persen").value = r.persenTahap || 100;
    document.getElementById("bap-pot-retensi").value = r.potonganRetensi || 0;
    document.getElementById("bap-pot-um").value = r.pengembalianUm || 0;
    document.getElementById("bap-bayar-lalu").value = r.pembayaranLalu || 0;
    document.getElementById("bap-sumber-dana").value = r.sumberDana || "DAU";
    document.getElementById("bap-ppn-mode").value = r.kenaPpn === false ? "NON_PPN" : "PPN11";

    document.getElementById("bap-penjamin-um").value = r.penjaminUm || "";
    document.getElementById("bap-no-jam-um").value = r.noJamUm || "";
    document.getElementById("bap-tgl-jam-um").value = r.tglJamUm || "";
    document.getElementById("bap-nilai-jam-um").value = r.nilaiJamUm || 0;
    document.getElementById("bap-berlaku-um").value = r.berlakuUm || "";

    document.getElementById("bap-penjamin-pem").value = r.penjaminPem || "";
    document.getElementById("bap-no-jam-pem").value = r.noJamPem || "";
    document.getElementById("bap-tgl-jam-pem").value = r.tglJamPem || "";
    document.getElementById("bap-nilai-jam-pem").value = r.nilaiJamPem || 0;
    document.getElementById("bap-berlaku-pem").value = r.berlakuPem || "";

    document.getElementById("bap-no-bapem").value = r.noBaPemeriksaan || "";
    document.getElementById("bap-tgl-bapem").value = r.tglBaPemeriksaan || "";
    document.getElementById("bap-no-bast").value = r.noBast || "";
    document.getElementById("bap-tgl-bast").value = r.tglBast || "";

    window.renderBapPreview();
    document.getElementById("bap-print-area").scrollIntoView({ behavior: "smooth" });
  };

  window.resetFormBap = function () {
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById("bap-tanggal").value = today;
    document.getElementById("bap-nomor").value = "";
    document.getElementById("bap-nilai-awal").value = "";
    document.getElementById("bap-nilai-kontrak").value = "";
    document.getElementById("bap-nilai-kontrak").dataset.manualEdited = "";
    document.getElementById("bap-pot-retensi").value = 0;
    document.getElementById("bap-pot-um").value = 0;
    document.getElementById("bap-bayar-lalu").value = 0;
    window.onBapTahapChange();
  };

  // Inisialisasi saat modul BAP dibuka
  window.initBapModule = function () {
    const tglEl = document.getElementById("bap-tanggal");
    if (tglEl && !tglEl.value) {
      tglEl.value = new Date().toISOString().slice(0, 10);
    }
    const akhirEl = document.getElementById("bap-nilai-kontrak");
    if (akhirEl) {
      akhirEl.addEventListener("input", function () {
        this.dataset.manualEdited = "1";
      });
    }
    window.onBapTahapChange();
    window.loadDaftarBap();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", window.initBapModule);
  } else {
    window.initBapModule();
  }
})();
