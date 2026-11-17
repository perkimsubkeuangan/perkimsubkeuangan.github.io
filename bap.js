// ========================================================
// FILE: bap.js (Modul BAP LS) - HANYA form input & daftar riwayat.
// Dokumen BAP dibuat server (Code.gs) sebagai Google Spreadsheet dari template; tampilan/redaksi/kop/data PPK-DPA-SPD
// diatur langsung di file template, bukan di sini. Halaman ini tidak lagi memiliki pratinjau kertas maupun window.print().
//
// PENTING: rumus pada hitungInti() HARUS identik dengan hitungBapInti_() di Code.gs. Server selalu menghitung ulang saat
// menyimpan; angka di layar ini hanya pratinjau agar pengguna bisa memeriksa sebelum menyimpan.
// ========================================================

let dataKontrakTersimpan = [];
let dataPenyediaTersimpan = [];
let referensiDataBap = {};
let daftarPptkBap = [];
const roleAktif = sessionStorage.getItem('sesiAktif_role');
const namaPptkAktif = sessionStorage.getItem('sesiAktif_namaLengkap');
const sesiValid = !!(roleAktif && namaPptkAktif && sessionStorage.getItem('sesi_token'));
const BOLEH_INPUT = (roleAktif === 'PPTK' || roleAktif === 'VERIFIKATOR' || roleAktif === 'SUPER_ADMIN');   // PIMPINAN: hanya melihat

// Tanpa sesi login -> kembali ke halaman login
if (!sesiValid) { window.location.replace('index.html'); }

