// ========================================================
// FILE 1/3: Code.gs  (Konfigurasi, Routing API, Auth, Master, Pagu & Akun)
// Pasangan file dalam project Apps Script yang sama:
//   - SpjDanArsip.gs (Modul SPJ GU/LS, Email Ulang, Upload & Arsip Drive)
//   - Bap.gs         (Modul BAP LS, Template Spreadsheet & Ekspor PDF A4)
//   - Notifikasi.gs  (Template & Pengiriman Email Otomatis)
// ========================================================

var SPREADSHEET_ID = "1f6zCI0i1roKCb_amkTIiXweI5XXtLQZGsNST27W2eDw";
var SHEET_SPJ = "Data_SPJ";
var SHEET_CONTROL = "DB_CONTROL";
var SHEET_KONTRAK = "DB_KONTRAK_LS";
var SHEET_PENYEDIA = "DB_PENYEDIA";
var SHEET_LOG = "LOG_SISTEM";
var SHEET_AKUN = "DB_AKUN"; // Tab khusus user (otomatis fallback ke DB_CONTROL bila belum dimigrasi)
var KOLOM_AKUN_JUDUL = ["NAMA LENGKAP", "USERNAME", "PASSWORD", "ROLE", "NIP", "STATUS", "UNIT KERJA", "EMAIL", "NO WA"];
var PROP_SESI_BATAS_ = "SESI_CABUT_MAP"; // Penanda waktu pencabutan sesi paksa per username
// ---------- Pembagian 3 Spreadsheet Database (kosongkan "" bila masih digabung di SPREADSHEET_ID) ----------
var DB_MASTER_ID = "1tA9oVAGI-oZwdAlOH0Hk1VhKv6_v3iroTd8rlm93fZA";         // DB_CONTROL, AKUN_META, DB_PENYEDIA
var DB_LOG_ID    = "1ttYyjU1hrcieUo6mKariIavGYeDmjH0R69edst_QyFU"; // LOG_SISTEM, Upload GU, Upload LS, Upload Revisi

function idTransaksi_() { return SPREADSHEET_ID; }
function idMaster_() { return (DB_MASTER_ID && !/^ISI_/.test(DB_MASTER_ID)) ? DB_MASTER_ID : SPREADSHEET_ID; }
function idLog_() { return (DB_LOG_ID && !/^ISI_/.test(DB_LOG_ID)) ? DB_LOG_ID : SPREADSHEET_ID; }
function ssTransaksi_() { return SpreadsheetApp.openById(idTransaksi_()); }
function ssMaster_() { return SpreadsheetApp.openById(idMaster_()); }
function ssLog_() { return SpreadsheetApp.openById(idLog_()); }

// ---------- Dokumen BAP: tab template pada Google Spreadsheet -> PDF A4 ----------
var TEMPLATE_BAP_ID = "1WaIhC3soeiHqIIoDa5QkuNPB4WBdrCrZhi_pzVP05zY";
// size=7 = A4 (210 x 297 mm); scale=2&fitw=true = Fit to Width pada A4 portrait (2 halaman cetak).
var PDF_BAP_PARAM = "size=7&portrait=true&scale=2&fitw=true&gridlines=false&sheetnames=false&printtitle=false&pagenum=UNDEFINED" +
  "&fzr=false&fzc=false&top_margin=0.5&bottom_margin=0.5&left_margin=0.4&right_margin=0.4&horizontal_alignment=CENTER&vertical_alignment=TOP";
// Koreksi halus (pixel) bila batas Halaman 1 sedikit kurang/berlebih (+ = dorong Poin III lebih ke bawah, - = naikkan).
var KOREKSI_TINGGI_HAL1_BAP_ = 0;
var PERBAIKI_RUMUS_TEMPLATE = true;
var ROOT_FOLDER_ID = "1Qb4gPMTgPnTy-85AD0g_TXbgJVXusc1D"; // Folder arsip G-Drive

// ⚠️ Email verifikator penerima notifikasi pengajuan baru
var EMAIL_VERIFIKATOR = "perkimsubkeuangan2@gmail.com";

// ---------- Pengaturan keamanan ----------
var SESI_DETIK = 6 * 60 * 60;      // sesi login 6 jam (maksimum CacheService = 21600)
var MAKS_GAGAL_LOGIN = 5;          // salah password 5x -> dikunci sementara
var KUNCI_LOGIN_DETIK = 15 * 60;   // lama dikunci: 15 menit
var OTP_MASA_DETIK = 10 * 60;      // kode OTP lupa password berlaku 10 menit
var MAKS_KIRIM_OTP = 3;            // maks. 3x permintaan OTP per akun per 15 menit
var MAKS_GAGAL_OTP = 5;            // salah kode OTP 5x -> kode OTP hangus
var IZINKAN_RESET_EMAIL_ADMIN = false; // false = SUPER_ADMIN dikecualikan dari reset via email (ubah true bila ingin diizinkan)
var HASH_PUTARAN = 300;            // jumlah putaran hash password
var PPTK_LIHAT_SEMUA = false;      // false = PPTK hanya melihat SPJ & BAP miliknya
var LINK_PUBLIK = false;           // false = file mengikuti izin folder arsip (disarankan)
var EMAIL_PENGAKSES_ARSIP = [];    // opsional: email yang otomatis diberi akses LIHAT ke folder arsip

var MAKS_UPLOAD_BYTE = 10 * 1024 * 1024;   // unggah langsung maks. 10 MB; file lebih besar lewat Google Form
var MIME_UPLOAD = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};

// HANYA 4 role tetap (sesuai kolom Role di DB_CONTROL).
var ROLE_VALID = ["PPTK", "VERIFIKATOR", "PIMPINAN", "SUPER_ADMIN"];
var TAHUN_ANGGARAN = 2026;                 // tahun anggaran untuk perhitungan realisasi pagu
var SHEET_META = "AKUN_META";              // waktu perubahan password terakhir per akun
var PASSWORD_LEMAH_DIAUDIT = ["123"];      // password awal/default yang dicari saat "Audit Password"
var AKSI_SAAT_INI_ = "";
var TAHAP_VALID = ["UM", "UM JASA", "100", "100 JASA", "I (100)"];

// Susunan kolom DB_KONTRAK_LS (urutan = kolom A, B, C, ...)
var KOLOM_KONTRAK = [
  "kodeSpj", "pptk", "pelaksana", "kegiatan", "subKegiatan", "uraian",
  "noKontrak", "tglKontrak", "nilaiKontrak", "tahapBayar", "nilaiBayar", "noBap", "tglBap", "program",
  "spd1No", "spd1Tgl", "spd2No", "spd2Tgl", "spd3No", "spd3Tgl", "spd4No", "spd4Tgl",
  "addNo", "addTgl", "addNilai",
  "jamPenjamin", "jamNo", "jamNilai", "jamTgl", "jamBerlaku",
  "bastTgl", "bastNo", "capaian", "pernyataan",
  "potRetensi", "potPengUm",
  "skemaRetensi", "nilaiKontrakAktif", "persenBayar", "jumlahPotongan", "pembayaranBapIni",
  "dak", "dau", "jenisPph", "tarifPph", "dpp", "ppn", "nilaiPph", "totalPajak", "nilaiBersih",
  "linkSpreadsheet", "linkPdf",
  "jamBerlakuAkhir"
];
var JUDUL_KOLOM_KONTRAK = [
  "KODE_SPJ", "PPTK", "PELAKSANA", "KEGIATAN", "SUB KEGIATAN", "URAIAN",
  "NO KONTRAK", "TGL KONTRAK", "NILAI KONTRAK", "TAHAP", "NILAI BAYAR (JUMLAH BRUTO)", "NO BAP", "TGL BAP", "PROGRAM",
  "SPD 1 NO", "SPD 1 TGL", "SPD 2 NO", "SPD 2 TGL", "SPD 3 NO", "SPD 3 TGL", "SPD 4 NO", "SPD 4 TGL",
  "NO ADDENDUM", "TGL ADDENDUM", "NILAI ADDENDUM",
  "JAMINAN: PENJAMIN", "JAMINAN: NOMOR", "JAMINAN: NILAI", "JAMINAN: TANGGAL", "JAMINAN: BERLAKU",
  "TGL BAST/BA PEMERIKSAAN", "NO BAST/BA PEMERIKSAAN", "CAPAIAN FISIK (%)", "PERNYATAAN",
  "POTONGAN RETENSI", "POTONGAN PENGEMBALIAN UM",
  "SKEMA RETENSI", "NILAI KONTRAK AKTIF", "PERSENTASE BAYAR (%)", "JUMLAH POTONGAN", "PEMBAYARAN BAP INI",
  "DAK", "DAU", "JENIS PPH", "TARIF PPH", "DPP (NILAI FISIK)", "PPN 11%", "NILAI PPH", "TOTAL PAJAK", "NILAI BERSIH TRANSFER",
  "LINK SPREADSHEET (TIDAK DIPAKAI)", "LINK PDF (TIDAK DIPAKAI)", "JAMINAN: BERLAKU AKHIR"
];
var KONTRAK_TEKS = ["kodeSpj", "noKontrak", "noBap", "spd1No", "spd2No", "spd3No", "spd4No", "addNo", "jamNo", "bastNo"];
var KONTRAK_TGL = ["tglKontrak", "tglBap", "spd1Tgl", "spd2Tgl", "spd3Tgl", "spd4Tgl", "addTgl", "jamTgl", "jamBerlaku", "jamBerlakuAkhir", "bastTgl"];
var KONTRAK_ANGKA = ["nilaiKontrak", "nilaiBayar", "addNilai", "jamNilai", "capaian", "potRetensi", "potPengUm",
  "nilaiKontrakAktif", "persenBayar", "jumlahPotongan", "pembayaranBapIni", "dak", "dau", "tarifPph", "dpp", "ppn", "nilaiPph", "totalPajak", "nilaiBersih"];

