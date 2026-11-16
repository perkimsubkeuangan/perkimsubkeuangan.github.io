// ============================================================================
// MODUL BAP LS - DISPERKIMTAN KABUPATEN BLITAR
// Tersambung 100% ke Code.gs (action: "load" & "create_bap")
// ============================================================================

(function () {
  const NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const NAMA_BULAN = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  // Konfigurasi cermin persis dari TAHAP_BAP di Code.gs
  const KONFIG_TAHAP = {
    "UM":       { kel: "FISIK", persenBebas: true,  persenDef: 30,  retensi: false, pengUmDari: "",        jaminan: "WAJIB",    bast: false, pph: "PPh Pasal 4(2)", tarif: 0.0175 },
    "UM JASA":  { kel: "JASA",  persenBebas: true,  persenDef: 30,  retensi: false, pengUmDari: "",        jaminan: "OPSIONAL", bast: true,  pph: "PPh Pasal 23",   tarif: 0.02 },
    "I (100)":  { kel: "FISIK", persenBebas: false, persenDef: 100, retensi: true,  pengUmDari: "UM",      jaminan: "SKEMA",    bast: true,  pph: "PPh Pasal 4(2)", tarif: 0.0175 },
    "100":      { kel: "FISIK", persenBebas: false, persenDef: 100, retensi: true,  pengUmDari: "",        jaminan: "SKEMA",    bast: true,  pph: "PPh Pasal 4(2)", tarif: 0.0175 },
    "100 JASA": { kel: "JASA",  persenBebas: false, persenDef: 100, retensi: false, pengUmDari: "UM JASA", jaminan: "",         bast: true,  pph: "PPh Pasal 23",   tarif: 0.02 }
  };

  // Default Master PPK, DPA & SPD sesuai template Excel (tertimpa otomatis bila sheet MASTER_BAP ada)
  const DEFAULT_MASTER_BAP = {
    ppk: {
      nama: "ANTONIUS NANANG ADI PUTRANTO, ST., MT.",
      jabatan: "Pejabat Pembuat Komitmen (PPK)",
      alamat: "Jl. S. Supriyadi 86 Blitar",
      pangkat: "Pembina Tk. I",
      nip: "NIP. 19780714 200212 1 006"
    },
    dpa: {
      nomor: "DPA/A.1/1.04.2.10.0.00.01.0000/001/2026",
      tanggal: "2026-01-02"
    },
    spd: [
      { nomor: "35.05/01.0/000001/1.04.2.10.0.00.01.0000/M/1/2026", tanggal: "2026-01-02" },
      { nomor: "35.05/01.0/000002/1.04.2.10.0.00.01.0000/P1/6/2026", tanggal: "2026-04-01" },
      { nomor: "35.05/01.0/000003/1.04.2.10.0.00.01.0000/P1/7/2026", tanggal: "2026-07-01" },
      { nomor: "35.05/01.0/000004/1.04.2.10.0.00.01.0000/P1/9/2026", tanggal: "2026-10-01" }
    ]
  };

  let stateBap = {
    user: null,
    referensi: {},
    penyediaCV: [],
    kontrakLS: [],
    akunPptk: [],
    masterBap: DEFAULT_MASTER_BAP
  };

  function getApiUrl() {
    if (typeof API_URL !== "undefined" && API_URL) return API_URL;
    if (typeof GAS_URL !== "undefined" && GAS_URL) return GAS_URL;
    if (window.CONFIG && window.CONFIG.API_URL) return window.CONFIG.API_URL;
    if (window.ERP_CONFIG && window.ERP_CONFIG.API_URL) return window.ERP_CONFIG.API_URL;
    return "";
  }

  function getSessionToken() {
    if (typeof sessionToken !== "undefined" && sessionToken) return sessionToken;
    if (typeof userToken !== "undefined" && userToken) return userToken;
    return localStorage.getItem("sessionToken") || sessionStorage.getItem("sessionToken") || localStorage.getItem("token") || "";
  }

  function angkaKeTerbilang(n) {
    n = Math.floor(Math.abs(Number(n) || 0));
    const satuan = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
    if (n === 0) return "Nol";
    if (n < 12) return satuan[n];
    if (n < 20) return satuan[n - 10] + " Belas";
    if (n < 100) {
      const puluh = Math.floor(n / 10), sisa = n % 10;
      return satuan[puluh] + " Puluh" + (sisa > 0 ? " " + angkaKeTerbilang(sisa) : "");
    }
    if (n < 200) return "Seratus" + (n - 100 > 0 ? " " + angkaKeTerbilang(n - 100) : "");
    if (n < 1000) {
      const ratus = Math.floor(n / 100), sisa = n % 100;
      return satuan[ratus] + " Ratus" + (sisa > 0 ? " " + angkaKeTerbilang(sisa) : "");
    }
    if (n < 2000) return "Seribu" + (n - 1000 > 0 ? " " + angkaKeTerbilang(n - 1000) : "");
    if (n < 1000000) {
      const ribu = Math.floor(n / 1000), sisa = n % 1000;
      return angkaKeTerbilang(ribu) + " Ribu" + (sisa > 0 ? " " + angkaKeTerbilang(sisa) : "");
    }
    return String(n);
  }

  function fmtSheetRp(val) {
    const num = Math.round(Number(val) || 0);
    return num <= 0 ? "-" : num.toLocaleString("id-ID");
  }

  function fmtTanggalIndoPanjang(isoDate) {
    if (!isoDate) return "-";
    const parts = String(isoDate).split("T")[0].split("-");
    if (parts.length !== 3) return isoDate;
    const y = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1, d = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d) || !NAMA_BULAN[m]) return isoDate;
    return String(d).padStart(2, "0") + " " + NAMA_BULAN[m] + " " + y;
  }

  function parseLocalDate(isoDate) {
    if (!isoDate) return null;
    const parts = String(isoDate).split("T")[0].split("-");
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

  // Ambil data master dari variabel global app.js atau langsung POST action:"load" ke Code.gs
  window.muatDataMasterBap = async function (forceFetch) {
    // 1) Cek apakah app.js sudah memuat data ke variabel global
    if (!forceFetch) {
      const refGlobal = window.referensiData || window.globalReferensi || (window.appData && window.appData.referensi);
      const cvGlobal = window.penyediaList || window.allPenyedia || (window.appData && window.appData.penyediaCV);
      const kGlobal = window.kontrakList || window.allKontrak || (window.appData && window.appData.kontrakLS);
      const uGlobal = window.currentUser || (window.appData && window.appData.user);
      const aGlobal = window.akunList || (window.appData && window.appData.akun);
      const mGlobal = (window.appData && window.appData.masterBap) || window.BAP_CONFIG;

      if (refGlobal && Object.keys(refGlobal).length > 0) {
        stateBap.referensi = refGlobal;
        stateBap.penyediaCV = cvGlobal || [];
        stateBap.kontrakLS = kGlobal || [];
        stateBap.user = uGlobal || null;
        stateBap.akunPptk = (aGlobal || []).filter(a => a.role === "PPTK");
        if (mGlobal && mGlobal.ppk) stateBap.masterBap = mGlobal;
        isiDropdownMaster();
        renderTabelRiwayatBap();
        window.renderBapPreview();
        return;
      }
    }

    // 2) Ambil langsung dari Code.gs (POST action: "load")
    const url = getApiUrl();
    const token = getSessionToken();
    if (!url || !token) return;

    try {
      const res = await fetch(url, {
        method: "POST",
        body: JSON.stringify({ action: "load", token: token })
      });
      const json = await res.json();
      if (json.status === "success") {
        stateBap.user = json.user || null;
        stateBap.referensi = json.referensi || {};
        stateBap.penyediaCV = json.penyediaCV || [];
        stateBap.kontrakLS = json.kontrakLS || [];
        stateBap.akunPptk = (json.akun || []).filter(a => a.role === "PPTK");
        if (json.masterBap && json.masterBap.ppk && json.masterBap.ppk.nama) {
          stateBap.masterBap = json.masterBap;
        } else if (window.BAP_CONFIG) {
          stateBap.masterBap = window.BAP_CONFIG;
        }
        isiDropdownMaster();
        renderTabelRiwayatBap();
        window.renderBapPreview();
      }
    } catch (err) {
      console.error("Gagal memuat master BAP:", err);
    }
  };

  function isiDropdownMaster() {
    // Dropdown PPTK (muncul bila login sebagai SUPER_ADMIN)
    const grpPptk = document.getElementById("grp-bap-pptk");
    const selPptk = document.getElementById("bap-pptk");
    if (grpPptk && selPptk) {
      const isSuperAdmin = stateBap.user && stateBap.user.role === "SUPER_ADMIN";
      grpPptk.style.display = isSuperAdmin ? "block" : "none";
      const curPptk = selPptk.value;
      selPptk.innerHTML = '<option value="">-- Pilih PPTK --</option>' +
        stateBap.akunPptk.map(p => `<option value="${escapeHtml(p.namaLengkap)}">${escapeHtml(p.namaLengkap)}</option>`).join("");
      if (curPptk) selPptk.value = curPptk;
    }

    // Dropdown Program
    const selProg = document.getElementById("bap-program");
    if (selProg) {
      const curProg = selProg.value;
      const progs = Object.keys(stateBap.referensi || {});
      selProg.innerHTML = '<option value="">-- Pilih Program --</option>' +
        progs.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
      if (curProg && progs.includes(curProg)) selProg.value = curProg;
    }

    // Dropdown CV / Penyedia
    const selCv = document.getElementById("bap-cv-select");
    if (selCv) {
      selCv.innerHTML = '<option value="">-- Pilih Penyedia Tersimpan atau Isi Baru --</option>' +
        stateBap.penyediaCV.map((c, idx) => `<option value="${idx}">${escapeHtml(c.pelaksana)} (${escapeHtml(c.direktur)})</option>`).join("");
    }
  }

  window.onBapProgramChange = function () {
    const prog = document.getElementById("bap-program").value;
    const selKeg = document.getElementById("bap-kegiatan");
    const selSub = document.getElementById("bap-subkegiatan");
    const kegs = prog && stateBap.referensi[prog] ? Object.keys(stateBap.referensi[prog]) : [];
    selKeg.innerHTML = '<option value="">-- Pilih Kegiatan --</option>' +
      kegs.map(k => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`).join("");
    selSub.innerHTML = '<option value="">-- Pilih Sub Kegiatan --</option>';
    window.renderBapPreview();
  };

  window.onBapKegiatanChange = function () {
    const prog = document.getElementById("bap-program").value;
    const keg = document.getElementById("bap-kegiatan").value;
    const selSub = document.getElementById("bap-subkegiatan");
    const subs = (prog && keg && stateBap.referensi[prog] && stateBap.referensi[prog][keg]) ? stateBap.referensi[prog][keg] : [];
    selSub.innerHTML = '<option value="">-- Pilih Sub Kegiatan --</option>' +
      subs.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
    window.renderBapPreview();
  };

  window.onBapCvSelect = function () {
    const idx = document.getElementById("bap-cv-select").value;
    if (idx === "") return;
    const cv = stateBap.penyediaCV[Number(idx)];
    if (!cv) return;
    document.getElementById("bap-perusahaan").value = cv.pelaksana || "";
    document.getElementById("bap-direktur").value = cv.direktur || "";
    document.getElementById("bap-jabatan-penyedia").value = cv.jabatan || "Direktur";
    document.getElementById("bap-npwp").value = cv.npwp || "";
    document.getElementById("bap-alamat-penyedia").value = cv.alamat || "";
    document.getElementById("bap-bank").value = cv.bank || "Bank Jatim";
    document.getElementById("bap-rekening").value = cv.noRek || "";
    window.renderBapPreview();
  };

  // Jika No. Kontrak diketik dan sudah ada BAP sebelumnya (misal UM), tarik otomatis data kontraknya
  window.onBapNoKontrakInput = function () {
    const noKontrak = document.getElementById("bap-no-kontrak").value.trim();
    if (noKontrak) {
      const riwayat = stateBap.kontrakLS.filter(x => String(x.noKontrak).trim() === noKontrak);
      if (riwayat.length > 0) {
        const ref = riwayat[0];
        if (!document.getElementById("bap-tgl-kontrak").value && ref.tglKontrak) {
          document.getElementById("bap-tgl-kontrak").value = ref.tglKontrak;
        }
        if (!(Number(document.getElementById("bap-nilai-awal").value) > 0) && ref.nilaiKontrak) {
          document.getElementById("bap-nilai-awal").value = ref.nilaiKontrak;
        }
        if (!document.getElementById("bap-perusahaan").value && ref.pelaksana) {
          document.getElementById("bap-perusahaan").value = ref.pelaksana;
          const cvMatch = stateBap.penyediaCV.find(c => String(c.pelaksana).trim().toUpperCase() === String(ref.pelaksana).trim().toUpperCase());
          if (cvMatch) {
            document.getElementById("bap-direktur").value = cvMatch.direktur || "";
            document.getElementById("bap-jabatan-penyedia").value = cvMatch.jabatan || "Direktur";
            document.getElementById("bap-npwp").value = cvMatch.npwp || "";
            document.getElementById("bap-alamat-penyedia").value = cvMatch.alamat || "";
            document.getElementById("bap-bank").value = cvMatch.bank || "Bank Jatim";
            document.getElementById("bap-rekening").value = cvMatch.noRek || "";
          }
        }
        if (!document.getElementById("bap-uraian").value && ref.uraian) {
          document.getElementById("bap-uraian").value = ref.uraian;
        }
      }
    }
    window.renderBapPreview();
  };

  window.onBapTahapChange = function () {
    const tahap = document.getElementById("bap-tahap").value;
    const cfg = KONFIG_TAHAP[tahap] || KONFIG_TAHAP["I (100)"];
    const persenEl = document.getElementById("bap-persen");

    persenEl.value = cfg.persenDef;
    persenEl.readOnly = !cfg.persenBebas;
    document.getElementById("bap-active-sheet-badge").textContent = "Sheet: " + tahap;

    // Skema Retensi hanya untuk I (100) & 100
    document.getElementById("grp-skema-retensi").style.display = cfg.retensi ? "block" : "none";

    // BAST / BA Pemeriksaan
    document.getElementById("grp-bast").style.display = cfg.bast ? "block" : "none";
    document.getElementById("lbl-bast-no").textContent = tahap === "UM JASA" ? "Nomor BA Pemeriksaan *" : "Nomor BAST *";
    document.getElementById("lbl-bast-tgl").textContent = tahap === "UM JASA" ? "Tanggal BA Pemeriksaan *" : "Tanggal BAST *";

    // Pernyataan khusus jasa
    document.getElementById("grp-pernyataan").style.display = cfg.kel === "JASA" ? "block" : "none";

    window.onBapSkemaChange();
  };

  window.onBapSkemaChange = function () {
    const tahap = document.getElementById("bap-tahap").value;
    const cfg = KONFIG_TAHAP[tahap] || KONFIG_TAHAP["I (100)"];
    const skema = document.getElementById("bap-skema-retensi").value;

    const tampilJam = cfg.jaminan === "WAJIB" || cfg.jaminan === "OPSIONAL" || (cfg.jaminan === "SKEMA" && skema === "JAMINAN");
    document.getElementById("grp-jaminan").style.display = tampilJam ? "block" : "none";
    document.getElementById("lbl-jam-penjamin").textContent =
      cfg.jaminan === "SKEMA" ? "Penjamin Pemeliharaan *" :
      cfg.jaminan === "OPSIONAL" ? "Penjamin Uang Muka (Opsional)" : "Penjamin Uang Muka *";

    window.renderBapPreview();
  };

  // Membangun Bagian II.8 persis 100% dengan ke-5 sheet spreadsheet
  function buildBagianII8Html(tahap, d) {
    const uraianText = escapeHtml(d.uraian || "[Uraian_Pekerjaan]");

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
                <td class="bap-bold">${escapeHtml(d.jamPenjamin || "[Penjamin_Uang_Muka]")}</td>
              </tr>
              <tr>
                <td>Nomor : ${escapeHtml(d.jamNo || "[No_Jaminan_UM]")}</td>
                <td>Tanggal : ${escapeHtml(d.jamTglFmt || "[Tgl_Jaminan_UM]")}</td>
              </tr>
              <tr>
                <td>Sebesar : Rp ${fmtSheetRp(d.jamNilai)}</td>
                <td>berlaku dari tanggal &nbsp;${escapeHtml(d.jamBerlakuFmt || "[Masa_Berlaku_UM]")}</td>
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
                <td>${escapeHtml(d.umPenjamin || "[Penjamin_Uang_Muka]")}</td>
              </tr>
              <tr>
                <td>Nomor : ${escapeHtml(d.umNo || "[No_Jaminan_UM]")}</td>
                <td>Tanggal : ${escapeHtml(d.umTglFmt || "[Tgl_Jaminan_UM]")}</td>
              </tr>
              <tr>
                <td>Sebesar : Rp ${fmtSheetRp(d.umNilai)}</td>
                <td>berlaku dari tanggal &nbsp;${escapeHtml(d.umBerlakuFmt || "[Masa_Berlaku_UM]")}</td>
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
                <td class="bap-bold">${escapeHtml(d.skema === "JAMINAN" ? (d.jamPenjamin || "[Penjamin_Pemeliharaan]") : "-")}</td>
              </tr>
              <tr>
                <td>Nomor : ${escapeHtml(d.skema === "JAMINAN" ? (d.jamNo || "[No_Jaminan_Pemeliharaan]") : "-")}</td>
                <td>Tanggal : ${escapeHtml(d.skema === "JAMINAN" ? (d.jamTglFmt || "[Tgl_Jaminan_Pemeliharaan]") : "-")}</td>
              </tr>
              <tr>
                <td>Sebesar : Rp ${d.skema === "JAMINAN" ? fmtSheetRp(d.jamNilai) : "-"}</td>
                <td>berlaku dari tanggal &nbsp;${escapeHtml(d.skema === "JAMINAN" ? (d.jamBerlakuFmt || "[Masa_Berlaku_Pemeliharaan]") : "-")}</td>
              </tr>
              <tr>
                <td colspan="2">Sesuai dengan Berita Acara Serah Terima Pekerjaan (BAST):</td>
              </tr>
              <tr>
                <td>tanggal : ${escapeHtml(d.bastTglFmt || "[Tgl_BAST]")}</td>
                <td>Nomor : ${escapeHtml(d.bastNo || "[No_BAST]")}</td>
              </tr>
              <tr>
                <td colspan="2">Yang Menyatakan bahwa prestasi kemajuan fisik pekerjaan telah mencapai &nbsp;<strong>100%</strong></td>
              </tr>
            </table>
          </td>
        </tr>
      `;
    }

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
                <td class="bap-bold">${escapeHtml(d.skema === "JAMINAN" ? (d.jamPenjamin || "[Penjamin_Pemeliharaan]") : "-")}</td>
              </tr>
              <tr>
                <td>Nomor : ${escapeHtml(d.skema === "JAMINAN" ? (d.jamNo || "[No_Jaminan_Pemeliharaan]") : "-")}</td>
                <td>Tanggal : ${escapeHtml(d.skema === "JAMINAN" ? (d.jamTglFmt || "[Tgl_Jaminan_Pemeliharaan]") : "-")}</td>
              </tr>
              <tr>
                <td>Sebesar : Rp ${d.skema === "JAMINAN" ? fmtSheetRp(d.jamNilai) : "-"}</td>
                <td>berlaku dari tanggal : &nbsp;${escapeHtml(d.skema === "JAMINAN" ? (d.jamBerlakuFmt || "[Masa_Berlaku_Pemeliharaan]") : "-")}</td>
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
                <td>tanggal : ${escapeHtml(d.bastTglFmt || "[Tgl_BAST]")}</td>
                <td>Nomor : ${escapeHtml(d.bastNo || "[No_BAST]")}</td>
              </tr>
              <tr>
                <td colspan="2">Yang Menyatakan bahwa prestasi kemajuan fisik pekerjaan telah mencapai &nbsp;<strong>100%</strong></td>
              </tr>
            </table>
          </td>
        </tr>
      `;
    }

    if (tahap === "UM JASA") {
      const ket = escapeHtml(d.pernyataan || "Yang Menyatakan bahwa Pihak Kedua Telah menyusun data pada laporan pendahuluan yang sesuai dengan kondisi di lapangan");
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
                <td>tanggal : ${escapeHtml(d.bastTglFmt || "[Tgl_BA_Pemeriksaan]")}</td>
                <td>Nomor : ${escapeHtml(d.bastNo || "[No_BA_Pemeriksaan]")}</td>
              </tr>
              <tr>
                <td colspan="2">${ket}</td>
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

    // 100 JASA
    const ketAkhir = escapeHtml(d.pernyataan || `Yang Menyatakan bahwa Pihak Kedua Telah Menyerahkan Hasil Pekerjaan sesuai dengan Dokumen ${d.uraian || "[Uraian_Pekerjaan]"} (Laporan Akhir)`);
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
              <td>tanggal : ${escapeHtml(d.bastTglFmt || "[Tgl_BAST]")}</td>
              <td>Nomor : ${escapeHtml(d.bastNo || "[No_BAST]")}</td>
            </tr>
            <tr>
              <td colspan="2">${ketAkhir}</td>
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

  // Rumus identik 100% dengan hitungBapInti_ di Code.gs
  function hitungBapInti(p) {
    const bayarIni = Math.round(p.bruto - p.retensi - p.pengUm);
    const dpp = Math.round(bayarIni / 1.11);
    const ppn = bayarIni - dpp;
    const pph = Math.round(dpp * p.tarif);
    const pecah = (t) => {
      t = Math.round(t);
      const f = Math.round(t / 1.11);
      return { fisik: f, ppn: t - f, jumlah: t };
    };
    const r1 = pecah(p.aktif), r2 = pecah(p.sebelum), r3 = pecah(bayarIni);
    const r4 = { fisik: r2.fisik + r3.fisik, ppn: r2.ppn + r3.ppn, jumlah: r2.jumlah + r3.jumlah };
    const r5 = { fisik: Math.max(0, r1.fisik - r4.fisik), ppn: Math.max(0, r1.ppn - r4.ppn), jumlah: Math.max(0, r1.jumlah - r4.jumlah) };
    return {
      aktif: p.aktif, bruto: p.bruto, retensi: p.retensi, pengUm: p.pengUm,
      potongan: p.retensi + p.pengUm, bayarIni: bayarIni,
      dpp: dpp, ppn: ppn, pph: pph, totalPajak: ppn + pph, bersih: bayarIni - (ppn + pph),
      rekap: [r1, r2, r3, r4, r5]
    };
  }

  window.renderBapPreview = function () {
    const tahap = document.getElementById("bap-tahap").value;
    const cfg = KONFIG_TAHAP[tahap] || KONFIG_TAHAP["I (100)"];
    const m = stateBap.masterBap || DEFAULT_MASTER_BAP;

    // Master PPK, DPA & SPD
    document.getElementById("pv-ppk-nama").textContent = m.ppk.nama;
    document.getElementById("pv-ppk-jabatan").textContent = m.ppk.jabatan;
    document.getElementById("pv-ppk-alamat").textContent = m.ppk.alamat;
    document.getElementById("pv-ttd-ppk").textContent = m.ppk.nama;
    document.getElementById("pv-ttd-pangkat").textContent = m.ppk.pangkat;
    document.getElementById("pv-ttd-nip").textContent = m.ppk.nip;

    document.getElementById("pv-dpa-no").textContent = m.dpa.nomor;
    document.getElementById("pv-dpa-tgl").textContent = fmtTanggalIndoPanjang(m.dpa.tanggal);

    const hurufSpd = ["a.", "b.", "c.", "d."];
    document.getElementById("pv-spd-rows").innerHTML = (m.spd || []).map((s, idx) => `
      <tr>
        <td></td>
        <td></td>
        <td class="col-sub">${hurufSpd[idx] || ""}</td>
        <td>Nomor</td>
        <td class="col-colon">:</td>
        <td>
          <table style="width:100%; border-collapse:collapse;">
            <tr>
              <td style="width:65%;">${escapeHtml(s.nomor)}</td>
              <td style="width:35%;">Tanggal : ${escapeHtml(fmtTanggalIndoPanjang(s.tanggal))}</td>
            </tr>
          </table>
        </td>
      </tr>
    `).join("");

    // Tanggal BAP & Nomor
    const tglBapIso = document.getElementById("bap-tanggal").value;
    const dt = parseLocalDate(tglBapIso);
    if (dt) {
      document.getElementById("pv-hari").textContent = NAMA_HARI[dt.getDay()];
      document.getElementById("pv-tgl-terbilang").textContent = angkaKeTerbilang(dt.getDate());
      document.getElementById("pv-bulan").textContent = NAMA_BULAN[dt.getMonth()];
      document.getElementById("pv-tahun-terbilang").textContent = angkaKeTerbilang(dt.getFullYear());
      document.getElementById("pv-tanggal-bap-ttd").textContent = fmtTanggalIndoPanjang(tglBapIso);
    }
    const noBapInput = document.getElementById("bap-nomor").value.trim();
    document.getElementById("pv-nomor-bap").textContent = noBapInput || "[Otomatis saat Simpan]";

    // Kegiatan, Sub Kegiatan & Penyedia
    document.getElementById("pv-kegiatan").textContent = document.getElementById("bap-kegiatan").value || "[Nama_Kegiatan]";
    document.getElementById("pv-subkegiatan").textContent = document.getElementById("bap-subkegiatan").value || "[Nama_Sub_Kegiatan]";

    const direktur = document.getElementById("bap-direktur").value.trim() || "[Nama_Direktur]";
    const jabPenyedia = document.getElementById("bap-jabatan-penyedia").value.trim() || "Direktur";
    const perusahaan = document.getElementById("bap-perusahaan").value.trim() || "[Nama_Perusahaan]";
    const alamatPenyedia = document.getElementById("bap-alamat-penyedia").value.trim() || "[Alamat_Perusahaan]";

    document.getElementById("pv-direktur").textContent = direktur;
    document.getElementById("pv-jabatan-penyedia").textContent = jabPenyedia;
    document.getElementById("pv-perusahaan").textContent = perusahaan;
    document.getElementById("pv-alamat-penyedia").textContent = alamatPenyedia;
    document.getElementById("pv-ttd-direktur").textContent = direktur;
    document.getElementById("pv-ttd-jabatan").textContent = jabPenyedia;

    // Kontrak & Addendum
    const noKontrak = document.getElementById("bap-no-kontrak").value.trim();
    const tglKontrakIso = document.getElementById("bap-tgl-kontrak").value;
    document.getElementById("pv-no-kontrak").textContent = noKontrak || "[Nomor_Kontrak]";
    document.getElementById("pv-tgl-kontrak").textContent = tglKontrakIso ? fmtTanggalIndoPanjang(tglKontrakIso) : "[Tanggal_Kontrak]";

    const nilaiAwal = Math.round(Number(document.getElementById("bap-nilai-awal").value) || 0);
    const addNo = document.getElementById("bap-no-addendum").value.trim();
    const addTglIso = document.getElementById("bap-tgl-addendum").value;
    const addNilai = Math.round(Number(document.getElementById("bap-nilai-addendum").value) || 0);
    const aktif = addNilai > 0 ? addNilai : nilaiAwal;

    document.getElementById("pv-nilai-awal").textContent = fmtSheetRp(nilaiAwal);
    document.getElementById("pv-no-addendum").textContent = addNo || "-";
    document.getElementById("pv-tgl-addendum").textContent = addTglIso ? fmtTanggalIndoPanjang(addTglIso) : "-";
    document.getElementById("pv-nilai-kontrak").textContent = fmtSheetRp(aktif);

    const uraian = document.getElementById("bap-uraian").value.trim();
    document.getElementById("pv-uraian").textContent = uraian || "[Uraian_Pekerjaan]";

    // Cek riwayat kontrak yang sama di DB_KONTRAK_LS (untuk Pengembalian UM & Pembayaran s.d BAP y.l)
    const riwayat = noKontrak
      ? stateBap.kontrakLS.filter(x => String(x.noKontrak).trim() === noKontrak && String(x.noBap).trim() !== noBapInput)
      : [];
    const rowUm = cfg.pengUmDari ? riwayat.find(x => String(x.tahapBayar).trim() === cfg.pengUmDari) : null;
    const pengUm = rowUm ? Math.round(Number(rowUm.pembayaranBapIni) || 0) : 0;
    const sebelum = riwayat.reduce((acc, x) => acc + Math.round(Number(x.pembayaranBapIni) || 0), 0);

    // Bagian II.8
    const skema = document.getElementById("bap-skema-retensi").value;
    const dII8 = {
      uraian: uraian,
      skema: skema,
      umPenjamin: rowUm ? rowUm.jamPenjamin : "",
      umNo: rowUm ? rowUm.jamNo : "",
      umTglFmt: rowUm && rowUm.jamTgl ? fmtTanggalIndoPanjang(rowUm.jamTgl) : "",
      umNilai: rowUm ? rowUm.jamNilai : 0,
      umBerlakuFmt: rowUm && rowUm.jamBerlaku ? fmtTanggalIndoPanjang(rowUm.jamBerlaku) : "",
      jamPenjamin: document.getElementById("bap-jam-penjamin").value.trim(),
      jamNo: document.getElementById("bap-jam-no").value.trim(),
      jamTglFmt: document.getElementById("bap-jam-tgl").value ? fmtTanggalIndoPanjang(document.getElementById("bap-jam-tgl").value) : "",
      jamNilai: Number(document.getElementById("bap-jam-nilai").value) || 0,
      jamBerlakuFmt: document.getElementById("bap-jam-berlaku").value ? fmtTanggalIndoPanjang(document.getElementById("bap-jam-berlaku").value) : "",
      bastNo: document.getElementById("bap-bast-no").value.trim(),
      bastTglFmt: document.getElementById("bap-bast-tgl").value ? fmtTanggalIndoPanjang(document.getElementById("bap-bast-tgl").value) : "",
      pernyataan: document.getElementById("bap-pernyataan").value.trim()
    };
    document.getElementById("pv-bagian-ii8").innerHTML = buildBagianII8Html(tahap, dII8);

    // Perhitungan Bagian III & IV (cermin 100% hitungBapInti_ di Code.gs)
    const persen = Number(document.getElementById("bap-persen").value) || 0;
    const bruto = Math.round((aktif * persen) / 100);
    const retensi = (cfg.retensi && skema === "RETENSI") ? Math.round(bruto * 0.05) : 0;
    const hit = hitungBapInti({ aktif: aktif, bruto: bruto, retensi: retensi, pengUm: pengUm, sebelum: sebelum, tarif: cfg.tarif });

    document.getElementById("pv-persen-1").textContent = persen + "%";
    document.getElementById("pv-persen-2").textContent = persen + "%";
    document.getElementById("pv-nilai-kali").textContent = fmtSheetRp(aktif);
    document.getElementById("pv-bruto-tahap").textContent = fmtSheetRp(hit.bruto);
    document.getElementById("pv-pot-retensi").textContent = fmtSheetRp(hit.retensi);
    document.getElementById("pv-pot-um").textContent = fmtSheetRp(hit.pengUm);
    document.getElementById("pv-pot-total").textContent = fmtSheetRp(hit.potongan);
    document.getElementById("pv-pembayaran-bap-ini").textContent = fmtSheetRp(hit.bayarIni);

    // Sumber Pembayaran DAK / DAU
    const dak = Math.max(0, Math.round(Number(document.getElementById("bap-dak").value) || 0));
    const dau = Math.max(0, hit.bayarIni - dak);
    document.getElementById("pv-dak-right").textContent = fmtSheetRp(dak);
    document.getElementById("pv-dau-right").textContent = fmtSheetRp(dau);
    document.getElementById("pv-sumber-total").textContent = fmtSheetRp(hit.bayarIni);

    // Tabel Rekapitulasi Bagian IV
    hit.rekap.forEach((row, idx) => {
      const no = idx + 1;
      document.getElementById(`rk-${no}-dpp`).textContent = fmtSheetRp(row.fisik);
      document.getElementById(`rk-${no}-ppn`).textContent = fmtSheetRp(row.ppn);
      document.getElementById(`rk-${no}-jml`).textContent = fmtSheetRp(row.jumlah);
    });

    // Rekening
    document.getElementById("pv-bank").textContent = document.getElementById("bap-bank").value.trim() || "[Nama_Bank]";
    document.getElementById("pv-rekening").textContent = document.getElementById("bap-rekening").value.trim() || "[No_Rekening]";

    // Helper Pajak Non-Cetak
    document.getElementById("bap-tax-summary-text").innerHTML =
      `DPP: <strong>Rp ${hit.dpp.toLocaleString("id-ID")}</strong> &nbsp;|&nbsp; ` +
      `PPN 11%: <strong>Rp ${hit.ppn.toLocaleString("id-ID")}</strong> &nbsp;|&nbsp; ` +
      `${cfg.pph} (${(cfg.tarif * 100).toFixed(2).replace(".", ",")}%): <strong>Rp ${hit.pph.toLocaleString("id-ID")}</strong> &nbsp;|&nbsp; ` +
      `Nilai Bersih Transfer ke Penyedia: <strong>Rp ${hit.bersih.toLocaleString("id-ID")}</strong>`;
  };

  window.cetakDokumenBap = function () {
    window.renderBapPreview();
    window.print();
  };

  // Simpan ke Code.gs (action: "create_bap")
  window.simpanBapKeServer = async function () {
    const url = getApiUrl();
    const token = getSessionToken();
    if (!url || !token) {
      alert("Sesi login atau URL server tidak ditemukan.");
      return;
    }

    const tahap = document.getElementById("bap-tahap").value;
    const cfg = KONFIG_TAHAP[tahap] || KONFIG_TAHAP["I (100)"];
    const skema = document.getElementById("bap-skema-retensi").value;

    const payload = {
      action: "create_bap",
      token: token,
      pptk: document.getElementById("bap-pptk") ? document.getElementById("bap-pptk").value : "",
      program: document.getElementById("bap-program").value,
      kegiatan: document.getElementById("bap-kegiatan").value,
      subKegiatan: document.getElementById("bap-subkegiatan").value,
      uraian: document.getElementById("bap-uraian").value.trim(),
      pelaksanaCv: document.getElementById("bap-perusahaan").value.trim(),
      direktur: document.getElementById("bap-direktur").value.trim(),
      jabatan: document.getElementById("bap-jabatan-penyedia").value.trim() || "Direktur",
      npwp: document.getElementById("bap-npwp").value.trim(),
      alamatCv: document.getElementById("bap-alamat-penyedia").value.trim(),
      bank: document.getElementById("bap-bank").value.trim(),
      noRek: document.getElementById("bap-rekening").value.trim(),
      noKontrak: document.getElementById("bap-no-kontrak").value.trim(),
      tglKontrak: document.getElementById("bap-tgl-kontrak").value,
      nilaiKontrak: Number(document.getElementById("bap-nilai-awal").value) || 0,
      addNo: document.getElementById("bap-no-addendum").value.trim(),
      addTgl: document.getElementById("bap-tgl-addendum").value,
      addNilai: Number(document.getElementById("bap-nilai-addendum").value) || 0,
      tahapBayar: tahap,
      persen: Number(document.getElementById("bap-persen").value) || cfg.persenDef,
      skemaRetensi: cfg.retensi ? skema : "",
      tglBap: document.getElementById("bap-tanggal").value,
      dak: Number(document.getElementById("bap-dak").value) || 0,
      jamPenjamin: document.getElementById("bap-jam-penjamin").value.trim(),
      jamNo: document.getElementById("bap-jam-no").value.trim(),
      jamNilai: Number(document.getElementById("bap-jam-nilai").value) || 0,
      jamTgl: document.getElementById("bap-jam-tgl").value,
      jamBerlaku: document.getElementById("bap-jam-berlaku").value,
      bastTgl: document.getElementById("bap-bast-tgl").value,
      bastNo: document.getElementById("bap-bast-no").value.trim(),
      pernyataan: document.getElementById("bap-pernyataan").value.trim()
    };

    const btn = document.getElementById("btn-simpan-bap");
    if (btn) { btn.disabled = true; btn.textContent = "Menyimpan..."; }

    try {
      const res = await fetch(url, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.status === "success") {
        document.getElementById("bap-nomor").value = json.noBap || "";
        window.renderBapPreview();
        alert("BAP berhasil disimpan!\nNomor BAP: " + json.noBap + "\nKode SPJ: " + json.kodeSpj);
        await window.muatDataMasterBap(true);
        if (typeof window.loadData === "function") window.loadData();
      } else {
        alert("Gagal menyimpan BAP:\n" + (json.message || "Periksa kembali isian formulir."));
      }
    } catch (err) {
      alert("Gagal terhubung ke server: " + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Simpan BAP ke Server"; }
    }
  };

  function renderTabelRiwayatBap() {
    const tbody = document.getElementById("bap-history-tbody");
    if (!tbody) return;
    const rows = stateBap.kontrakLS || [];
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#64748b;">Belum ada data BAP tersimpan.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.slice().reverse().map((r, revIdx) => {
      const realIdx = rows.length - 1 - revIdx;
      return `
        <tr>
          <td><strong>${escapeHtml(r.noBap || "-")}</strong></td>
          <td>${escapeHtml(fmtTanggalIndoPanjang(r.tglBap || ""))}</td>
          <td>${escapeHtml(r.tahapBayar || "-")}</td>
          <td>${escapeHtml(r.noKontrak || "-")}</td>
          <td>${escapeHtml(r.pelaksana || "-")}</td>
          <td>${escapeHtml(r.subKegiatan || "-")}</td>
          <td>Rp ${(Number(r.pembayaranBapIni) || 0).toLocaleString("id-ID")}</td>
          <td>
            <button type="button" class="bap-btn bap-btn-primary" style="padding:4px 9px; font-size:11.5px;" onclick="muatBapKePreview(${realIdx})">Muat &amp; Cetak</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  window.muatBapKePreview = function (idx) {
    const r = (stateBap.kontrakLS || [])[idx];
    if (!r) return;

    document.getElementById("bap-tahap").value = r.tahapBayar || "I (100)";
    window.onBapTahapChange();

    document.getElementById("bap-nomor").value = r.noBap || "";
    document.getElementById("bap-tanggal").value = r.tglBap || "";

    if (document.getElementById("bap-pptk") && r.pptk) {
      document.getElementById("bap-pptk").value = r.pptk;
    }

    if (r.program) {
      document.getElementById("bap-program").value = r.program;
      window.onBapProgramChange();
    }
    if (r.kegiatan) {
      const selKeg = document.getElementById("bap-kegiatan");
      if (![...selKeg.options].some(o => o.value === r.kegiatan)) {
        selKeg.add(new Option(r.kegiatan, r.kegiatan));
      }
      selKeg.value = r.kegiatan;
      window.onBapKegiatanChange();
    }
    if (r.subKegiatan) {
      const selSub = document.getElementById("bap-subkegiatan");
      if (![...selSub.options].some(o => o.value === r.subKegiatan)) {
        selSub.add(new Option(r.subKegiatan, r.subKegiatan));
      }
      selSub.value = r.subKegiatan;
    }

    document.getElementById("bap-perusahaan").value = r.pelaksana || "";
    const cvMatch = stateBap.penyediaCV.find(c => String(c.pelaksana).trim().toUpperCase() === String(r.pelaksana).trim().toUpperCase());
    if (cvMatch) {
      document.getElementById("bap-direktur").value = cvMatch.direktur || "";
      document.getElementById("bap-jabatan-penyedia").value = cvMatch.jabatan || "Direktur";
      document.getElementById("bap-npwp").value = cvMatch.npwp || "";
      document.getElementById("bap-alamat-penyedia").value = cvMatch.alamat || "";
      document.getElementById("bap-bank").value = cvMatch.bank || "Bank Jatim";
      document.getElementById("bap-rekening").value = cvMatch.noRek || "";
    }

    document.getElementById("bap-no-kontrak").value = r.noKontrak || "";
    document.getElementById("bap-tgl-kontrak").value = r.tglKontrak || "";
    document.getElementById("bap-nilai-awal").value = r.nilaiKontrak || 0;
    document.getElementById("bap-no-addendum").value = r.addNo || "";
    document.getElementById("bap-tgl-addendum").value = r.addTgl || "";
    document.getElementById("bap-nilai-addendum").value = r.addNilai || 0;
    document.getElementById("bap-uraian").value = r.uraian || "";

    if (r.skemaRetensi) {
      document.getElementById("bap-skema-retensi").value = r.skemaRetensi;
      window.onBapSkemaChange();
    }

    document.getElementById("bap-jam-penjamin").value = r.jamPenjamin || "";
    document.getElementById("bap-jam-no").value = r.jamNo || "";
    document.getElementById("bap-jam-tgl").value = r.jamTgl || "";
    document.getElementById("bap-jam-nilai").value = r.jamNilai || 0;
    document.getElementById("bap-jam-berlaku").value = r.jamBerlaku || "";
    document.getElementById("bap-bast-no").value = r.bastNo || "";
    document.getElementById("bap-bast-tgl").value = r.bastTgl || "";
    document.getElementById("bap-pernyataan").value = r.pernyataan || "";
    document.getElementById("bap-persen").value = r.persenBayar || 100;
    document.getElementById("bap-dak").value = r.dak || 0;

    window.renderBapPreview();
    document.getElementById("bap-print-area").scrollIntoView({ behavior: "smooth" });
  };

  window.resetFormBap = function () {
    document.getElementById("bap-nomor").value = "";
    document.getElementById("bap-tanggal").value = new Date().toISOString().slice(0, 10);
    document.getElementById("bap-no-kontrak").value = "";
    document.getElementById("bap-nilai-awal").value = "";
    document.getElementById("bap-no-addendum").value = "";
    document.getElementById("bap-tgl-addendum").value = "";
    document.getElementById("bap-nilai-addendum").value = "";
    document.getElementById("bap-jam-penjamin").value = "";
    document.getElementById("bap-jam-no").value = "";
    document.getElementById("bap-jam-tgl").value = "";
    document.getElementById("bap-jam-nilai").value = "";
    document.getElementById("bap-jam-berlaku").value = "";
    document.getElementById("bap-bast-no").value = "";
    document.getElementById("bap-bast-tgl").value = "";
    document.getElementById("bap-pernyataan").value = "";
    document.getElementById("bap-dak").value = 0;
    window.onBapTahapChange();
  };

  window.initBapModule = function () {
    const tglEl = document.getElementById("bap-tanggal");
    if (tglEl && !tglEl.value) tglEl.value = new Date().toISOString().slice(0, 10);
    window.onBapTahapChange();
    window.muatDataMasterBap(false);
  };

  // Alias kompatibilitas bila app.js memanggil nama fungsi lama saat tab BAP dibuka
  window.initBap = window.initBapModule;
  window.renderBapTable = renderTabelRiwayatBap;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", window.initBapModule);
  } else {
    window.initBapModule();
  }
})();
