// ==========================================
// PENGATURAN APLIKASI (aman untuk repositori publik)
// Tidak ada lagi akun / password di file ini. Login diperiksa di server (Apps Script).
// ==========================================

const CONFIG = {
    // ⚠️ URL deploy Apps Script (berakhiran /exec). Ganti bila Anda membuat deployment baru.
    APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxxiFIvTMaW2MulpE1RFLAVFuyyfaQ_ot5aBJr9cd29WvEx-9RqgvTSem-NSGDByvV3/exec",

    // Tahun anggaran yang dihitung pada kartu pagu
    TAHUN_ANGGARAN: 2026,

    // Nilai pagu diisi dari server (menu "Atur Pagu"), bukan dari file ini
    PAGU_TAHUNAN: 0,
    PAGU_TW: [0, 0, 0, 0]
};

// ==========================================
// PARAMETER HITUNG BAP (hanya untuk pratinjau angka di modal form BAP)
// Dokumen BAP TIDAK dibangun dari HTML: server (Code.gs, aksi "pdf_bap") mengisi tab template pada Google Spreadsheet lalu
// mengekspornya ke PDF F4. Kop surat, logo, redaksi, tata letak, serta Data PPK / Nomor & Tanggal DPA / SPD (tab MASTER_BAP)
// hanya diubah di Spreadsheet template, TIDAK ada di file ini.
// Nilai di bawah HARUS sama dengan BAP_PPN, BAP_RETENSI, dan TAHAP_BAP di Code.gs (server yang menjadi acuan saat menyimpan).
// ==========================================
const BAP_CONFIG = {
    tahunAnggaran: 2026,
    ppn: 0.11,             // PPN efektif (12% x 11/12): DPP = pembayaran / 1,11
    retensiPersen: 0.05,   // potongan retensi 5% (tahap I (100) & 100) bila tidak memakai Jaminan Pemeliharaan
    pph: {
        fisik: { label: "PPh Pasal 4(2)", tarif: 0.0175 },   // UM, I (100), 100
        jasa:  { label: "PPh Pasal 23",   tarif: 0.02 }      // UM JASA, 100 JASA
    }
};

// ==========================================
// GOOGLE FORM UNTUK FILE > 10 MB
// ID Pengajuan terisi otomatis lewat parameter entry (satu entry yang sama pada ketiga Form).
// ==========================================
const FORM_UPLOAD = {
    GU: "https://docs.google.com/forms/d/e/1FAIpQLSfsYK2c5ucvUX7SOXkXLR3_WPIwJZ5h2sNMnHNWQlZF67G1ag/viewform",
    LS: "https://docs.google.com/forms/d/e/1FAIpQLSfeB478TimX9oyEsyf3ibuVyrCBnw_hNs0A_XJ2LHbAwuuNSw/viewform",
    REVISI: "https://docs.google.com/forms/d/e/1FAIpQLSfFAommHUUMIQXhq16CtjtIspZqiYc0_eCAoqvNFN3f3vpShg/viewform",
    ENTRY_ID: "entry.1525941067"
};
function urlFormUpload(jenis, idSpj) {
    const dasar = FORM_UPLOAD[jenis];
    if (!dasar) return '#';
    return dasar + '?usp=pp_url&' + FORM_UPLOAD.ENTRY_ID + '=' + encodeURIComponent(String(idSpj));
}

// ==========================================
// PEMANGGIL API BERTOKEN (dipakai index.html)
// ==========================================
function paksaLogout(pesan) {
    sessionStorage.clear();
    alert(pesan || "Sesi berakhir. Silakan login ulang.");
    window.location.href = "index.html";
}

function apiPost(payload) {
    payload.token = sessionStorage.getItem('sesi_token') || '';
    return fetch(CONFIG.APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) })
        .then(res => res.json())
        .then(res => {
            if (res && res.status === 'auth') { paksaLogout(res.message); throw new Error('Sesi berakhir'); }
            return res;
        });
}
