// ========================================================
// FILE: bap.js (Modul BAP LS) - versi diperbaiki
// ========================================================
let dataKontrakTersimpan = [];
let dataPenyediaTersimpan = [];
let referensiDataBap = {};
let searchQuery = "";
const roleAktif = sessionStorage.getItem('sesiAktif_role');
const namaPptkAktif = sessionStorage.getItem('sesiAktif_namaLengkap');
const sesiValid = !!(roleAktif && namaPptkAktif);

// Tanpa sesi login (mis. halaman dibuka langsung) -> kembali ke halaman login
if (!sesiValid) { window.location.replace('index.html'); }

document.addEventListener('DOMContentLoaded', () => {
    if (!sesiValid) return;
    const btn = document.getElementById('btnTambahBap');
    if (btn) btn.classList.remove('hidden');
    const cari = document.getElementById('cariKontrak');
    if (cari) cari.addEventListener('input', renderTabelKontrak);
    ambilDataBAP();
});

// ---------- Helper ----------
function escapeHtml(s) {
    return String(s === null || s === undefined ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function formatRupiah(angka) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(angka) || 0); }

// yyyy-MM-dd (atau ISO) -> dd/MM/yyyy
function formatTanggal(dateStr) {
    if (!dateStr || dateStr === '-') return '-';
    const raw = String(dateStr).split('T')[0];
    const p = raw.split('-');
    if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
    return raw;
}
// yyyy-MM-dd -> 13 November 2026
function formatTanggalPanjang(dateStr) {
    if (!dateStr || dateStr === '-') return '.....................';
    const raw = String(dateStr).split('T')[0];
    const p = raw.split('-');
    if (p.length !== 3) return raw;
    const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    return `${parseInt(p[2], 10)} ${bulan[parseInt(p[1], 10) - 1] || p[1]} ${p[0]}`;
}
// 2026 -> "Dua Ribu Dua Puluh Enam" (berlaku 2000-2099)
function terbilangTahun(y) {
    const s = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan'];
    const r = y - 2000;
    let t = 'Dua Ribu';
    if (r <= 0) return t;
    if (r < 10) return `${t} ${s[r]}`;
    if (r === 10) return `${t} Sepuluh`;
    if (r === 11) return `${t} Sebelas`;
    if (r < 20) return `${t} ${s[r - 10]} Belas`;
    return `${t} ${s[Math.floor(r / 10)]} Puluh${r % 10 ? ' ' + s[r % 10] : ''}`;
}

// ---------- Ambil & tampilkan data ----------
function ambilDataBAP() {
    const tbody = document.getElementById('tabelKontrakBody');
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400 font-medium"><i class="fa-solid fa-spinner fa-spin me-2 text-blue-500"></i> Memuat data dari server...</td></tr>`;

    return fetch(CONFIG.APPS_SCRIPT_URL)
        .then(res => res.json())
        .then(data => {
            if (data.status === 'error') {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-red-500 font-medium">Server error: ${escapeHtml(data.message)}</td></tr>`;
                return;
            }
            dataKontrakTersimpan = data.kontrakLS || [];
            dataPenyediaTersimpan = data.penyediaCV || [];
            referensiDataBap = data.referensi || {};
            renderTabelKontrak();
        })
        .catch(e => {
            console.error(e);
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-red-500 font-medium">Gagal terhubung ke server. Refresh halaman (F5).</td></tr>`;
        });
}

function cariProfilCv(namaCv) {
    const key = String(namaCv || '').trim().toUpperCase();
    return dataPenyediaTersimpan.find(cv => String(cv.pelaksana).trim().toUpperCase() === key);
}

