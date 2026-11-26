// ========================================================
// FILE 2/3: SpjDanArsip.gs  (Modul SPJ GU/LS, Email Ulang, Upload & Arsip Drive)
// Pasangan file dalam project Apps Script yang sama:
//   - Code.gs       (Konfigurasi, Routing API, Auth, Master, Pagu & Akun)
//   - Bap.gs        (Modul BAP LS, Template Spreadsheet & Ekspor PDF A4)
//   - Notifikasi.gs (Template & Pengiriman Email Otomatis)
// ========================================================

// ========================================================
// SPJ GU / LS
// ========================================================
function idSpjUnik_(sheet) {
  var dasar = "SPJ-" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd-HHmmss");
  var ada = {};
  var maks = sheet.getMaxRows();
  if (maks > 1) {
    var v = sheet.getRange(2, 1, maks - 1, 1).getValues();
    for (var i = 0; i < v.length; i++) ada[String(v[i][0])] = true;
  }
  var id = dasar, n = 1;
  while (ada[id]) { n++; id = dasar + "-" + n; }
  return id;
}

function adaPptk_(ss, nama) {
  return bacaAkun_(ssMaster_()).some(function (a) { return a.role === "PPTK" && a.status !== "NONAKTIF" && a.namaLengkap === nama; });
}

function aksiSimpanSpjBaru_(sesi, data) {
  if (!butuhRole_(sesi, ["PPTK", "SUPER_ADMIN"])) return tolak_(sesi);   // VERIFIKATOR & PIMPINAN tidak boleh membuat pengajuan
  var ss = ssTransaksi_();
  var sheet = ss.getSheetByName(SHEET_SPJ);

  var jenis = String(data.jenisSurat || "").trim();
  if (jenis !== "GU" && jenis !== "LS") return { status: "error", message: "Jenis surat harus GU atau LS." };
  var tgl = tglValid_(data.createdAt);
  if (!tgl) return { status: "error", message: "Tanggal pengajuan tidak valid." };

  var pptk = (sesi.r === "PPTK") ? sesi.n : bersih_(data.pptk, 120);
  var email = bersih_(data.emailPptk, 120);
  if (email && !emailValid_(email)) return { status: "error", message: "Format email tidak valid." };
  var wa = bersih_(data.wa, 25).replace(/[^0-9+]/g, "");
  var unit = teks_(data.unitKerja, 120);

  var npd, program, kegiatan, subKegiatan, uraian, nominal, namaCv = "", tahap = "", kodeBapSimpan = "";

  if (jenis === "LS") {
    var kodeBap = bersih_(data.kodeBap, 60);
    var kontrak = bacaKontrak_(ss).filter(function (k) { return k.kodeSpj === kodeBap; })[0];
    if (!kontrak) return { status: "error", message: "Data BAP/kontrak tidak ditemukan. Isi dulu di Modul BAP LS." };
    if (sesi.r === "PPTK" && String(kontrak.pptk).trim() !== sesi.n) return tolak_(sesi);
    // Data LS diambil dari BAP di server (tidak mempercayai isian dari browser)
    // Nominal SPJ = PEMBAYARAN_BAP_INI (bruto dikurangi retensi & pengembalian UM), BUKAN bruto tahap:
    // memakai bruto pada tahap I (100) akan menghitung uang muka dua kali pada realisasi pagu.
    npd = kontrak.noKontrak; uraian = kontrak.uraian; nominal = kontrak.pembayaranBapIni; kodeBapSimpan = kontrak.kodeSpj;
    namaCv = kontrak.pelaksana; tahap = kontrak.tahapBayar;
    kegiatan = kontrak.kegiatan; subKegiatan = kontrak.subKegiatan;
    program = kontrak.program || bersih_(data.program, 255);
    pptk = kontrak.pptk;
    // Satu BAP (KODE_SPJ / tahap) hanya boleh diajukan SPJ-nya satu kali.
    // Baris baru menyimpan kodeBap (kolom Y). Baris lama (tanpa kodeBap) dicocokkan lewat No. Kontrak + Tahap.
    var semua = sheet.getDataRange().getValues();
    for (var i = 1; i < semua.length; i++) {
      if (String(semua[i][3]) !== "LS") continue;
      var kbTersimpan = String(semua[i][24] || "").trim();
      var kembar = kbTersimpan
        ? (kbTersimpan === kodeBapSimpan)
        : (String(semua[i][2]) === String(npd) && String(semua[i][23]) === String(tahap));
      if (kembar) return { status: "error", message: "Kontrak " + npd + " tahap " + tahap + " sudah pernah diajukan SPJ-nya." };
    }
  } else {
    npd = bersih_(data.npd, 120); program = bersih_(data.program, 255); kegiatan = bersih_(data.kegiatan, 255);
    subKegiatan = bersih_(data.subKegiatan, 255); uraian = bersih_(data.uraian, 1000); nominal = angka_(data.nominal);
    if (!npd || !program || !kegiatan || !subKegiatan || !uraian) return { status: "error", message: "Data pengajuan belum lengkap." };
    if (sesi.r !== "PPTK" && !adaPptk_(ss, pptk)) return { status: "error", message: "Pilih PPTK yang terdaftar." }; // SUPER_ADMIN input atas nama PPTK
  }
  if (!pptk) return { status: "error", message: "Nama PPTK wajib diisi." };
  if (!(nominal > 0) || nominal > 999999999999) return { status: "error", message: "Nominal tidak valid." };

  var id = idSpjUnik_(sheet);
  var log = "[" + sekarang_() + "] DIAJUKAN oleh " + sesi.n;
  var baris = barisKosongPertama_(sheet, 1);
  sheet.getRange(baris, 3).setNumberFormat("@");
  sheet.getRange(baris, 7).setNumberFormat("@");
  pastikanKolom_(sheet, 25);
  sheet.getRange(baris, 1, 1, 25).setValues([[
    id, tgl, npd, jenis, aman_(pptk), email, wa, unit,
    aman_(program), aman_(kegiatan), aman_(subKegiatan), aman_(uraian), nominal,
    "-", "-", "-", "BELUM_DIPROSES", "-", log, "", "", "", aman_(namaCv), aman_(tahap), kodeBapSimpan
  ]]);

  var info = { id: id, npd: npd, jenisSurat: jenis, pptk: pptk, kegiatan: kegiatan, uraian: uraian, nominal: nominal, nilai: nominal };
  kirimNotifikasiEmail(email, "PENGAJUAN_BERHASIL", info);
  kirimNotifikasiEmail(EMAIL_VERIFIKATOR, "NOTIF_VERIFIKATOR", info);
  catatLog_("SPJ_BARU", pelaku_(sesi), id + " (" + jenis + ") baris " + baris);
  return { status: "success", id: id };
}

