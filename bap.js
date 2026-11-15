// ========================================================
// FILE: bap.js (Modul BAP LS) - mengikuti template REKAP_LS_2026.xlsx
// Jenis BAP dipilih otomatis dari kolom "Tahap": UM, UM JASA, I (100), 100, 100 JASA
// Data tetap (PPK, DPA, alamat dinas) ada di config.js -> BAP_CONFIG
// ========================================================
const LOGO_BAP = 'data:image/png;base64,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';

let dataKontrakTersimpan = [];
let dataPenyediaTersimpan = [];
let referensiDataBap = {};
const roleAktif = sessionStorage.getItem('sesiAktif_role');
const namaPptkAktif = sessionStorage.getItem('sesiAktif_namaLengkap');
const sesiValid = !!(roleAktif && namaPptkAktif && sessionStorage.getItem('sesi_token'));

// Tanpa sesi login -> kembali ke halaman login
if (!sesiValid) { window.location.replace('index.html'); }

document.addEventListener('DOMContentLoaded', () => {
    if (!sesiValid) return;
    const btn = document.getElementById('btnTambahBap');
    if (btn) { btn.classList.remove('hidden'); btn.classList.add('flex'); }
    const cari = document.getElementById('cariKontrak');
    if (cari) cari.addEventListener('input', renderTabelKontrak);
    const tbody = document.getElementById('tabelKontrakBody');
    tbody.addEventListener('click', (ev) => {
        const b = ev.target.closest('button[data-kode]');
        if (b) cetakBap(b.getAttribute('data-kode'));
    });
    ambilDataBAP();
});

// ---------- Helper ----------
function escapeHtml(s) {
    return String(s === null || s === undefined ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function angkaId(n) { return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0)); }
function formatRupiah(n) { return 'Rp ' + angkaId(n); }
function persenId(p) { return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(Number(p) || 0); }

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function pecahTgl(s) { // 'yyyy-MM-dd' (atau ISO) -> {y,m,d} atau null
    const m = String(s || '').split('T')[0].match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
}
function formatTanggal(s) { const t = pecahTgl(s); return t ? `${String(t.d).padStart(2, '0')}/${String(t.m).padStart(2, '0')}/${t.y}` : '-'; }
function tglPanjang(s) { const t = pecahTgl(s); return t ? `${String(t.d).padStart(2, '0')} ${BULAN[t.m - 1]} ${t.y}` : '-'; }

function terbilang(n) {
    const s = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
    n = Math.floor(n);
    if (n < 12) return s[n];
    if (n < 20) return terbilang(n - 10) + ' Belas';
    if (n < 100) return terbilang(Math.floor(n / 10)) + ' Puluh' + (n % 10 ? ' ' + terbilang(n % 10) : '');
    if (n < 200) return 'Seratus' + (n % 100 ? ' ' + terbilang(n % 100) : '');
    if (n < 1000) return terbilang(Math.floor(n / 100)) + ' Ratus' + (n % 100 ? ' ' + terbilang(n % 100) : '');
    if (n < 2000) return 'Seribu' + (n % 1000 ? ' ' + terbilang(n % 1000) : '');
    if (n < 1000000) return terbilang(Math.floor(n / 1000)) + ' Ribu' + (n % 1000 ? ' ' + terbilang(n % 1000) : '');
    return String(n);
}

// Pengaturan bagian formulir & isi cetakan per tahap
const KONFIG_TAHAP = {
    'UM': { judul: 'Uang Muka (Fisik)', jaminan: 'Jaminan Uang Muka', bast: null, capaian: false, pernyataan: false, potongan: false },
    'UM JASA': { judul: 'Uang Muka (Jasa Konsultansi)', jaminan: null, bast: 'Berita Acara Pemeriksaan', capaian: false, pernyataan: true, potongan: true,
        defPernyataan: 'Pihak Kedua telah menyusun data pada laporan pendahuluan yang sesuai dengan kondisi di lapangan' },
    'I (100)': { judul: 'Termin I (Fisik)', jaminan: 'Jaminan Pemeliharaan', bast: 'Berita Acara Serah Terima Pekerjaan (BAST)', capaian: true, pernyataan: false, potongan: true },
    '100': { judul: 'Termin 100% (Fisik)', jaminan: 'Jaminan Pemeliharaan', bast: 'Berita Acara Serah Terima Pekerjaan (BAST)', capaian: true, pernyataan: false, potongan: true },
    '100 JASA': { judul: 'Termin 100% (Jasa Konsultansi)', jaminan: null, bast: 'Berita Acara Serah Terima Pekerjaan (BAST)', capaian: false, pernyataan: true, potongan: true,
        defPernyataan: 'Pihak Kedua telah menyerahkan hasil pekerjaan sesuai dengan dokumen jasa konsultansi (Laporan Akhir)' }
};