// ---------- Aturan BAP per tahap (server = acuan; cermin di app.js -> BAP.KONFIG_TAHAP) ----------
var BAP_PPN = 0.11;       // PPN efektif (12% x 11/12); DPP = pembayaran / 1,11
var BAP_RETENSI = 0.05;   // potongan retensi 5%
var TAHAP_BAP = {
  "UM":       { kel: "FISIK", persenBebas: true,  persenDef: 30,  retensi: false, pengUmDari: "",        jaminan: "WAJIB",    bast: false, pph: "PPh Pasal 4(2)", tarif: 0.0175 },
  "UM JASA":  { kel: "JASA",  persenBebas: true,  persenDef: 30,  retensi: false, pengUmDari: "",        jaminan: "OPSIONAL", bast: true,  pph: "PPh Pasal 23",   tarif: 0.02 },
  "I (100)":  { kel: "FISIK", persenBebas: false, persenDef: 100, retensi: true,  pengUmDari: "UM",      jaminan: "SKEMA",    bast: true,  pph: "PPh Pasal 4(2)", tarif: 0.0175 },
  "100":      { kel: "FISIK", persenBebas: false, persenDef: 100, retensi: true,  pengUmDari: "",        jaminan: "SKEMA",    bast: true,  pph: "PPh Pasal 4(2)", tarif: 0.0175 },
  "100 JASA": { kel: "JASA",  persenBebas: false, persenDef: 100, retensi: false, pengUmDari: "UM JASA", jaminan: "",         bast: true,  pph: "PPh Pasal 23",   tarif: 0.02 }
};

// ========================================================
// PINTU MASUK
// ========================================================
function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// doGet sengaja TIDAK mengembalikan data apa pun (mencegah kebocoran akun & password)
function doGet(e) {
  return jsonOut({ status: "ok", pesan: "ERP SPJ API aktif. Data hanya dapat diakses setelah login." });
}

function doPost(e) {
  var data;
  try {
    data = JSON.parse((e && e.postData && e.postData.contents) ? e.postData.contents : "{}");
  } catch (err) {
    return jsonOut({ status: "error", message: "Permintaan tidak valid." });
  }
  var aksi = String(data.action || "");
  AKSI_SAAT_INI_ = aksi;

  try {
    if (aksi === "login") return jsonOut(prosesLogin_(data));
    if (aksi === "lupa_password_minta") return jsonOut(aksiMintaOtpReset_(data));
    if (aksi === "lupa_password_reset") return jsonOut(aksiVerifikasiOtpReset_(data));

    var sesi = ambilSesi_(data.token);
    if (!sesi) return jsonOut({ status: "auth", message: "Sesi berakhir atau tidak valid. Silakan login ulang." });

    if (aksi === "logout") { CacheService.getScriptCache().remove("sesi_" + String(data.token)); return jsonOut({ status: "success" }); }
    if (aksi === "load") return jsonOut(aksiLoad_(sesi));
    if (aksi === "upload_berkas") return jsonOut(aksiUploadBerkas_(sesi, data));
    if (aksi === "akun_uji_password") return jsonOut(aksiUjiPassword_(sesi, data));
    if (aksi === "akun_audit_password") return jsonOut(aksiAuditPassword_(sesi));
    if (aksi === "pdf_bap") return jsonOut(aksiPdfBap_(sesi, data));

    // Aksi yang menulis data: dikunci agar dua orang tidak saling menimpa
    var lock = LockService.getScriptLock();
    try { lock.waitLock(20000); }
    catch (err) { return jsonOut({ status: "error", message: "Server sedang sibuk, coba lagi sebentar." }); }
    try {
      var hasil;
      if (aksi === "create") hasil = aksiSimpanSpjBaru_(sesi, data);
      else if (aksi === "update_status") hasil = aksiUpdateStatus_(sesi, data);
      else if (aksi === "update_data_teks") hasil = aksiUpdateDataTeks_(sesi, data);
      else if (aksi === "sync_pagu") hasil = aksiSimpanPagu_(sesi, data);
      else if (aksi === "akun_simpan") hasil = aksiAkunSimpan_(sesi, data);
      else if (aksi === "akun_hapus") hasil = aksiAkunHapus_(sesi, data);
      else if (aksi === "akun_toggle_status") hasil = aksiToggleStatusAkun_(sesi, data);
      else if (aksi === "akun_cabut_sesi") hasil = aksiCabutSesiAdmin_(sesi, data);
      else if (aksi === "akun_update_profil") hasil = aksiUpdateProfilMandiri_(sesi, data);
      else if (aksi === "akun_ganti_password") hasil = aksiGantiPasswordMandiri_(sesi, data);
      else if (aksi === "resend_email") hasil = kirimUlangEmailPptk_(sesi, data);
      else if (aksi === "create_bap") hasil = aksiSimpanBap_(sesi, data);
      else if (aksi === "update_bap") hasil = aksiUpdateBap_(sesi, data);
      else if (aksi === "delete_pengajuan") hasil = aksiHapusPengajuan_(sesi, data);
      else if (aksi === "delete_bap") hasil = aksiHapusBap_(sesi, data);
      else hasil = { status: "error", message: "Aksi tidak dikenali." };
      return jsonOut(hasil);
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    catatLog_("ERROR", "-", aksi + ": " + error);
    return jsonOut({ status: "error", message: "Terjadi kesalahan di server: " + error });
  }
}

// ========================================================
// LOGIN, SESI, PASSWORD
// ========================================================
function toHex_(bytes) {
  var s = "";
  for (var i = 0; i < bytes.length; i++) { s += ("0" + (bytes[i] & 0xff).toString(16)).slice(-2); }
  return s;
}

function hashPassword_(plain, salt) {
  salt = salt || Utilities.getUuid().replace(/-/g, "").substring(0, 16);
  var h = String(plain);
  for (var i = 0; i < HASH_PUTARAN; i++) {
    h = toHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ":" + h));
  }
  return "h1$" + salt + "$" + h;
}

function samaAman_(a, b) { // perbandingan waktu-konstan
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  var r = 0;
  for (var i = 0; i < a.length; i++) { r |= a.charCodeAt(i) ^ b.charCodeAt(i); }
  return r === 0;
}

function cekPassword_(plain, tersimpan) {
  tersimpan = String(tersimpan);
  if (tersimpan.indexOf("h1$") === 0) {
    var p = tersimpan.split("$");
    if (p.length !== 3) return false;
    return samaAman_(hashPassword_(plain, p[1]), tersimpan);
  }
  return samaAman_(plain, tersimpan); // password lama (belum di-hash) -> akan di-upgrade saat login
}

function bacaPetaCabutSesi_() {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty(PROP_SESI_BATAS_);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function cabutSesiUser_(username) {
  username = String(username || "").trim().toLowerCase();
  if (!username) return 0;
  var now = Date.now();
  try {
    var props = PropertiesService.getScriptProperties();
    var peta = bacaPetaCabutSesi_();
    peta[username] = now;
    var batasLama = now - 7 * 24 * 60 * 60 * 1000;
    Object.keys(peta).forEach(function (k) { if (Number(peta[k]) < batasLama) delete peta[k]; });
    props.setProperty(PROP_SESI_BATAS_, JSON.stringify(peta));
  } catch (e) { catatLog_("SESI_WARN", "sistem", "gagal cabut sesi " + username + ": " + e); }
  return now;
}

function buatTokenSesi_(username, role, nama, minIat) {
  var token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
  var iat = Math.max(Date.now(), Number(minIat || 0));
  CacheService.getScriptCache().put("sesi_" + token, JSON.stringify({ u: username, r: role, n: nama, iat: iat }), SESI_DETIK);
  return token;
}

function prosesLogin_(data) {
  var uname = String(data.username || "").trim().toLowerCase();
  var pass = String(data.password || "");
  if (!uname || !pass) return { status: "error", message: "Username dan password wajib diisi." };
  if (uname.length > 60 || pass.length > 200) return { status: "error", message: "Username atau password salah." };

  var cache = CacheService.getScriptCache();
  var kunciGagal = "gagal_" + uname;
  var gagal = Number(cache.get(kunciGagal) || 0);
  if (gagal >= MAKS_GAGAL_LOGIN) {
    return { status: "error", message: "Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit." };
  }

  var ssMst = ssMaster_();
  var daftarAkun = bacaAkun_(ssMst);
  var akun = null;
  for (var i = 0; i < daftarAkun.length; i++) {
    if (daftarAkun[i].username.toLowerCase() === uname && daftarAkun[i].password !== "") { akun = daftarAkun[i]; break; }
  }

  var ok = !!akun && cekPassword_(pass, akun.password);
  if (!ok) {
    cache.put(kunciGagal, String(gagal + 1), KUNCI_LOGIN_DETIK);
    Utilities.sleep(600);
    catatLog_("LOGIN_GAGAL", uname, "percobaan ke-" + (gagal + 1));
    return { status: "error", message: "Username atau password salah." };
  }
  cache.remove(kunciGagal);

  if (akun.status === "NONAKTIF") {
    catatLog_("LOGIN_NONAKTIF", akun.namaLengkap + " (" + uname + ")", "akun nonaktif mencoba masuk");
    return { status: "error", message: "Akun Anda berstatus NONAKTIF. Hubungi SUPER_ADMIN." };
  }

  // Upgrade otomatis: password lama (teks biasa) diganti hash pada sheet sumbernya
  if (String(akun.password).indexOf("h1$") !== 0 && akun._sumber && akun._baris > 1) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      var shSumber = ssMst.getSheetByName(akun._sumber);
      if (shSumber) shSumber.getRange(akun._baris, 3).setNumberFormat("@").setValue(hashPassword_(pass));
    } catch (e) { /* tidak fatal */ } finally { try { lock.releaseLock(); } catch (e2) {} }
  }

  var role = akun.role;
  var nama = akun.namaLengkap;
  if (ROLE_VALID.indexOf(role) === -1) {
    catatLog_("LOGIN_DITOLAK", nama + " (" + uname + ")", "role tidak valid: " + role);
    return { status: "error", message: "Role akun tidak valid. Hubungi SUPER_ADMIN." };
  }
  var token = buatTokenSesi_(akun.username, role, nama);
  catatLog_("LOGIN", nama + " (" + akun.username + ", " + role + ")", "berhasil masuk");
  return {
    status: "success", token: token,
    user: {
      username: akun.username, role: role, namaLengkap: nama,
      nip: akun.nip || "", status: akun.status,
      unitKerja: akun.unitKerja || "", email: akun.email || "", wa: akun.wa || ""
    }
  };
}