function aksiUpdateStatus_(sesi, data) {
  var st = String(data.status || "");
  var sheet = ssTransaksi_().getSheetByName(SHEET_SPJ);
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) !== String(data.id)) continue;
    var cur = String(rows[i][16]);

    if (st === "DISETUJUI" || st === "REVISI" || st === "DITOLAK") {
      if (!butuhRole_(sesi, ["VERIFIKATOR", "SUPER_ADMIN"])) return tolak_(sesi);
      if (cur === "SUDAH DIPINDAHBUKUKAN") return { status: "error", message: "Pengajuan sudah dipindahbukukan, status tidak dapat diubah." };
    } else if (st === "SUDAH DIPINDAHBUKUKAN") {
      if (!butuhRole_(sesi, ["VERIFIKATOR", "SUPER_ADMIN"])) return tolak_(sesi);
      if (cur !== "DISETUJUI") return { status: "error", message: "Hanya pengajuan berstatus DISETUJUI yang dapat dipindahbukukan." };
    } else {
      return { status: "error", message: "Status tidak valid." };
    }

    var r = i + 1, now = sekarang_(), logBaru = "";
    var catatan = bersih_(data.catatanRevisi, 2000);
    sheet.getRange(r, 17).setValue(st);

    if (st === "REVISI" || st === "DITOLAK") {
      if (!catatan) return { status: "error", message: "Catatan wajib diisi." };
      var catatanHtml = catatan.replace(/\r?\n/g, "<br>"); // disimpan apa adanya; tampilan akan meng-escape
      sheet.getRange(r, 18).setNumberFormat("@").setValue(catatanHtml);
      logBaru = "[" + now + "] " + st + " oleh " + sesi.n + " - Catatan: " + catatanHtml;
    } else if (st === "SUDAH DIPINDAHBUKUKAN") {
      var noPb = bersih_(data.noPb, 60), tglPb = tglValid_(data.tglPb);
      if (!noPb || !tglPb) return { status: "error", message: "No PB dan tanggal PB wajib diisi dengan benar." };
      sheet.getRange(r, 20).setNumberFormat("@").setValue(noPb);
      sheet.getRange(r, 21).setValue(tglPb);
      sheet.getRange(r, 22).setValue(aman_(bersih_(data.buktiPb, 300)));
      logBaru = "[" + now + "] PINDAHBUKU SELESAI oleh " + sesi.n + " - No PB: " + noPb;
    } else {
      sheet.getRange(r, 18).setValue("-");
      logBaru = "[" + now + "] DISETUJUI oleh " + sesi.n;
    }
    var logLama = sheet.getRange(r, 19).getValue() || "";
    sheet.getRange(r, 19).setValue(logBaru + "\n" + logLama);

    kirimNotifikasiEmail(rows[i][5], "STATUS_UPDATE", {
      status: st, pptk: rows[i][4], npd: rows[i][2], kegiatan: rows[i][9], nilai: rows[i][12],
      catatan: catatan || "-", noPb: bersih_(data.noPb, 60), tglPb: tglValid_(data.tglPb)
    });
    catatLog_("STATUS", pelaku_(sesi), rows[i][0] + " -> " + st);
    return { status: "success" };
  }
  return { status: "error", message: "ID Pengajuan tidak ditemukan." };
}

function aksiUpdateDataTeks_(sesi, data) {
  var ss = ssTransaksi_();
  var sheet = ss.getSheetByName(SHEET_SPJ);
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) !== String(data.id)) continue;
    var r = i + 1, status = String(rows[i][16]), jenis = String(rows[i][3]);
    var admin = (sesi.r === "SUPER_ADMIN");   // koreksi/override; VERIFIKATOR & PIMPINAN tidak boleh mengubah isi pengajuan

    if (!admin) {
      if (sesi.r !== "PPTK" || String(rows[i][4]).trim() !== sesi.n) return tolak_(sesi);
      if (status !== "BELUM_DIPROSES" && status !== "REVISI") return { status: "error", message: "Data tidak dapat diubah pada status " + status + "." };
    }

    var tgl = tglValid_(data.createdAt);
    var email = bersih_(data.emailPptk, 120);
    if (email && !emailValid_(email)) return { status: "error", message: "Format email tidak valid." };
    if (tgl) sheet.getRange(r, 2).setValue(tgl);
    sheet.getRange(r, 6).setValue(email);
    sheet.getRange(r, 7).setNumberFormat("@").setValue(bersih_(data.wa, 25).replace(/[^0-9+]/g, ""));
    sheet.getRange(r, 8).setValue(teks_(data.unitKerja, 120));

    // Data LS berasal dari BAP -> tidak boleh diubah dari sini
    if (jenis === "GU") {
      var nominal = angka_(data.nominal);
      if (!(nominal > 0) || nominal > 999999999999) return { status: "error", message: "Nominal tidak valid." };
      sheet.getRange(r, 3).setNumberFormat("@").setValue(bersih_(data.npd, 120));
      if (admin) sheet.getRange(r, 5).setValue(teks_(data.pptk, 120));
      sheet.getRange(r, 9).setValue(teks_(data.program, 255));
      sheet.getRange(r, 10).setValue(teks_(data.kegiatan, 255));
      sheet.getRange(r, 11).setValue(teks_(data.subKegiatan, 255));
      sheet.getRange(r, 12).setValue(teks_(data.uraian, 1000));
      sheet.getRange(r, 13).setValue(nominal);
    }
    var logLama = sheet.getRange(r, 19).getValue() || "";
    sheet.getRange(r, 19).setValue("[" + sekarang_() + "] DATA TEKS DIEDIT oleh " + sesi.n + (admin && status !== "BELUM_DIPROSES" && status !== "REVISI" ? " (koreksi SUPER_ADMIN)" : "") + "\n" + logLama);
    catatLog_("EDIT_DATA", pelaku_(sesi), String(rows[i][0]) + " (" + jenis + ", status " + status + ")");
    return { status: "success" };
  }
  return { status: "error", message: "ID Pengajuan tidak ditemukan." };
}

