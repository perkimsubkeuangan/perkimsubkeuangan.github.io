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
// DATA TETAP UNTUK CETAK BAP (sesuai template REKAP_LS_2026.xlsx)
// Ubah di sini bila PPK / nomor DPA berganti. Tidak perlu menyentuh bap.js.
// ==========================================
const BAP_CONFIG = {
    instansi: "PEMERINTAH KABUPATEN BLITAR",
    dinas: "DINAS PERUMAHAN RAKYAT, KAWASAN PERMUKIMAN, DAN PERTANAHAN",
    alamatDinas: "Jl. S. Supriyadi No. 86  Pos Box. 24  Telp. (0342) 801317  Kode Pos 66132",
    kotaDinas: "B  L  I  T  A  R",
    webDinas: "Website: www.dpkp.blitarkab.go.id, Email: dpkp@blitarkab.go.id",
    kotaTtd: "Blitar",
    tahunAnggaran: 2026,
    ppn: 0.11,   // PPN efektif (12% x 11/12), sama dengan rumus pada template Excel
    ppk: {
        nama: "ANTONIUS NANANG ADI PUTRANTO, ST., MT.",
        jabatan: "Pejabat Pembuat Komitmen (PPK)",
        alamat: "Jl. S. Supriyadi 86 Blitar",
        pangkat: "Pembina Tk. I",
        nip: "19780714 200212 1 006"
    },
    dpa: {
        nomor: "DPA/A.1/1.04.2.10.0.00.01.0000/001/2026",
        tanggal: "2026-01-02"
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
// PEMANGGIL API BERTOKEN (dipakai index.html & bap.html)
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