function ambilSesi_(token) {
  token = String(token || "");
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  var cache = CacheService.getScriptCache();
  var raw = cache.get("sesi_" + token);
  if (!raw) return null;
  var s = JSON.parse(raw);
  if (ROLE_VALID.indexOf(s.r) === -1) return null;
  var peta = bacaPetaCabutSesi_();
  var batas = Number(peta[String(s.u || "").toLowerCase()] || 0);
  if (batas > 0 && Number(s.iat || 0) < batas) {
    cache.remove("sesi_" + token);
    return null;
  }
  cache.put("sesi_" + token, raw, SESI_DETIK); // perpanjang selama aktif
  return { username: s.u, r: s.r, n: s.n, token: token };
}

// ========================================================
// LUPA PASSWORD VIA KODE OTP EMAIL
// ========================================================
function escEmail_(s) {
  return String(s === null || s === undefined ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function buatOtp6Digit_() {
  var d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + ":" + Date.now() + ":" + Math.random());
  var num = (((d[0] & 0x7f) << 24) | ((d[1] & 0xff) << 16) | ((d[2] & 0xff) << 8) | (d[3] & 0xff)) % 1000000;
  return ("000000" + num).slice(-6);
}

function hashOtp_(uname, otp, salt) {
  return toHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ":" + String(uname).toLowerCase() + ":" + String(otp)));
}

function kirimEmailOtpReset_(email, nama, uname, otp) {
  var menit = Math.round(OTP_MASA_DETIK / 60);
  var htmlBody =
    '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:540px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background-color:#ffffff;">' +
    '<div style="background-color:#101d38;padding:22px 20px;text-align:center;">' +
    '<h2 style="color:#ffffff;margin:0;font-size:18px;letter-spacing:1px;">SISTEM ERP SPJ DISPERKIMTAN</h2>' +
    '<p style="color:#94a3b8;font-size:11px;margin:4px 0 0 0;letter-spacing:1.5px;">KABUPATEN BLITAR</p></div>' +
    '<div style="padding:26px 24px;background-color:#f8fafc;">' +
    '<p style="font-size:14px;color:#334155;margin-top:0;">Yth. <strong>' + escEmail_(nama) + '</strong>,</p>' +
    '<p style="font-size:13px;color:#475569;line-height:1.6;">Kami menerima permintaan reset kata sandi untuk akun <strong>' + escEmail_(uname) + '</strong>. Gunakan kode verifikasi (OTP) berikut:</p>' +
    '<div style="background-color:#ffffff;border:2px dashed #059669;border-radius:8px;padding:18px;text-align:center;margin:20px 0;">' +
    '<div style="font-size:11px;color:#64748b;font-weight:bold;letter-spacing:1px;margin-bottom:6px;">KODE OTP RESET PASSWORD</div>' +
    '<div style="font-size:32px;font-weight:900;letter-spacing:8px;color:#101d38;font-family:Consolas,monospace;">' + escEmail_(otp) + '</div>' +
    '<div style="font-size:11px;color:#dc2626;margin-top:8px;font-weight:600;">Berlaku selama ' + menit + ' menit &bull; Hanya untuk 1 kali pakai</div></div>' +
    '<p style="font-size:12px;color:#64748b;line-height:1.6;"><strong>Jangan bagikan kode ini kepada siapa pun.</strong> Jika Anda tidak merasa meminta reset kata sandi, abaikan email ini; akun Anda tetap aman.</p>' +
    '<p style="font-size:12px;color:#334155;margin-top:18px;margin-bottom:0;">Hormat kami,<br><strong>Sub Bagian Keuangan DISPERKIMTAN Kabupaten Blitar</strong></p></div></div>';
  MailApp.sendEmail({
    to: email,
    subject: "Kode OTP Reset Password - Sistem ERP SPJ (" + otp + ")",
    htmlBody: htmlBody
  });
}

function aksiMintaOtpReset_(data) {
  var uname = bersih_(data.username, 60).toLowerCase();
  if (!uname) return { status: "error", message: "Masukkan Username / NIP Anda terlebih dahulu." };

  var cache = CacheService.getScriptCache();
  if (cache.get("otpcd_" + uname)) {
    return { status: "error", message: "Mohon tunggu 1 menit sebelum meminta kode OTP kembali." };
  }
  if (!batasPercobaan_("otpreq_" + uname, MAKS_KIRIM_OTP)) {
    return { status: "error", message: "Terlalu banyak permintaan kode OTP. Coba lagi dalam 15 menit atau hubungi SUPER_ADMIN." };
  }

  var pesanNetral = "Jika username terdaftar, berstatus AKTIF, dan memiliki email di profil akun, kode OTP 6 digit telah dikirim. Periksa kotak masuk atau folder Spam (berlaku 10 menit).";
  var daftar = bacaAkun_(ssMaster_());
  var akun = null;
  for (var i = 0; i < daftar.length; i++) {
    if (daftar[i].username.toLowerCase() === uname && daftar[i].password !== "") { akun = daftar[i]; break; }
  }

  if (!akun) {
    Utilities.sleep(500);
    catatLog_("OTP_DIABAIKAN", uname, "username tidak ditemukan / belum punya password");
    return { status: "success", message: pesanNetral };
  }
  if (akun.status === "NONAKTIF") {
    Utilities.sleep(500);
    catatLog_("OTP_DIABAIKAN", akun.namaLengkap + " (" + uname + ")", "akun NONAKTIF");
    return { status: "success", message: pesanNetral };
  }
  if (akun.role === "SUPER_ADMIN" && !IZINKAN_RESET_EMAIL_ADMIN) {
    Utilities.sleep(500);
    catatLog_("OTP_DITOLAK_ADMIN", akun.namaLengkap + " (" + uname + ")", "reset via email dinonaktifkan untuk SUPER_ADMIN");
    return { status: "success", message: pesanNetral };
  }
  if (!akun.email || !emailValid_(akun.email)) {
    Utilities.sleep(500);
    catatLog_("OTP_DIABAIKAN", akun.namaLengkap + " (" + uname + ")", "email akun kosong / tidak valid");
    return { status: "success", message: pesanNetral };
  }

  // Sisakan sedikit buffer kuota email harian agar notifikasi SPJ tidak terganggu
  try {
    if (MailApp.getRemainingDailyQuota() < 5) {
      catatLog_("OTP_KUOTA_HABIS", akun.namaLengkap + " (" + uname + ")", "kuota MailApp harian hampir habis");
      return { status: "error", message: "Layanan email sedang mencapai batas harian. Hubungi SUPER_ADMIN untuk reset password manual." };
    }
  } catch (eQuota) { /* abaikan bila tidak tersedia */ }

  var otp = buatOtp6Digit_();
  var salt = Utilities.getUuid().replace(/-/g, "").substring(0, 12);
  cache.put("otp_" + uname, JSON.stringify({ h: hashOtp_(uname, otp, salt), s: salt, gagal: 0 }), OTP_MASA_DETIK);
  cache.put("otpcd_" + uname, "1", 60);

  try {
    kirimEmailOtpReset_(akun.email, akun.namaLengkap, akun.username, otp);
    catatLog_("OTP_TERKIRIM", akun.namaLengkap + " (" + uname + ")", "OTP reset password dikirim ke email terdaftar");
    return { status: "success", message: pesanNetral };
  } catch (err) {
    cache.remove("otp_" + uname);
    cache.remove("otpcd_" + uname);
    catatLog_("OTP_ERROR", akun.namaLengkap + " (" + uname + ")", "gagal kirim email OTP: " + err);
    return { status: "error", message: "Gagal mengirim email OTP. Coba lagi nanti atau hubungi SUPER_ADMIN." };
  }
}