document.addEventListener('DOMContentLoaded', () => {
    if (!sesiValid) return;
    document.getElementById('boxFormBap').classList.toggle('hidden', !BOLEH_INPUT);
    document.getElementById('catatanBacaSaja').classList.toggle('hidden', BOLEH_INPUT);

    const cari = document.getElementById('cariKontrak');
    if (cari) cari.addEventListener('input', renderTabelKontrak);
    document.getElementById('tabelKontrakBody').addEventListener('click', (ev) => {
        const b = ev.target.closest('button[data-aksi="buat"]');
        if (b) buatSpreadsheetUntuk(b);
    });
    // Pratinjau hitungan ikut berubah saat isian yang memengaruhi angka diubah
    ['bapNilaiKontrak', 'bapPersen', 'bapAddNilai', 'bapDak', 'bapNoKontrak'].forEach(id => {
        const el = document.getElementById(id); if (el) el.addEventListener('input', hitungLive);
    });
    document.querySelectorAll('input[name="bapSkema"]').forEach(r => r.addEventListener('change', aturBagianForm));
    document.getElementById('bapJamNilai').addEventListener('input', (ev) => { ev.target.dataset.otomatis = ''; });
    document.getElementById('bapNoKontrak').addEventListener('change', cekKontrakOtomatis);
    document.getElementById('bapUraian').addEventListener('input', perbaruiPlaceholderPernyataan);
    ambilDataBAP().then(resetFormBap);
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
function pecahTgl(s) { // 'yyyy-MM-dd' (atau ISO) -> {y,m,d} atau null
    const m = String(s || '').split('T')[0].match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
}
function formatTanggal(s) { const t = pecahTgl(s); return t ? `${String(t.d).padStart(2, '0')}/${String(t.m).padStart(2, '0')}/${t.y}` : '-'; }
// Hanya tautan Google Spreadsheet yang boleh dijadikan href (cegah javascript: / situs lain bila sel sheet diubah manual)
function amanUrlSheet(u) { return /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9_-]+/.test(String(u || '')) ? String(u) : ''; }

const v = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
const tampil = (id, ya) => { const el = document.getElementById(id); if (el) el.classList.toggle('hidden', !ya); };
const skemaTerpilih = () => { const r = document.querySelector('input[name="bapSkema"]:checked'); return r ? r.value : 'RETENSI'; };

// ---------- Aturan per tahap (cermin TAHAP_BAP di Code.gs) ----------
// jaminan: WAJIB | OPSIONAL | SKEMA (wajib bila skema = Jaminan Pemeliharaan) | '' (tidak ada)
const BAST_LABEL = 'Berita Acara Serah Terima Pekerjaan (BAST)';
const KONFIG_TAHAP = {
    'UM': { kel: 'FISIK', pph: 'fisik', persenBebas: true, persenDef: 30, retensi: false, pengUmDari: '', jaminan: 'WAJIB', labelJaminan: 'Jaminan Uang Muka', bast: null, pernyataan: false },
    'UM JASA': { kel: 'JASA', pph: 'jasa', persenBebas: true, persenDef: 30, retensi: false, pengUmDari: '', jaminan: 'OPSIONAL', labelJaminan: 'Jaminan Uang Muka', bast: 'Berita Acara Pemeriksaan', pernyataan: true },
    'I (100)': { kel: 'FISIK', pph: 'fisik', persenBebas: false, persenDef: 100, retensi: true, pengUmDari: 'UM', jaminan: 'SKEMA', labelJaminan: 'Jaminan Pemeliharaan', bast: BAST_LABEL, pernyataan: false },
    '100': { kel: 'FISIK', pph: 'fisik', persenBebas: false, persenDef: 100, retensi: true, pengUmDari: '', jaminan: 'SKEMA', labelJaminan: 'Jaminan Pemeliharaan', bast: BAST_LABEL, pernyataan: false },
    '100 JASA': { kel: 'JASA', pph: 'jasa', persenBebas: false, persenDef: 100, retensi: false, pengUmDari: 'UM JASA', jaminan: '', labelJaminan: '', bast: BAST_LABEL, pernyataan: true }
};
const tarifPphTahap = (t) => BAP_CONFIG.pph[t.pph].tarif;
const labelPphTahap = (t) => BAP_CONFIG.pph[t.pph].label;

// Contoh kalimat standar yang ada di template (hanya sebagai petunjuk; kalimat sebenarnya diatur di template)
function pernyataanDefault(tahap, uraian) {
    if (tahap === 'UM JASA') return 'Contoh standar template: Pihak Kedua telah menyusun data pada laporan pendahuluan yang sesuai dengan kondisi di lapangan';
    if (tahap === '100 JASA') return `Contoh standar template: Pihak Kedua telah menyerahkan hasil pekerjaan sesuai dengan dokumen ${uraian || '[uraian pekerjaan]'} (Laporan Akhir)`;
    return '';
}
function perbaruiPlaceholderPernyataan() {
    const tahap = v('bapTahap'), t = KONFIG_TAHAP[tahap];
    if (t && t.pernyataan) document.getElementById('bapPernyataan').placeholder = pernyataanDefault(tahap, v('bapUraian'));
}

// ---------- Inti hitung (identik dengan hitungBapInti_ di Code.gs) ----------
function hitungInti(p) {
    const ppnRate = BAP_CONFIG.ppn;   // 0,11
    const bayarIni = Math.round(p.bruto - p.retensi - p.pengUm);
    const dpp = Math.round(bayarIni / (1 + ppnRate));
    const ppn = bayarIni - dpp;
    const pph = Math.round(dpp * p.tarif);
    const pecah = (t) => { t = Math.round(t); const f = Math.round(t / (1 + ppnRate)); return { fisik: f, ppn: t - f, jumlah: t }; };
    const r1 = pecah(p.aktif), r2 = pecah(p.sebelum), r3 = pecah(bayarIni);
    const r4 = { fisik: r2.fisik + r3.fisik, ppn: r2.ppn + r3.ppn, jumlah: r2.jumlah + r3.jumlah };
    const r5 = { fisik: Math.max(0, r1.fisik - r4.fisik), ppn: Math.max(0, r1.ppn - r4.ppn), jumlah: Math.max(0, r1.jumlah - r4.jumlah) };
    return {
        aktif: p.aktif, bruto: p.bruto, retensi: p.retensi, pengUm: p.pengUm, potongan: p.retensi + p.pengUm,
        bayarIni, dpp, ppn, pph, totalPajak: ppn + pph, bersih: bayarIni - (ppn + pph), rekap: [r1, r2, r3, r4, r5]
    };
}

// Cadangan untuk baris lama (server sudah menormalkan; ini hanya jaga-jaga)
function lengkapiKontrak(k) {
    const awal = Number(k.nilaiKontrak) || 0, add = Number(k.addNilai) || 0, bruto = Number(k.nilaiBayar) || 0;
    const pot = Math.round((Number(k.potRetensi) || 0) + (Number(k.potPengUm) || 0));
    if (!(Number(k.nilaiKontrakAktif) > 0)) k.nilaiKontrakAktif = add > 0 ? add : awal;
    if (!(Number(k.pembayaranBapIni) > 0)) k.pembayaranBapIni = Math.round(bruto - pot);
    return k;
}
function riwayatKontrak(noKontrak) {
    const key = String(noKontrak || '').trim();
    if (!key) return [];
    return dataKontrakTersimpan.filter(x => String(x.noKontrak).trim() === key);
}

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
            dataKontrakTersimpan = (data.kontrakLS || []).map(lengkapiKontrak);
            dataPenyediaTersimpan = data.penyediaCV || [];
            referensiDataBap = data.referensi || {};
            daftarPptkBap = (data.akun || []).filter(a => a.role === 'PPTK');
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
    const q = (document.getElementById('cariKontrak').value || '').toLowerCase();
    const data = dataKontrakTersimpan.filter(k =>
        `${k.pelaksana} ${k.noKontrak} ${k.uraian} ${k.tahapBayar} ${k.noBap}`.toLowerCase().includes(q));

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400 font-medium">Belum ada riwayat BAP.</td></tr>`;
        return;
    }
    const tombol = 'px-2.5 py-1 rounded font-bold text-[10px] shadow-sm text-white inline-flex items-center gap-1';
    tbody.innerHTML = data.map(k => {
        const adaPotongan = Number(k.jumlahPotongan) > 0;
        const linkSheet = amanUrlSheet(k.linkSpreadsheet), linkPdf = amanUrlSheet(k.linkPdf);
        let aksi;
        if (linkSheet) {
            aksi = `<a href="${escapeHtml(linkSheet)}" target="_blank" rel="noopener noreferrer" class="${tombol} bg-blue-600 hover:bg-blue-700"><i class="fa-solid fa-table"></i> Edit di Sheets</a>` +
                (linkPdf ? ` <a href="${escapeHtml(linkPdf)}" target="_blank" rel="noopener noreferrer" class="${tombol} bg-slate-700 hover:bg-slate-800"><i class="fa-solid fa-file-pdf"></i> PDF</a>` : '');
        } else if (BOLEH_INPUT && (roleAktif !== 'PPTK' || String(k.pptk).trim() === String(namaPptkAktif).trim())) {
            aksi = `<button type="button" data-aksi="buat" data-kode="${escapeHtml(k.kodeSpj)}" class="${tombol} bg-emerald-600 hover:bg-emerald-700"><i class="fa-solid fa-wand-magic-sparkles"></i> Buat Spreadsheet</button>`;
        } else {
            aksi = `<span class="text-[10px] text-slate-400">Belum dibuat</span>`;
        }
        return `
            <tr class="hover:bg-blue-50/30 border-b border-slate-100">
                <td class="py-3 px-4 font-bold text-slate-700">${escapeHtml(k.noKontrak || '-')}<br><span class="text-[10px] text-slate-400 font-normal">Tgl: ${formatTanggal(k.tglKontrak)} &middot; ${escapeHtml(k.noBap || '-')}</span></td>
                <td class="py-3 px-4 font-bold text-purple-700">${escapeHtml(k.pelaksana || '-')}<br><span class="text-[10px] text-slate-500 font-normal block w-64 truncate" title="${escapeHtml(k.uraian)}">${escapeHtml(k.uraian || '-')}</span></td>
                <td class="py-3 px-4 font-bold text-slate-800">${formatRupiah(k.pembayaranBapIni)}${adaPotongan ? `<br><span class="text-[10px] text-slate-400 font-normal">Bruto ${formatRupiah(k.nilaiBayar)} &minus; potongan ${formatRupiah(k.jumlahPotongan)}</span>` : ''}</td>
                <td class="py-3 px-4 font-bold text-blue-600 text-xs">${escapeHtml(k.tahapBayar || '-')}</td>
                <td class="py-3 px-4 text-center space-x-1">${aksi}</td>
            </tr>`;
    }).join('');
}

