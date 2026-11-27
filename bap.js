// ========================================================
// FILE 3/3: bap.js  (Modul BAP LS, Hitung Pratinjau, Riwayat & Preview/Cetak PDF A4)
// Dimuat setelah config.js, app.js, dan spj.js pada index.html.
// ========================================================
// ============================================================================
// MODUL BAP LS (tab "Modul BAP LS" pada sidebar) — form input/edit (modal), riwayat, preview & cetak PDF A4.
// Seluruh logika berada di namespace BAP agar tidak bentrok dengan fungsi SPJ. Handler HTML memakai BAP.xxx().
// Data memakai state yang sama dengan bagian SPJ: window.DATABASE_KONTRAK (DB_KONTRAK_LS), DATABASE_PENYEDIA, DATABASE_AKUN, referensiData.
// DOKUMEN BAP TIDAK DIBANGUN DI SINI: server (aksi pdf_bap) mengisi tab template pada Google Spreadsheet lalu mengekspornya ke PDF A4.
// Kop, logo, redaksi, tata letak, serta data PPK / DPA / SPD (tab MASTER_BAP) hanya ada di Spreadsheet template.
//
// PENTING: hitungInti() HARUS identik dengan hitungBapInti_() di Code.gs. Server selalu menghitung ulang saat menyimpan;
// angka di form hanyalah pratinjau; angka pada dokumen dihitung oleh rumus di Spreadsheet template.
// ============================================================================
const BAP = (function () {
    'use strict';

    // ---------- Helper ----------
    const e = (s) => escapeHtml(s);                              // escapeHtml: global di app.js
    const $ = (id) => document.getElementById(id);
    const v = (id) => { const el = $(id); return el ? el.value.trim() : ''; };
    const tampil = (id, ya) => { const el = $(id); if (el) el.classList.toggle('hidden', !ya); };
    const angkaId = (n) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));
    const rpTeks = (n) => 'Rp ' + angkaId(n);
    const persenId = (p) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(Number(p) || 0);
    const daftar = () => window.DATABASE_KONTRAK || [];
    const daftarCv = () => window.DATABASE_PENYEDIA || [];
    const cariKontrak = (kode) => daftar().find(x => String(x.kodeSpj) === String(kode));
    const cariCv = (nama) => {
        const key = String(nama || '').trim().toUpperCase();
        return key ? daftarCv().find(c => String(c.pelaksana).trim().toUpperCase() === key) : undefined;
    };
    function pecahTgl(s) { // 'yyyy-MM-dd' (atau ISO) -> {y,m,d} atau null
        const m = String(s || '').split('T')[0].match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
    }
    const formatTgl = (s) => { const t = pecahTgl(s); return t ? `${String(t.d).padStart(2, '0')}/${String(t.m).padStart(2, '0')}/${t.y}` : '-'; };

    // ---------- Hak akses di tampilan (penegakan sebenarnya ada di server) ----------
    const bolehInput = () => ['PPTK', 'VERIFIKATOR', 'BENDAHARA', 'SUPER_ADMIN'].includes(sesiAktif.role);          // PIMPINAN: hanya melihat
    const bolehEdit = (k) => bolehInput() && (sesiAktif.role !== 'PPTK' || String(k.pptk).trim() === String(sesiAktif.namaLengkap).trim());
    const adalahAdmin = () => sesiAktif.role === 'SUPER_ADMIN';                                         // tombol Hapus: SUPER_ADMIN saja

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

    // Contoh kalimat standar pernyataan (kalimat sebenarnya ada di tab template Spreadsheet; dipakai bila kolom pernyataan dikosongkan)
    function pernyataanDefault(tahap, uraian) {
        if (tahap === 'UM JASA') return 'Pihak Kedua telah menyusun data pada laporan pendahuluan yang sesuai dengan kondisi di lapangan';
        if (tahap === '100 JASA') return `Pihak Kedua telah menyerahkan hasil pekerjaan sesuai dengan dokumen ${uraian || '................'} (Laporan Akhir)`;
        return '';
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


    // ========================================================================
    // STATE & INISIALISASI
    // ========================================================================
    let editKode = '';        // KODE_SPJ BAP yang sedang diedit ('' = mode input baru)
    let previewKode = '';     // KODE_SPJ BAP yang sedang dipratinjau
    let siap = false;
    const OPT_KEG = '<option value="" disabled selected>-- Pilih Kegiatan --</option>';
    const OPT_SUB = '<option value="" disabled selected>-- Pilih Subkegiatan --</option>';
    const CV_BARU = '__BARU__';
    const NAMA_TOMBOL_SIMPAN = '<i class="fa-solid fa-floppy-disk"></i> Simpan &amp; Generate BAP';

    function init() {
        if (!$('formBap')) return;
        tampil('btnBukaFormBap', bolehInput());
        tampil('catatanBacaSaja', !bolehInput());
        if (!siap) {
            siap = true;
            $('cariBap').addEventListener('input', renderTabel);
            if ($('filterPemilikBap')) $('filterPemilikBap').addEventListener('change', renderTabel);
            $('tabelBapBody').addEventListener('click', (ev) => {
                const b = ev.target.closest('button[data-aksi]');
                if (!b) return;
                const kode = b.getAttribute('data-kode'), aksi = b.getAttribute('data-aksi');
                if (aksi === 'preview') preview(kode);
                else if (aksi === 'edit') mulaiEdit(kode);
                else if (aksi === 'hapus') hapus(kode, b);
                else if (aksi === 'ajukan_spj' && typeof bukaFormSpjDariBap === 'function') bukaFormSpjDariBap(kode);
            });
            ['bapNilaiKontrak', 'bapPersen', 'bapAddNilai', 'bapDak', 'bapNoKontrak'].forEach(id => { $(id).addEventListener('input', hitungLive); });
            document.querySelectorAll('input[name="bapSkema"]').forEach(r => r.addEventListener('change', aturBagianForm));
            $('bapJamNilai').addEventListener('input', (ev) => { ev.target.dataset.otomatis = ''; });
            $('bapNoKontrak').addEventListener('change', cekKontrakOtomatis);
            $('bapUraian').addEventListener('input', perbaruiPlaceholderPernyataan);
        }
        resetForm();
        renderTabel();
    }

    // Dipanggil setiap kali data dimuat ulang dari server (tarikDataDariServer). Tidak menghapus isian yang sedang diketik.
    function setelahLoad() {
        if (!$('formBap')) return;
        renderTabel();
        if ($('bapProgram').options.length <= 1) isiDropdownProgram();
        isiDropdownCv(true);
        isiPicker(true);
    }

    function tampilkanTab(ya) {
        tampil('viewBap', ya);
        tampil('viewSpj', !ya);
        tampil('headerAksiSpj', !ya);
        if (ya) renderTabel();
    }

    // ========================================================================
    // DAFTAR RIWAYAT BAP
    // ========================================================================
    function renderTabel() {
        const tbody = $('tabelBapBody');
        if (!tbody) return;
        const q = ($('cariBap').value || '').toLowerCase();
        const fPem = ($('filterPemilikBap') && sesiAktif.role === 'PPTK') ? $('filterPemilikBap').value : 'ALL';
        const data = daftar().filter(k => {
            if (fPem === 'MINE' && String(k.pptk || '').trim() !== String(sesiAktif.namaLengkap || '').trim()) return false;
            return `${k.pelaksana} ${k.noKontrak} ${k.kodeBerkas || ''} ${k.pptk || ''} ${k.uraian} ${k.tahapBayar} ${k.noBap}`.toLowerCase().includes(q);
        });
        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400 font-medium">Belum ada riwayat BAP.</td></tr>`;
            return;
        }
        const tb = 'px-2.5 py-1 rounded font-bold text-[10px] shadow-sm text-white inline-flex items-center gap-1 whitespace-nowrap';
        tbody.innerHTML = data.map(k => {
            const adaPotongan = Number(k.jumlahPotongan) > 0;
            const kode = e(k.kodeSpj);
            const milikSaya = String(k.pptk || '').trim() === String(sesiAktif.namaLengkap || '').trim();
            const sudahSpj = typeof bapSudahDiajukan === 'function' ? bapSudahDiajukan(k) : false;
            const bolehAjukan = (adalahAdmin() || (sesiAktif.role === 'PPTK' && milikSaya));
            let aksi = KONFIG_TAHAP[k.tahapBayar]
                ? `<button type="button" data-aksi="preview" data-kode="${kode}" class="${tb} bg-sipd-navy hover:bg-slate-800"><i class="fa-solid fa-print"></i> Preview / Cetak</button>`
                : `<span class="text-[10px] text-slate-400">Tahap tidak dikenal</span>`;
            if (!sudahSpj && bolehAjukan && KONFIG_TAHAP[k.tahapBayar]) {
                aksi += ` <button type="button" data-aksi="ajukan_spj" data-kode="${kode}" class="${tb} bg-purple-600 hover:bg-purple-700" title="Buat SPJ LS langsung dari BAP ini"><i class="fa-solid fa-paper-plane"></i> Ajukan SPJ</button>`;
            }
            if (bolehEdit(k)) aksi += ` <button type="button" data-aksi="edit" data-kode="${kode}" class="${tb} bg-blue-600 hover:bg-blue-700"><i class="fa-solid fa-pen-to-square"></i> Edit Data</button>`;
            if (adalahAdmin()) aksi += ` <button type="button" data-aksi="hapus" data-kode="${kode}" class="${tb} bg-red-600 hover:bg-red-700"><i class="fa-solid fa-trash"></i> Hapus</button>`;
            const badgeMilik = (sesiAktif.role === 'PPTK' && milikSaya)
                ? ` <span class="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[9px] font-bold">Milik Saya</span>`
                : (k.pptk ? ` <span class="text-[10px] text-slate-400 font-normal">&middot; ${e(k.pptk)}</span>` : '');
            const badgeSpj = sudahSpj
                ? `<div class="mt-1"><span class="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[9px] font-bold inline-flex items-center gap-1"><i class="fa-solid fa-check"></i> Sudah SPJ</span></div>`
                : '';
            return `
            <tr class="hover:bg-blue-50/30 border-b border-slate-100">
                <td class="py-3 px-4 font-bold text-slate-700">${k.kodeBerkas ? `<span class="px-1.5 py-0.5 mr-1.5 bg-teal-50 text-teal-800 border border-teal-200 rounded font-mono text-[10px]">${e(k.kodeBerkas)}</span>` : ''}${e(k.noKontrak || '-')}${badgeMilik}<br><span class="text-[10px] text-slate-400 font-normal">Tgl: ${formatTgl(k.tglKontrak)} &middot; ${e(k.noBap || '-')}</span></td>
                <td class="py-3 px-4 font-bold text-purple-700">${e(k.pelaksana || '-')}<br><span class="text-[10px] text-slate-500 font-normal block max-w-xs lg:max-w-md xl:max-w-2xl truncate" title="${e(k.uraian)}">${e(k.uraian || '-')}</span></td>
                <td class="py-3 px-4 font-bold text-slate-800">${rpTeks(k.pembayaranBapIni)}${adaPotongan ? `<br><span class="text-[10px] text-slate-400 font-normal">Bruto ${rpTeks(k.nilaiBayar)} &minus; potongan ${rpTeks(k.jumlahPotongan)}</span>` : ''}</td>
                <td class="py-3 px-4 font-bold text-blue-600 text-xs">${e(k.tahapBayar || '-')}${badgeSpj}</td>
                <td class="py-3 px-4 text-center space-x-1">${aksi}</td>
            </tr>`;
        }).join('');
    }

    // ========================================================================
    // FORM INPUT / EDIT
    // ========================================================================
    function resetForm() {
        editKode = '';
        $('formBap').reset();
        $('bapTahap').disabled = false;
        tampil('bannerEditBap', false);
        $('btnSubmitBap').innerHTML = NAMA_TOMBOL_SIMPAN;
        $('judulFormBap').textContent = 'Form Input BAP LS';
        $('subJudulFormBap').textContent = 'Isi data kontrak & pembayaran. Dokumen BAP dibuat dari template Spreadsheet.';
        $('bapNoBap').readOnly = true;
        isiPicker(false);
        isiDropdownProgram();
        $('bapKegiatan').innerHTML = OPT_KEG;
        $('bapSubKegiatan').innerHTML = OPT_SUB;
        isiDropdownCv(false);
        tampil('infoKontrak', false); tampil('infoCv', false);
        $('detAddendum').open = false;
        $('bapJamNilai').dataset.otomatis = '';
        const rb = document.querySelector('input[name="bapSkema"][value="RETENSI"]'); if (rb) rb.checked = true;
        aturBagianForm();
        generateNomor();
    }

    // Tambah BAP baru: modal form dibuka kosong (sama seperti modal pengajuan SPJ)
    function bukaForm() {
        if (!bolehInput()) { alert('Peran Anda tidak memiliki hak menambah data BAP.'); return; }
        resetForm();
        openModal('modalFormBap');
        $('modalFormBap').scrollTop = 0;
    }
    function tutupForm() { closeModal('modalFormBap'); resetForm(); }

    // Picker PPTK hanya untuk VERIFIKATOR & SUPER_ADMIN saat membuat BAP baru (BAP dibuat atas nama PPTK)
    function isiPicker(pertahankan) {
        const adaPicker = sesiAktif.role !== 'PPTK' && !editKode;
        tampil('boxBapPptk', adaPicker);
        const sel = $('bapPptk'); sel.required = adaPicker;
        const lama = pertahankan ? sel.value : '';
        sel.innerHTML = '<option value="" disabled selected>-- Pilih PPTK --</option>' +
            (window.DATABASE_AKUN || []).filter(a => a.role === 'PPTK' && String(a.status || 'AKTIF').toUpperCase() !== 'NONAKTIF').map(p => `<option value="${e(p.namaLengkap)}">${e(p.namaLengkap)}</option>`).join('');
        if (lama && Array.from(sel.options).some(o => o.value === lama)) sel.value = lama;
    }

    function isiDropdownProgram() {
        let html = '<option value="" disabled selected>-- Pilih Program --</option>';
        for (const prog in referensiData) html += `<option value="${e(prog)}">${e(prog)}</option>`;
        $('bapProgram').innerHTML = html;
    }
    function updateKegiatan() {
        const prog = $('bapProgram').value;
        $('bapSubKegiatan').innerHTML = OPT_SUB;
        let html = OPT_KEG;
        if (prog && referensiData[prog]) for (const keg in referensiData[prog]) html += `<option value="${e(keg)}">${e(keg)}</option>`;
        $('bapKegiatan').innerHTML = html;
    }
    function updateSubkegiatan() {
        const prog = $('bapProgram').value, keg = $('bapKegiatan').value;
        let html = OPT_SUB;
        if (prog && keg && referensiData[prog] && referensiData[prog][keg]) referensiData[prog][keg].forEach(sub => { html += `<option value="${e(sub)}">${e(sub)}</option>`; });
        $('bapSubKegiatan').innerHTML = html;
    }
    function pilihAnggaran(prog, keg, sub) {
        const adaOpsi = (id, val) => Array.from($(id).options).some(o => o.value === val);
        if (!prog) { for (const p in referensiData) { if (referensiData[p][keg]) { prog = p; break; } } }
        if (!prog || !adaOpsi('bapProgram', prog)) return;
        $('bapProgram').value = prog; updateKegiatan();
        if (!adaOpsi('bapKegiatan', keg)) return;
        $('bapKegiatan').value = keg; updateSubkegiatan();
        if (adaOpsi('bapSubKegiatan', sub)) $('bapSubKegiatan').value = sub;
    }

    // ---------- Penyedia / CV: pilih dari DB_PENYEDIA atau input baru ----------
    function isiDropdownCv(pertahankan) {
        const sel = $('bapPilihCv');
        const lama = pertahankan ? sel.value : '';
        const nama = daftarCv().map(c => String(c.pelaksana || '').trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, 'id'));
        sel.innerHTML = '<option value="" disabled selected>-- Pilih Penyedia --</option><option value="' + CV_BARU + '">+ Penyedia / CV baru</option>' +
            nama.map(n => `<option value="${e(n)}">${e(n)}</option>`).join('');
        if (lama && Array.from(sel.options).some(o => o.value === lama)) sel.value = lama;
        else { tampil('boxCvBaru', false); $('bapPelaksanaCv').required = false; }
    }
    const namaCvTerpilih = () => $('bapPilihCv').value === CV_BARU ? v('bapPelaksanaCv') : $('bapPilihCv').value;
    const FIELD_CV = ['bapDirektur', 'bapNpwp', 'bapAlamatCv', 'bapBank', 'bapNoRek'];
    function pilihCvBerubah() {
        const pilih = $('bapPilihCv').value, info = $('infoCv'), baru = pilih === CV_BARU;
        tampil('boxCvBaru', baru);
        $('bapPelaksanaCv').required = baru;
        info.classList.remove('hidden');
        if (baru) {
            $('bapPelaksanaCv').value = '';
            FIELD_CV.forEach(id => { $(id).value = ''; });
            $('bapJabatan').value = 'Direktur';
            info.className = 'text-[10px] mt-1 text-blue-600'; info.textContent = 'Penyedia baru: data akan disimpan ke DB_PENYEDIA saat BAP disimpan.';
            return;
        }
        const cv = cariCv(pilih);
        if (!cv) { info.className = 'text-[10px] mt-1 hidden'; return; }
        $('bapDirektur').value = cv.direktur || '';
        $('bapJabatan').value = cv.jabatan || 'Direktur';
        $('bapNpwp').value = cv.npwp || '';
        $('bapAlamatCv').value = (cv.alamat && cv.alamat !== '-') ? cv.alamat : '';
        $('bapBank').value = cv.bank || '';
        $('bapNoRek').value = cv.noRek || '';
        const lengkap = cv.alamat && cv.alamat !== '-';
        info.className = 'text-[10px] mt-1 ' + (lengkap ? 'text-emerald-600' : 'text-amber-600');
        info.textContent = lengkap ? 'Data penyedia terisi otomatis dan boleh diperbarui.' : 'Alamat penyedia belum ada. Mohon lengkapi.';
    }
    function setCvTerpilih(nama) {
        const sel = $('bapPilihCv');
        if (Array.from(sel.options).some(o => o.value === nama)) { sel.value = nama; pilihCvBerubah(); }
        else { sel.value = CV_BARU; pilihCvBerubah(); $('bapPelaksanaCv').value = nama; }
    }

    function skemaTerpilih() { const r = document.querySelector('input[name="bapSkema"]:checked'); return r ? r.value : 'RETENSI'; }
    function perbaruiPlaceholderPernyataan() {
        const tahap = v('bapTahap'), t = KONFIG_TAHAP[tahap];
        if (!t || !t.pernyataan) return;
        if (tahap === '100 JASA') {
            $('bapPernyataan').placeholder = 'Cth: Laporan Akhir Pengawasan Pembangunan ... (ketik keterangan dokumen sesuai BAST)';
        } else {
            $('bapPernyataan').placeholder = 'Kalimat standar: ' + pernyataanDefault(tahap, v('bapUraian'));
        }
    }

    // Bagian formulir yang tampil mengikuti tahap (dan skema jaminan) terpilih
    function aturBagianForm() {
        const tahap = $('bapTahap').value, t = KONFIG_TAHAP[tahap], skema = skemaTerpilih();
        const jamTampil = !!t && (t.jaminan === 'WAJIB' || t.jaminan === 'OPSIONAL' || (t.jaminan === 'SKEMA' && skema === 'JAMINAN'));
        const jamWajib = !!t && (t.jaminan === 'WAJIB' || (t.jaminan === 'SKEMA' && skema === 'JAMINAN'));
        const wajibDokBast = tahap === '100 JASA';
        tampil('boxPersen', !!t && t.persenBebas);
        tampil('boxSkema', !!t && t.retensi);
        tampil('secJaminan', jamTampil);
        tampil('secBast', !!t && !!t.bast);
        tampil('boxPernyataan', !!t && t.pernyataan);
        tampil('panelHitung', !!t);
        if (t && t.labelJaminan) $('lblJaminan').textContent = t.labelJaminan + (jamWajib ? ' (wajib)' : ' (isi bila dipersyaratkan)');
        if (t && t.bast) $('lblBast').textContent = t.bast;
        if ($('lblPernyataan')) {
            $('lblPernyataan').textContent = wajibDokBast ? 'Keterangan Dokumen Hasil Pekerjaan (sesuai BAST)' : 'Pernyataan (opsional)';
            tampil('reqPernyataan', wajibDokBast);
            $('hintPernyataan').innerHTML = wajibDokBast
                ? 'Akan dicetak sebagai: <i>"Yang Menyatakan bahwa Pihak Kedua Telah Menyerahkan Hasil Pekerjaan sesuai dengan Dokumen <b>[isian Anda]</b>"</i>'
                : 'Lanjutan kalimat <i>"Yang menyatakan bahwa ..."</i> (kosongkan untuk memakai kalimat standar template).';
        }
        ['bapJamPenjamin', 'bapJamNo', 'bapJamTgl', 'bapJamNilai', 'bapJamBerlakuMulai', 'bapJamBerlakuAkhir'].forEach(id => { $(id).required = jamWajib; });
        ['bapBastTgl', 'bapBastNo'].forEach(id => { $(id).required = !!(t && t.bast); });
        $('bapPernyataan').required = wajibDokBast;
        $('bapPersen').required = !!(t && t.persenBebas);
        if (t && t.persenBebas && !v('bapPersen')) $('bapPersen').value = t.persenDef;
        perbaruiPlaceholderPernyataan();
        hitungLive();
    }
    // BAP lain pada kontrak yang sama, dipisah: lebih dulu tersimpan (earlier) & lanjutan (later). Saat edit, BAP sendiri tidak dihitung.
    function kerabat(noKontrak) {
        const all = daftar(), key = String(noKontrak || '').trim();
        const idxSendiri = editKode ? all.findIndex(x => x.kodeSpj === editKode) : all.length;
        const lain = [], earlier = [], later = [];
        all.forEach((x, i) => {
            if (i === idxSendiri || !key || String(x.noKontrak).trim() !== key) return;
            lain.push(x); (i < idxSendiri ? earlier : later).push(x);
        });
        return { lain, earlier, later };
    }

    // Kumpulkan angka dari formulir -> hitungan pratinjau (aturan sama dengan server)
    function konteksForm() {
        const tahap = v('bapTahap'), t = KONFIG_TAHAP[tahap];
        if (!t) return null;
        const kr = kerabat(v('bapNoKontrak'));
        const nilaiKontrak = Math.round(Number(v('bapNilaiKontrak')) || 0);
        const addNilai = Math.round(Number(v('bapAddNilai')) || 0);
        const aktif = addNilai > 0 ? addNilai : nilaiKontrak;
        const persen = t.persenBebas ? (Number(v('bapPersen')) || 0) : 100;
        const skema = t.retensi ? skemaTerpilih() : '';
        const bruto = Math.round(aktif * persen / 100);
        const retensi = (t.retensi && skema === 'RETENSI') ? Math.round(bruto * BAP_CONFIG.retensiPersen) : 0;
        const rowUm = t.pengUmDari ? kr.earlier.find(x => String(x.tahapBayar).trim() === t.pengUmDari) : null;
        const pengUm = rowUm ? Math.round(rowUm.pembayaranBapIni) : 0;
        const sebelum = kr.earlier.reduce((a, x) => a + Math.round(Number(x.pembayaranBapIni) || 0), 0);
        const sesudah = kr.later.reduce((a, x) => a + Math.round(Number(x.pembayaranBapIni) || 0), 0);
        const hit = hitungInti({ aktif, bruto, retensi, pengUm, sebelum, tarif: tarifPphTahap(t) });
        return { tahap, t, kr, aktif, persen, skema, bruto, retensi, rowUm, pengUm, sebelum, sesudah, hit, dak: Math.max(0, Math.round(Number(v('bapDak')) || 0)) };
    }

    function hitungLive() {
        const panel = $('panelHitung');
        if (!panel) return;
        const c = konteksForm();
        if (!c) { panel.innerHTML = ''; return; }
        const { t, hit } = c;
        const pesan = [];
        if (c.tahap === 'I (100)' && !c.rowUm) pesan.push('BAP tahap <b>UM</b> untuk nomor kontrak ini belum ada. Input BAP UM dulu, atau pilih tahap <b>100</b> bila tanpa uang muka.');
        if (c.tahap === '100' && c.kr.lain.some(x => String(x.tahapBayar).trim() === 'UM')) pesan.push('Kontrak ini sudah mengambil Uang Muka. Gunakan tahap <b>I (100)</b>.');
        if (t.persenBebas && c.kr.earlier.length) pesan.push('Uang muka harus menjadi BAP pertama pada kontrak; kontrak ini sudah memiliki BAP sebelumnya.');
        if (t.persenBebas && c.persen > 30) pesan.push('Persentase uang muka di atas 30% — pastikan diatur dalam kontrak.');
        if (c.aktif > 0 && c.sebelum + hit.bayarIni + c.sesudah > c.aktif) pesan.push('Total pembayaran kontrak melebihi nilai kontrak.');
        if (c.aktif > 0 && !(hit.bayarIni > 0)) pesan.push('Pembayaran BAP ini nol atau negatif.');
        if (c.dak > hit.bayarIni) pesan.push('DAK melebihi pembayaran BAP ini.');
        if (editKode && c.kr.later.length) pesan.push('Ada BAP lanjutan pada kontrak ini: pembayaran BAP ini tidak boleh berubah (server akan menolak).');

        const baris = (lab, val, tebal, kls) => `<tr class="${kls || ''}"><td class="py-0.5 pr-3 ${tebal ? 'font-bold' : ''}">${lab}</td><td class="py-0.5 text-right font-mono ${tebal ? 'font-bold' : ''}">${val}</td></tr>`;
        let h = `<div class="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2"><i class="fa-solid fa-calculator me-1"></i>Pratinjau hitungan <span class="font-normal normal-case">(dihitung ulang di server saat disimpan)</span></div>
            <table class="w-full text-xs">
            ${baris(`${persenId(c.persen)}% × Nilai Kontrak Aktif (${rpTeks(c.aktif)})`, rpTeks(hit.bruto), true)}
            ${t.retensi ? baris(`Potongan Retensi 5%${c.skema === 'JAMINAN' ? ' <span class="text-slate-400">(diganti Jaminan Pemeliharaan)</span>' : ''}`, rpTeks(hit.retensi)) : ''}
            ${t.pengUmDari ? baris(`Pengembalian ${t.pengUmDari}${c.rowUm ? '' : ' <span class="text-red-500">(belum ada)</span>'}`, rpTeks(hit.pengUm)) : ''}
            ${baris('Jumlah Potongan', rpTeks(hit.potongan))}
            ${baris('Pembayaran BAP ini (termasuk PPN / bruto)', rpTeks(hit.bayarIni), true, 'border-t border-slate-300')}
            ${baris('DAK / DAU', `${rpTeks(c.dak)} / ${rpTeks(hit.bayarIni - c.dak)}`)}
            ${baris('DPP (Nilai Fisik) = Pembayaran ÷ 1,11', rpTeks(hit.dpp))}
            ${baris('PPN 11%', rpTeks(hit.ppn))}
            ${baris(`${labelPphTahap(t)} ${persenId(tarifPphTahap(t) * 100)}% × DPP`, rpTeks(hit.pph))}
            ${baris('Nilai Bersih Transfer', rpTeks(hit.bersih), true, 'border-t border-slate-300 text-emerald-700')}
            ${baris('Pembayaran s.d BAP yang lalu', rpTeks(c.sebelum))}
            ${baris('Sisa Nilai Kontrak setelah BAP ini', rpTeks(hit.rekap[4].jumlah))}
            </table>`;
        if (pesan.length) h += `<div class="mt-2 bg-amber-50 border border-amber-200 text-amber-800 rounded p-2 text-[11px] space-y-1">${pesan.map(p => `<div><i class="fa-solid fa-triangle-exclamation me-1"></i>${p}</div>`).join('')}</div>`;
        panel.innerHTML = h;

        // Nilai jaminan terisi otomatis (tetap bisa diubah): Jaminan UM = nilai UM; Jaminan Pemeliharaan = 5% bruto
        const jn = $('bapJamNilai');
        const perluJam = t.jaminan === 'WAJIB' || (t.jaminan === 'SKEMA' && c.skema === 'JAMINAN');
        if (jn && perluJam && (!jn.value || jn.dataset.otomatis === '1')) {
            const saran = t.jaminan === 'SKEMA' ? Math.round(hit.bruto * BAP_CONFIG.retensiPersen) : hit.bruto;
            if (saran > 0) { jn.value = saran; jn.dataset.otomatis = '1'; }
        }
    }

    // Pratinjau nomor BAP; nomor yang sah dibuat server saat disimpan (aman dari nomor kembar). Saat edit, nomor lama dipertahankan.
    function generateNomor() {
        if (editKode) return;
        const tgl = pecahTgl(v('bapTglBap'));
        const tahun = tgl ? tgl.y : new Date().getFullYear();
        let maks = 0;
        daftar().forEach(k => {
            const m = String(k.noBap || '').match(/^B\/BAP-LS\/(\d+)\/409\.13\.1\/(\d{4})$/);
            if (m && parseInt(m[2], 10) === tahun) maks = Math.max(maks, parseInt(m[1], 10));
        });
        $('bapNoBap').value = `B/BAP-LS/${String(maks + 1).padStart(5, '0')}/409.13.1/${tahun}`;
    }

    // Nomor kontrak sudah pernah dipakai -> data kontrak, mata anggaran & penyedia terisi otomatis dari BAP sebelumnya (mode input baru)
    function cekKontrakOtomatis() {
        const info = $('infoKontrak');
        const riw = kerabat(v('bapNoKontrak')).lain;
        if (!riw.length) { tampil('infoKontrak', false); hitungLive(); return; }
        if (editKode) { hitungLive(); return; }
        const ref = riw[0];
        const terakhirAdd = riw.filter(x => x.addNo && x.addNo !== '-').pop();
        $('bapTglKontrak').value = ref.tglKontrak || '';
        $('bapNilaiKontrak').value = ref.nilaiKontrak || '';
        if ($('bapKodeBerkas') && !v('bapKodeBerkas')) $('bapKodeBerkas').value = ref.kodeBerkas || '';
        if (terakhirAdd) {
            $('bapAddNo').value = terakhirAdd.addNo; $('bapAddTgl').value = terakhirAdd.addTgl || ''; $('bapAddNilai').value = terakhirAdd.addNilai || '';
            $('detAddendum').open = true;
        }
        if (!v('bapUraian')) $('bapUraian').value = ref.uraian || '';
        pilihAnggaran(ref.program, ref.kegiatan, ref.subKegiatan);
        setCvTerpilih(String(ref.pelaksana || '').trim());
        info.innerHTML = `<i class="fa-solid fa-circle-info me-1"></i>Kontrak sudah terdaftar (BAP sebelumnya: <b>${riw.map(x => e(x.tahapBayar)).join(', ')}</b>). Data kontrak, anggaran, dan penyedia terisi otomatis; pembayaran sebelumnya dihitung otomatis.`;
        tampil('infoKontrak', true);
        hitungLive();
    }

    // ---------- Mode edit ----------
    function mulaiEdit(kode) {
        const k = cariKontrak(kode);
        if (!k) { alert('Data BAP tidak ditemukan. Muat ulang halaman.'); return; }
        if (!bolehEdit(k)) { alert('Anda tidak memiliki hak mengedit BAP ini.'); return; }
        if (!KONFIG_TAHAP[k.tahapBayar]) { alert('Tahap "' + k.tahapBayar + '" tidak dikenali, BAP tidak dapat diedit.'); return; }
        tampilkanTab(true); if (typeof setJenisTampilan === 'function') setJenisTampilan('BAP');
        tutupPreview();
        $('formBap').reset();
        isiDropdownProgram(); $('bapKegiatan').innerHTML = OPT_KEG; $('bapSubKegiatan').innerHTML = OPT_SUB; isiDropdownCv(false);
        editKode = k.kodeSpj;
        isiPicker(false);
        $('bapTahap').value = k.tahapBayar; $('bapTahap').disabled = true;   // tahap tidak dapat diubah saat edit
        const t = KONFIG_TAHAP[k.tahapBayar];
        const skema = k.skemaRetensi || (k.jamPenjamin ? 'JAMINAN' : 'RETENSI');
        if (t.retensi) { const rb = document.querySelector(`input[name="bapSkema"][value="${skema}"]`); if (rb) rb.checked = true; }
        aturBagianForm();
        pilihAnggaran(k.program, k.kegiatan, k.subKegiatan);
        $('bapUraian').value = k.uraian || '';
        $('bapNoKontrak').value = k.noKontrak || ''; $('bapTglKontrak').value = k.tglKontrak || ''; $('bapNilaiKontrak').value = k.nilaiKontrak || '';
        if ($('bapKodeBerkas')) $('bapKodeBerkas').value = k.kodeBerkas || '';
        $('bapAddNo').value = (k.addNo && k.addNo !== '-') ? k.addNo : ''; $('bapAddTgl').value = k.addTgl || ''; $('bapAddNilai').value = k.addNilai || '';
        $('detAddendum').open = !!(k.addNo && k.addNo !== '-');
        $('bapTglBap').value = k.tglBap || ''; $('bapNoBap').value = k.noBap || '';
        if (t.persenBebas) $('bapPersen').value = k.persenBayar || t.persenDef;
        $('bapDak').value = Number(k.dak) > 0 ? k.dak : '';
        $('bapJamPenjamin').value = k.jamPenjamin || ''; $('bapJamNo').value = k.jamNo || ''; $('bapJamTgl').value = k.jamTgl || '';
        $('bapJamNilai').value = Number(k.jamNilai) > 0 ? k.jamNilai : ''; $('bapJamNilai').dataset.otomatis = '';
        $('bapJamBerlakuMulai').value = k.jamBerlaku || ''; $('bapJamBerlakuAkhir').value = k.jamBerlakuAkhir || '';
        $('bapBastTgl').value = k.bastTgl || ''; $('bapBastNo').value = k.bastNo || ''; $('bapPernyataan').value = k.pernyataan || '';
        setCvTerpilih(String(k.pelaksana || '').trim());
        tampil('infoKontrak', false);
        $('bannerEditNomor').textContent = `${k.noBap} · ${k.tahapBayar} · ${k.noKontrak}`;
        tampil('bannerEditBap', true);
        $('judulFormBap').textContent = 'Edit Data BAP LS';
        $('subJudulFormBap').textContent = 'Nomor BAP tetap. Seluruh nominal dihitung ulang oleh server saat disimpan.';
        $('btnSubmitBap').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan Perubahan';
        hitungLive();
        openModal('modalFormBap');
        $('modalFormBap').scrollTop = 0;
    }

    // ---------- Simpan (baru / perubahan) ----------
    function simpan(ev) {
        ev.preventDefault();
        if (!bolehInput()) { alert('Peran Anda tidak memiliki hak menyimpan BAP.'); return; }
        const c = konteksForm();
        if (!c) { alert('Pilih tahap pembayaran terlebih dahulu.'); return; }
        const { t, hit } = c;
        const namaCv = namaCvTerpilih();
        if (!namaCv) { alert('Pilih penyedia / CV, atau isi nama penyedia baru.'); return; }
        const nilaiKontrak = Number(v('bapNilaiKontrak'));
        if (!(nilaiKontrak > 0)) { alert('Nilai kontrak harus lebih dari 0.'); return; }
        if (t.persenBebas && !(c.persen > 0 && c.persen < 100)) { alert('Persentase uang muka harus lebih dari 0 dan kurang dari 100%.'); return; }
        if (c.tahap === 'I (100)' && !c.rowUm) { alert('Tahap I (100) mensyaratkan BAP tahap UM pada kontrak yang sama.\nInput BAP UM dulu, atau pilih tahap 100 bila tanpa uang muka.'); return; }
        if (c.tahap === '100' && c.kr.lain.some(x => String(x.tahapBayar).trim() === 'UM')) { alert('Kontrak ini sudah mengambil Uang Muka. Gunakan tahap I (100).'); return; }
        if (!(hit.bayarIni > 0)) { alert('Pembayaran BAP ini nol atau negatif. Periksa isian.'); return; }
        const totalKontrak = c.sebelum + hit.bayarIni + c.sesudah;
        if (totalKontrak > c.aktif) { alert('Total pembayaran kontrak (' + rpTeks(totalKontrak) + ') melebihi nilai kontrak (' + rpTeks(c.aktif) + ').'); return; }
        if (c.dak > hit.bayarIni) { alert('Sumber dana DAK tidak boleh melebihi pembayaran BAP ini.'); return; }
        if (!/^[0-9]{5,30}$/.test(v('bapNoRek'))) { alert('No. rekening harus berupa angka (5-30 digit).'); return; }

        const addIsi = [v('bapAddNo'), v('bapAddTgl'), Number(v('bapAddNilai')) > 0 ? '1' : ''];
        if (addIsi.some(Boolean) && !addIsi.every(Boolean)) { alert('Data addendum harus lengkap (nomor, tanggal, nilai) atau dikosongkan semua.'); return; }

        const jamIsi = ['bapJamPenjamin', 'bapJamNo', 'bapJamTgl', 'bapJamBerlakuMulai', 'bapJamBerlakuAkhir'].map(v).concat([Number(v('bapJamNilai')) > 0 ? '1' : '']);
        const jamWajib = t.jaminan === 'WAJIB' || (t.jaminan === 'SKEMA' && c.skema === 'JAMINAN');
        const jamPakai = jamWajib || t.jaminan === 'OPSIONAL';
        if (jamPakai && (jamWajib || jamIsi.some(Boolean)) && !jamIsi.every(Boolean)) { alert('Data ' + t.labelJaminan + ' harus lengkap (penjamin, nomor, tanggal, nilai, berlaku mulai, berlaku sampai).'); return; }
        if (jamPakai && v('bapJamBerlakuMulai') && v('bapJamBerlakuAkhir') && v('bapJamBerlakuAkhir') < v('bapJamBerlakuMulai')) { alert('Tanggal "Berlaku Sampai" tidak boleh lebih awal dari "Berlaku Mulai".'); return; }

        const edit = !!editKode;
        if (!confirm(`${edit ? 'Simpan PERUBAHAN BAP' : 'Simpan BAP'} ${c.tahap}?\n\nBruto: ${rpTeks(hit.bruto)}\nPotongan: ${rpTeks(hit.potongan)}\nPembayaran BAP ini: ${rpTeks(hit.bayarIni)}\nNilai bersih transfer: ${rpTeks(hit.bersih)}`)) return;

        const btn = $('btnSubmitBap'), labelAwal = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Menyimpan...'; btn.disabled = true;

        // Hanya isian dasar yang dikirim; server menghitung ulang seluruh angka. Bagian yang tidak dipakai tahap ini dikirim kosong.
        const payload = {
            action: edit ? 'update_bap' : 'create_bap',
            kodeSpj: edit ? editKode : '',
            pptk: (sesiAktif.role === 'PPTK' || edit) ? '' : v('bapPptk'),
            program: v('bapProgram'), kegiatan: v('bapKegiatan'), subKegiatan: v('bapSubKegiatan'), uraian: v('bapUraian'),
            noKontrak: v('bapNoKontrak'), tglKontrak: v('bapTglKontrak'), nilaiKontrak, kodeBerkas: v('bapKodeBerkas'),
            tahapBayar: c.tahap, persen: t.persenBebas ? c.persen : 100, skemaRetensi: c.skema,
            tglBap: v('bapTglBap'), dak: c.dak,
            addNo: v('bapAddNo'), addTgl: v('bapAddTgl'), addNilai: Number(v('bapAddNilai')) || 0,
            jamPenjamin: jamPakai ? v('bapJamPenjamin') : '', jamNo: jamPakai ? v('bapJamNo') : '', jamNilai: jamPakai ? Number(v('bapJamNilai')) || 0 : 0,
            jamTgl: jamPakai ? v('bapJamTgl') : '',
            jamBerlakuMulai: jamPakai ? v('bapJamBerlakuMulai') : '', jamBerlakuAkhir: jamPakai ? v('bapJamBerlakuAkhir') : '',
            bastTgl: t.bast ? v('bapBastTgl') : '', bastNo: t.bast ? v('bapBastNo') : '',
            pernyataan: t.pernyataan ? v('bapPernyataan') : '',
            pelaksanaCv: namaCv, direktur: v('bapDirektur'), jabatan: v('bapJabatan'), npwp: v('bapNpwp'),
            alamatCv: v('bapAlamatCv'), bank: v('bapBank'), noRek: v('bapNoRek')
        };

        apiPost(payload)
            .then(res => {
                if (res.status !== 'success') { alert('Gagal Menyimpan: ' + res.message); return; }
                terapkanHasil(res);            // tabel riwayat langsung menampilkan data terbaru
                closeModal('modalFormBap');    // modal tertutup otomatis
                resetForm();
                showToast(res.mode === 'update' ? 'Perubahan BAP tersimpan.' : 'BAP tersimpan: ' + res.noBap);
                tarikDataDariServer();         // selaraskan seluruh state dengan server
            })
            .catch(err => { if (String(err.message) !== 'Sesi berakhir') alert('Koneksi Terputus: ' + err.message + '\nPeriksa tabel Riwayat sebelum mencoba lagi agar tidak terjadi data ganda.'); })
            .finally(() => { btn.disabled = false; if (btn.innerHTML.indexOf('fa-spinner') > -1) btn.innerHTML = labelAwal; });
    }

    // Masukkan hasil server ke state lokal agar tabel & preview langsung benar (sebelum load ulang selesai)
    function terapkanHasil(res) {
        if (res.kontrak) {
            const arr = window.DATABASE_KONTRAK = window.DATABASE_KONTRAK || [];
            const i = arr.findIndex(x => x.kodeSpj === res.kontrak.kodeSpj);
            if (i > -1) arr[i] = res.kontrak; else arr.push(res.kontrak);
            hapusCachePdf(res.kontrak.kodeSpj);
        }
        if (res.penyedia) {
            const arr = window.DATABASE_PENYEDIA = window.DATABASE_PENYEDIA || [];
            const key = String(res.penyedia.pelaksana).trim().toUpperCase();
            const i = arr.findIndex(c => String(c.pelaksana).trim().toUpperCase() === key);
            if (i > -1) arr[i] = res.penyedia; else arr.push(res.penyedia);
        }
        renderTabel();
    }

    // ---------- Hapus (khusus SUPER_ADMIN; server memvalidasi ulang) ----------
    function hapus(kode, btn) {
        if (!adalahAdmin()) return;   // tombol memang tidak dirender untuk peran lain
        const k = cariKontrak(kode);
        if (!k) { alert('Data BAP tidak ditemukan. Muat ulang halaman.'); return; }
        const pesan = 'HAPUS PERMANEN data BAP ini?\n\n' +
            'No. BAP        : ' + (k.noBap || '-') + '\n' +
            'No. Kontrak    : ' + (k.noKontrak || '-') + '  (tahap ' + (k.tahapBayar || '-') + ')\n' +
            'Penyedia       : ' + (k.pelaksana || '-') + '\n' +
            'Uraian         : ' + String(k.uraian || '-').slice(0, 120) + '\n' +
            'Sub Kegiatan   : ' + (k.subKegiatan || '-') + '\n' +
            'Pembayaran     : ' + rpTeks(k.pembayaranBapIni) + '\n\n' +
            'Baris di Spreadsheet ikut terhapus dan tidak dapat dikembalikan.';
        if (!confirm(pesan)) return;
        const awal = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }
        apiPost({ action: 'delete_bap', kodeSpj: k.kodeSpj, noBap: k.noBap })
            .then(res => {
                if (res.status !== 'success') { alert('Gagal menghapus: ' + res.message); if (btn) { btn.disabled = false; btn.innerHTML = awal; } return; }
                window.DATABASE_KONTRAK = daftar().filter(x => x.kodeSpj !== k.kodeSpj);   // buang dari cache memori
                hapusCachePdf(k.kodeSpj);
                if (editKode === k.kodeSpj) resetForm();
                renderTabel();
                showToast('BAP ' + k.noBap + ' dihapus.');
                tarikDataDariServer();                                                    // muat ulang: tidak ada data sisa
            })
            .catch(err => { if (String(err.message) !== 'Sesi berakhir') alert('Koneksi terputus: ' + err.message); if (btn) { btn.disabled = false; btn.innerHTML = awal; } });
    }

   // ========================================================================
    // PREVIEW & CETAK: PDF A4 dibuat SERVER dari tab template pada Google Spreadsheet (aksi pdf_bap).
    // Tidak ada HTML/CSS dokumen di sini: yang tampil di <iframe> adalah file PDF yang sama dengan hasil cetak.
    // ========================================================================
    let pdfUrl = '', pdfNama = '', seqPreview = 0;
    const cachePdfBap = {};

    function hapusCachePdf(kode) {
        if (kode && cachePdfBap[kode]) {
            URL.revokeObjectURL(cachePdfBap[kode].url);
            delete cachePdfBap[kode];
        }
    }
    function setStatusPdf(mode, pesan) {   // 'loading' | 'error' | 'ok'
        tampil('statusPdfLoading', mode === 'loading');
        tampil('statusPdfError', mode === 'error');
        tampil('areaFramePdf', mode === 'ok');
        $('pesanPdfError').textContent = pesan || '';
        ['btnDownloadPdfBap', 'btnCetakPdfBap'].forEach(id => { $(id).disabled = mode !== 'ok'; });
    }
    function bersihkanPdf() {
        $('frameBapPdf').src = 'about:blank';
        pdfUrl = ''; pdfNama = '';
    }
    function isiBannerPajak(p) {
        $('pjBayar').textContent = rpTeks(p.pembayaranBapIni);
        $('pjDpp').textContent = rpTeks(p.dpp);
        $('pjPpn').textContent = rpTeks(p.ppn);
        $('pjPphLabel').textContent = `${p.jenisPph || 'PPh'} ${persenId((Number(p.tarifPph) || 0) * 100)}%`;
        $('pjPph').textContent = rpTeks(p.nilaiPph);
        $('pjBersih').textContent = rpTeks(p.nilaiBersih);
        tampil('bannerPajakBap', true);
    }
    function tampilkanHasilPdf(item) {
        isiBannerPajak(item.pajak || {});
        pdfUrl = item.url;
        pdfNama = item.nama;
        $('frameBapPdf').src = pdfUrl;
        setStatusPdf('ok');
        if ((item.peringatan || []).length) {
            $('pesanPeringatanPdf').textContent = item.peringatan.length + ' sel template tidak terisi (posisi sel berbeda dari peta). Periksa dokumen, lalu beri tahu Super Admin (rincian di LOG_SISTEM).';
            tampil('pesanPeringatanPdf', true);
        }
    }

    function preview(kode) {
        const k = cariKontrak(kode);
        if (!k) { alert('Data BAP tidak ditemukan. Muat ulang halaman.'); return; }
        if (!KONFIG_TAHAP[k.tahapBayar]) { alert('Tahap pembayaran "' + k.tahapBayar + '" belum memiliki tab template.'); return; }
        previewKode = k.kodeSpj;
        const urut = ++seqPreview;
        bersihkanPdf();
        tampil('bannerPajakBap', false); tampil('pesanPeringatanPdf', false);
        $('judulPreviewBap').textContent = `${k.noBap} · ${k.tahapBayar}`;
        tampil('btnEditDariPreview', bolehEdit(k));
        openModal('modalPreviewBap');

        if (cachePdfBap[k.kodeSpj]) {
            tampilkanHasilPdf(cachePdfBap[k.kodeSpj]);
            return;
        }

        setStatusPdf('loading');
        apiPost({ action: 'pdf_bap', kodeSpj: k.kodeSpj })
            .then(res => {
                if (urut !== seqPreview) return;
                if (res.status !== 'success') { setStatusPdf('error', res.message); return; }
                const bytes = Uint8Array.from(atob(res.pdfBase64), ch => ch.charCodeAt(0));
                hapusCachePdf(k.kodeSpj);
                const item = {
                    url: URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })),
                    nama: res.namaFile || 'BAP.pdf',
                    pajak: res.pajak || {},
                    peringatan: res.peringatan || []
                };
                cachePdfBap[k.kodeSpj] = item;
                tampilkanHasilPdf(item);
            })
            .catch(err => {
                if (urut !== seqPreview || String(err.message) === 'Sesi berakhir') return;
                setStatusPdf('error', 'Koneksi terputus: ' + err.message);
            });
    }
    function ulangiPreview() { if (previewKode) { hapusCachePdf(previewKode); preview(previewKode); } }
    function tutupPreview() { seqPreview++; bersihkanPdf(); previewKode = ''; closeModal('modalPreviewBap'); }
    function editDariPreview() { if (previewKode) mulaiEdit(previewKode); }

    function unduhPdf() {
        if (!pdfUrl) return;
        const a = document.createElement('a');
        a.href = pdfUrl; a.download = pdfNama || 'BAP.pdf';
        document.body.appendChild(a); a.click(); a.remove();
    }
    // Cetak langsung: mencetak file PDF di <iframe>; bila browser tidak mengizinkan, PDF dibuka di tab baru untuk dicetak dari sana
    function cetakLangsung() {
        if (!pdfUrl) return;
        const f = $('frameBapPdf');
        try { f.contentWindow.focus(); f.contentWindow.print(); }
        catch (err) { window.open(pdfUrl, '_blank'); }
    }

    return {
        init, setelahLoad, tampilkanTab, renderTabel,
        bukaForm, tutupForm, aturBagianForm, updateKegiatan, updateSubkegiatan, pilihCvBerubah, generateNomor, simpan,
        preview, ulangiPreview, tutupPreview, editDariPreview, unduhPdf, cetakLangsung, mulaiEdit, hapus,
        _uji: { hitungInti }   // dipakai pengujian
    };
})();