function aksiVerifikasiOtpReset_(data) {
  var uname = bersih_(data.username, 60).toLowerCase();
  var otp = String(data.otp || "").replace(/\s+/g, "");
  var passBaru = String(data.passwordBaru || "");

  if (!uname) return { status: "error", message: "Username / NIP wajib diisi." };
  if (!/^\d{6}$/.test(otp)) return { status: "error", message: "Kode OTP harus berupa 6 digit angka." };
  if (passBaru.length < 8 || passBaru.length > 200) return { status: "error", message: "Password baru minimal 8 karakter." };
  if (passBaru.toLowerCase() === uname) return { status: "error", message: "Password baru tidak boleh sama dengan username." };
  if (PASSWORD_LEMAH_DIAUDIT.indexOf(passBaru) > -1) return { status: "error", message: "Password terlalu lemah. Gunakan kombinasi yang lebih kuat." };

  var cache = CacheService.getScriptCache();
  var kunciOtp = "otp_" + uname;
  var raw = cache.get(kunciOtp);
  if (!raw) return { status: "error", message: "Kode OTP tidak ditemukan atau sudah kedaluwarsa. Silakan minta kode baru." };

  var rec;
  try { rec = JSON.parse(raw); } catch (e) { cache.remove(kunciOtp); return { status: "error", message: "Kode OTP tidak valid. Silakan minta kode baru." }; }
  if (Number(rec.gagal || 0) >= MAKS_GAGAL_OTP) {
    cache.remove(kunciOtp);
    return { status: "error", message: "Terlalu banyak percobaan salah. Kode OTP dibatalkan, silakan minta kode baru." };
  }

  var cocok = samaAman_(hashOtp_(uname, otp, rec.s), rec.h);
  if (!cocok) {
    rec.gagal = Number(rec.gagal || 0) + 1;
    Utilities.sleep(500);
    if (rec.gagal >= MAKS_GAGAL_OTP) {
      cache.remove(kunciOtp);
      catatLog_("OTP_HANGUS", uname, "salah OTP " + rec.gagal + "x");
      return { status: "error", message: "Kode OTP salah dan dibatalkan karena terlalu banyak percobaan. Silakan minta kode baru." };
    }
    cache.put(kunciOtp, JSON.stringify(rec), OTP_MASA_DETIK);
    catatLog_("OTP_SALAH", uname, "percobaan ke-" + rec.gagal);
    return { status: "error", message: "Kode OTP salah. Sisa percobaan: " + (MAKS_GAGAL_OTP - rec.gagal) + "." };
  }

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); }
  catch (err) { return { status: "error", message: "Server sedang sibuk, coba lagi sebentar." }; }
  try {
    var ss = ssMaster_();
    var daftar = bacaAkun_(ss);
    var idx = -1;
    for (var i = 0; i < daftar.length; i++) {
      if (daftar[i].username.toLowerCase() === uname && daftar[i].password !== "") { idx = i; break; }
    }
    if (idx === -1) { cache.remove(kunciOtp); return { status: "error", message: "Akun tidak ditemukan." }; }
    var target = daftar[idx];
    if (target.status === "NONAKTIF") { cache.remove(kunciOtp); return { status: "error", message: "Akun berstatus NONAKTIF. Hubungi SUPER_ADMIN." }; }
    if (target.role === "SUPER_ADMIN" && !IZINKAN_RESET_EMAIL_ADMIN) { cache.remove(kunciOtp); return { status: "error", message: "Reset via email tidak diizinkan untuk akun ini." }; }

    target.password = hashPassword_(passBaru);
    tulisAkun_(ss, daftar);
    tandaiPasswordDiubah_(ss, target.username, target.namaLengkap + " (reset OTP email)");
    cabutSesiUser_(target.username);

    cache.remove(kunciOtp);
    cache.remove("otpcd_" + uname);
    cache.remove("gagal_" + uname); // buka kunci login bila sebelumnya terkunci salah password
    catatLog_("RESET_PASSWORD_OTP", target.namaLengkap + " (" + target.username + ", " + target.role + ")", "reset password via OTP email berhasil; sesi lama dicabut");
    return { status: "success", message: "Password berhasil diperbarui. Silakan masuk dengan password baru Anda." };
  } finally {
    lock.releaseLock();
  }
}

function butuhRole_(sesi, daftar) {
  return daftar.indexOf(sesi.r) > -1;
}
function tolak_(sesi) {
  if (sesi) catatLog_("AKSES_DITOLAK", pelaku_(sesi), "aksi: " + AKSI_SAAT_INI_);
  return { status: "error", message: "Anda tidak memiliki hak untuk aksi ini." };
}
function pelaku_(sesi) { return sesi.n + " (" + sesi.username + ", " + sesi.r + ")"; }

// ========================================================
// UTILITAS VALIDASI & PENULISAN
// ========================================================
function bersih_(v, maks) {
  var s = String(v === null || v === undefined ? "" : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
  return s.slice(0, maks || 255);
}
// Cegah "formula injection": teks diawali = + - @ akan dianggap rumus oleh Sheets
function aman_(v) {
  var s = String(v === null || v === undefined ? "" : v);
  if (s !== "-" && /^[=+\-@]/.test(s)) return "'" + s;
  return s;
}
function teks_(v, maks) { return aman_(bersih_(v, maks)); }
function angka_(v) { var n = Number(v); return isFinite(n) ? n : 0; }
function tglValid_(s) { s = String(s || ""); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ""; }
function emailValid_(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "")); }
function sekarang_() { return Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm"); }
function rpTeks_(n) { return "Rp " + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, "."); }

function formatTglSheet(v) {
  if (Object.prototype.toString.call(v) === "[object Date]") return Utilities.formatDate(v, "GMT+7", "yyyy-MM-dd");
  return (v === null || v === undefined) ? "" : String(v);
}

// Baris kosong PERTAMA berdasarkan satu kolom kunci (mulai baris 2).
function barisKosongPertama_(sheet, kolom) {
  var maks = sheet.getMaxRows();
  if (maks < 2) { sheet.insertRowsAfter(Math.max(maks, 1), 2 - maks + 1); maks = sheet.getMaxRows(); }
  var vals = sheet.getRange(2, kolom, maks - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === "") return i + 2;
  }
  sheet.insertRowAfter(maks);
  return maks + 1;
}

function barisSheetBerdasar_(sheet, kolom0, nilai) { // nomor baris (1-based) pada sheet, atau -1
  var vals = sheet.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) { if (String(vals[i][kolom0]).trim() === String(nilai).trim()) return i + 1; }
  return -1;
}

function pastikanKolom_(sheet, n) {
  var maks = sheet.getMaxColumns();
  if (maks < n) sheet.insertColumnsAfter(maks, n - maks);
}

function catatLog_(jenis, pelaku, detail) {
  try {
    var ss = ssLog_();
    var sh = ss.getSheetByName(SHEET_LOG);
    if (!sh) { sh = ss.insertSheet(SHEET_LOG); sh.getRange(1, 1, 1, 4).setValues([["WAKTU", "JENIS", "PELAKU", "DETAIL"]]); }
    var baris = sh.getLastRow() + 1;
    sh.getRange(baris, 1, 1, 4).setNumberFormat("@").setValues([[sekarang_(), jenis, String(pelaku), String(detail).slice(0, 1500)]]);
    if (baris > 3000) sh.deleteRows(2, 500);
  } catch (e) { console.log("Gagal catat log: " + e); }
}

// ========================================================
// MEMBACA DATA & REALISASI PAGU
// ========================================================
function normStatusAkun_(v) {
  return String(v || "").trim().toUpperCase() === "NONAKTIF" ? "NONAKTIF" : "AKTIF";
}

function sheetAkun_(ss) {
  var sh = ss.getSheetByName(SHEET_AKUN);
  if (!sh) {
    sh = ss.insertSheet(SHEET_AKUN);
    sh.getRange(1, 1, 1, KOLOM_AKUN_JUDUL.length).setValues([KOLOM_AKUN_JUDUL]).setFontWeight("bold");
  }
  return sh;
}

// Membaca akun dari tab DB_AKUN (bila sudah ada & terisi), otomatis fallback ke DB_CONTROL kolom A:E bila belum dimigrasi
function bacaAkun_(ss) {
  var hasil = [];
  var shAkun = ss.getSheetByName(SHEET_AKUN);
  if (shAkun && shAkun.getLastRow() > 1) {
    var valsA = shAkun.getDataRange().getValues();
    for (var i = 1; i < valsA.length; i++) {
      if (String(valsA[i][0] || "").trim() === "") continue;
      hasil.push({
        namaLengkap: String(valsA[i][0]).trim(),
        username: String(valsA[i][1] || "").trim(),
        password: String(valsA[i][2] || ""),
        role: String(valsA[i][3] || "").trim(),
        nip: String(valsA[i][4] || "").trim(),
        status: normStatusAkun_(valsA[i][5]),
        unitKerja: String(valsA[i][6] || "").trim(),
        email: String(valsA[i][7] || "").trim(),
        wa: String(valsA[i][8] || "").trim(),
        _baris: i + 1,
        _sumber: SHEET_AKUN
      });
    }
    if (hasil.length > 0) return hasil;
  }
  var shCtrl = ss.getSheetByName(SHEET_CONTROL);
  if (!shCtrl) return hasil;
  var valsC = shCtrl.getDataRange().getValues();
  for (var j = 1; j < valsC.length; j++) {
    if (String(valsC[j][0] || "").trim() === "") continue;
    hasil.push({
      namaLengkap: String(valsC[j][0]).trim(),
      username: String(valsC[j][1] || "").trim(),
      password: String(valsC[j][2] || ""),
      role: String(valsC[j][3] || "").trim(),
      nip: String(valsC[j][4] || "").trim(),
      status: "AKTIF",
      unitKerja: "",
      email: "",
      wa: "",
      _baris: j + 1,
      _sumber: SHEET_CONTROL
    });
  }
  return hasil;
}

function bacaControl_(ss) {
  var sheet = ss.getSheetByName(SHEET_CONTROL);
  var hasil = { akun: bacaAkun_(ss), pagu: { tahunan: 0, tw: [0, 0, 0, 0] }, referensi: {} };
  if (!sheet) return hasil;
  var vals = sheet.getDataRange().getValues();
  var adaTw = false, paguLama = 0;
  for (var i = 1; i < vals.length; i++) {
    var label = String(vals[i][6] || "").trim().toUpperCase();
    var nilai = Number(vals[i][7]) || 0;
    if (label === "TAHUNAN") hasil.pagu.tahunan = nilai;
    else if (label === "TW1" || label === "TW2" || label === "TW3" || label === "TW4") { hasil.pagu.tw[Number(label.charAt(2)) - 1] = nilai; adaTw = true; }
    else if (label === "TRIWULAN") paguLama = nilai;

    var prog = String(vals[i][9] || "").trim(), keg = String(vals[i][10] || "").trim(), sub = String(vals[i][11] || "").trim();
    if (prog !== "") {
      if (!hasil.referensi[prog]) hasil.referensi[prog] = {};
      if (keg !== "") {
        if (!hasil.referensi[prog][keg]) hasil.referensi[prog][keg] = [];
        if (sub !== "" && hasil.referensi[prog][keg].indexOf(sub) === -1) hasil.referensi[prog][keg].push(sub);
      }
    }
  }
  if (!adaTw && paguLama > 0) hasil.pagu.tw = [paguLama, paguLama, paguLama, paguLama];
  return hasil;
}