function renderTabelKontrak() {
    const tbody = document.getElementById('tabelKontrakBody');
    const cari = document.getElementById('cariKontrak');
    searchQuery = cari ? cari.value.toLowerCase() : '';

    const filteredData = dataKontrakTersimpan.filter(item => {
        if (roleAktif === 'PPTK' && String(item.pptk).trim() !== String(namaPptkAktif).trim()) return false;
        return `${item.pelaksana} ${item.noKontrak} ${item.uraian}`.toLowerCase().includes(searchQuery);
    });

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400 font-medium">Data Kontrak belum tersedia.</td></tr>`;
        return;
    }

    let html = '';
    filteredData.forEach(kontrak => {
        const profilCV = cariProfilCv(kontrak.pelaksana);
        const badgeCV = profilCV
            ? `<span class="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold ms-2">CV Terdaftar</span>`
            : `<span class="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold ms-2">Bank Kosong</span>`;

        html += `
            <tr class="hover:bg-blue-50/30 border-b border-slate-100">
                <td class="py-3 px-4 font-bold text-slate-700">${escapeHtml(kontrak.noKontrak || '-')}<br><span class="text-[10px] text-slate-400 font-normal">Tgl: ${formatTanggal(kontrak.tglKontrak)}</span></td>
                <td class="py-3 px-4 font-bold text-purple-700">${escapeHtml(kontrak.pelaksana || '-')}${badgeCV}<br><span class="text-[10px] text-slate-500 font-normal block w-64 truncate" title="${escapeHtml(kontrak.uraian)}">${escapeHtml(kontrak.uraian || '-')}</span></td>
                <td class="py-3 px-4 font-bold text-slate-800">${formatRupiah(kontrak.nilaiBayar)}</td>
                <td class="py-3 px-4 font-bold text-blue-600 text-xs">${escapeHtml(kontrak.tahapBayar || '-')}</td>
                <td class="py-3 px-4 text-center"><button onclick="cetakBapBerdasarkanJenis('${escapeHtml(kontrak.kodeSpj)}')" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[10px] shadow-sm"><i class="fa-solid fa-print"></i> CETAK BAP</button></td>
            </tr>`;
    });
    tbody.innerHTML = html;
}

// ---------- Form input BAP ----------
const OPT_KEG = '<option value="" disabled selected>-- Pilih Kegiatan --</option>';
const OPT_SUB = '<option value="" disabled selected>-- Pilih Subkegiatan --</option>';

function bukaFormBap() {
    document.getElementById('formBap').reset();
    isiDropdownProgramBap();
    document.getElementById('bapKegiatan').innerHTML = OPT_KEG;
    document.getElementById('bapSubKegiatan').innerHTML = OPT_SUB;
    generateNomorBap();
    document.getElementById('modalInputBap').classList.remove('hidden');
}

function isiDropdownProgramBap() {
    const sel = document.getElementById('bapProgram');
    if (!sel) return;
    let html = '<option value="" disabled selected>-- Pilih Program --</option>';
    for (const prog in referensiDataBap) html += `<option value="${escapeHtml(prog)}">${escapeHtml(prog)}</option>`;
    sel.innerHTML = html;
}

function updateKegiatanBap() {
    const prog = document.getElementById('bapProgram').value;
    const kegSelect = document.getElementById('bapKegiatan');
    document.getElementById('bapSubKegiatan').innerHTML = OPT_SUB;
    let html = OPT_KEG;
    if (prog && referensiDataBap[prog]) {
        for (const keg in referensiDataBap[prog]) html += `<option value="${escapeHtml(keg)}">${escapeHtml(keg)}</option>`;
    }
    kegSelect.innerHTML = html;
}

function updateSubkegiatanBap() {
    const prog = document.getElementById('bapProgram').value;
    const keg = document.getElementById('bapKegiatan').value;
    const subSelect = document.getElementById('bapSubKegiatan');
    let html = OPT_SUB;
    if (prog && keg && referensiDataBap[prog] && referensiDataBap[prog][keg]) {
        referensiDataBap[prog][keg].forEach(sub => { html += `<option value="${escapeHtml(sub)}">${escapeHtml(sub)}</option>`; });
    }
    subSelect.innerHTML = html;
}

// Nomor BAP otomatis: B/BAP-LS/00001/409.13.1/2026 (urutan = nomor tertinggi tahun ini + 1)
function generateNomorBap() {
    const tahun = new Date().getFullYear();
    let maks = 0;
    dataKontrakTersimpan.forEach(k => {
        const m = String(k.noBap || '').match(/^B\/BAP-LS\/(\d+)\/409\.13\.1\/(\d{4})$/);
        if (m && parseInt(m[2], 10) === tahun) maks = Math.max(maks, parseInt(m[1], 10));
    });
    const nomor = `B/BAP-LS/${String(maks + 1).padStart(5, '0')}/409.13.1/${tahun}`;
    const input = document.getElementById('bapNoBap');
    if (input) {
        input.value = nomor;
        input.readOnly = true;
        input.classList.add('bg-slate-100', 'cursor-not-allowed', 'text-slate-500');
    }
}