// BAP lama (atau yang gagal dibuat filenya) dibuatkan Spreadsheet dari data yang sudah tersimpan
function buatSpreadsheetUntuk(btn) {
    const kode = btn.getAttribute('data-kode');
    if (!confirm('Buat file Spreadsheet BAP dari template untuk data ini?')) return;
    const awal = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Membuat...';
    apiPost({ action: 'generate_bap_sheet', kodeSpj: kode })
        .then(res => {
            if (res.status === 'success') { ambilDataBAP(); }
            else { alert('Gagal: ' + res.message); btn.disabled = false; btn.innerHTML = awal; }
        })
        .catch(err => { if (String(err.message) !== 'Sesi berakhir') alert('Koneksi terputus: ' + err.message); btn.disabled = false; btn.innerHTML = awal; });
}

// ---------- Form input BAP ----------
const OPT_KEG = '<option value="" disabled selected>-- Pilih Kegiatan --</option>';
const OPT_SUB = '<option value="" disabled selected>-- Pilih Subkegiatan --</option>';
const CV_BARU = '__BARU__';

function resetFormBap() {
    if (!BOLEH_INPUT) return;
    document.getElementById('formBap').reset();
    const adaPicker = roleAktif !== 'PPTK';   // VERIFIKATOR & SUPER_ADMIN membuat BAP atas nama PPTK
    tampil('boxBapPptk', adaPicker);
    const selPptk = document.getElementById('bapPptk'); selPptk.required = adaPicker;
    selPptk.innerHTML = '<option value="" disabled selected>-- Pilih PPTK --</option>' + daftarPptkBap.map(p => `<option value="${escapeHtml(p.namaLengkap)}">${escapeHtml(p.namaLengkap)}</option>`).join('');
    isiDropdownProgramBap();
    document.getElementById('bapKegiatan').innerHTML = OPT_KEG;
    document.getElementById('bapSubKegiatan').innerHTML = OPT_SUB;
    isiDropdownCv();
    document.getElementById('infoKontrak').classList.add('hidden');
    document.getElementById('infoCv').classList.add('hidden');
    document.getElementById('detAddendum').open = false;
    document.getElementById('bapJamNilai').dataset.otomatis = '';
    const rb = document.querySelector('input[name="bapSkema"][value="RETENSI"]'); if (rb) rb.checked = true;
    aturBagianForm();
    generateNomorBap();
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
function pilihAnggaran(prog, keg, sub) {
    const adaOpsi = (id, val) => Array.from(document.getElementById(id).options).some(o => o.value === val);
    if (!prog) { for (const p in referensiDataBap) { if (referensiDataBap[p][keg]) { prog = p; break; } } }
    if (!prog || !adaOpsi('bapProgram', prog)) return;
    document.getElementById('bapProgram').value = prog; updateKegiatanBap();
    if (!adaOpsi('bapKegiatan', keg)) return;
    document.getElementById('bapKegiatan').value = keg; updateSubkegiatanBap();
    if (adaOpsi('bapSubKegiatan', sub)) document.getElementById('bapSubKegiatan').value = sub;
}

// ---------- Penyedia / CV: pilih dari DB_PENYEDIA atau input baru ----------
function isiDropdownCv() {
    const nama = dataPenyediaTersimpan.map(c => String(c.pelaksana || '').trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, 'id'));
    document.getElementById('bapPilihCv').innerHTML =
        '<option value="" disabled selected>-- Pilih Penyedia --</option>' +
        '<option value="' + CV_BARU + '">+ Penyedia / CV baru</option>' +
        nama.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
    tampil('boxCvBaru', false);
    document.getElementById('bapPelaksanaCv').required = false;
}
function namaCvTerpilih() {
    const pilih = document.getElementById('bapPilihCv').value;
    return pilih === CV_BARU ? v('bapPelaksanaCv') : pilih;
}
const FIELD_CV = ['bapDirektur', 'bapNpwp', 'bapAlamatCv', 'bapAktaNo', 'bapAktaTgl', 'bapBank', 'bapNoRek'];
function pilihCvBerubah() {
    const pilih = document.getElementById('bapPilihCv').value;
    const info = document.getElementById('infoCv');
    const baru = pilih === CV_BARU;
    tampil('boxCvBaru', baru);
    document.getElementById('bapPelaksanaCv').required = baru;
    if (baru) {
        document.getElementById('bapPelaksanaCv').value = '';
        FIELD_CV.forEach(id => { document.getElementById(id).value = ''; });
        document.getElementById('bapJabatan').value = 'Direktur';
        info.className = 'text-[10px] mt-1 text-blue-600'; info.textContent = 'Penyedia baru: data akan disimpan ke DB_PENYEDIA saat BAP disimpan.';
        return;
    }
    const cv = cariProfilCv(pilih);
    if (!cv) { info.className = 'text-[10px] mt-1 hidden'; return; }
    document.getElementById('bapDirektur').value = cv.direktur || '';
    document.getElementById('bapJabatan').value = cv.jabatan || 'Direktur';
    document.getElementById('bapNpwp').value = cv.npwp || '';
    document.getElementById('bapAlamatCv').value = (cv.alamat && cv.alamat !== '-') ? cv.alamat : '';
    document.getElementById('bapAktaNo').value = cv.aktaNo || '';
    document.getElementById('bapAktaTgl').value = cv.aktaTgl || '';
    document.getElementById('bapBank').value = cv.bank || '';
    document.getElementById('bapNoRek').value = cv.noRek || '';
    const lengkap = cv.alamat && cv.alamat !== '-';
    info.className = 'text-[10px] mt-1 ' + (lengkap ? 'text-emerald-600' : 'text-amber-600');
    info.textContent = lengkap ? 'Data penyedia terisi otomatis dan boleh diperbarui.' : 'Alamat penyedia belum ada. Mohon lengkapi.';
}
function setCvTerpilih(nama) {
    const sel = document.getElementById('bapPilihCv');
    const ada = Array.from(sel.options).some(o => o.value === nama);
    if (ada) { sel.value = nama; pilihCvBerubah(); }
    else { sel.value = CV_BARU; pilihCvBerubah(); document.getElementById('bapPelaksanaCv').value = nama; }
}