function bacaKontrak_(ss) {
  var sheet = ss.getSheetByName(SHEET_KONTRAK);
  var hasil = [];
  if (!sheet) return hasil;
  var vals = sheet.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === "") continue;
    var o = {};
    for (var k = 0; k < KOLOM_KONTRAK.length; k++) {
      var key = KOLOM_KONTRAK[k], v = vals[i][k];
      if (KONTRAK_TGL.indexOf(key) > -1) o[key] = formatTglSheet(v);
      else if (KONTRAK_ANGKA.indexOf(key) > -1) o[key] = (v === "" || v === null || v === undefined) ? 0 : Number(v) || 0;
      else o[key] = (v === null || v === undefined) ? "" : String(v);
    }
    lengkapiKontrak_(o);
    hasil.push(o);
  }
  return hasil;
}

function lengkapiKontrak_(o) {
  var awal = Number(o.nilaiKontrak) || 0, add = Number(o.addNilai) || 0, bruto = Number(o.nilaiBayar) || 0;
  if (!(o.nilaiKontrakAktif > 0)) o.nilaiKontrakAktif = add > 0 ? add : awal;
  o.jumlahPotongan = Math.round((Number(o.potRetensi) || 0) + (Number(o.potPengUm) || 0));
  if (!(o.pembayaranBapIni > 0)) o.pembayaranBapIni = Math.round(bruto - o.jumlahPotongan);
  if (!(o.persenBayar > 0) && o.nilaiKontrakAktif > 0) o.persenBayar = Math.round(bruto / o.nilaiKontrakAktif * 10000) / 100;
  var cfg = TAHAP_BAP[o.tahapBayar];
  if (cfg && !o.jenisPph) { o.jenisPph = cfg.pph; o.tarifPph = cfg.tarif; }
  if (o.jenisPph && !(o.dpp > 0)) {
    var tarif = o.tarifPph > 0 ? o.tarifPph : (cfg ? cfg.tarif : 0);
    o.dpp = Math.round(o.pembayaranBapIni / (1 + BAP_PPN));
    o.ppn = o.pembayaranBapIni - o.dpp;
    o.nilaiPph = Math.round(o.dpp * tarif);
    o.totalPajak = o.ppn + o.nilaiPph;
    o.nilaiBersih = o.pembayaranBapIni - o.totalPajak;
  }
  if (!(o.dak > 0) && !(o.dau > 0)) o.dau = o.pembayaranBapIni;
  return o;
}

function bacaPenyedia_(ss) {
  var sheet = ss.getSheetByName(SHEET_PENYEDIA);
  var hasil = [];
  if (!sheet) return hasil;
  var vals = sheet.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][3]).trim() === "") continue;
    hasil.push({
      direktur: String(vals[i][0] || ""), alamat: String(vals[i][1] || ""), npwp: String(vals[i][2] || ""),
      pelaksana: String(vals[i][3] || ""), bank: String(vals[i][4] || ""), noRek: String(vals[i][5] || ""),
      jabatan: String(vals[i][6] || ""), aktaNo: String(vals[i][7] || ""), aktaTgl: formatTglSheet(vals[i][8])
    });
  }
  return hasil;
}

function ambilSemuaDataSpj_(ss) {
  var sheetSpj = ss.getSheetByName(SHEET_SPJ);
  var dataSpj = sheetSpj.getDataRange().getValues();
  var hasil = [];
  for (var i = 1; i < dataSpj.length; i++) {
    if (String(dataSpj[i][0]).trim() === "") continue;
    hasil.push({
      id: dataSpj[i][0], createdAt: formatTglSheet(dataSpj[i][1]), npd: String(dataSpj[i][2]), jenisSurat: dataSpj[i][3],
      pptk: dataSpj[i][4], emailPptk: dataSpj[i][5], wa: String(dataSpj[i][6]), unitKerja: dataSpj[i][7],
      program: dataSpj[i][8], kegiatan: dataSpj[i][9], subKegiatan: dataSpj[i][10], uraian: dataSpj[i][11],
      nominal: dataSpj[i][12], linkKeuangan: dataSpj[i][13], linkSpj: dataSpj[i][14], linkRevisi: dataSpj[i][15],
      status: dataSpj[i][16], catatanRevisi: dataSpj[i][17], riwayatLog: dataSpj[i][18],
      noPb: String(dataSpj[i][19]), tglPb: formatTglSheet(dataSpj[i][20]), buktiPb: dataSpj[i][21],
      namaCv: dataSpj[i][22] || "", tahap: dataSpj[i][23] || "", kodeBap: String(dataSpj[i][24] || "")
    });
  }
  return hasil;
}

function aksiLoad_(sesi) {
  var ssTrx = ssTransaksi_();
  var ssMst = ssMaster_();
  var ctrl = bacaControl_(ssMst);

  // Pengaman ganda: pastikan akun aktif saat memuat data
  var me = ctrl.akun.filter(function (a) { return a.username.toLowerCase() === String(sesi.username || "").toLowerCase(); })[0];
  if (me && me.status === "NONAKTIF") {
    return { status: "auth", message: "Akun Anda dinonaktifkan. Silakan hubungi SUPER_ADMIN." };
  }

  var semuaSpj = ambilSemuaDataSpj_(ssTrx);
  var batasi = (sesi.r === "PPTK" && !PPTK_LIHAT_SEMUA);

  var spj = batasi ? semuaSpj.filter(function (x) { return String(x.pptk).trim() === sesi.n; }) : semuaSpj;
  var kontrak = bacaKontrak_(ssTrx);
  if (batasi) kontrak = kontrak.filter(function (x) { return String(x.pptk).trim() === sesi.n; });

  var real = hitungRealisasi_(semuaSpj);
  var pagu = (sesi.r === "PPTK") ? { tahunan: ctrl.pagu.tahunan, tw: null } : ctrl.pagu;
  var realisasi = bentukRealisasi_(sesi, real);

  var akun;
  if (sesi.r === "SUPER_ADMIN") {
    var meta = bacaMetaPassword_(ssMst);
    akun = ctrl.akun.map(function (a) {
      var fmt = a.password === "" ? "KOSONG" : (a.password.indexOf("h1$") === 0 ? "HASH" : "TEKS_BIASA");
      var m = meta[a.username.toLowerCase()] || {};
      return {
        namaLengkap: a.namaLengkap, username: a.username, role: a.role, nip: a.nip,
        status: a.status, unitKerja: a.unitKerja || "", email: a.email || "", wa: a.wa || "",
        roleValid: ROLE_VALID.indexOf(a.role) > -1,
        passwordFormat: fmt, passwordDiubah: m.tgl || "", passwordDiubahOleh: m.oleh || "",
        passwordDefault: fmt === "TEKS_BIASA" && PASSWORD_LEMAH_DIAUDIT.indexOf(a.password) > -1
      };
    });
  } else {
    akun = ctrl.akun.filter(function (a) { return a.role === "PPTK"; })
      .map(function (a) {
        return {
          namaLengkap: a.namaLengkap, username: "", role: "PPTK", nip: a.nip,
          status: a.status, unitKerja: a.unitKerja || "", email: a.email || "", wa: a.wa || ""
        };
      });
  }

  return {
    status: "success",
    user: {
      username: sesi.username, role: sesi.r, namaLengkap: sesi.n,
      nip: me ? (me.nip || "") : "",
      status: me ? me.status : "AKTIF",
      unitKerja: me ? (me.unitKerja || "") : "",
      email: me ? (me.email || "") : "",
      wa: me ? (me.wa || "") : ""
    },
    akun: akun, pagu: pagu, realisasi: realisasi, tahunAnggaran: TAHUN_ANGGARAN, referensi: ctrl.referensi,
    spj: spj, kontrakLS: kontrak, penyediaCV: bacaPenyedia_(ssMst)
  };
}

function bulanDariNpd_(npd) {
  var p = String(npd || "").split("/").map(function (x) { return x.trim(); }).filter(Boolean);
  if (p.length < 2) return null;
  var th = p[p.length - 1], bl = p[p.length - 2];
  if (/^\d{4}$/.test(th) && /^\d{1,2}$/.test(bl) && Number(bl) >= 1 && Number(bl) <= 12) return { bulan: Number(bl), tahun: Number(th) };
  return null;
}
function bulanDariTanggal_(s) {
  var m = String(s || "").split("T")[0].match(/^(\d{4})-(\d{2})-/);
  return (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) ? { tahun: Number(m[1]), bulan: Number(m[2]) } : null;
}
function tentukanPeriode_(x) {
  if (String(x.jenisSurat || "GU") === "GU") { var n = bulanDariNpd_(x.npd); if (n) return n; }
  return (x.status === "SUDAH DIPINDAHBUKUKAN" ? bulanDariTanggal_(x.tglPb) : null) || bulanDariTanggal_(x.createdAt);
}
function bentukRealisasi_(sesi, real) {
  var totalCair = real.cair.reduce(function (a, b) { return a + b; }, 0);
  if (sesi.r === "PPTK") return { ringkasan: true, totalCair: totalCair };
  return { ringkasan: false, cair: real.cair, proses: real.proses, totalCair: totalCair, tanpaPeriode: real.tanpaPeriode, luarTahun: real.luarTahun };
}
function hitungRealisasi_(semuaSpj) {
  var cair = [0, 0, 0, 0], proses = [0, 0, 0, 0], tanpaPeriode = 0, luarTahun = 0;
  semuaSpj.forEach(function (x) {
    if (x.status === "DITOLAK") return;
    var nom = Number(x.nominal) || 0, per = tentukanPeriode_(x);
    if (!per) { tanpaPeriode++; return; }
    if (per.tahun !== TAHUN_ANGGARAN) { luarTahun++; return; }
    var tw = Math.floor((per.bulan - 1) / 3);
    if (x.status === "SUDAH DIPINDAHBUKUKAN") cair[tw] += nom; else proses[tw] += nom;
  });
  return { cair: cair, proses: proses, tanpaPeriode: tanpaPeriode, luarTahun: luarTahun };
}
function ringkasanRealisasiTerbaru_(sesi, ss) {
  return bentukRealisasi_(sesi, hitungRealisasi_(ambilSemuaDataSpj_(ss)));
}