// Auto-fill CV jika sudah pernah didaftarkan
function cekCvOtomatis() {
    const cvEksis = cariProfilCv(document.getElementById('bapPelaksanaCv').value);
    if (cvEksis) {
        document.getElementById('bapDirektur').value = cvEksis.direktur || "";
        document.getElementById('bapNpwp').value = cvEksis.npwp || "";
        document.getElementById('bapBank').value = cvEksis.bank || "";
        document.getElementById('bapNoRek').value = cvEksis.noRek || "";
    }
}

function simpanBapKeServer(e) {
    e.preventDefault();

    const nilaiKontrak = Number(document.getElementById('bapNilaiKontrak').value);
    const nilaiBayar = Number(document.getElementById('bapNilaiBayar').value);
    if (!(nilaiKontrak > 0) || !(nilaiBayar > 0)) { alert('Nilai kontrak dan nilai bayar harus lebih dari 0.'); return; }
    if (nilaiBayar > nilaiKontrak) { alert('Nilai bayar tahap ini tidak boleh melebihi nilai total kontrak.'); return; }

    const btn = document.getElementById('btnSubmitBap');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Menyimpan...'; btn.disabled = true;

    const now = new Date();
    const idBapBaru = `BAP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

    const payload = {
        action: 'create_bap',
        kodeSpj: idBapBaru,
        pptk: namaPptkAktif,
        program: document.getElementById('bapProgram').value,
        kegiatan: document.getElementById('bapKegiatan').value,
        subKegiatan: document.getElementById('bapSubKegiatan').value,
        uraian: document.getElementById('bapUraian').value.trim(),
        noKontrak: document.getElementById('bapNoKontrak').value.trim(),
        tglKontrak: document.getElementById('bapTglKontrak').value,
        nilaiKontrak: nilaiKontrak,
        tahapBayar: document.getElementById('bapTahap').value,
        nilaiBayar: nilaiBayar,
        noBap: document.getElementById('bapNoBap').value || "-",
        tglBap: "-",
        pelaksanaCv: document.getElementById('bapPelaksanaCv').value.trim(),
        direktur: document.getElementById('bapDirektur').value.trim(),
        npwp: document.getElementById('bapNpwp').value.trim(),
        alamatCv: "-",
        bank: document.getElementById('bapBank').value.trim(),
        noRek: document.getElementById('bapNoRek').value.trim()
    };

    fetch(CONFIG.APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) })
        .then(res => res.json())
        .then(res => {
            if (res.status === 'success') {
                document.getElementById('modalInputBap').classList.add('hidden');
                alert("Data Kontrak & BAP Berhasil Disimpan!");
                ambilDataBAP();
            } else {
                alert("Gagal Menyimpan: " + res.message);
                // Kemungkinan nomor BAP bentrok dengan input PPTK lain -> segarkan data & nomor
                if (/nomor bap/i.test(String(res.message))) ambilDataBAP().then(generateNomorBap);
            }
        })
        .catch(err => alert("Koneksi Terputus: " + err.message))
        .finally(() => { btn.innerHTML = '<i class="fa-solid fa-save"></i> Simpan Data BAP'; btn.disabled = false; });
}

// ---------- Cetak ----------
function cetakBapBerdasarkanJenis(kodeSpj) {
    const kontrak = dataKontrakTersimpan.find(k => String(k.kodeSpj) === String(kodeSpj));
    if (!kontrak) return alert("Data kontrak tidak ditemukan!");
    const profilCV = cariProfilCv(kontrak.pelaksana);
    if (!profilCV) return alert("Data Bank untuk Penyedia ini belum lengkap!");

    const jenisBapTipe = document.getElementById('jenisBapSelector').value;
    const e = escapeHtml;
    let htmlBapKonten = "";

    if (jenisBapTipe === 'UM') {
        const namaBank = String(profilCV.bank || '').replace(/^\s*bank\s+/i, ''); // hindari "Bank BANK JATIM"
        const noBap = (kontrak.noBap && kontrak.noBap !== '-') ? e(kontrak.noBap) : '.....................';
        htmlBapKonten = `
            <div style="text-align:center; border-bottom: 3px solid black; margin-bottom: 20px; padding-bottom: 10px;">
                <h3 style="margin:0; font-size:16px;">PEMERINTAH KABUPATEN BLITAR</h3><h2 style="margin:0; font-size:20px; font-weight:bold;">DINAS PERUMAHAN RAKYAT, KAWASAN PERMUKIMAN, DAN PERTANAHAN</h2><p style="margin:0; font-size:12px;">Jl. S. Supriyadi No. 86 Pos Box. 24 Telp. (0342) 801317</p>
            </div>
            <h3 style="text-align:center; text-decoration:underline; font-size:14px; margin-bottom:5px;">BERITA ACARA PEMBAYARAN UANG MUKA</h3><p style="text-align:center; margin-top:0; font-size:12px;">Nomor : ${noBap}</p>
            <p style="text-align:justify; margin-top:20px; line-height:1.5;">Pada hari ini <strong>.................</strong> tanggal <strong>.................</strong> bulan <strong>.................</strong> tahun <strong>${terbilangTahun(new Date().getFullYear())}</strong>, kami yang bertanda tangan di bawah ini :</p>
            <table style="width:100%; margin-top:10px; line-height:1.5;">
                <tr><td style="width:5%;">I.</td><td style="width:25%;">Nama</td><td style="width:2%;">:</td><td><strong>${e(kontrak.pptk)}</strong></td></tr>
                <tr><td></td><td>Jabatan</td><td>:</td><td>Pejabat Pembuat Komitmen (PPTK)</td></tr><tr><td></td><td colspan="3">Selanjutnya disebut sebagai <strong>PIHAK KESATU</strong></td></tr>
                <tr><td colspan="4" style="height:10px;"></td></tr>
                <tr><td>II.</td><td>Nama</td><td>:</td><td><strong>${e(profilCV.direktur)}</strong></td></tr>
                <tr><td></td><td>Jabatan</td><td>:</td><td>Direktur ${e(kontrak.pelaksana)}</td></tr><tr><td></td><td colspan="3">Selanjutnya disebut sebagai <strong>PIHAK KEDUA</strong></td></tr>
            </table>
            <p style="text-align:justify; margin-top:15px; line-height:1.5;">Sesuai dengan Surat Perjanjian (Kontrak) Nomor: <strong>${e(kontrak.noKontrak)}</strong> tanggal <strong>${formatTanggalPanjang(kontrak.tglKontrak)}</strong>, maka PIHAK KESATU setuju untuk melakukan pembayaran Uang Muka kepada PIHAK KEDUA dengan rincian:</p>
            <table style="width:100%; margin-top:10px; line-height:1.5;">
                <tr><td style="width:5%; vertical-align:top;">1.</td><td style="width:30%; vertical-align:top;">Nama Pekerjaan</td><td style="width:2%; vertical-align:top;">:</td><td style="vertical-align:top;">${e(kontrak.uraian)}</td></tr>
                <tr><td>2.</td><td>Nilai Kontrak</td><td>:</td><td>${formatRupiah(kontrak.nilaiKontrak)}</td></tr>
                <tr><td>3.</td><td>Nilai Uang Muka</td><td>:</td><td><strong>${formatRupiah(kontrak.nilaiBayar)}</strong></td></tr>
                <tr><td style="vertical-align:top;">4.</td><td style="vertical-align:top;">Rekening Pembayaran</td><td style="vertical-align:top;">:</td><td style="vertical-align:top;">Bank ${e(namaBank)}<br>No Rek. ${e(profilCV.noRek)}<br>a.n ${e(kontrak.pelaksana)}</td></tr>
            </table>
            <table style="width:100%; margin-top:50px; text-align:center;">
                <tr><td style="width:50%;"><strong>PIHAK KEDUA</strong><br>Direktur ${e(kontrak.pelaksana)}<br><br><br><br><br><u><strong>${e(profilCV.direktur)}</strong></u></td><td style="width:50%;"><strong>PIHAK KESATU</strong><br>Pejabat Pembuat Komitmen<br><br><br><br><br><u><strong>${e(kontrak.pptk)}</strong></u></td></tr>
            </table>
        `;
    } else {
        htmlBapKonten = `<h2 style="text-align:center; color:red;">Template belum tersedia.</h2>`;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return alert("Popup diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.");
    printWindow.document.write(`<html><head><title>Cetak BAP</title><style>@media print { @page { margin: 20mm; } } body { font-family: 'Times New Roman', serif; font-size: 14px; padding: 15px; }</style></head><body>${htmlBapKonten}<script>setTimeout(function(){ window.print(); }, 800);<\/script></body></html>`);
    printWindow.document.close();
}