// Hapus SPJ GU / SPJ LS (Data_SPJ, khusus SUPER_ADMIN). Berkas yang sudah diunggah ke Drive TIDAK ikut dihapus.
function aksiHapusPengajuan_(sesi, data) {
  if (sesi.r !== "SUPER_ADMIN") return tolak_(sesi);   // validasi ulang di server, apa pun yang dikirim browser
  var id = bersih_(data.id, 80);
  if (!id) return { status: "error", message: "ID pengajuan tidak ada." };
  var ss = ssTransaksi_();
  var sheet = ss.getSheetByName(SHEET_SPJ);
  if (!sheet) return { status: "error", message: "Sheet " + SHEET_SPJ + " tidak ditemukan." };
  var baris = barisSheetBerdasar_(sheet, 0, id);
  if (baris === -1) return { status: "error", message: "Pengajuan tidak ditemukan (mungkin sudah dihapus). Muat ulang halaman." };
  var r = sheet.getRange(baris, 1, 1, 25).getValues()[0];
  // kolom: A id | B tgl | C npd | D jenis | E pptk | I program | J kegiatan | K sub | L uraian | M nominal | Q status | W namaCv | X tahap | Y kodeBap
  var ringkas = "id " + id + " | " + r[3] + " | " + r[2] + " | PPTK " + r[4] + " | " + String(r[11]).slice(0, 80) + " | " + rpTeks_(r[12]) + " | status " + r[16] + (r[22] ? " | " + r[22] : "") + (r[23] ? " | tahap " + r[23] : "") + (r[24] ? " | kodeBap " + r[24] : "");
  sheet.deleteRow(baris);
  catatLog_("SPJ_HAPUS", pelaku_(sesi), ringkas);
  return { status: "success", id: id, ringkasan: ringkas, realisasi: ringkasanRealisasiTerbaru_(sesi, ss) };
}

// ========================================================
// EMAIL ULANG KE PPTK (semua nilai di-escape)
// ========================================================
function urlDriveAman_(u) {
  u = String(u || "");
  return /^https:\/\/(drive|docs)\.google\.com\//.test(u) ? u : "";
}