// ---------- Ambil & tampilkan data ----------
function ambilDataBAP() {
    const tbody = document.getElementById('tabelKontrakBody');
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400 font-medium"><i class="fa-solid fa-spinner fa-spin me-2 text-blue-500"></i> Memuat data dari server...</td></tr>`;
    return apiPost({ action: 'load' })
        .then(data => {
            if (data.status !== 'success') {
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
    if (!key) return undefined;
    return dataPenyediaTersimpan.find(cv => String(cv.pelaksana).trim().toUpperCase() === key);
}

function renderTabelKontrak() {
    const tbody = document.getElementById('tabelKontrakBody');
    const cari = document.getElementById('cariKontrak');
    const q = cari ? cari.value.toLowerCase() : '';

    const data = dataKontrakTersimpan.filter(k =>
        `${k.pelaksana} ${k.noKontrak} ${k.uraian} ${k.tahapBayar}`.toLowerCase().includes(q));

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400 font-medium">Data Kontrak belum tersedia.</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(k => {
        const cv = cariProfilCv(k.pelaksana);
        let badge = `<span class="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold ms-2">Bank Kosong</span>`;
        if (cv) badge = cv.alamat && cv.alamat !== '-'
            ? `<span class="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold ms-2">CV Terdaftar</span>`
            : `<span class="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold ms-2">Alamat Kosong</span>`;
        const bisaCetak = !!KONFIG_TAHAP[k.tahapBayar];
        return `
            <tr class="hover:bg-blue-50/30 border-b border-slate-100">
                <td class="py-3 px-4 font-bold text-slate-700">${escapeHtml(k.noKontrak || '-')}<br><span class="text-[10px] text-slate-400 font-normal">Tgl: ${formatTanggal(k.tglKontrak)}</span></td>
                <td class="py-3 px-4 font-bold text-purple-700">${escapeHtml(k.pelaksana || '-')}${badge}<br><span class="text-[10px] text-slate-500 font-normal block w-64 truncate" title="${escapeHtml(k.uraian)}">${escapeHtml(k.uraian || '-')}</span></td>
                <td class="py-3 px-4 font-bold text-slate-800">${formatRupiah(k.nilaiBayar)}</td>
                <td class="py-3 px-4 font-bold text-blue-600 text-xs">${escapeHtml(k.tahapBayar || '-')}</td>
                <td class="py-3 px-4 text-center">${bisaCetak
                    ? `<button data-kode="${escapeHtml(k.kodeSpj)}" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[10px] shadow-sm"><i class="fa-solid fa-print"></i> CETAK BAP</button>`
                    : `<span class="text-[10px] text-slate-400">Tahap tidak dikenal</span>`}</td>
            </tr>`;
    }).join('');
}

// ---------- Form input BAP ----------
const OPT_KEG = '<option value="" disabled selected>-- Pilih Kegiatan --</option>';
const OPT_SUB = '<option value="" disabled selected>-- Pilih Subkegiatan --</option>';
const v = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
const tampil = (id, ya) => { const el = document.getElementById(id); if (el) el.classList.toggle('hidden', !ya); };

function bangunGridSpd() {
    let html = '';
    for (let i = 1; i <= 4; i++) {
        const wajib = i === 1;
        html += `
            <div><label class="block text-[10px] font-bold text-slate-600 mb-1">SPD ${i} - Nomor ${wajib ? '<span class="text-red-500">*</span>' : ''}</label>
                <input type="text" id="bapSpd${i}No" maxlength="120" ${wajib ? 'required' : ''} class="w-full px-3 py-1.5 border border-slate-300 rounded outline-none text-xs text-slate-700"></div>
            <div><label class="block text-[10px] font-bold text-slate-600 mb-1">SPD ${i} - Tanggal ${wajib ? '<span class="text-red-500">*</span>' : ''}</label>
                <input type="date" id="bapSpd${i}Tgl" ${wajib ? 'required' : ''} class="w-full px-3 py-1.5 border border-slate-300 rounded outline-none text-xs text-slate-700"></div>`;
    }
    document.getElementById('gridSpd').innerHTML = html;
}

function bukaFormBap() {
    document.getElementById('formBap').reset();
    bangunGridSpd();
    isiDropdownProgramBap();
    document.getElementById('bapKegiatan').innerHTML = OPT_KEG;
    document.getElementById('bapSubKegiatan').innerHTML = OPT_SUB;
    document.getElementById('infoPersen').textContent = '';
    document.getElementById('infoCv').classList.add('hidden');
    aturBagianForm();
    generateNomorBap();
    document.getElementById('modalInputBap').classList.remove('hidden');
}

function isiDropdownProgramBap() {
    let html = '<option value="" disabled selected>-- Pilih Program --</option>';
    for (const prog in referensiDataBap) html += `<option value="${escapeHtml(prog)}">${escapeHtml(prog)}</option>`;
    document.getElementById('bapProgram').innerHTML = html;
}
function updateKegiatanBap() {
    const prog = document.getElementById('bapProgram').value;
    document.getElementById('bapSubKegiatan').innerHTML = OPT_SUB;
    let html = OPT_KEG;
    if (prog && referensiDataBap[prog]) for (const keg in referensiDataBap[prog]) html += `<option value="${escapeHtml(keg)}">${escapeHtml(keg)}</option>`;
    document.getElementById('bapKegiatan').innerHTML = html;
}
function updateSubkegiatanBap() {
    const prog = document.getElementById('bapProgram').value;
    const keg = document.getElementById('bapKegiatan').value;
    let html = OPT_SUB;
    if (prog && keg && referensiDataBap[prog] && referensiDataBap[prog][keg]) {
        referensiDataBap[prog][keg].forEach(sub => { html += `<option value="${escapeHtml(sub)}">${escapeHtml(sub)}</option>`; });
    }
    document.getElementById('bapSubKegiatan').innerHTML = html;
}

// Tampilkan hanya bagian formulir yang dipakai tahap terpilih
function aturBagianForm() {
    const t = KONFIG_TAHAP[document.getElementById('bapTahap').value];
    tampil('secJaminan', !!(t && t.jaminan));
    tampil('secBast', !!(t && t.bast));
    tampil('secPotongan', !!(t && t.potongan));
    tampil('boxCapaian', !!(t && t.capaian));
    tampil('boxPernyataan', !!(t && t.pernyataan));
    if (t && t.jaminan) document.getElementById('lblJaminan').textContent = t.jaminan;
    if (t && t.bast) document.getElementById('lblBast').textContent = t.bast;
    ['bapBastTgl', 'bapBastNo'].forEach(id => { document.getElementById(id).required = !!(t && t.bast); });
    document.getElementById('bapCapaian').required = !!(t && t.capaian);

    const pern = document.getElementById('bapPernyataan');
    const semuaDefault = Object.values(KONFIG_TAHAP).map(x => x.defPernyataan).filter(Boolean);
    if (t && t.pernyataan && (pern.value.trim() === '' || semuaDefault.includes(pern.value.trim()))) pern.value = t.defPernyataan || '';
}

function hitungPersen() {
    const k = Number(document.getElementById('bapNilaiKontrak').value);
    const b = Number(document.getElementById('bapNilaiBayar').value);
    document.getElementById('infoPersen').textContent = (k > 0 && b > 0) ? `(${persenId(b / k * 100)}% dari nilai kontrak)` : '';
}

// Pratinjau nomor BAP; nomor yang sah dibuat server saat disimpan (aman dari nomor kembar)
function generateNomorBap() {
    const tgl = pecahTgl(v('bapTglBap'));
    const tahun = tgl ? tgl.y : new Date().getFullYear();
    let maks = 0;
    dataKontrakTersimpan.forEach(k => {
        const m = String(k.noBap || '').match(/^B\/BAP-LS\/(\d+)\/409\.13\.1\/(\d{4})$/);
        if (m && parseInt(m[2], 10) === tahun) maks = Math.max(maks, parseInt(m[1], 10));
    });
    document.getElementById('bapNoBap').value = `B/BAP-LS/${String(maks + 1).padStart(5, '0')}/409.13.1/${tahun}`;
}

// Isi otomatis bila CV sudah pernah didaftarkan
function cekCvOtomatis() {
    const info = document.getElementById('infoCv');
    const cv = cariProfilCv(document.getElementById('bapPelaksanaCv').value);
    if (cv) {
        document.getElementById('bapDirektur').value = cv.direktur || '';
        document.getElementById('bapNpwp').value = cv.npwp || '';
        document.getElementById('bapAlamatCv').value = (cv.alamat && cv.alamat !== '-') ? cv.alamat : '';
        document.getElementById('bapBank').value = cv.bank || '';
        document.getElementById('bapNoRek').value = cv.noRek || '';
        info.textContent = (cv.alamat && cv.alamat !== '-') ? 'CV sudah terdaftar: data terisi otomatis.' : 'CV terdaftar, tetapi alamat belum ada. Mohon lengkapi alamat.';
        info.className = 'text-[10px] mt-1 ' + ((cv.alamat && cv.alamat !== '-') ? 'text-emerald-600' : 'text-amber-600');
    } else {
        info.className = 'text-[10px] mt-1 hidden';
    }
}

function simpanBapKeServer(e) {
    e.preventDefault();
    const t = KONFIG_TAHAP[v('bapTahap')];
    if (!t) { alert('Pilih tahap pembayaran terlebih dahulu.'); return; }

    const nilaiKontrak = Number(v('bapNilaiKontrak'));
    const nilaiBayar = Number(v('bapNilaiBayar'));
    if (!(nilaiKontrak > 0) || !(nilaiBayar > 0)) { alert('Nilai kontrak dan nilai bayar harus lebih dari 0.'); return; }
    if (nilaiBayar > nilaiKontrak) { alert('Nilai bayar tahap ini tidak boleh melebihi nilai total kontrak.'); return; }
    const potRetensi = t.potongan ? Number(v('bapPotRetensi')) || 0 : 0;
    const potPengUm = t.potongan ? Number(v('bapPotPengUm')) || 0 : 0;
    if (potRetensi + potPengUm > nilaiBayar) { alert('Total potongan tidak boleh melebihi nilai bayar.'); return; }
    if (!/^[0-9]{5,30}$/.test(v('bapNoRek'))) { alert('No. rekening harus berupa angka (5-30 digit).'); return; }

    const btn = document.getElementById('btnSubmitBap');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Menyimpan...'; btn.disabled = true;

    // Bagian yang tidak dipakai tahap ini dikirim kosong (supaya sisa isian tidak ikut tersimpan)
    const jam = !!t.jaminan, bast = !!t.bast;
    const payload = {
        action: 'create_bap',
        program: v('bapProgram'), kegiatan: v('bapKegiatan'), subKegiatan: v('bapSubKegiatan'), uraian: v('bapUraian'),
        noKontrak: v('bapNoKontrak'), tglKontrak: v('bapTglKontrak'), nilaiKontrak, tahapBayar: v('bapTahap'),
        nilaiBayar, tglBap: v('bapTglBap'),
        spd1No: v('bapSpd1No'), spd1Tgl: v('bapSpd1Tgl'), spd2No: v('bapSpd2No'), spd2Tgl: v('bapSpd2Tgl'),
        spd3No: v('bapSpd3No'), spd3Tgl: v('bapSpd3Tgl'), spd4No: v('bapSpd4No'), spd4Tgl: v('bapSpd4Tgl'),
        addNo: v('bapAddNo'), addTgl: v('bapAddTgl'), addNilai: Number(v('bapAddNilai')) || 0,
        jamPenjamin: jam ? v('bapJamPenjamin') : '', jamNo: jam ? v('bapJamNo') : '', jamNilai: jam ? Number(v('bapJamNilai')) || 0 : 0,
        jamTgl: jam ? v('bapJamTgl') : '', jamBerlaku: jam ? v('bapJamBerlaku') : '',
        bastTgl: bast ? v('bapBastTgl') : '', bastNo: bast ? v('bapBastNo') : '',
        capaian: t.capaian ? Number(v('bapCapaian')) || 0 : 0,
        pernyataan: t.pernyataan ? v('bapPernyataan') : '',
        potRetensi, potPengUm,
        pelaksanaCv: v('bapPelaksanaCv'), direktur: v('bapDirektur'), npwp: v('bapNpwp'),
        alamatCv: v('bapAlamatCv'), bank: v('bapBank'), noRek: v('bapNoRek')
    };

    apiPost(payload)
        .then(res => {
            if (res.status === 'success') {
                document.getElementById('modalInputBap').classList.add('hidden');
                alert('Data Kontrak & BAP berhasil disimpan.\nNomor BAP: ' + res.noBap);
                ambilDataBAP();
            } else {
                alert('Gagal Menyimpan: ' + res.message);
            }
        })
        .catch(err => { if (String(err.message) !== 'Sesi berakhir') alert('Koneksi Terputus: ' + err.message); })
        .finally(() => { btn.innerHTML = '<i class="fa-solid fa-save"></i> Simpan Data BAP'; btn.disabled = false; });
}

// ========================================================
// CETAK BAP  (susunan mengikuti template Excel: bagian I s.d. V)
// ========================================================
function hitungBap(k) {
    const ppn = BAP_CONFIG.ppn;
    const awal = Number(k.nilaiKontrak) || 0;
    const bruto = Number(k.nilaiBayar) || 0;
    const retensi = Number(k.potRetensi) || 0, pengUm = Number(k.potPengUm) || 0;
    const potongan = retensi + pengUm;
    const bayarIni = bruto - potongan;

    // Pembayaran sebelumnya: BAP lain pada kontrak yang sama yang dibuat lebih dulu
    const idx = dataKontrakTersimpan.findIndex(x => x.kodeSpj === k.kodeSpj);
    const sebelum = dataKontrakTersimpan
        .filter((x, i) => i < idx && String(x.noKontrak).trim() === String(k.noKontrak).trim())
        .reduce((a, x) => a + (Number(x.nilaiBayar) || 0) - (Number(x.potRetensi) || 0) - (Number(x.potPengUm) || 0), 0);

    const pecah = (tot) => { tot = Math.round(tot); const fisik = Math.round(tot / (1 + ppn)); return { fisik, ppn: tot - fisik, jumlah: tot }; };
    const r1 = pecah(awal), r2 = pecah(sebelum), r3 = pecah(bayarIni), r4 = pecah(sebelum + bayarIni);
    const r5 = { fisik: r1.fisik - r4.fisik, ppn: r1.ppn - r4.ppn, jumlah: r1.jumlah - r4.jumlah };
    return { awal, bruto, retensi, pengUm, potongan, bayarIni, persen: awal > 0 ? bruto / awal * 100 : 0, rekap: [r1, r2, r3, r4, r5] };
}

function htmlBap(k, cv) {
    const e = escapeHtml, C = BAP_CONFIG, t = KONFIG_TAHAP[k.tahapBayar], h = hitungBap(k);
    const rp = (n) => 'Rp. ' + angkaId(n);
    const kosong = '.....................';
    const ada = (s) => (s && String(s).trim() !== '' && s !== '-') ? e(s) : '-';

    const tb = pecahTgl(k.tglBap);
    const hariIni = tb ? HARI[new Date(tb.y, tb.m - 1, tb.d).getDay()] : kosong;
    const noBap = (k.noBap && k.noBap !== '-') ? e(k.noBap) : kosong;

    // baris "label : nilai" (ind = lekuk dalam px)
    const kv = (no, label, val, ind) => `<tr><td class="no">${no}</td><td style="padding-left:${ind || 0}px;width:235px">${label}</td><td class="c">:</td><td>${val}</td></tr>`;
    const judulBaris = (no, teks) => `<tr><td class="no">${no}</td><td colspan="3">${teks}</td></tr>`;

    // ---- II.2 SPD (hanya yang terisi) ----
    let spd = '';
    let nSpd = 0;
    for (let i = 1; i <= 4; i++) {
        if (k['spd' + i + 'No']) {
            nSpd++;
            spd += kv('', `${String.fromCharCode(96 + nSpd)}. Nomor`, e(k['spd' + i + 'No']), 14);
            spd += kv('', 'Tanggal', tglPanjang(k['spd' + i + 'Tgl']), 28);
        }
    }
    if (!nSpd) spd = kv('', 'a. Nomor', '-', 14);

    const adaAdd = !!(k.addNo && k.addNo !== '-');
    const nilaiAkhirTxt = adaAdd && Number(k.addNilai) > 0 ? rp(k.addNilai) : '-';

    // ---- II.8 pembayaran sesuai tahap ----
    const jaminanRows = (label) =>
        kv('', `Dengan ${label} oleh`, ada(k.jamPenjamin), 14) +
        kv('', 'Nomor', ada(k.jamNo), 28) + kv('', 'Tanggal', k.jamTgl ? tglPanjang(k.jamTgl) : '-', 28) +
        kv('', 'Sebesar', Number(k.jamNilai) > 0 ? rp(k.jamNilai) : '-', 28) +
        kv('', 'Berlaku dari tanggal', k.jamBerlaku ? tglPanjang(k.jamBerlaku) : '-', 28);
    const bastRows = (label) =>
        `<tr><td class="no"></td><td colspan="3" style="padding-left:14px">Sesuai ${label} :</td></tr>` + kv('', 'Tanggal', k.bastTgl ? tglPanjang(k.bastTgl) : '-', 28) + kv('', 'Nomor', ada(k.bastNo), 28);
    const capaianTxt = `Yang menyatakan bahwa prestasi kemajuan fisik pekerjaan telah mencapai <b>${persenId(k.capaian)} %</b>.`;
    const termynKosong =
        judulBaris('', '<b>b.</b> Pembayaran Termyn Ke ……………') +
        `<tr><td class="no"></td><td colspan="3" style="padding-left:14px">Sesuai Berita Acara ………………………………….. :</td></tr>` + kv('', 'Tanggal', '-', 28) + kv('', 'Nomor', '-', 28) +
        judulBaris('', 'Yang menyatakan bahwa prestasi kemajuan fisik pekerjaan telah mencapai …….. %.');

    let pembayaran = '';
    if (k.tahapBayar === 'UM') {
        pembayaran = judulBaris('8.', '<b>a.</b> Pembayaran Uang Muka') + jaminanRows('Jaminan Uang Muka') + termynKosong;
    } else if (k.tahapBayar === 'UM JASA') {
        pembayaran = judulBaris('8.', '<b>a.</b> Pembayaran Uang Muka') + bastRows('Berita Acara Pemeriksaan') +
            judulBaris('', `Yang menyatakan bahwa ${e(k.pernyataan || '')}.`) + termynKosong;
    } else if (k.tahapBayar === '100') {
        pembayaran = judulBaris('8.', '<b>a.</b> Pembayaran Termyn 100%') + jaminanRows('Jaminan Pemeliharaan') +
            bastRows('Berita Acara Serah Terima Pekerjaan (BAST)') + judulBaris('', capaianTxt);
    } else if (k.tahapBayar === 'I (100)') {
        pembayaran = judulBaris('8.', '<b>a.</b> Pembayaran Termyn I (100%)') + jaminanRows('Jaminan Pemeliharaan') +
            bastRows('Berita Acara Serah Terima Pekerjaan (BAST)') + judulBaris('', capaianTxt);
    } else { // 100 JASA
        pembayaran = judulBaris('8.', '<b>a.</b> Pembayaran Termyn 100%') + bastRows('Berita Acara Serah Terima Pekerjaan (BAST)') +
            judulBaris('', `Yang menyatakan bahwa ${e(k.pernyataan || '')}.`) + termynKosong;
    }

    // ---- III perhitungan ----
    const perhitungan = `
        <table class="plain">
            <tr><td class="no">1.</td><td colspan="2"><b>Perhitungan Pembayaran</b></td></tr>
            <tr><td class="no"></td><td style="width:22px">a.</td><td>${persenId(h.persen)} % X Nilai Kontrak = ${persenId(h.persen)} % X ${rp(h.awal)} = <b>${rp(h.bruto)}</b></td></tr>
            <tr><td class="no"></td><td>b.</td><td>Potongan-potongan :</td></tr>
        </table>
        <table class="plain" style="margin-left:46px;width:430px">
            <tr><td style="width:24px">i)</td><td style="width:210px">Uang Retensi/Jaminan</td><td class="c">=</td><td class="r">${rp(h.retensi)}</td></tr>
            <tr><td>ii)</td><td>Pengembalian Uang Muka</td><td class="c">=</td><td class="r">${rp(h.pengUm)}</td></tr>
            <tr><td>iii)</td><td>Jumlah Potongan</td><td class="c">=</td><td class="r">${rp(h.potongan)}</td></tr>
        </table>
        <table class="plain">
            <tr><td class="no"></td><td style="width:22px">c.</td><td>Pembayaran BAP ini (termasuk PPN/bruto) = <b>${rp(h.bayarIni)}</b></td></tr>
        </table>
        <div class="blok">
        <table class="plain" style="margin-top:6px">
            <tr><td class="no">2.</td><td colspan="4"><b>Rincian sumber pembayaran :</b></td></tr>
            <tr><td class="no"></td><td colspan="4">APBD Tahun Anggaran ${C.tahunAnggaran}</td></tr>
            <tr><td class="no"></td><td style="width:22px">-</td><td style="width:90px">DAK</td><td class="r" style="width:150px">${rp(0)}</td><td></td></tr>
            <tr><td class="no"></td><td>-</td><td>DAU</td><td class="r">${rp(h.bayarIni)}</td><td></td></tr>
            <tr><td class="no"></td><td colspan="2"><b>TOTAL</b></td><td class="r"><b>${rp(h.bayarIni)}</b></td><td></td></tr>
        </table>
        </div>`;

    // ---- IV rekap ----
    const nama = ['Nilai Kontrak', 'Pembayaran s.d BAP y.l', 'Pembayaran BAP ini', 'Total Pembayaran s.d BAP ini', 'Sisa Kontrak'];
    const rekap = h.rekap.map((r, i) => `
        <tr><td class="c">${i + 1}.</td><td>${nama[i]}</td><td class="r">${angkaId(r.fisik)}</td><td class="r">${angkaId(r.ppn)}</td><td class="r">${angkaId(r.jumlah)}</td></tr>`).join('');

    return `
    <div class="kop">
        <img src="${LOGO_BAP}" alt="">
        <div class="kop-teks">
            <div>${e(C.instansi)}</div>
            <div class="b">${e(C.dinas)}</div>
            <div>${e(C.alamatDinas)}</div>
            <div>${e(C.kotaDinas)}</div>
            <div>${e(C.webDinas)}</div>
        </div>
    </div>
    <div class="judul"><u>BERITA ACARA PEMBAYARAN</u></div>
    <div class="nomor">Nomor ${noBap}</div>

    <p class="j">Pada hari ini <b>${hariIni}</b> tanggal <b>${tb ? terbilang(tb.d) : kosong}</b> bulan <b>${tb ? BULAN[tb.m - 1] : kosong}</b> tahun <b>${tb ? terbilang(tb.y) : kosong}</b> kami yang bertandatangan dibawah ini:</p>

    <table class="plain">
        <tr><td class="rom">I.</td><td class="no">1.</td><td style="width:110px">Nama</td><td class="c">:</td><td>${e(C.ppk.nama)}</td></tr>
        <tr><td></td><td></td><td>Jabatan</td><td class="c">:</td><td>${e(C.ppk.jabatan)}</td></tr>
        <tr><td></td><td></td><td>Kegiatan</td><td class="c">:</td><td>${e(k.kegiatan)}</td></tr>
        <tr><td></td><td></td><td>Sub Kegiatan</td><td class="c">:</td><td>${e(k.subKegiatan)}</td></tr>
        <tr><td></td><td></td><td>Alamat</td><td class="c">:</td><td>${e(C.ppk.alamat)}</td></tr>
        <tr><td></td><td></td><td colspan="3" style="padding-top:4px">Untuk selanjutnya disebut &nbsp;&nbsp;&nbsp;: <b>PIHAK PERTAMA</b></td></tr>
        <tr><td></td><td class="no" style="padding-top:8px">2.</td><td style="padding-top:8px">Nama</td><td class="c" style="padding-top:8px">:</td><td style="padding-top:8px">${e(cv.direktur)}</td></tr>
        <tr><td></td><td></td><td>Jabatan</td><td class="c">:</td><td>Direktur</td></tr>
        <tr><td></td><td></td><td>Perusahaan</td><td class="c">:</td><td>${e(k.pelaksana)}</td></tr>
        <tr><td></td><td></td><td>Alamat</td><td class="c">:</td><td>${ada(cv.alamat)}</td></tr>
        <tr><td></td><td></td><td colspan="3" style="padding-top:4px">Untuk selanjutnya disebut &nbsp;&nbsp;&nbsp;: <b>PIHAK KEDUA</b></td></tr>
    </table>

    <table class="plain" style="margin-top:6px">
        <tr><td class="rom">II.</td><td colspan="4"><b>Berdasarkan :</b></td></tr>
    </table>
    <table class="plain tbl-ii">
        ${judulBaris('1.', 'Nomor &amp; Tanggal DPA :')}
        ${kv('', 'a. Nomor', e(C.dpa.nomor), 14)}
        ${kv('', 'Tanggal', tglPanjang(C.dpa.tanggal), 28)}
        ${judulBaris('2.', 'Nomor &amp; Tanggal SPD :')}
        ${spd}
        ${kv('3.', 'No &amp; Tgl Kontrak / SPK Awal', 'No. ' + e(k.noKontrak) + '<br>Tgl. ' + tglPanjang(k.tglKontrak))}
        ${kv('4.', 'Nilai Kontrak / SPK (Awal)', rp(h.awal))}
        ${kv('5.', 'No &amp; Tgl Addendum', adaAdd ? 'No. ' + e(k.addNo) + '<br>Tgl. ' + tglPanjang(k.addTgl) : 'No. -<br>Tgl. -')}
        ${kv('6.', 'Nilai Kontrak (termasuk Addendum)', nilaiAkhirTxt)}
        ${kv('7.', 'Uraian Pekerjaan', e(k.uraian))}
        ${pembayaran}
    </table>

    <table class="plain" style="margin-top:6px">
        <tr><td class="rom">III.</td><td>Sesuai ketentuan pada syarat-syarat Kontrak/SPK/Surat Perjanjian tersebut diatas, maka PIHAK KEDUA berhak menerima pembayaran dari PIHAK PERTAMA, dengan uraian pembayaran sebagai berikut:</td></tr>
    </table>
    ${perhitungan}

    <div class="blok">
    <table class="plain" style="margin-top:6px"><tr><td class="rom">IV.</td><td><b>REKAPITULASI PEMBAYARAN KONTRAK :</b></td></tr></table>
    <table class="rek">
        <thead>
            <tr><th style="width:36px">NO.</th><th>URAIAN</th><th style="width:105px">NILAI FISIK (Rp.)</th><th style="width:95px">PPN (Rp.)</th><th style="width:110px">JUMLAH (Rp.)</th></tr>
            <tr class="nm"><td class="c">1</td><td class="c">2</td><td class="c">3</td><td class="c">4</td><td class="c">5</td></tr>
        </thead>
        <tbody>${rekap}</tbody>
    </table>
    </div>

    <div class="blok">
    <table class="plain" style="margin-top:6px">
        <tr><td class="rom">V.</td><td colspan="4">PIHAK KEDUA sepakat atas jumlah pembayaran tersebut diatas dan dibayarkan ke:</td></tr>
        <tr><td></td><td style="width:60px"><b>BANK</b></td><td class="c">:</td><td style="width:230px">${e(cv.bank)}</td><td><b>No. Rekening</b> &nbsp;: ${e(cv.noRek)}</td></tr>
    </table>
    <p class="j" style="margin-top:8px">Demikian Berita Acara Pembayaran ini dibuat dalam rangkap 2 (Dua) dan dapatnya dipergunakan sebagaimana mestinya.</p>

    <table class="ttd">
        <tr><td></td><td class="kanan">${e(C.kotaTtd)}, ${tb ? tglPanjang(k.tglBap) : kosong}</td></tr>
        <tr>
            <td><b>PIHAK KEDUA</b><br>PENYEDIA JASA<br><br><br><br><br><u><b>${e(cv.direktur)}</b></u><br>Direktur</td>
            <td><b>PIHAK PERTAMA</b><br>PENGGUNA ANGGARAN /<br>PEJABAT PEMBUAT KOMITMEN<br><br><br><br><u><b>${e(C.ppk.nama)}</b></u><br>${e(C.ppk.pangkat)}<br>NIP. ${e(C.ppk.nip)}</td>
        </tr>
    </table>
    </div>`;
}

const CSS_CETAK = `
    @page { size: A4; margin: 12mm 14mm; }
    * { box-sizing: border-box; }
    body { font-family: Tahoma, Arial, sans-serif; font-size: 11px; line-height: 1.35; color: #000; margin: 0; }
    table { border-collapse: collapse; width: 100%; }
    td, th { vertical-align: top; padding: 1px 3px; }
    .kop { display: flex; align-items: center; gap: 12px; border-bottom: 3px double #000; padding-bottom: 6px; margin-bottom: 10px; }
    .kop img { width: 70px; height: auto; }
    .kop-teks { flex: 1; text-align: center; font-size: 11px; line-height: 1.3; }
    .kop-teks .b { font-weight: bold; font-size: 13px; }
    .judul { text-align: center; font-weight: bold; font-size: 13px; margin-top: 4px; }
    .nomor { text-align: center; margin-bottom: 8px; }
    p.j { text-align: justify; margin: 6px 0; }
    .plain td.no { width: 24px; } .plain td.rom { width: 30px; font-weight: bold; }
    td.c { width: 12px; text-align: center; } td.r { text-align: right; white-space: nowrap; }
    .tbl-ii td.no { width: 24px; }
    .rek th, .rek td { border: 1px solid #000; padding: 3px 5px; }
    .rek th { text-align: center; font-weight: bold; }
    .rek tr.nm td { font-size: 9px; }
    .rek td.c { width: auto; }
    .blok { page-break-inside: avoid; }
    .ttd { margin-top: 10px; } .ttd td { width: 50%; text-align: center; }
    .ttd td.kanan { text-align: center; padding-bottom: 6px; }
`;

function cetakBap(kodeSpj) {
    const k = dataKontrakTersimpan.find(x => String(x.kodeSpj) === String(kodeSpj));
    if (!k) return alert('Data kontrak tidak ditemukan!');
    if (!KONFIG_TAHAP[k.tahapBayar]) return alert('Tahap pembayaran "' + k.tahapBayar + '" belum memiliki template.');
    const cv = cariProfilCv(k.pelaksana);
    if (!cv) return alert('Data penyedia (direktur, bank, rekening) untuk "' + k.pelaksana + '" belum lengkap!');
    if (!cv.alamat || cv.alamat === '-') {
        if (!confirm('Alamat CV belum diisi, pada cetakan akan tertulis "-". Lanjutkan mencetak?')) return;
    }

    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) return alert('Popup diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>BAP ${escapeHtml(k.tahapBayar)} - ${escapeHtml(k.pelaksana)}</title><style>${CSS_CETAK}</style></head><body>${htmlBap(k, cv)}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch (err) { /* pengguna bisa cetak manual */ } }, 700);
}