// ========================================================
// PAGU (TAHUNAN + TW1..TW4) -> DB_CONTROL kolom G:H baris 2-6
// ========================================================
function aksiSimpanPagu_(sesi, data) {
  if (sesi.r !== "SUPER_ADMIN") return tolak_(sesi);
  var nilai = [angka_(data.tahunan)];
  var tw = data.tw || [];
  for (var i = 0; i < 4; i++) nilai.push(angka_(tw[i]));
  for (var j = 0; j < nilai.length; j++) {
    if (nilai[j] < 0 || nilai[j] > 999999999999999) return { status: "error", message: "Nominal pagu tidak valid." };
  }
  var sheet = ssMaster_().getSheetByName(SHEET_CONTROL);
  if (sheet.getMaxRows() < 6) sheet.insertRowsAfter(sheet.getMaxRows(), 6 - sheet.getMaxRows());
  sheet.getRange(2, 7, 5, 2).setValues([
    ["TAHUNAN", nilai[0]], ["TW1", nilai[1]], ["TW2", nilai[2]], ["TW3", nilai[3]], ["TW4", nilai[4]]
  ]);
  catatLog_("PAGU", pelaku_(sesi), "Tahunan=" + nilai[0] + " TW=" + nilai.slice(1).join("/"));
  return { status: "success" };
}

// ---------- Waktu perubahan password (sheet AKUN_META) ----------
function bacaMetaPassword_(ss) {
  var sh = ss.getSheetByName(SHEET_META), hasil = {};
  if (!sh || sh.getLastRow() < 2) return hasil;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues();
  for (var i = 0; i < v.length; i++) {
    var u = String(v[i][0]).trim().toLowerCase();
    if (u) hasil[u] = { tgl: String(v[i][1]), oleh: String(v[i][2]) };
  }
  return hasil;
}
function sheetMeta_(ss) {
  var sh = ss.getSheetByName(SHEET_META);
  if (!sh) { sh = ss.insertSheet(SHEET_META); sh.getRange(1, 1, 1, 3).setValues([["USERNAME", "PASSWORD_DIUBAH", "DIUBAH_OLEH"]]); }
  return sh;
}
function barisMeta_(sh, username) {
  if (!username || sh.getLastRow() < 2) return 0;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < v.length; i++) { if (String(v[i][0]).trim().toLowerCase() === String(username).toLowerCase()) return i + 2; }
  return 0;
}
function tandaiPasswordDiubah_(ss, username, oleh, usernameLama) {
  var sh = sheetMeta_(ss);
  var r = barisMeta_(sh, username) || barisMeta_(sh, usernameLama) || barisKosongPertama_(sh, 1);
  sh.getRange(r, 1, 1, 3).setNumberFormat("@").setValues([[username, sekarang_(), oleh]]);
}
function pindahMeta_(ss, lama, baru) {
  var sh = ss.getSheetByName(SHEET_META); if (!sh) return;
  var r = barisMeta_(sh, lama); if (r) sh.getRange(r, 1).setNumberFormat("@").setValue(baru);
}
function hapusMeta_(ss, username) {
  var sh = ss.getSheetByName(SHEET_META); if (!sh) return;
  var r = barisMeta_(sh, username); if (r) sh.getRange(r, 1, 1, 3).clearContent();
}

// ========================================================
// AKUN & PROFIL USER (DB_AKUN pada ERP_MASTER). Password tidak pernah dikirim ke browser.
// ========================================================
function tulisAkun_(ss, daftar) {
  var sheet = sheetAkun_(ss);
  pastikanKolom_(sheet, KOLOM_AKUN_JUDUL.length);
  sheet.getRange(1, 1, 1, KOLOM_AKUN_JUDUL.length).setValues([KOLOM_AKUN_JUDUL]);
  var perlu = daftar.length + 1;
  if (sheet.getMaxRows() < perlu) sheet.insertRowsAfter(sheet.getMaxRows(), perlu - sheet.getMaxRows());
  var n = Math.max(sheet.getLastRow() - 1, daftar.length);
  if (n > 0) sheet.getRange(2, 1, n, KOLOM_AKUN_JUDUL.length).clearContent();
  if (daftar.length > 0) {
    var rng = sheet.getRange(2, 1, daftar.length, KOLOM_AKUN_JUDUL.length);
    rng.setNumberFormat("@");
    rng.setValues(daftar.map(function (a) {
      return [
        a.namaLengkap, a.username, a.password, a.role, a.nip || "",
        normStatusAkun_(a.status), a.unitKerja || "", a.email || "", a.wa || ""
      ];
    }));
  }
}

function gantiNamaPptk_(ss, lama, baru) {
  var s1 = ss.getSheetByName(SHEET_SPJ);
  if (s1 && s1.getLastRow() > 1) {
    var r1 = s1.getRange(2, 5, s1.getLastRow() - 1, 1), v1 = r1.getValues();
    for (var i = 0; i < v1.length; i++) if (String(v1[i][0]).trim() === lama) v1[i][0] = baru;
    r1.setValues(v1);
  }
  var s2 = ss.getSheetByName(SHEET_KONTRAK);
  if (s2 && s2.getLastRow() > 1) {
    var r2 = s2.getRange(2, 2, s2.getLastRow() - 1, 1), v2 = r2.getValues();
    for (var j = 0; j < v2.length; j++) if (String(v2[j][0]).trim() === lama) v2[j][0] = baru;
    r2.setValues(v2);
  }
}

function aksiAkunSimpan_(sesi, data) {
  if (sesi.r !== "SUPER_ADMIN") return tolak_(sesi);
  var ss = ssMaster_();
  var daftar = bacaAkun_(ss);

  var namaLama = bersih_(data.namaLama, 120);
  var nama = bersih_(data.namaLengkap, 120);
  var username = bersih_(data.username, 40).toLowerCase();
  var role = bersih_(data.role, 20);
  var nip = bersih_(data.nip, 40);
  var password = String(data.password || "");
  var status = normStatusAkun_(data.status || "AKTIF");
  var unitKerja = bersih_(data.unitKerja, 120);
  var email = bersih_(data.email, 120);
  var wa = bersih_(data.wa, 25).replace(/[^0-9+]/g, "");

  if (!nama) return { status: "error", message: "Nama lengkap wajib diisi." };
  if (ROLE_VALID.indexOf(role) === -1) return { status: "error", message: "Role tidak valid." };
  if (username && !/^[a-z0-9._-]{3,40}$/.test(username)) return { status: "error", message: "Username 3-40 karakter: huruf kecil, angka, titik, strip." };
  if (email && !emailValid_(email)) return { status: "error", message: "Format email tidak valid." };

  var idx = -1;
  for (var i = 0; i < daftar.length; i++) { if (daftar[i].namaLengkap.toLowerCase() === namaLama.toLowerCase() && namaLama) { idx = i; break; } }
  for (var a = 0; a < daftar.length; a++) {
    if (a !== idx && daftar[a].namaLengkap.toLowerCase() === nama.toLowerCase()) return { status: "error", message: "Nama sudah terdaftar." };
    if (username && a !== idx && daftar[a].username.toLowerCase() === username) return { status: "error", message: "Username sudah dipakai." };
  }

  var lamaObj = idx > -1 ? daftar[idx] : null;
  if (lamaObj && status === "NONAKTIF" && (lamaObj.username.toLowerCase() === String(sesi.username).toLowerCase() || lamaObj.namaLengkap.toLowerCase() === String(sesi.n).toLowerCase())) {
    return { status: "error", message: "Anda tidak dapat menonaktifkan akun yang sedang dipakai sendiri." };
  }

  var entri = {
    namaLengkap: nama, username: username, role: role, nip: nip, password: "",
    status: status,
    unitKerja: data.unitKerja !== undefined ? unitKerja : (lamaObj ? lamaObj.unitKerja : ""),
    email: data.email !== undefined ? email : (lamaObj ? lamaObj.email : ""),
    wa: data.wa !== undefined ? wa : (lamaObj ? lamaObj.wa : "")
  };
  if (username) {
    if (password) {
      if (password.length < 8) return { status: "error", message: "Password minimal 8 karakter." };
      entri.password = hashPassword_(password);
    } else if (lamaObj && lamaObj.password) {
      entri.password = lamaObj.password;
    } else {
      return { status: "error", message: "Password wajib diisi untuk akun baru." };
    }
  }

  var baru = daftar.slice();
  if (idx > -1) baru[idx] = entri; else baru.push(entri);

  var adaAdminAktif = baru.some(function (x) { return x.role === "SUPER_ADMIN" && normStatusAkun_(x.status) === "AKTIF" && x.username && x.password; });
  if (!adaAdminAktif) return { status: "error", message: "Minimal harus ada satu SUPER_ADMIN berstatus AKTIF yang dapat login." };

  tulisAkun_(ss, baru);
  if (idx > -1 && namaLama !== nama) gantiNamaPptk_(ssTransaksi_(), namaLama, nama);

  var userLama = lamaObj ? lamaObj.username : "";
  if (password) tandaiPasswordDiubah_(ss, username, pelaku_(sesi), userLama);
  else if (userLama && username && userLama.toLowerCase() !== username) pindahMeta_(ss, userLama, username);
  else if (userLama && !username) hapusMeta_(ss, userLama);

  // Cabut sesi lama bila password direset, status jadi NONAKTIF, atau identitas login (username/role/nama) berubah
  var perluCabut = !!lamaObj && (
    !!password ||
    status === "NONAKTIF" ||
    lamaObj.role !== role ||
    lamaObj.namaLengkap !== nama ||
    userLama.toLowerCase() !== username
  );
  if (perluCabut) {
    if (userLama) cabutSesiUser_(userLama);
    if (username && username !== userLama.toLowerCase()) cabutSesiUser_(username);
  }

  catatLog_("AKUN", pelaku_(sesi), (idx > -1 ? "ubah " : "tambah ") + nama + " (" + role + ", " + status + ")");
  if (password) catatLog_(idx > -1 ? "RESET_PASSWORD" : "PASSWORD_BARU", pelaku_(sesi), "akun " + username + " (isi password tidak dicatat)");
  return { status: "success" };
}