function kirimUlangEmailPptk_(sesi, data) {
  if (!butuhRole_(sesi, ["VERIFIKATOR", "SUPER_ADMIN"])) return tolak_(sesi);
  var sheet = ssTransaksi_().getSheetByName(SHEET_SPJ);
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) !== String(data.id)) continue;
    var tglRaw = rows[i][1], npd = rows[i][2], jenisSurat = String(rows[i][3]).trim(), pptk = rows[i][4], emailPptk = rows[i][5];
    var uraian = rows[i][11], nominal = rows[i][12], st = String(rows[i][16]), catatan = rows[i][17], buktiPb = rows[i][21];
    var tglStr = formatTglSheet(tglRaw);
    if (/^\d{4}-\d{2}-\d{2}$/.test(tglStr)) tglStr = tglStr.split("-").reverse().join("/");

    if (!emailPptk || String(emailPptk).indexOf("@") === -1) return { status: "error", message: "Email PPTK kosong atau tidak valid." };

    var warna = "#334155";
    if (st === "DISETUJUI") warna = "#059669"; else if (st === "REVISI") warna = "#f59e0b";
    else if (st === "DITOLAK") warna = "#dc2626"; else if (st === "SUDAH DIPINDAHBUKUKAN") warna = "#2563eb";

    var htmlCatatan = "";
    if ((st === "REVISI" || st === "DITOLAK") && catatan && String(catatan).trim() !== "" && catatan !== "-") {
      var teksCatatan = h_(String(catatan).replace(/<br\s*\/?>/gi, "\n")).replace(/\n/g, "<br>");
      htmlCatatan = '<div style="background-color:#fffbeb;border-left:4px solid #f59e0b;padding:15px;margin:20px 0;border-radius:0 4px 4px 0;">' +
        '<h4 style="margin:0 0 5px 0;color:#b45309;font-size:13px;">Catatan Verifikator:</h4>' +
        '<p style="margin:0;font-size:13px;color:#78350f;line-height:1.5;">' + teksCatatan + '</p></div>';
    }

    var li = function (t) { return '<li style="margin-bottom:5px;">' + t + '</li>'; };
    var tindak = "";
    if (st === "DITOLAK") {
      tindak = li("Pengajuan tidak dapat diproses lebih lanjut karena belum memenuhi ketentuan.") +
        li("Mohon periksa kembali kelengkapan dan kesesuaian dokumen pengajuan Anda.") +
        li("Untuk informasi lebih lanjut, silakan hubungi Verifikator / Sub Bagian Keuangan.");
    } else if (st === "REVISI") {
      tindak = li("Lakukan perbaikan segera sesuai dengan catatan verifikator di atas.") +
        li("Edit pengajuan teks atau unggah ulang dokumen baru melalui Sistem ERP SPJ.") +
        li("Pastikan seluruh dokumen telah dilengkapi sesuai dengan peraturan yang berlaku.");
    } else if (st === "DISETUJUI") {
      tindak = li("Segera serahkan berkas fisik asli (Hardcopy) ke Sub Bagian Keuangan.") +
        li("Penyerahan berkas fisik asli merupakan syarat mutlak untuk proses pencairan (Pemindahbukuan).") +
        li("Pastikan berkas yang dicetak sama persis dengan dokumen yang diunggah ke sistem.");
    } else if (st === "SUDAH DIPINDAHBUKUKAN") {
      var tombol = "";
      var urlPb = urlDriveAman_(buktiPb);
      if (urlPb) tombol = '<br><br><a href="' + h_(urlPb) + '" target="_blank" style="background-color:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:4px;font-weight:bold;font-size:12px;display:inline-block;">Lihat / Unduh Bukti PB</a>';
      tindak = li("Dana pencairan telah berhasil ditransfer ke rekening tujuan (Penyedia/Pihak Ketiga).") +
        li("Silakan lakukan pengecekan mutasi atau saldo pada rekening penerima terkait.") +
        li("Apabila terdapat kendala atau pertanyaan, hubungi Bendahara Pengeluaran." + tombol);
    } else {
      tindak = li("Menunggu antrean pengecekan dokumen oleh Verifikator Keuangan.");
    }

    var labelNpd = (jenisSurat === "LS") ? "No. Kontrak" : "Nomor NPD";
    var labelUraian = (jenisSurat === "LS") ? "Nama Pekerjaan" : "Uraian SPJ";
    var td1 = 'padding:12px 15px;color:#64748b;background-color:#f8fafc;border-bottom:1px solid #f1f5f9;';
    var td2 = 'padding:12px 15px;color:#0f172a;font-weight:bold;border-bottom:1px solid #f1f5f9;';

    var htmlBody =
      '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background-color:#ffffff;">' +
      '<div style="background-color:#101d38;padding:25px 20px;text-align:center;"><h2 style="color:#fff;margin:0;font-size:20px;letter-spacing:1px;">SISTEM ERP SPJ DPRKPP</h2>' +
      '<p style="color:#94a3b8;font-size:12px;margin:5px 0 0 0;letter-spacing:2px;">KABUPATEN BLITAR</p></div>' +
      '<div style="padding:30px 25px;background-color:#f8fafc;">' +
      '<p style="font-size:14px;color:#334155;margin-top:0;">Yth. <strong>' + h_(pptk) + '</strong>,</p>' +
      '<p style="font-size:14px;color:#475569;line-height:1.6;">Berikut adalah pemberitahuan pembaruan status untuk dokumen pengajuan SPJ Anda yang tersimpan di dalam sistem:</p>' +
      '<div style="background-color:#fff;border:1px solid #e2e8f0;border-radius:6px;margin:25px 0;overflow:hidden;"><table style="width:100%;border-collapse:collapse;font-size:13px;">' +
      '<tr><td style="' + td1 + 'width:35%;">Tanggal</td><td style="' + td2 + '">' + h_(tglStr) + '</td></tr>' +
      '<tr><td style="' + td1 + '">' + labelNpd + '</td><td style="' + td2 + '">' + h_(npd) + '</td></tr>' +
      '<tr><td style="' + td1 + '">Jenis Surat</td><td style="' + td2 + '">' + h_(jenisSurat) + '</td></tr>' +
      '<tr><td style="' + td1 + '">' + labelUraian + '</td><td style="' + td2 + 'font-weight:normal;color:#475569;">' + h_(uraian) + '</td></tr>' +
      '<tr><td style="' + td1 + '">Nominal Bruto</td><td style="' + td2 + '">Rp ' + formatAngkaId_(nominal) + '</td></tr>' +
      '<tr><td style="padding:15px;color:#64748b;background-color:#f1f5f9;font-weight:bold;">Status Saat Ini</td><td style="padding:15px;background-color:#f1f5f9;">' +
      '<span style="background-color:' + warna + ';color:#fff;padding:6px 12px;border-radius:4px;font-weight:bold;font-size:11px;">' + h_(st) + '</span></td></tr>' +
      '</table></div>' + htmlCatatan +
      '<div style="margin:25px 0 35px 0;"><h4 style="color:#334155;font-size:12px;margin-bottom:12px;border-bottom:2px solid #e2e8f0;padding-bottom:6px;">TINDAK LANJUT</h4>' +
      '<ul style="font-size:13px;color:#475569;line-height:1.6;padding-left:20px;margin:0;">' + tindak + '</ul></div>' +
      '<p style="font-size:14px;color:#334155;line-height:1.5;margin-top:10px;">Hormat kami,<br><br><strong>Sub Bagian Keuangan</strong><br>DISPERKIMTAN Kabupaten Blitar</p></div>' +
      '<div style="background-color:#f1f5f9;padding:20px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;">' +
      '<p style="margin:0;line-height:1.5;">Pesan ini dikirim oleh Sistem ERP Keuangan saat dokumen diverifikasi.<br>Mohon untuk <strong>tidak membalas</strong> alamat email ini.</p></div></div>';

    try {
      MailApp.sendEmail({ to: emailPptk, subject: "Sistem ERP: Status Dokumen SPJ Anda (" + st + ")", htmlBody: htmlBody });
      catatLog_("EMAIL_ULANG", pelaku_(sesi), String(rows[i][0]) + " -> " + emailPptk);
      return { status: "success" };
    } catch (e) {
      return { status: "error", message: "Gagal mengirim email: " + e };
    }
  }
  return { status: "error", message: "Data pengajuan tidak ditemukan." };
}