// Bagian formulir yang tampil mengikuti tahap (dan skema jaminan) terpilih
function aturBagianForm() {
    const tahap = document.getElementById('bapTahap').value;
    const t = KONFIG_TAHAP[tahap];
    const skema = skemaTerpilih();
    const jamTampil = !!t && (t.jaminan === 'WAJIB' || t.jaminan === 'OPSIONAL' || (t.jaminan === 'SKEMA' && skema === 'JAMINAN'));
    const jamWajib = !!t && (t.jaminan === 'WAJIB' || (t.jaminan === 'SKEMA' && skema === 'JAMINAN'));

    tampil('boxPersen', !!t && t.persenBebas);
    tampil('boxSkema', !!t && t.retensi);
    tampil('secJaminan', jamTampil);
    tampil('secBast', !!t && !!t.bast);
    tampil('boxPernyataan', !!t && t.pernyataan);
    tampil('panelHitung', !!t);
    if (t && t.labelJaminan) document.getElementById('lblJaminan').textContent = t.labelJaminan + (jamWajib ? ' (wajib)' : ' (opsional; disimpan, tetapi template UM JASA tidak memiliki baris jaminan)');
    if (t && t.bast) document.getElementById('lblBast').textContent = t.bast;
    ['bapJamPenjamin', 'bapJamNo', 'bapJamTgl', 'bapJamNilai', 'bapJamBerlaku'].forEach(id => { document.getElementById(id).required = jamWajib; });
    ['bapBastTgl', 'bapBastNo'].forEach(id => { document.getElementById(id).required = !!(t && t.bast); });
    document.getElementById('bapPersen').required = !!(t && t.persenBebas);
    if (t && t.persenBebas && !v('bapPersen')) document.getElementById('bapPersen').value = t.persenDef;
    perbaruiPlaceholderPernyataan();
    hitungLive();
}