function aksiToggleStatusAkun_(sesi, data) {
  if (sesi.r !== "SUPER_ADMIN") return tolak_(sesi);
  var ss = ssMaster_();
  var daftar = bacaAkun_(ss);
  var nama = bersih_(data.namaLengkap, 120).toLowerCase();
  var idx = -1;
  for (var i = 0; i < daftar.length; i++) {
    if (daftar[i].namaLengkap.toLowerCase() === nama) { idx = i; break; }
  }
  if (idx === -1) return { status: "error", message: "Akun tidak ditemukan." };
  var target = daftar[idx];
  var statusBaru = target.status === "NONAKTIF" ? "AKTIF" : "NONAKTIF";
  if (statusBaru === "NONAKTIF" && (target.username.toLowerCase() === String(sesi.username).toLowerCase() || target.namaLengkap.toLowerCase() === String(sesi.n).toLowerCase())) {
    return { status: "error", message: "Anda tidak dapat menonaktifkan akun yang sedang dipakai sendiri." };
  }
  target.status = statusBaru;
  var adaAdminAktif = daftar.some(function (x) { return x.role === "SUPER_ADMIN" && normStatusAkun_(x.status) === "AKTIF" && x.username && x.password; });
  if (!adaAdminAktif) return { status: "error", message: "Minimal harus ada satu SUPER_ADMIN berstatus AKTIF." };
  tulisAkun_(ss, daftar);
  if (statusBaru === "NONAKTIF" && target.username) cabutSesiUser_(target.username);
  catatLog_("AKUN_STATUS", pelaku_(sesi), target.namaLengkap + " (" + (target.username || "-") + ") -> " + statusBaru);
  return { status: "success", statusBaru: statusBaru };
}

function aksiCabutSesiAdmin_(sesi, data) {
  if (sesi.r !== "SUPER_ADMIN") return tolak_(sesi);
  var uname = bersih_(data.username, 40).toLowerCase();
  if (!uname) return { status: "error", message: "Username wajib diisi." };
  if (uname === String(sesi.username).toLowerCase()) return { status: "error", message: "Gunakan tombol Keluar untuk mengakhiri sesi Anda sendiri." };
  cabutSesiUser_(uname);
  catatLog_("CABUT_SESI", pelaku_(sesi), "cabut sesi paksa akun " + uname);
  return { status: "success" };
}

function aksiAkunHapus_(sesi, data) {
  if (sesi.r !== "SUPER_ADMIN") return tolak_(sesi);
  var ss = ssMaster_();
  var daftar = bacaAkun_(ss);
  var nama = bersih_(data.namaLengkap, 120).toLowerCase();
  var dihapus = daftar.filter(function (a) { return a.namaLengkap.toLowerCase() === nama; })[0];
  var sisa = daftar.filter(function (a) { return a.namaLengkap.toLowerCase() !== nama; });
  if (sisa.length === daftar.length) return { status: "error", message: "Akun tidak ditemukan." };
  if (nama === String(sesi.n).toLowerCase()) return { status: "error", message: "Anda tidak dapat menghapus akun yang sedang dipakai." };
  var adaAdminAktif = sisa.some(function (x) { return x.role === "SUPER_ADMIN" && normStatusAkun_(x.status) === "AKTIF" && x.username && x.password; });
  if (!adaAdminAktif) return { status: "error", message: "Minimal harus ada satu SUPER_ADMIN berstatus AKTIF." };
  tulisAkun_(ss, sisa);
  if (dihapus && dihapus.username) {
    hapusMeta_(ss, dihapus.username);
    cabutSesiUser_(dihapus.username);
  }
  catatLog_("AKUN", pelaku_(sesi), "hapus " + nama);
  return { status: "success" };
}

// ---------- Fitur Akun Mandiri (untuk semua user yang sedang login) ----------
function aksiUpdateProfilMandiri_(sesi, data) {
  var ss = ssMaster_();
  var daftar = bacaAkun_(ss);
  var uname = String(sesi.username || "").toLowerCase();
  var idx = -1;
  for (var i = 0; i < daftar.length; i++) {
    if (daftar[i].username.toLowerCase() === uname) { idx = i; break; }
  }
  if (idx === -1) return { status: "error", message: "Data akun Anda tidak ditemukan." };

  var unitKerja = bersih_(data.unitKerja, 120);
  var email = bersih_(data.email, 120);
  var wa = bersih_(data.wa, 25).replace(/[^0-9+]/g, "");
  if (email && !emailValid_(email)) return { status: "error", message: "Format email tidak valid." };

  daftar[idx].unitKerja = unitKerja;
  daftar[idx].email = email;
  daftar[idx].wa = wa;
  tulisAkun_(ss, daftar);
  catatLog_("PROFIL_UBAH", pelaku_(sesi), "unit=" + (unitKerja || "-") + ", email=" + (email || "-") + ", wa=" + (wa || "-"));
  return {
    status: "success",
    user: {
      username: daftar[idx].username, role: daftar[idx].role, namaLengkap: daftar[idx].namaLengkap,
      nip: daftar[idx].nip || "", status: daftar[idx].status,
      unitKerja: unitKerja, email: email, wa: wa
    }
  };
}

function aksiGantiPasswordMandiri_(sesi, data) {
  if (!batasPercobaan_("gantipw_" + sesi.username, 5)) {
    return { status: "error", message: "Terlalu banyak percobaan ganti password. Coba lagi dalam 15 menit." };
  }
  var passLama = String(data.passwordLama || "");
  var passBaru = String(data.passwordBaru || "");
  if (!passLama || !passBaru) return { status: "error", message: "Password saat ini dan password baru wajib diisi." };
  if (passBaru.length < 8 || passBaru.length > 200) return { status: "error", message: "Password baru minimal 8 karakter." };

  var ss = ssMaster_();
  var daftar = bacaAkun_(ss);
  var uname = String(sesi.username || "").toLowerCase();
  var idx = -1;
  for (var i = 0; i < daftar.length; i++) {
    if (daftar[i].username.toLowerCase() === uname) { idx = i; break; }
  }
  if (idx === -1) return { status: "error", message: "Akun tidak ditemukan." };
  if (!cekPassword_(passLama, daftar[idx].password)) {
    Utilities.sleep(400);
    catatLog_("GANTI_PASSWORD_GAGAL", pelaku_(sesi), "password lama tidak cocok");
    return { status: "error", message: "Password saat ini salah." };
  }
  if (passBaru === passLama) return { status: "error", message: "Password baru tidak boleh sama dengan password lama." };
  if (passBaru.toLowerCase() === uname) return { status: "error", message: "Password baru tidak boleh sama dengan username." };
  if (PASSWORD_LEMAH_DIAUDIT.indexOf(passBaru) > -1) return { status: "error", message: "Password terlalu lemah. Gunakan kombinasi yang lebih kuat." };

  daftar[idx].password = hashPassword_(passBaru);
  tulisAkun_(ss, daftar);
  tandaiPasswordDiubah_(ss, daftar[idx].username, pelaku_(sesi) + " (mandiri)");

  // Cabut seluruh sesi lama di perangkat lain, lalu terbitkan token baru khusus perangkat ini
  var batas = cabutSesiUser_(daftar[idx].username);
  if (sesi.token) CacheService.getScriptCache().remove("sesi_" + sesi.token);
  var tokenBaru = buatTokenSesi_(daftar[idx].username, daftar[idx].role, daftar[idx].namaLengkap, batas + 10);

  catatLog_("GANTI_PASSWORD", pelaku_(sesi), "ubah password mandiri berhasil; sesi perangkat lain dicabut");
  return { status: "success", token: tokenBaru };
}

function batasPercobaan_(kunci, maks) {
  var cache = CacheService.getScriptCache(), n = Number(cache.get(kunci) || 0);
  if (n >= maks) return false;
  cache.put(kunci, String(n + 1), KUNCI_LOGIN_DETIK);
  return true;
}

function aksiUjiPassword_(sesi, data) {
  if (sesi.r !== "SUPER_ADMIN") return tolak_(sesi);
  if (!batasPercobaan_("ujipw_" + sesi.username, 10)) return { status: "error", message: "Terlalu banyak pengujian. Coba lagi dalam 15 menit." };
  var uname = bersih_(data.username, 40).toLowerCase(), pass = String(data.password || "");
  if (!uname || !pass) return { status: "error", message: "Username dan password uji wajib diisi." };
  var akun = bacaAkun_(ssMaster_())
    .filter(function (a) { return a.username.toLowerCase() === uname && a.password !== ""; })[0];
  if (!akun) return { status: "error", message: "Akun tidak ditemukan atau belum memiliki password." };
  var cocok = cekPassword_(pass, akun.password);
  catatLog_("UJI_PASSWORD", pelaku_(sesi), "akun " + uname + " -> " + (cocok ? "COCOK" : "TIDAK COCOK") + " (isi password uji tidak dicatat)");
  return { status: "success", cocok: cocok };
}