// ========================================================
// ARSIP BERKAS & UPLOAD (GOOGLE DRIVE + GOOGLE FORM)
// Struktur folder: ROOT / GU|LS / Program / Kegiatan / Sub Kegiatan / [Revisi]
// ========================================================
function bersihkanNama(text) { return String(text).replace(/[\\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "_"; }

function dapatkanAtauBuatFolder(parentFolder, namaFolder) {
  var it = parentFolder.getFoldersByName(namaFolder);
  return it.hasNext() ? it.next() : parentFolder.createFolder(namaFolder);
}

function folderTujuan_(jenisSurat, prog, keg, sub, isRevisi) {
  var f = DriveApp.getFolderById(ROOT_FOLDER_ID);
  f = dapatkanAtauBuatFolder(f, bersihkanNama(jenisSurat || "GU"));
  f = dapatkanAtauBuatFolder(f, bersihkanNama(prog || "Program_Tidak_Diketahui"));
  f = dapatkanAtauBuatFolder(f, bersihkanNama(keg || "Kegiatan_Tidak_Diketahui"));
  f = dapatkanAtauBuatFolder(f, bersihkanNama(sub || "Sub_Tidak_Diketahui"));
  if (isRevisi) f = dapatkanAtauBuatFolder(f, "Revisi");
  return f;
}

function aturAkses_(file) {
  try {
    if (LINK_PUBLIK) file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) { catatLog_("ARSIP_WARN", "sistem", "Gagal atur sharing: " + e); }
}

// Satu file: pindahkan; bila tidak boleh dipindah, salin ke folder tujuan lalu buang yang asli.
function arsipkanSatuFile_(fileId, folder) {
  var file = DriveApp.getFileById(fileId);
  var nama = file.getName();
  try {
    file.moveTo(folder);
  } catch (e1) {
    catatLog_("ARSIP_WARN", "sistem", "moveTo gagal untuk " + nama + " (" + e1 + "), mencoba salin.");
    var salinan = file.makeCopy(nama, folder);
    try { file.setTrashed(true); } catch (e2) { catatLog_("ARSIP_WARN", "sistem", "Salinan dibuat, file asli tidak bisa dihapus: " + e2); }
    file = salinan;
  }
  aturAkses_(file);
  return { url: file.getUrl(), nama: nama, ok: true };
}

function daftarIdFile_(teksUrl) {
  var ids = [];
  String(teksUrl || "").split(/\s*,\s*(?=https?:\/\/)/).forEach(function (u) {
    var m = String(u).match(/[-\w]{25,}/);
    if (m) ids.push({ id: m[0], url: String(u).trim() });
  });
  return ids;
}

// Mengembalikan array {url, nama, ok}; kegagalan DICATAT (tidak lagi disembunyikan).
function pindahkanBerkas_(teksUrl, jenisSurat, prog, keg, sub, isRevisi) {
  var hasil = [];
  var daftar = daftarIdFile_(teksUrl);
  if (daftar.length === 0 && String(teksUrl || "").trim() !== "") {
    catatLog_("ARSIP_ERROR", "sistem", "Tidak ada ID file pada isian: " + teksUrl);
    return [{ url: String(teksUrl), nama: "Dokumen_Lampiran (belum terarsip)", ok: false }];
  }
  var folder;
  try { folder = folderTujuan_(jenisSurat, prog, keg, sub, isRevisi); }
  catch (e) {
    catatLog_("ARSIP_ERROR", "sistem", "Tidak bisa membuat/membuka folder tujuan (cek ROOT_FOLDER_ID & izin akun script): " + e);
    return daftar.map(function (d) { return { url: d.url, nama: "Dokumen_Lampiran (belum terarsip)", ok: false }; });
  }
  daftar.forEach(function (d) {
    try { hasil.push(arsipkanSatuFile_(d.id, folder)); }
    catch (e) {
      catatLog_("ARSIP_ERROR", "sistem", "Gagal mengarsipkan file " + d.id + ": " + e + " (pemilik file harus akun yang sama dengan pemilik script)");
      hasil.push({ url: d.url, nama: "Dokumen_Lampiran (belum terarsip)", ok: false });
    }
  });
  return hasil;
}

function gabungLink_(arr) { return arr.map(function (x) { return x.url + "|" + x.nama; }).join("\n"); }

// ---------- UPLOAD LANGSUNG DARI APLIKASI (tanpa Google Form) ----------
function bersihNamaFile_(n) {
  n = String(n || "").replace(/[\\\/:*?"<>|\u0000-\u001F]/g, "_").replace(/\s+/g, " ").trim();
  if (n.length > 100) { var e = n.lastIndexOf("."); var ext = e > -1 ? n.slice(e) : ""; n = n.slice(0, 100 - ext.length) + ext; }
  return n;
}

// Periksa isi file benar-benar sesuai ekstensinya (bukan sekadar nama)
function cekMagic_(ext, b) {
  if (!b || b.length < 8) return false;
  var at = function (i) { return b[i] & 0xff; };
  if (ext === "pdf") return at(0) === 0x25 && at(1) === 0x50 && at(2) === 0x44 && at(3) === 0x46;
  if (ext === "png") return at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4E && at(3) === 0x47;
  if (ext === "jpg" || ext === "jpeg") return at(0) === 0xFF && at(1) === 0xD8 && at(2) === 0xFF;
  if (ext === "docx" || ext === "xlsx") return at(0) === 0x50 && at(1) === 0x4B;
  if (ext === "doc" || ext === "xls") return at(0) === 0xD0 && at(1) === 0xCF && at(2) === 0x11 && at(3) === 0xE0;
  return false;
}

function labelSlot_(jenis, slot) {
  if (slot === "revisi") return "Revisi";
  if (jenis === "LS") return slot === "keuangan" ? "Kwitansi" : "Berkas Pencairan LS";
  return slot === "keuangan" ? "Dok. Keuangan" : "SPJ Fungsional";
}

function cariBarisSpj_(sheet, id) {
  var maks = sheet.getLastRow();
  if (maks < 2) return 0;
  var v = sheet.getRange(2, 1, maks - 1, 1).getValues();
  for (var i = 0; i < v.length; i++) { if (String(v[i][0]) === String(id)) return i + 2; }
  return 0;
}

function tambahLink_(lama, baris) {
  lama = String(lama || "");
  return (lama === "" || lama === "-") ? baris : lama + "\n" + baris;
}

function namaDrive_(id, jenis, slot, nama) {
  return id + "_" + labelSlot_(jenis, slot).replace(/[^\w ]/g, "") + "_" + nama;
}

// Pemeriksaan hak & status sebelum berkas diterima. Mengembalikan {galat} atau data baris.
function validasiUnggah_(sesi, id, slot) {
  var sheet = ssTransaksi_().getSheetByName(SHEET_SPJ);
  var r0 = cariBarisSpj_(sheet, id);
  if (!r0) return { galat: { status: "error", message: "ID Pengajuan tidak ditemukan." } };
  var baris0 = sheet.getRange(r0, 1, 1, 24).getValues()[0];
  var pemilik = (sesi.r === "PPTK" && String(baris0[4]).trim() === sesi.n);
  var admin = (sesi.r === "SUPER_ADMIN");
  if (!pemilik && !admin) return { galat: tolak_(sesi) };
  var st0 = String(baris0[16]);
  // PPTK terkunci pada status selain BELUM_DIPROSES/REVISI. SUPER_ADMIN boleh (override) dan tercatat.
  if (!admin && st0 !== "BELUM_DIPROSES" && st0 !== "REVISI") return { galat: { status: "error", message: "Berkas tidak dapat diubah pada status " + st0 + "." } };
  if (slot !== "revisi") {
    var cur0 = String(baris0[slot === "keuangan" ? 13 : 14] || "");
    if (cur0 !== "" && cur0 !== "-" && cur0.split("\n").length >= 10) return { galat: { status: "error", message: "Jumlah berkas pada bagian ini sudah maksimal (10)." } };
  }
  return { sheet: sheet, baris0: baris0, jenis: String(baris0[3]) };
}

// Catat berkas yang sudah ada di Drive ke Data_SPJ + riwayat (kunci hanya selama menulis)
function catatBerkas_(sesi, id, slot, url, nama, baris0, jenis) {
  var sheet = ssTransaksi_().getSheetByName(SHEET_SPJ);
  var baris = url + "|" + nama;
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); }
  catch (e) { return { status: "error", message: "File sudah tersimpan di Drive, tetapi server sibuk saat mencatat. Coba unggah ulang." }; }
  try {
    var r = cariBarisSpj_(sheet, id);
    if (!r) return { status: "error", message: "ID Pengajuan tidak ditemukan." };
    var stSekarang = String(sheet.getRange(r, 17).getValue());
    var admin = (sesi.r === "SUPER_ADMIN"), terkunci = (stSekarang !== "BELUM_DIPROSES" && stSekarang !== "REVISI");
    if (terkunci && !admin) return { status: "error", message: "Status berubah menjadi " + stSekarang + ". Berkas tidak dicatat." };
    var tandaOverride = (admin && terkunci) ? " (override SUPER_ADMIN, status " + stSekarang + ")" : "";
    var now = sekarang_(), logLama = String(sheet.getRange(r, 19).getValue() || ""), logBaru;

    if (slot === "revisi") {
      var revLama = String(sheet.getRange(r, 16).getValue() || "");
      var nomor = (revLama.match(/\[\d{2}\//g) || []).length + 1;
      var barisRev = nomor + ". [" + now.split(" ")[0] + "] " + baris;
      sheet.getRange(r, 16).setValue((revLama === "-" || revLama === "") ? barisRev : barisRev + "\n" + revLama);
      if (stSekarang === "REVISI") { sheet.getRange(r, 17).setValue("BELUM_DIPROSES"); sheet.getRange(r, 18).setValue("-"); }
      logBaru = "[" + now + "] BERKAS REVISI DIUPLOAD oleh " + sesi.n + tandaOverride + "\nLinkRevisiLog: " + baris;
    } else {
      var kol = slot === "keuangan" ? 14 : 15;
      sheet.getRange(r, kol).setValue(tambahLink_(sheet.getRange(r, kol).getValue(), baris));
      logBaru = "[" + now + "] BERKAS DIUNGGAH oleh " + sesi.n + tandaOverride + " - " + labelSlot_(jenis, slot) + "\nLinkRevisiLog: " + baris;
    }
    sheet.getRange(r, 19).setValue(logBaru + "\n" + logLama);
    catatLog_("UPLOAD", pelaku_(sesi), id + " | " + slot + " | " + nama + " -> " + jenis + "/" + baris0[8] + "/" + baris0[9] + "/" + baris0[10]);
    return { status: "success", url: url, nama: nama };
  } finally {
    lock.releaseLock();
  }
}

function cekNamaSlotFile_(data) {
  var slot = String(data.slot || "");
  if (["keuangan", "spj", "revisi"].indexOf(slot) === -1) return { galat: { status: "error", message: "Jenis berkas tidak valid." } };
  var nama = bersihNamaFile_(data.nama);
  var ext = (nama.indexOf(".") > -1 ? nama.split(".").pop() : "").toLowerCase();
  if (!MIME_UPLOAD[ext]) return { galat: { status: "error", message: "Tipe file tidak diizinkan (PDF, JPG, PNG, DOC, DOCX, XLS, XLSX)." } };
  return { slot: slot, nama: nama, ext: ext };
}

// UNGGAH LANGSUNG (file <= 10 MB): isi file dikirim dalam permintaan ini
function aksiUploadBerkas_(sesi, data) {
  var c = cekNamaSlotFile_(data); if (c.galat) return c.galat;
  var b64 = String(data.data || "");
  if (!b64) return { status: "error", message: "File kosong." };
  if (b64.length > Math.ceil(MAKS_UPLOAD_BYTE * 4 / 3) + 16) return { status: "error", message: "Ukuran file melebihi 10 MB. Gunakan tombol Upload via Google Form." };
  var bytes;
  try { bytes = Utilities.base64Decode(b64); } catch (e) { return { status: "error", message: "Isi file tidak dapat dibaca." }; }
  if (bytes.length > MAKS_UPLOAD_BYTE) return { status: "error", message: "Ukuran file melebihi 10 MB. Gunakan tombol Upload via Google Form." };
  if (!cekMagic_(c.ext, bytes)) return { status: "error", message: "Isi file tidak sesuai dengan ekstensinya (." + c.ext + ")." };

  var id = String(data.id || "");
  var v = validasiUnggah_(sesi, id, c.slot); if (v.galat) return v.galat;

  var file;
  try {
    var folder = folderTujuan_(v.jenis, v.baris0[8], v.baris0[9], v.baris0[10], c.slot === "revisi");
    file = folder.createFile(Utilities.newBlob(bytes, MIME_UPLOAD[c.ext], namaDrive_(id, v.jenis, c.slot, c.nama)));
    aturAkses_(file);
  } catch (e) {
    catatLog_("UPLOAD_ERROR", pelaku_(sesi), id + ": gagal menyimpan ke Drive: " + e);
    return { status: "error", message: "Gagal menyimpan ke Google Drive: " + e + " (periksa ROOT_FOLDER_ID & izin akun script)." };
  }
  return catatBerkas_(sesi, id, c.slot, file.getUrl(), c.nama, v.baris0, v.jenis);
}

// ---------- UPLOAD LEWAT GOOGLE FORM (untuk file > 10 MB) ----------
// Inti pemrosesan satu respon Form. nv = {"Judul pertanyaan": ["nilai"]}.
function prosesUploadForm_(nv, lewatiBilaAda) {
  var cari = function (kata) {
    var k, i, kk;
    for (k in nv) { kk = String(k).trim().toLowerCase(); for (i = 0; i < kata.length; i++) { if (kk === kata[i]) return String((nv[k] && nv[k][0]) || ""); } }
    for (k in nv) { kk = String(k).trim().toLowerCase(); for (i = 0; i < kata.length; i++) { if (kk.indexOf(kata[i]) > -1) return String((nv[k] && nv[k][0]) || ""); } }
    return "";
  };
  var idPengajuan = cari(["id pengajuan"]).trim();
  if (!/^SPJ-\d{8}-\d{6}(-\d+)?$/.test(idPengajuan)) {
    catatLog_("UPLOAD_ERROR", "form", "ID PENGAJUAN kosong/tidak valid ('" + idPengajuan + "'). Judul pertanyaan yang diterima: " + Object.keys(nv).join(" | "));
    return "id-tidak-valid";
  }
  var fileKeuangan = cari(["dokumen keuangan", "kwitansi"]);
  var fileSpj = cari(["dokumen spj gu", "berkas pencairan", "spj fungsional", "dokumen spj"]);
  var fileRevisi = cari(["dokumen revisi", "revisi"]);
  if (!fileKeuangan && !fileSpj && !fileRevisi) {
    catatLog_("UPLOAD_ERROR", "form", idPengajuan + ": tidak ada kolom berkas yang cocok. Judul pertanyaan yang diterima: " + Object.keys(nv).join(" | "));
    return "tanpa-berkas";
  }

  var sheet = ssTransaksi_().getSheetByName(SHEET_SPJ);
  var r = cariBarisSpj_(sheet, idPengajuan);
  if (!r) { catatLog_("UPLOAD_ERROR", "form", "ID PENGAJUAN " + idPengajuan + " tidak ditemukan di " + SHEET_SPJ); return "id-tidak-ditemukan"; }
  var row = sheet.getRange(r, 1, 1, 24).getValues()[0];
  var status = String(row[16]);
  if (status === "DISETUJUI" || status === "SUDAH DIPINDAHBUKUKAN" || status === "DITOLAK") {
    catatLog_("UPLOAD_DITOLAK", "form", idPengajuan + ": upload diabaikan karena status " + status);
    return "status-" + status;
  }
  var jenis = row[3] || "GU", prog = row[8], keg = row[9], sub = row[10];

  if (lewatiBilaAda) {
    var sudah = String(row[13]) + String(row[14]) + String(row[15]);
    var baru = function (t) {
      if (!t) return "";
      var ids = daftarIdFile_(t);
      return (ids.length && ids.every(function (d) { return sudah.indexOf(d.id) > -1; })) ? "" : t;
    };
    fileKeuangan = baru(fileKeuangan); fileSpj = baru(fileSpj); fileRevisi = baru(fileRevisi);
  }
  if (!fileKeuangan && !fileSpj && !fileRevisi) return "sudah-diproses";

  var now = sekarang_(), logTambahan = "";
  var catat = function (label, arr) { logTambahan += "[" + now + "] BERKAS DIUNGGAH (via Form) - " + label + arr.map(function (x) { return "\nLinkRevisiLog: " + x.url + "|" + x.nama; }).join("") + "\n"; };

  if (fileKeuangan) {
    var a = pindahkanBerkas_(fileKeuangan, jenis, prog, keg, sub, false);
    sheet.getRange(r, 14).setValue(tambahLink_(sheet.getRange(r, 14).getValue(), gabungLink_(a)));
    catat(labelSlot_(String(jenis), "keuangan"), a);
  }
  if (fileSpj) {
    var b = pindahkanBerkas_(fileSpj, jenis, prog, keg, sub, false);
    sheet.getRange(r, 15).setValue(tambahLink_(sheet.getRange(r, 15).getValue(), gabungLink_(b)));
    catat(labelSlot_(String(jenis), "spj"), b);
  }
  if (fileRevisi) {
    var rev = pindahkanBerkas_(fileRevisi, jenis, prog, keg, sub, true);
    var revLama = String(sheet.getRange(r, 16).getValue() || "");
    var nomor = (revLama.match(/\[\d{2}\//g) || []).length;
    var barisRev = rev.map(function (x, idx) { return (nomor + idx + 1) + ". [" + now.split(" ")[0] + "] " + x.url + "|" + x.nama; }).reverse().join("\n");
    sheet.getRange(r, 16).setValue((revLama === "-" || revLama === "") ? barisRev : barisRev + "\n" + revLama);
    sheet.getRange(r, 17).setValue("BELUM_DIPROSES");
    sheet.getRange(r, 18).setValue("-");
    logTambahan += "[" + now + "] BERKAS REVISI DIUPLOAD" + rev.map(function (x) { return "\nLinkRevisiLog: " + x.url + "|" + x.nama; }).join("") + "\n";
  }
  sheet.getRange(r, 19).setValue(logTambahan + String(sheet.getRange(r, 19).getValue() || ""));
  catatLog_("UPLOAD", "form", idPengajuan + " diarsipkan ke " + jenis + "/" + prog + "/" + keg + "/" + sub);
  return "ok";
}

// Trigger "On form submit" (opsional; hanya bila Anda masih memakai Google Form)
function pasangkanFileDariGForm(e) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (err) { catatLog_("UPLOAD_ERROR", "sistem", "Tidak dapat memperoleh kunci: " + err); return; }
  try {
    catatLog_("FORM_MASUK", "form", "Trigger terpanggil. Kolom: " + Object.keys((e && e.namedValues) ? e.namedValues : {}).join(" | "));
    prosesUploadForm_((e && e.namedValues) ? e.namedValues : {}, false);
  }
  catch (error) { catatLog_("UPLOAD_ERROR", "form", String(error)); }
  finally { lock.releaseLock(); }
}

// Pulihkan unggahan lama yang hanya tercatat di sheet respon Form (Upload GU / Upload LS / Upload Revisi).
function prosesUploadFormLama() {
  var ss = ssLog_();
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  var hasil = {};
  try {
    ["Upload GU", "Upload LS", "Upload Revisi"].forEach(function (nama) {
      var sh = ss.getSheetByName(nama); if (!sh) return;
      var vals = sh.getDataRange().getValues(); if (vals.length < 2) return;
      var head = vals[0].map(function (h) { return String(h).trim(); });
      for (var i = 1; i < vals.length; i++) {
        var nv = {};
        for (var j = 0; j < head.length; j++) nv[head[j]] = [String(vals[i][j])];
        var h = prosesUploadForm_(nv, true);
        hasil[h] = (hasil[h] || 0) + 1;
      }
    });
  } finally { lock.releaseLock(); }
  var ringkas = JSON.stringify(hasil);
  catatLog_("PULIHKAN_FORM", "pengelola", ringkas);
  return "Selesai: " + ringkas + " (ok = berhasil dipulihkan). Rincian kegagalan ada di sheet " + SHEET_LOG + ".";
}

// ========================================================
// ALAT BANTU PENGELOLA (TRIGGER & ARSIP)
// ========================================================
function pasangTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "pasangkanFileDariGForm") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("pasangkanFileDariGForm").forSpreadsheet(idLog_()).onFormSubmit().create();
  return "Trigger terpasang.";
}

function rapikanArsipLama() {
  var sheet = ssTransaksi_().getSheetByName(SHEET_SPJ);
  var rows = sheet.getDataRange().getValues(), diproses = 0, gagal = 0;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === "") continue;
    var jenis = rows[i][3] || "GU", prog = rows[i][8], keg = rows[i][9], sub = rows[i][10];
    [[14, false], [15, false], [16, true]].forEach(function (kol) {
      var teks = String(rows[i][kol[0] - 1] || "");
      if (teks === "" || teks === "-") return;
      var barisBaru = teks.split("\n").map(function (line) {
        var m = line.match(/^(\d+\.\s*\[[^\]]+\]\s*)?(.*)$/);
        var prefix = (m && m[1]) ? m[1] : "", isi = (m && m[2]) ? m[2] : line;
        var url = isi.split("|")[0];
        if (!daftarIdFile_(url).length) return line;
        var hasil = pindahkanBerkas_(url, jenis, prog, keg, sub, kol[1])[0];
        diproses++; if (!hasil.ok) gagal++;
        return prefix + hasil.url + "|" + hasil.nama;
      }).join("\n");
      sheet.getRange(i + 1, kol[0]).setValue(barisBaru);
    });
  }
  return "Selesai. Berkas diproses: " + diproses + ", gagal: " + gagal + ". Lihat sheet " + SHEET_LOG + " untuk rincian.";
}