// Kumpulkan angka dari formulir -> hitungan pratinjau (aturan sama dengan server)
function konteksForm() {
    const tahap = v('bapTahap'), t = KONFIG_TAHAP[tahap];
    if (!t) return null;
    const riwayat = riwayatKontrak(v('bapNoKontrak'));
    const nilaiKontrak = Math.round(Number(v('bapNilaiKontrak')) || 0);
    const addNilai = Math.round(Number(v('bapAddNilai')) || 0);
    const aktif = addNilai > 0 ? addNilai : nilaiKontrak;
    const persen = t.persenBebas ? (Number(v('bapPersen')) || 0) : 100;
    const skema = t.retensi ? skemaTerpilih() : '';
    const bruto = Math.round(aktif * persen / 100);
    const retensi = (t.retensi && skema === 'RETENSI') ? Math.round(bruto * BAP_CONFIG.retensiPersen) : 0;
    const rowUm = t.pengUmDari ? riwayat.find(x => String(x.tahapBayar).trim() === t.pengUmDari) : null;
    const pengUm = rowUm ? Math.round(rowUm.pembayaranBapIni) : 0;
    const sebelum = riwayat.reduce((a, x) => a + Math.round(Number(x.pembayaranBapIni) || 0), 0);
    const hit = hitungInti({ aktif, bruto, retensi, pengUm, sebelum, tarif: tarifPphTahap(t) });
    return { tahap, t, riwayat, aktif, persen, skema, bruto, retensi, rowUm, pengUm, sebelum, hit, dak: Math.max(0, Math.round(Number(v('bapDak')) || 0)) };
}