function aksiAuditPassword_(sesi) {
  if (sesi.r !== "SUPER_ADMIN") return tolak_(sesi);
  if (!batasPercobaan_("auditpw_" + sesi.username, 3)) return { status: "error", message: "Audit terlalu sering. Coba lagi dalam 15 menit." };
  var hasil = [];
  bacaAkun_(ssMaster_()).forEach(function (a) {
    if (!a.username || !a.password) return;
    var temuan = "";
    for (var i = 0; i < PASSWORD_LEMAH_DIAUDIT.length && !temuan; i++) { if (cekPassword_(PASSWORD_LEMAH_DIAUDIT[i], a.password)) temuan = "masih memakai password awal/default"; }
    if (!temuan && cekPassword_(a.username, a.password)) temuan = "password sama dengan username";
    hasil.push({ username: a.username, namaLengkap: a.namaLengkap, status: a.status, format: a.password.indexOf("h1$") === 0 ? "HASH" : "TEKS_BIASA", temuan: temuan });
  });
  var lemah = hasil.filter(function (h) { return h.temuan; }).length;
  catatLog_("AUDIT_PASSWORD", pelaku_(sesi), hasil.length + " akun diperiksa, " + lemah + " bermasalah");
  return { status: "success", hasil: hasil };
}

// ========================================================
// ALAT BANTU PENGELOLA (UMUM & MIGRASI)
// ========================================================
// Pindahkan daftar akun dari DB_CONTROL (kolom A:E) ke tab khusus DB_AKUN (kolom A:I) pada ERP_MASTER.
// Aman dijalankan berulang: tidak menimpa bila DB_AKUN sudah terisi.
function migrasiTabAkun() {
  var ssMst = ssMaster_();
  var shAda = ssMst.getSheetByName(SHEET_AKUN);
  if (shAda && shAda.getLastRow() > 1) {
    var msgAda = "DB_AKUN sudah ada dan berisi " + (shAda.getLastRow() - 1) + " akun. Tidak ada yang ditimpa.";
    Logger.log(msgAda);
    return msgAda;
  }
  var daftar = bacaAkun_(ssMst);
  if (daftar.length === 0) return "Tidak ditemukan data akun di DB_CONTROL.";
  tulisAkun_(ssMst, daftar);
  catatLog_("MIGRASI_AKUN", "pengelola", daftar.length + " akun disalin ke " + SHEET_AKUN);
  var msg = "Selesai: " + daftar.length + " akun berhasil disalin ke tab " + SHEET_AKUN + " di " + ssMst.getName() + " (status default: AKTIF).";
  Logger.log(msg);
  return msg;
}

function siapkanSheet() {
  var ssTrx = ssTransaksi_(), ssMst = ssMaster_(), ssLg = ssLog_();
  var sK = ssTrx.getSheetByName(SHEET_KONTRAK);
  if (sK) { pastikanKolom_(sK, JUDUL_KOLOM_KONTRAK.length); sK.getRange(1, 1, 1, JUDUL_KOLOM_KONTRAK.length).setValues([JUDUL_KOLOM_KONTRAK]); }
  var sP = ssMst.getSheetByName(SHEET_PENYEDIA);
  if (sP) { pastikanKolom_(sP, 9); sP.getRange(1, 1, 1, 9).setValues([["DIREKTUR", "ALAMAT", "NPWP", "PELAKSANA", "BANK", "NO REK", "JABATAN", "AKTA NO", "AKTA TGL"]]); }
  var sS = ssTrx.getSheetByName(SHEET_SPJ);
  if (sS) { pastikanKolom_(sS, 25); sS.getRange(1, 25).setValue("KODE_BAP"); }
  var sC = ssMst.getSheetByName(SHEET_CONTROL);
  if (sC) {
    if (sC.getMaxRows() < 6) sC.insertRowsAfter(sC.getMaxRows(), 6 - sC.getMaxRows());
    var g = sC.getRange(2, 7, 5, 2).getValues();
    var label = ["TAHUNAN", "TW1", "TW2", "TW3", "TW4"];
    var lamaTw = 0;
    for (var i = 0; i < 5; i++) { if (String(g[i][0]).trim().toUpperCase() === "TRIWULAN") lamaTw = Number(g[i][1]) || 0; }
    for (var j = 0; j < 5; j++) {
      var sama = String(g[j][0]).trim().toUpperCase() === label[j];
      var nilai = sama ? (Number(g[j][1]) || 0) : (j === 0 ? 0 : lamaTw);
      sC.getRange(2 + j, 7, 1, 2).setValues([[label[j], nilai]]);
    }
  }
  sheetAkun_(ssMst);
  sheetMeta_(ssMst);
  if (!ssLg.getSheetByName(SHEET_LOG)) {
    var shL = ssLg.insertSheet(SHEET_LOG);
    shL.getRange(1, 1, 1, 4).setValues([["WAKTU", "JENIS", "PELAKU", "DETAIL"]]);
  }
  catatLog_("SETUP", "pengelola", "siapkanSheet dijalankan");
  return "Selesai. Struktur kolom di Transaksi, Master (termasuk DB_AKUN), dan Log sudah disiapkan.";
}

function hashSemuaPassword() {
  var ssMst = ssMaster_();
  var daftar = bacaAkun_(ssMst), n = 0;
  daftar.forEach(function (a) {
    if (a.password !== "" && a.password.indexOf("h1$") !== 0) {
      a.password = hashPassword_(a.password);
      n++;
    }
  });
  if (n > 0) tulisAkun_(ssMst, daftar);
  return n + " password di-hash.";
}

// Jalankan SEKALI setelah mengisi DB_MASTER_ID & DB_LOG_ID: menyalin tab Master & Log tanpa menghapus file lama
function migrasiSalinTab() {
  if (idMaster_() === idTransaksi_() || idLog_() === idTransaksi_()) {
    return "Isi dulu DB_MASTER_ID dan DB_LOG_ID di bagian atas Code.gs dengan ID 2 Spreadsheet baru.";
  }
  var asal = ssTransaksi_();
  var salinGrup = function (targetSs, daftarTab, label) {
    var log = [];
    daftarTab.forEach(function (nama) {
      var src = asal.getSheetByName(nama);
      if (!src) { log.push("LEWATI " + label + "/" + nama + " (tidak ada di file asal)"); return; }
      if (targetSs.getSheetByName(nama)) { log.push("SUDAH ADA " + label + "/" + nama); return; }
      src.copyTo(targetSs).setName(nama);
      log.push("OK salin " + label + "/" + nama);
    });
    if (targetSs.getSheets().length > 1) {
      ["Sheet1", "Lembar1"].forEach(function (defNama) {
        var sDef = targetSs.getSheetByName(defNama);
        if (sDef && sDef.getLastRow() === 0) targetSs.deleteSheet(sDef);
      });
    }
    return log;
  };
  var hasil = []
    .concat(salinGrup(ssMaster_(), [SHEET_CONTROL, SHEET_META, SHEET_PENYEDIA], "ERP_MASTER"))
    .concat(salinGrup(ssLog_(), [SHEET_LOG], "ERP_LOG_ARSIP"));
  var ringkas = hasil.join("\n");
  Logger.log(ringkas);
  return ringkas;
}

function cekPengaturan() {
  var out = [];
  out.push("Akun script berjalan sebagai: " + Session.getEffectiveUser().getEmail());
  try {
    var root = DriveApp.getFolderById(ROOT_FOLDER_ID);
    out.push("OK  folder arsip: " + root.getName() + " (pemilik: " + (root.getOwner() ? root.getOwner().getEmail() : "?") + ")");
    var uji = folderTujuan_("_UJI", "Program", "Kegiatan", "Sub", true);
    out.push("OK  bisa membuat struktur _UJI/Program/Kegiatan/Sub/Revisi");
    var t = uji.createFile("uji.txt", "uji"); t.setTrashed(true);
    out.push("OK  bisa menulis file ke folder tujuan");
    root.getFoldersByName("_UJI").next().setTrashed(true);
  } catch (e) { out.push("GAGAL  akses Drive: " + e); }
  var trg = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === "pasangkanFileDariGForm"; });
  out.push(trg.length === 0 ? "INFO  trigger Form tidak terpasang (tidak perlu bila memakai upload langsung dari aplikasi)" : (trg.length === 1 ? "INFO  trigger Form terpasang (cadangan)" : "PERHATIAN  trigger Form berjumlah " + trg.length + " -> jalankan pasangTrigger() untuk merapikan"));

  var cekGrup = function (label, ss, daftarTab) {
    out.push("--- " + label + ": " + ss.getName() + " ---");
    daftarTab.forEach(function (n) {
      out.push((ss.getSheetByName(n) ? "OK  sheet " : "GAGAL  sheet tidak ada: ") + n);
    });
  };
  var ssMst = ssMaster_();
  cekGrup("TRANSAKSI", ssTransaksi_(), [SHEET_SPJ, SHEET_KONTRAK]);
  cekGrup("MASTER", ssMst, [SHEET_CONTROL, SHEET_PENYEDIA, SHEET_META]);
  var shAkun = ssMst.getSheetByName(SHEET_AKUN);
  out.push((shAkun && shAkun.getLastRow() > 1)
    ? "OK  sheet " + SHEET_AKUN + " (" + (shAkun.getLastRow() - 1) + " akun)"
    : "INFO  sheet " + SHEET_AKUN + " belum terisi (masih fallback DB_CONTROL -> jalankan migrasiTabAkun() sekali)");
  cekGrup("LOG & FORM", ssLog_(), [SHEET_LOG]);

  EMAIL_PENGAKSES_ARSIP.forEach(function (em) {
    try { DriveApp.getFolderById(ROOT_FOLDER_ID).addViewer(em); out.push("OK  akses lihat diberikan ke " + em); }
    catch (e) { out.push("GAGAL memberi akses ke " + em + ": " + e); }
  });
  Logger.log(out.join("\n"));
  return out.join("\n");
}