function hitungLive() {
    const panel = document.getElementById('panelHitung');
    if (!panel) return;
    const c = konteksForm();
    if (!c) { panel.innerHTML = ''; return; }
    const { t, hit } = c;

    // Peringatan aturan antar-tahap (server menegakkan aturan yang sama)
    const pesan = [];
    if (c.tahap === 'I (100)' && !c.rowUm) pesan.push('BAP tahap <b>UM</b> untuk nomor kontrak ini belum ada. Input BAP UM dulu, atau pilih tahap <b>100</b> bila tanpa uang muka.');
    if (c.tahap === '100' && c.riwayat.some(x => String(x.tahapBayar).trim() === 'UM')) pesan.push('Kontrak ini sudah mengambil Uang Muka. Gunakan tahap <b>I (100)</b>.');
    if (c.t.persenBebas && c.riwayat.length) pesan.push('Uang muka harus menjadi BAP pertama pada kontrak; kontrak ini sudah memiliki BAP lain.');
    if (c.t.persenBebas && c.persen > 30) pesan.push('Persentase uang muka di atas 30% — pastikan diatur dalam kontrak.');
    if (c.aktif > 0 && c.sebelum + hit.bayarIni > c.aktif) pesan.push('Total pembayaran s.d BAP ini melebihi nilai kontrak.');
    if (c.aktif > 0 && !(hit.bayarIni > 0)) pesan.push('Pembayaran BAP ini nol atau negatif.');
    if (c.dak > hit.bayarIni) pesan.push('DAK melebihi pembayaran BAP ini.');

    const baris = (lab, val, tebal, kls) => `<tr class="${kls || ''}"><td class="py-0.5 pr-3 ${tebal ? 'font-bold' : ''}">${lab}</td><td class="py-0.5 text-right font-mono ${tebal ? 'font-bold' : ''}">${val}</td></tr>`;
    let h = `<div class="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2"><i class="fa-solid fa-calculator me-1"></i>Pratinjau hitungan <span class="font-normal normal-case">(dihitung ulang di server saat disimpan; angka dokumen mengikuti rumus template)</span></div>
        <table class="w-full text-xs">
        ${baris(`${persenId(c.persen)}% × Nilai Kontrak Aktif (${formatRupiah(c.aktif)})`, formatRupiah(hit.bruto), true)}
        ${c.t.retensi ? baris(`Potongan Retensi 5%${c.skema === 'JAMINAN' ? ' <span class="text-slate-400">(diganti Jaminan Pemeliharaan)</span>' : ''}`, formatRupiah(hit.retensi)) : ''}
        ${c.t.pengUmDari ? baris(`Pengembalian ${c.t.pengUmDari}${c.rowUm ? '' : ' <span class="text-red-500">(belum ada)</span>'}`, formatRupiah(hit.pengUm)) : ''}
        ${baris('Jumlah Potongan', formatRupiah(hit.potongan))}
        ${baris('Pembayaran BAP ini (termasuk PPN / bruto)', formatRupiah(hit.bayarIni), true, 'border-t border-slate-300')}
        ${baris(`DAK / DAU`, `${formatRupiah(c.dak)} / ${formatRupiah(hit.bayarIni - c.dak)}`)}
        ${baris('DPP (Nilai Fisik) = Pembayaran ÷ 1,11', formatRupiah(hit.dpp))}
        ${baris('PPN 11%', formatRupiah(hit.ppn))}
        ${baris(`${labelPphTahap(t)} ${persenId(tarifPphTahap(t) * 100)}% × DPP`, formatRupiah(hit.pph))}
        ${baris('Nilai Bersih Transfer', formatRupiah(hit.bersih), true, 'border-t border-slate-300 text-emerald-700')}
        ${baris('Pembayaran s.d BAP yang lalu', formatRupiah(c.sebelum))}
        ${baris('Sisa Nilai Kontrak setelah BAP ini', formatRupiah(hit.rekap[4].jumlah))}
        </table>`;
    if (pesan.length) h += `<div class="mt-2 bg-amber-50 border border-amber-200 text-amber-800 rounded p-2 text-[11px] space-y-1">${pesan.map(p => `<div><i class="fa-solid fa-triangle-exclamation me-1"></i>${p}</div>`).join('')}</div>`;
    panel.innerHTML = h;

    // Nilai jaminan terisi otomatis (tetap bisa diubah): Jaminan UM = nilai UM; Jaminan Pemeliharaan = 5% bruto
    const jn = document.getElementById('bapJamNilai');
    const perluJam = t.jaminan === 'WAJIB' || (t.jaminan === 'SKEMA' && c.skema === 'JAMINAN');
    if (jn && perluJam && (!jn.value || jn.dataset.otomatis === '1')) {
        const saran = t.jaminan === 'SKEMA' ? Math.round(hit.bruto * BAP_CONFIG.retensiPersen) : hit.bruto;
        if (saran > 0) { jn.value = saran; jn.dataset.otomatis = '1'; }
    }
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

// Nomor kontrak sudah pernah dipakai -> data kontrak, mata anggaran & penyedia terisi otomatis dari BAP sebelumnya
function cekKontrakOtomatis() {
    const info = document.getElementById('infoKontrak');
    const riw = riwayatKontrak(v('bapNoKontrak'));
    if (!riw.length) { info.classList.add('hidden'); hitungLive(); return; }
    const ref = riw[0];
    const terakhirAdd = riw.filter(x => x.addNo && x.addNo !== '-').pop();
    document.getElementById('bapTglKontrak').value = ref.tglKontrak || '';
    document.getElementById('bapNilaiKontrak').value = ref.nilaiKontrak || '';
    if (terakhirAdd) {
        document.getElementById('bapAddNo').value = terakhirAdd.addNo; document.getElementById('bapAddTgl').value = terakhirAdd.addTgl || ''; document.getElementById('bapAddNilai').value = terakhirAdd.addNilai || '';
        document.getElementById('detAddendum').open = true;
    }
    if (!v('bapUraian')) document.getElementById('bapUraian').value = ref.uraian || '';
    pilihAnggaran(ref.program, ref.kegiatan, ref.subKegiatan);
    setCvTerpilih(String(ref.pelaksana || '').trim());
    info.innerHTML = `<i class="fa-solid fa-circle-info me-1"></i>Kontrak sudah terdaftar (BAP sebelumnya: <b>${riw.map(x => escapeHtml(x.tahapBayar)).join(', ')}</b>). Data kontrak, anggaran, dan penyedia terisi otomatis; pembayaran sebelumnya dihitung otomatis.`;
    info.classList.remove('hidden');
    hitungLive();
}

function simpanBapKeServer(e) {
    e.preventDefault();
    const c = konteksForm();
    if (!c) { alert('Pilih tahap pembayaran terlebih dahulu.'); return; }
    const { t, hit } = c;
    const namaCv = namaCvTerpilih();
    if (!namaCv) { alert('Pilih penyedia / CV, atau isi nama penyedia baru.'); return; }

    const nilaiKontrak = Number(v('bapNilaiKontrak'));
    if (!(nilaiKontrak > 0)) { alert('Nilai kontrak harus lebih dari 0.'); return; }
    if (t.persenBebas && !(c.persen > 0 && c.persen < 100)) { alert('Persentase uang muka harus lebih dari 0 dan kurang dari 100%.'); return; }
    if (c.tahap === 'I (100)' && !c.rowUm) { alert('Tahap I (100) mensyaratkan BAP tahap UM pada kontrak yang sama.\nInput BAP UM dulu, atau pilih tahap 100 bila tanpa uang muka.'); return; }
    if (c.tahap === '100' && c.riwayat.some(x => String(x.tahapBayar).trim() === 'UM')) { alert('Kontrak ini sudah mengambil Uang Muka. Gunakan tahap I (100).'); return; }
    if (!(hit.bayarIni > 0)) { alert('Pembayaran BAP ini nol atau negatif. Periksa isian.'); return; }
    if (c.sebelum + hit.bayarIni > c.aktif) { alert('Total pembayaran s.d BAP ini (' + formatRupiah(c.sebelum + hit.bayarIni) + ') melebihi nilai kontrak (' + formatRupiah(c.aktif) + ').'); return; }
    if (c.dak > hit.bayarIni) { alert('Sumber dana DAK tidak boleh melebihi pembayaran BAP ini.'); return; }
    if (!/^[0-9]{5,30}$/.test(v('bapNoRek'))) { alert('No. rekening harus berupa angka (5-30 digit).'); return; }

    // Addendum: lengkap atau kosong semua
    const addIsi = [v('bapAddNo'), v('bapAddTgl'), Number(v('bapAddNilai')) > 0 ? '1' : ''];
    if (addIsi.some(Boolean) && !addIsi.every(Boolean)) { alert('Data addendum harus lengkap (nomor, tanggal, nilai) atau dikosongkan semua.'); return; }

    // Jaminan: wajib / sebagian terisi tidak diperbolehkan
    const jamIsi = ['bapJamPenjamin', 'bapJamNo', 'bapJamTgl', 'bapJamBerlaku'].map(v).concat([Number(v('bapJamNilai')) > 0 ? '1' : '']);
    const jamWajib = t.jaminan === 'WAJIB' || (t.jaminan === 'SKEMA' && c.skema === 'JAMINAN');
    const jamPakai = jamWajib || t.jaminan === 'OPSIONAL';
    if (jamPakai && (jamWajib || jamIsi.some(Boolean)) && !jamIsi.every(Boolean)) { alert('Data ' + t.labelJaminan + ' harus lengkap (penjamin, nomor, tanggal, nilai, tanggal berlaku).'); return; }

    const ringkas = `Simpan BAP ${c.tahap} dan buat Spreadsheet?\n\nBruto: ${formatRupiah(hit.bruto)}\nPotongan: ${formatRupiah(hit.potongan)}\nPembayaran BAP ini: ${formatRupiah(hit.bayarIni)}\nNilai bersih transfer: ${formatRupiah(hit.bersih)}`;
    if (!confirm(ringkas)) return;

    const btn = document.getElementById('btnSubmitBap');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Memproses...'; btn.disabled = true;
    tampil('statusSimpan', true);

    // Hanya isian dasar yang dikirim; server menghitung ulang seluruh angka. Bagian yang tidak dipakai tahap ini dikirim kosong.
    const payload = {
        action: 'create_bap',
        pptk: roleAktif === 'PPTK' ? '' : v('bapPptk'),
        program: v('bapProgram'), kegiatan: v('bapKegiatan'), subKegiatan: v('bapSubKegiatan'), uraian: v('bapUraian'),
        noKontrak: v('bapNoKontrak'), tglKontrak: v('bapTglKontrak'), nilaiKontrak,
        tahapBayar: c.tahap, persen: t.persenBebas ? c.persen : 100, skemaRetensi: c.skema,
        tglBap: v('bapTglBap'), dak: c.dak,
        addNo: v('bapAddNo'), addTgl: v('bapAddTgl'), addNilai: Number(v('bapAddNilai')) || 0,
        jamPenjamin: jamPakai ? v('bapJamPenjamin') : '', jamNo: jamPakai ? v('bapJamNo') : '', jamNilai: jamPakai ? Number(v('bapJamNilai')) || 0 : 0,
        jamTgl: jamPakai ? v('bapJamTgl') : '', jamBerlaku: jamPakai ? v('bapJamBerlaku') : '',
        bastTgl: t.bast ? v('bapBastTgl') : '', bastNo: t.bast ? v('bapBastNo') : '',
        pernyataan: t.pernyataan ? v('bapPernyataan') : '',
        pelaksanaCv: namaCv, direktur: v('bapDirektur'), jabatan: v('bapJabatan'), npwp: v('bapNpwp'),
        alamatCv: v('bapAlamatCv'), aktaNo: v('bapAktaNo'), aktaTgl: v('bapAktaTgl'), bank: v('bapBank'), noRek: v('bapNoRek')
    };

    apiPost(payload)
        .then(res => {
            if (res.status === 'success') {
                tampilkanSukses(res);
                ambilDataBAP().then(resetFormBap);
            } else {
                alert('Gagal Menyimpan: ' + res.message);
            }
        })
        .catch(err => { if (String(err.message) !== 'Sesi berakhir') alert('Koneksi Terputus: ' + err.message + '\nPeriksa tabel Riwayat sebelum mencoba lagi agar tidak terjadi data ganda.'); })
        .finally(() => { btn.innerHTML = '<i class="fa-solid fa-file-circle-check"></i> Simpan &amp; Generate BAP Spreadsheet'; btn.disabled = false; tampil('statusSimpan', false); });
}

function tampilkanSukses(res) {
    document.getElementById('suksesNomor').textContent = res.noBap || '-';
    document.getElementById('suksesRingkas').innerHTML = `Pembayaran BAP ini <b>${formatRupiah(res.pembayaranBapIni)}</b> &middot; Nilai bersih transfer <b>${formatRupiah(res.nilaiBersih)}</b>`;
    const a = document.getElementById('linkSukses'), p = document.getElementById('linkPdfSukses');
    const urlSheet = amanUrlSheet(res.spreadsheetUrl), urlPdf = amanUrlSheet(res.pdfUrl);
    a.href = urlSheet || '#'; a.classList.toggle('hidden', !urlSheet);
    p.href = urlPdf || '#'; p.classList.toggle('hidden', !urlPdf);
    const w = document.getElementById('suksesPeringatan');
    const n = (res.peringatan || []).length;
    w.classList.toggle('hidden', n === 0);
    if (n) w.textContent = 'Catatan: ' + n + ' sel pada template tidak terisi (posisi sel berbeda dari peta). Periksa dokumen dan beri tahu Super Admin; rinciannya ada di LOG_SISTEM.';
    document.getElementById('modalSukses').classList.remove('hidden');
}
