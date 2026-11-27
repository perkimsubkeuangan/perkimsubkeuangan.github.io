// ========================================================
// FILE 2/3: spj.js  (Modul SPJ GU/LS, Verifikasi, Cetak Antrean, Upload Berkas & Hapus SPJ)
// Dimuat setelah config.js dan app.js pada index.html.
// ========================================================

// PPTK hanya boleh mengajukan atas namanya sendiri (server juga memaksa hal yang sama)
function kunciPptkLogin() {
    const sel = document.getElementById('inputPptk'); if (!sel) return;
    if (sesiAktif.role === 'PPTK') { setSelectValue(sel, sesiAktif.namaLengkap); sel.style.pointerEvents = 'none'; sel.tabIndex = -1; sel.classList.add('bg-slate-100'); }
    else { sel.style.pointerEvents = 'auto'; sel.tabIndex = 0; sel.classList.remove('bg-slate-100'); }
}

function isiDropdownPptkUtama() {
    const selectPptk = document.getElementById('inputPptk');
    if(selectPptk && window.DATABASE_AKUN) {
        selectPptk.innerHTML = '<option value="" disabled selected>-- Pilih Nama PPTK --</option>';
        window.DATABASE_AKUN.forEach(user => {
            if(user.role === 'PPTK' && String(user.status || 'AKTIF').toUpperCase() !== 'NONAKTIF') {
                selectPptk.innerHTML += `<option value="${escapeHtml(user.namaLengkap)}">${escapeHtml(user.namaLengkap)}</option>`;
            }
        });
    }
}

// Auto-fill Unit Kerja, Email, dan No. WA dari profil akun PPTK terpilih (hanya saat pengajuan baru)
function autoFillKontakPptk() {
    if (isEditMode) return;
    const selPptk = document.getElementById('inputPptk');
    const nama = selPptk ? String(selPptk.value || '').trim() : '';
    let profil = (window.DATABASE_AKUN || []).find(a => a.role === 'PPTK' && String(a.namaLengkap).trim() === nama);
    if (!profil && sesiAktif.role === 'PPTK') profil = sesiAktif;
    if (!profil) return;
    if (profil.unitKerja) setSelectValue(document.getElementById('inputUnitKerja'), profil.unitKerja);
    const elEmail = document.getElementById('inputEmail');
    if (elEmail && profil.email) elEmail.value = profil.email;
    const elWa = document.getElementById('inputWa');
    if (elWa && profil.wa) elWa.value = profil.wa;
}

function isPemilikSpj(item) {
    return !!item && String(item.pptk || '').trim() === String(sesiAktif.namaLengkap || '').trim();
}

function bukaFormSpjBaru(jenisDefault) {
    if (!bisaBuatSpj()) { alert('Peran Anda tidak memiliki hak membuat pengajuan.'); return; }
    isEditMode = false; editIdTarget = null;
    window._defaultJenisSpjBaru = (jenisDefault === 'GU' || jenisDefault === 'LS') ? jenisDefault : '';
    window._defaultKodeBapBaru = '';
    openModal('modalNewSpj');
}

function bukaFormSpjDariBap(kodeBap) {
    if (!bisaBuatSpj()) { alert('Peran Anda tidak memiliki hak membuat pengajuan SPJ.'); return; }
    const k = (window.DATABASE_KONTRAK || []).find(x => String(x.kodeSpj) === String(kodeBap));
    if (!k) { alert('Data BAP tidak ditemukan. Muat ulang halaman.'); return; }
    if (sesiAktif.role === 'PPTK' && String(k.pptk).trim() !== String(sesiAktif.namaLengkap).trim()) {
        alert('Anda hanya dapat mengajukan SPJ dari BAP milik Anda sendiri.');
        return;
    }
    if (bapSudahDiajukan(k)) { alert('BAP ini sudah pernah diajukan SPJ-nya.'); return; }
    isEditMode = false; editIdTarget = null;
    window._defaultJenisSpjBaru = 'LS';
    window._defaultKodeBapBaru = k.kodeSpj;
    openModal('modalNewSpj');
}

function isiDropdownProgram() {
    const progSelect = document.getElementById('inputProgram'); if(!progSelect) return;
    progSelect.innerHTML = '<option value="" disabled selected>-- Pilih Program --</option>';
    for (let prog in referensiData) progSelect.innerHTML += `<option value="${escapeHtml(prog)}">${escapeHtml(prog)}</option>`;
}
function updateKegiatanDropdown() {
    const prog = document.getElementById('inputProgram').value; const kegSelect = document.getElementById('inputKegiatan'); const subSelect = document.getElementById('inputSubkegiatan');
    kegSelect.innerHTML = '<option value="" disabled selected>-- Pilih Kegiatan --</option>'; subSelect.innerHTML = '<option value="" disabled selected>-- Pilih Subkegiatan --</option>';
    if(prog && referensiData[prog]) for (let keg in referensiData[prog]) kegSelect.innerHTML += `<option value="${escapeHtml(keg)}">${escapeHtml(keg)}</option>`;
}
function updateSubkegiatanDropdown() {
    const prog = document.getElementById('inputProgram').value; const keg = document.getElementById('inputKegiatan').value; const subSelect = document.getElementById('inputSubkegiatan');
    subSelect.innerHTML = '<option value="" disabled selected>-- Pilih Subkegiatan --</option>';
    if(prog && keg && referensiData[prog][keg]) referensiData[prog][keg].forEach(sub => subSelect.innerHTML += `<option value="${escapeHtml(sub)}">${escapeHtml(sub)}</option>`);
}

// Satu BAP hanya boleh diajukan SPJ-nya satu kali (server menegakkan aturan yang sama di aksiSimpanSpjBaru_).
// Baris baru menyimpan kodeBap; baris lama tanpa kodeBap dicocokkan lewat No. Kontrak + Tahap.
function bapSudahDiajukan(k) {
    return (spjData || []).some(x => String(x.jenisSurat) === 'LS' && (x.kodeBap
        ? String(x.kodeBap) === String(k.kodeSpj)
        : String(x.npd) === String(k.noKontrak) && String(x.tahap) === String(k.tahapBayar)));
}

function ubahLabelNpdKontrak() {
    const jenis = document.getElementById('inputJenisSurat').value;
    const boxBap = document.getElementById('box-pilih-bap');
    const inputPilihBap = document.getElementById('inputPilihBap');
    const inputTeks = ['inputNpd', 'inputUraian', 'inputNominal'].map(id => document.getElementById(id));
    const selectAnggaran = ['inputProgram', 'inputKegiatan', 'inputSubkegiatan'].map(id => document.getElementById(id));

    if (jenis === 'LS') {
        document.getElementById('label-npd-kontrak').innerText = 'Nomor Kontrak / SPK';
        const lblNom = document.getElementById('label-nominal'); if (lblNom) lblNom.innerText = 'Pembayaran BAP Ini (Rp, termasuk PPN)';
        document.getElementById('box-cv').classList.remove('hidden');
        document.getElementById('box-tahap').classList.remove('hidden');

        // Data LS diambil dari BAP -> kolom dikunci; saat mode edit, kotak pilih BAP disembunyikan
        if (boxBap) boxBap.classList.toggle('hidden', isEditMode);
        inputTeks.forEach(el => { if (el) { el.readOnly = true; el.classList.add('bg-slate-100'); } });
        selectAnggaran.forEach(el => { if (el) { el.style.pointerEvents = 'none'; el.tabIndex = -1; el.classList.add('bg-slate-100'); } });
        const elCvLs = document.getElementById('inputCv'), elTahapLs = document.getElementById('inputTahap');
        if (elCvLs) { elCvLs.readOnly = true; elCvLs.classList.add('bg-slate-100'); }
        if (elTahapLs) { elTahapLs.style.pointerEvents = 'none'; elTahapLs.tabIndex = -1; elTahapLs.classList.add('bg-slate-100'); }

        if (inputPilihBap) {
            inputPilihBap.required = !isEditMode;
            // PPTK hanya melihat BAP miliknya; peran lain melihat semua. BAP yang SPJ-nya sudah diajukan tidak ditawarkan lagi.
            const daftar = (window.DATABASE_KONTRAK || []).filter(k =>
                (sesiAktif.role !== 'PPTK' || String(k.pptk).trim() === String(sesiAktif.namaLengkap).trim()) &&
                (isEditMode || !bapSudahDiajukan(k)));
            let html = daftar.length
                ? '<option value="" disabled selected>-- Pilih Kontrak BAP Anda --</option>'
                : '<option value="" disabled selected>-- Belum ada BAP yang siap diajukan (isi dulu di Modul BAP LS) --</option>';
            daftar.forEach(k => {
                html += `<option value="${escapeHtml(k.kodeSpj)}">${escapeHtml(k.noKontrak)} - ${escapeHtml(k.pelaksana)} (${escapeHtml(k.tahapBayar)}) - Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(Number(k.pembayaranBapIni) || 0))}</option>`;
            });
            inputPilihBap.innerHTML = html;
        }
    } else {
        document.getElementById('label-npd-kontrak').innerText = 'Nomor NPD';
        const lblNom2 = document.getElementById('label-nominal'); if (lblNom2) lblNom2.innerText = 'Nominal Bruto (Rp)';
        document.getElementById('inputNpd').placeholder = 'Cth: 001/NPD/2026';
        document.getElementById('box-cv').classList.add('hidden');
        document.getElementById('box-tahap').classList.add('hidden');

        if (boxBap) boxBap.classList.add('hidden');
        if (inputPilihBap) inputPilihBap.required = false;
        inputTeks.forEach(el => { if (el) { el.readOnly = false; el.classList.remove('bg-slate-100'); el.value = ""; } });
        selectAnggaran.forEach(el => { if (el) { el.style.pointerEvents = 'auto'; el.tabIndex = 0; el.classList.remove('bg-slate-100'); } });
        const elCvGu = document.getElementById('inputCv'), elTahapGu = document.getElementById('inputTahap');
        if (elCvGu) { elCvGu.readOnly = false; elCvGu.classList.remove('bg-slate-100'); }
        if (elTahapGu) { elTahapGu.style.pointerEvents = 'auto'; elTahapGu.tabIndex = 0; elTahapGu.classList.remove('bg-slate-100'); }

        // Pulihkan dropdown anggaran yang sebelumnya dikunci jadi 1 pilihan oleh autoFillDariBap()
        isiDropdownProgram();
        document.getElementById('inputKegiatan').innerHTML = '<option value="" disabled selected>-- Pilih Kegiatan --</option>';
        document.getElementById('inputSubkegiatan').innerHTML = '<option value="" disabled selected>-- Pilih Subkegiatan --</option>';
    }
}

function autoFillDariBap() {
    const idBap = document.getElementById('inputPilihBap').value;
    const dataBap = (window.DATABASE_KONTRAK || []).find(k => String(k.kodeSpj) === String(idBap));
    if (!dataBap) return;

    document.getElementById('inputNpd').value = dataBap.noKontrak || '';
    document.getElementById('inputUraian').value = dataBap.uraian || '';
    // Nominal SPJ = PEMBAYARAN BAP INI (bruto dikurangi retensi & pengembalian UM), sama dengan yang disimpan server
    document.getElementById('inputNominal').value = dataBap.pembayaranBapIni || '';
    document.getElementById('inputCv').value = dataBap.pelaksana || '';
    setSelectValue(document.getElementById('inputTahap'), dataBap.tahapBayar);

    // Program tidak disimpan di DB_KONTRAK_LS pada data lama -> cari dari tabel referensi
    let program = dataBap.program || '';
    if (!program) {
        for (const prog in referensiData) {
            const subs = referensiData[prog][dataBap.kegiatan];
            if (subs && subs.indexOf(dataBap.subKegiatan) !== -1) { program = prog; break; }
        }
    }
    if (!program) {
        for (const prog in referensiData) { if (referensiData[prog][dataBap.kegiatan]) { program = prog; break; } }
    }

    const satuOpsi = (id, val) => { document.getElementById(id).innerHTML = `<option value="${escapeHtml(val)}" selected>${escapeHtml(val)}</option>`; };
    satuOpsi('inputProgram', program || '-');
    satuOpsi('inputKegiatan', dataBap.kegiatan || '-');
    satuOpsi('inputSubkegiatan', dataBap.subKegiatan || '-');
}

function kirimPengajuanSpjBaru(e) {
    e.preventDefault();
    const cekEm = validasiDaftarEmail(document.getElementById('inputEmail').value, 5);
    if (!cekEm.ok) { alert(cekEm.pesan); return; }
    document.getElementById('inputEmail').value = cekEm.teks;
    const btn = document.getElementById('btnSubmitNew'); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Menyimpan...'; btn.disabled = true;
    
    const rawDate = document.getElementById('inputTanggal').value; 
    let generatedId = "";
    if (!isEditMode) {
        const now = new Date();
        generatedId = `SPJ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`; 
    }
    const idSistem = isEditMode ? editIdTarget : generatedId; 
    const actionType = isEditMode ? 'update_data_teks' : 'create';

    const inputCv = document.getElementById('inputCv');
    const inputTahap = document.getElementById('inputTahap');

    const payload = {
        action: actionType, id: idSistem, createdAt: rawDate,
        kodeBap: (document.getElementById('inputPilihBap') ? document.getElementById('inputPilihBap').value : ''),
        jenisSurat: document.getElementById('inputJenisSurat').value, pptk: document.getElementById('inputPptk').value, emailPptk: document.getElementById('inputEmail').value, 
        unitKerja: document.getElementById('inputUnitKerja').value, npd: document.getElementById('inputNpd').value, 
        program: document.getElementById('inputProgram').value, kegiatan: document.getElementById('inputKegiatan').value, 
        subKegiatan: document.getElementById('inputSubkegiatan').value, nominal: document.getElementById('inputNominal').value, 
        uraian: document.getElementById('inputUraian').value, wa: document.getElementById('inputWa').value,
        namaCv: (document.getElementById('inputJenisSurat').value === 'LS' && inputCv) ? inputCv.value : "",
        tahap: (document.getElementById('inputJenisSurat').value === 'LS' && inputTahap) ? inputTahap.value : "",
        status: 'BELUM_DIPROSES'
    };

    apiPost(payload)
        .then(res => {
            if(res.status === 'success') {
                document.getElementById('formNewSpj').classList.add('hidden'); 
                tarikDataDariServer(); 
                
                // ... [LANJUTAN KODE DIV SUKSES SEPERTI SEMULA] ... 

                if (isEditMode) {
                    const divSukses = document.createElement('div'); divSukses.id = "pesanSuksesDiv"; divSukses.className = "text-center py-6 space-y-4";
                    divSukses.innerHTML = `<div class="text-5xl text-emerald-500 mb-2"><i class="fa-solid fa-circle-check"></i></div><h3 class="text-lg font-bold text-slate-800">Perbaikan Data Berhasil!</h3><button onclick="closeModal('modalNewSpj');" class="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md">Tutup</button>`;
                    document.getElementById('formNewSpj').parentElement.appendChild(divSukses);
                } else {

                    const divSukses = document.createElement('div'); divSukses.id = "pesanSuksesDiv"; divSukses.className = "text-center py-4 space-y-4";
                    
                    if (payload.jenisSurat === 'LS') {
                        const jumlahLSSaatIni = spjData.filter(item => String(item.jenisSurat) === 'LS').length;
                        const noUrut = res.noAntreanLs || ('LS-' + String(jumlahLSSaatIni + 1).padStart(4, '0'));
                        const safeNpd = payload.npd.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                        
                        divSukses.innerHTML = `
                            <div class="text-4xl text-purple-500 mb-2"><i class="fa-solid fa-file-invoice"></i></div><h3 class="text-lg font-bold text-slate-800">Pengajuan LS Berhasil Disimpan!</h3>
                            <div class="bg-purple-50 border border-purple-200 p-4 rounded-lg my-4 text-center mx-auto max-w-sm"><p class="text-xs text-purple-600 font-bold mb-1">NOMOR URUT / ANTREAN LS ANDA</p><h2 class="text-3xl font-black text-purple-800 tracking-widest">${noUrut}</h2></div>
                            ${panelUploadHtml(res.id || idSistem, 'LS')}
                            <button onclick="cetakNomorUrut('${noUrut}', '${safeNpd}', '${payload.createdAt}')" class="text-xs text-slate-500 hover:text-slate-800 underline font-bold transition-colors"><i class="fa-solid fa-print"></i> Unduh / Cetak Bukti Antrean LS</button>
                        `;
                    } else {
                        divSukses.innerHTML = `
                            <div class="text-5xl text-emerald-500 mb-2"><i class="fa-solid fa-circle-check"></i></div><h3 class="text-lg font-bold text-slate-800">Data Pengajuan Berhasil Disimpan!</h3>
                            ${panelUploadHtml(res.id || idSistem, 'GU')}`;
                    }
                    document.getElementById('formNewSpj').parentElement.appendChild(divSukses);
                }
            } else { alert("GAGAL MENYIMPAN!\n" + (res.message || res.pesan || JSON.stringify(res))); }
        })
        .catch(err => alert("KONEKSI TERPUTUS!\nError: " + err.message))
        .finally(() => { 
            btn.innerHTML = 'Lanjut ke Form Upload <i class="fa-solid fa-arrow-right"></i>'; 
            btn.disabled = false; 
        });
}

function cetakNomorUrut(noUrut, npd, tglUpload) {
    const printWindow = window.open('', '_blank', 'width=550,height=750');
    const itemCardHtml = `
        <div class="antrean-card">
            <div class="header-row"><span class="title">TANDA TERIMA ANTREAN LS</span><span class="sub">BUKTI ADMINISTRASI</span></div>
            <div class="section-title">NOMOR ANTREAN</div>
            <div class="number-box">${noUrut}</div>
            <div class="content-wrapper">
                <div class="info-side">
                    <div class="info-group"><div class="section-title">NOMOR KONTRAK</div><div class="info-val">${escapeHtml(npd)}</div></div>
                    <div class="info-group"><div class="section-title">TANGGAL UPLOAD</div><div class="info-val">${escapeHtml(tglUpload)}</div></div>
                </div>
                <div class="sign-side">
                    <table class="para-table">
                        <thead><tr><th colspan="2">DISETUJUI</th></tr><tr><th width="40%">TANGGAL</th><th width="60%">PARAF</th></tr></thead>
                        <tbody><tr><td height="55"></td><td></td></tr></tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    printWindow.document.write(`
        <html><head><title>Bukti Antrean LS</title>
        <style>
            @media print { @page { margin: 15mm; } body { -webkit-print-color-adjust: exact; } .antrean-card { page-break-inside: avoid; } }
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #000; padding: 10px; margin: 0; background: #fff; }
            .antrean-card { border: 2px solid #000; padding: 18px; margin-bottom: 20px; background: #fff; }
            .header-row { display: flex; justify-content: space-between; align-items: baseline; border-b: 2px solid #000; padding-bottom: 6px; margin-bottom: 12px; }
            .title { font-size: 15px; font-weight: 900; letter-spacing: 0.5px; } .sub { font-size: 11px; font-weight: bold; text-transform: uppercase; color: #333; }
            .section-title { font-size: 10px; font-weight: 800; text-transform: uppercase; margin-bottom: 3px; color: #222; }
            .number-box { font-size: 42px; font-weight: 900; text-align: center; border: 2px solid #000; padding: 8px; margin-bottom: 14px; letter-spacing: 2px; }
            .content-wrapper { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 15px; }
            .info-side { flex: 1; padding-right: 20px; } .info-group { margin-bottom: 12px; } .info-val { font-size: 13px; font-weight: bold; word-break: break-word; }
            .sign-side { width: 220px; } .para-table { width: 100%; border-collapse: collapse; }
            .para-table th, .para-table td { border: 1px solid #000; padding: 6px; text-align: center; } .para-table th { font-size: 11px; font-weight: 800; background: #fff; }
            .cut-line { text-align: center; border-bottom: 2px dashed #000; line-height: 0.1em; margin: 30px 0 35px 0; font-size: 11px; font-weight: bold; text-transform: uppercase; } .cut-line span { background: #fff; padding: 0 15px; }
        </style></head><body>
            ${itemCardHtml}
            <div class="cut-line"><span>✂ POTONG DI SINI ✂</span></div>
            ${itemCardHtml}
            <script>setTimeout(function(){ window.print(); }, 400);<\/script>
        </body></html>
    `);
    printWindow.document.close();
}

function getFilteredSpjData() {
    let data = [...spjData];
    if (sesiAktif.role === 'PPTK' && filterPemilikSpj === 'MINE') {
        data = data.filter(item => isPemilikSpj(item));
    }
    if (filterJenis !== 'ALL') {
        data = data.filter(item => String(item.jenisSurat || 'GU') === filterJenis);
    }
    if (filterStatus === 'DISETUJUI_GU') {
        data = data.filter(item => String(item.jenisSurat || 'GU') === 'GU' && item.status === 'DISETUJUI');
    } else if (filterStatus && filterStatus !== 'ALL') {
        data = data.filter(item => String(item.status || '') === filterStatus);
    }
    if (searchQuery) {
        data = data.filter(item => {
            const textToSearch = `${item.npd} ${item.kegiatan} ${item.pptk} ${item.uraian} ${item.namaCv} ${item.tahap}`.toLowerCase();
            return textToSearch.includes(searchQuery);
        });
    }
    data.sort((a, b) => {
        let valA = Number(a.nominal) || 0;
        let valB = Number(b.nominal) || 0;
        let dateA = new Date(a.createdAt);
        let dateB = new Date(b.createdAt);
        if (sortType === 'NOMINAL_DESC') return valB - valA;
        if (sortType === 'NOMINAL_ASC') return valA - valB;
        if (sortType === 'TGL_ASC') return dateA - dateB;
        return dateB - dateA;
    });
    return data;
}

function setFilterStatus(st) {
    filterStatus = (filterStatus === st && st !== 'ALL') ? 'ALL' : (st || 'ALL');
    const sel = document.getElementById('selectStatusSpj');
    if (sel) sel.value = (filterStatus === 'DISETUJUI_GU') ? 'DISETUJUI' : filterStatus;
    currentPage = 1;
    renderTabelSpj();
}

function gantiPageSize() { rowsPerPage = parseInt(document.getElementById('selectPageSize').value); currentPage = 1; renderTabelSpj(); }
function gantiHalaman(arah) {
    const totalPages = Math.ceil(getFilteredSpjData().length / rowsPerPage) || 1;
    currentPage += arah;
    if (currentPage < 1) currentPage = 1;
    if (currentPage > totalPages) currentPage = totalPages;
    renderTabelSpj();
}

function terapkanFilterDanSort() {
    searchQuery = document.getElementById('inputSearchSpj') ? document.getElementById('inputSearchSpj').value.toLowerCase() : '';
    sortType = document.getElementById('selectSortSpj') ? document.getElementById('selectSortSpj').value : 'TGL_DESC';
    const selSt = document.getElementById('selectStatusSpj');
    if (selSt) filterStatus = selSt.value || 'ALL';
    const selPem = document.getElementById('filterPemilikSpj');
    if (selPem) filterPemilikSpj = selPem.value || 'ALL';
    currentPage = 1;
    renderTabelSpj();
}

function exportSpjExcel() {
    const data = getFilteredSpjData();
    if (!data.length) { alert('Tidak ada data SPJ untuk diekspor.'); return; }
    const ta = String(CONFIG.TAHUN_ANGGARAN || '2026');
    const head = ['No', 'Tanggal', 'Jenis', 'No. NPD / Kontrak', 'PPTK', 'Unit Kerja', 'Program', 'Kegiatan', 'Sub Kegiatan', 'Penyedia / CV', 'Tahap', 'Uraian', 'Nominal (Rp)', 'Status', 'No. PB', 'Tanggal PB'];
    const rows = data.map((x, i) => [
        i + 1, formatTanggalIndo(x.createdAt), x.jenisSurat || 'GU', x.npd || '-', x.pptk || '-', x.unitKerja || '-',
        x.program || '-', x.kegiatan || '-', x.subKegiatan || '-', x.namaCv || '-', x.tahap || '-', x.uraian || '-',
        Number(x.nominal) || 0, x.status || '-', x.noPb || '-', x.tglPb ? formatTanggalIndo(String(x.tglPb)) : '-'
    ]);
    const namaFile = `DATA_SPJ_${filterJenis}_${ta}`;
    if (typeof XLSX !== 'undefined') {
        const ws = XLSX.utils.aoa_to_sheet([head, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'SPJ_' + filterJenis);
        XLSX.writeFile(wb, namaFile + '.xlsx');
        showToast('File Excel ' + namaFile + '.xlsx berhasil diunduh.');
    } else {
       const csv = [head, ...rows].map(r => r.map(v => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\n');
const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = namaFile + '.csv';
        document.body.appendChild(a); a.click(); a.remove();
        showToast('File CSV ' + namaFile + '.csv berhasil diunduh.');
    }
}

function renderTabelSpj() {
    const tbody = document.getElementById('spjTableBody'); tbody.innerHTML = '';

    // --- HITUNG STATISTIK BERKAS GU, LS, & ACTIONABLE COUNTERS ---
    let guTotal = 0, guNominal = 0, guMenunggu = 0, guRevisi = 0, guSiapPb = 0, guSelesaiPb = 0, guDitolak = 0;
    let lsTotal = 0, lsNominal = 0, lsMenunggu = 0, lsRevisi = 0, lsDisetujui = 0, lsNominalDisetujui = 0, lsDitolak = 0;

    spjData.forEach(item => {
        if (sesiAktif.role === 'PPTK' && filterPemilikSpj === 'MINE' && !isPemilikSpj(item)) return;
        const jns = String(item.jenisSurat || 'GU').trim();
        const nom = Number(item.nominal) || 0;
        const st = String(item.status || '');
        if (jns === 'LS') {
            lsTotal++;
            if (st !== 'DITOLAK') lsNominal += nom;
            if (st === 'BELUM_DIPROSES') lsMenunggu++;
            else if (st === 'REVISI') lsRevisi++;
            else if (st === 'DISETUJUI' || st === 'SUDAH DIPINDAHBUKUKAN') { lsDisetujui++; lsNominalDisetujui += nom; }
            else if (st === 'DITOLAK') lsDitolak++;
        } else {
            guTotal++;
            if (st !== 'DITOLAK') guNominal += nom;
            if (st === 'BELUM_DIPROSES') guMenunggu++;
            else if (st === 'REVISI') guRevisi++;
            else if (st === 'DISETUJUI') guSiapPb++;
            else if (st === 'SUDAH DIPINDAHBUKUKAN') guSelesaiPb++;
            else if (st === 'DITOLAK') guDitolak++;
        }
    });

    const setT = (id, txt) => { const el = document.getElementById(id); if (el) el.innerText = txt; };

    // Dashboard Semua: Total Berkas Pencairan GU & LS
    const guProses = guMenunggu + guRevisi + guSiapPb;
    const lsProses = lsMenunggu + lsRevisi;
    setT('totalBerkasGu', String(guTotal));
    setT('totalNominalGu', formatRupiah(guNominal));
    setT('subBerkasGu', `Selesai PB: ${guSelesaiPb} · Siap PB: ${guSiapPb} · Proses: ${guMenunggu + guRevisi}`);

    setT('totalBerkasLs', String(lsTotal));
    setT('totalNominalLs', formatRupiah(lsNominal));
    setT('subBerkasLs', `Disetujui: ${lsDisetujui} · Proses: ${lsProses}${lsDitolak ? ' · Ditolak: ' + lsDitolak : ''}`);

    setT('totalBerkasSemua', String(guTotal + lsTotal));
    setT('totalNominalSemua', formatRupiah(guNominal + lsNominal));
    setT('subBerkasSemua', `Selesai: ${guSelesaiPb + lsDisetujui} · Proses: ${guProses + lsProses} · Ditolak: ${guDitolak + lsDitolak}`);

    // Dashboard Semua: Actionable Counters (Tunggu Transfer PB KHUSUS GU, LS tidak masuk!)
    setT('countMenunggu', String(guMenunggu + lsMenunggu));
    setT('countRevisi', String(guRevisi + lsRevisi));
    setT('countSiapPb', String(guSiapPb));

    // Panel Khusus GU
    setT('guCountTotal', String(guTotal));
    setT('guNominalTotal', formatRupiah(guNominal));
    setT('guSubSelesaiPb', `Selesai PB: ${guSelesaiPb}`);
    setT('guCountMenunggu', String(guMenunggu));
    setT('guCountRevisi', String(guRevisi));
    setT('guCountSiapPb', String(guSiapPb));

    // Panel Khusus LS (berakhir di Disetujui)
    setT('lsCountTotal', String(lsTotal));
    setT('lsNominalTotal', formatRupiah(lsNominal));
    setT('lsCountMenunggu', String(lsMenunggu));
    setT('lsCountRevisi', String(lsRevisi));
    setT('lsCountDisetujui', String(lsDisetujui));
    setT('lsNominalDisetujui', formatRupiah(lsNominalDisetujui));

    const filteredData = getFilteredSpjData();

    const totalData = filteredData.length; const totalPages = Math.ceil(totalData / rowsPerPage) || 1;
    const startIndex = (currentPage - 1) * rowsPerPage; const endIndex = Math.min(startIndex + rowsPerPage, totalData);
    const infoEl = document.getElementById('infoHalaman'); const btnPrev = document.getElementById('btnPrevPage'); const btnNext = document.getElementById('btnNextPage');
    if (infoEl) infoEl.innerText = `Hal ${currentPage} dari ${totalPages}`;
    if (btnPrev) btnPrev.disabled = currentPage === 1; if (btnNext) btnNext.disabled = currentPage === totalPages || totalPages === 0;
    const dataHalamanIni = filteredData.slice(startIndex, endIndex);

    let colSpanNum = filterJenis === 'ALL' ? 12 : (filterJenis === 'LS' ? 10 : 9);
    if (dataHalamanIni.length === 0) { tbody.innerHTML = `<tr><td colspan="${colSpanNum}" class="text-center py-10 text-slate-500 font-medium">Belum ada data SPJ untuk ditampilkan.</td></tr>`; return; }

    dataHalamanIni.forEach(item => {
        let jenisSurat = String(item.jenisSurat || 'GU');
        let badge = `<span class="px-2.5 py-1 rounded-full border border-slate-200 font-bold text-slate-600 bg-slate-100 text-[10px] tracking-wide">MENUNGGU</span>`;
        if (item.status === 'DISETUJUI') {
            badge = jenisSurat === 'LS'
                ? `<span class="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 text-[10px] tracking-wide"><i class="fa-solid fa-circle-check me-1"></i>DISETUJUI</span>`
                : `<span class="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 text-[10px] tracking-wide">DISETUJUI</span>`;
        }
        if (item.status === 'REVISI') badge = `<span class="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200 text-[10px] tracking-wide">REVISI</span>`;
        if (item.status === 'DITOLAK') badge = `<span class="px-2.5 py-1 rounded-full bg-red-50 text-red-700 font-bold border border-red-200 text-[10px] tracking-wide">DITOLAK</span>`;
        if (item.status === 'SUDAH DIPINDAHBUKUKAN') badge = `<span class="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200 text-[10px] tracking-wide">SELESAI PB</span>`;

        const bacaSaja = (sesiAktif.role === 'PPTK' || sesiAktif.role === 'PIMPINAN');
        let actionBtnText = bacaSaja ? '<i class="fa-solid fa-folder-open"></i> DETAIL' : '<i class="fa-solid fa-clipboard-check"></i> VERIFIKASI';
        let actionBtnColor = bacaSaja
            ? 'bg-slate-700 hover:bg-slate-800'
            : (filterJenis === 'GU' ? 'bg-indigo-600 hover:bg-indigo-700' : (filterJenis === 'LS' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-sipd-navy hover:bg-slate-800'));

        let jenisBadge = jenisSurat === 'LS' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200';
        let tdJenisHtml = filterJenis === 'ALL' ? `<td class="py-4 px-4 text-xs align-top text-center whitespace-nowrap"><span class="px-2 py-1 rounded-md border font-bold text-[10px] ${jenisBadge}">${jenisSurat}</span></td>` : ``;

        let cvText = jenisSurat === 'LS' && item.namaCv ? escapeHtml(item.namaCv) : '-';
        let tahapText = jenisSurat === 'LS' && item.tahap ? escapeHtml(item.tahap) : '-';
        let tglPbText = jenisSurat === 'LS' ? '<span class="text-slate-300">-</span>' : (item.tglPb ? formatTanggalIndo(String(item.tglPb)) : '-');
        let uraianPekerjaan = escapeHtml(item.uraian || '-');
        let npdColor = filterJenis === 'GU' ? 'text-indigo-900' : (filterJenis === 'LS' ? 'text-purple-900' : 'text-slate-800');
        let rowHover = filterJenis === 'GU' ? 'hover:bg-indigo-50/40' : (filterJenis === 'LS' ? 'hover:bg-purple-50/40' : 'hover:bg-slate-50/50');

        let tdCvHtml = (filterJenis === 'ALL' || filterJenis === 'LS') ? `<td class="py-4 px-4 text-xs align-top font-bold text-purple-700">${cvText}</td>` : ``;
        let tdTahapHtml = (filterJenis === 'ALL' || filterJenis === 'LS') ? `<td class="py-4 px-4 text-xs align-top text-center"><span class="${jenisSurat === 'LS' ? 'px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded font-bold text-[10px]' : ''}">${tahapText}</span></td>` : ``;
        let tdTglPbHtml = (filterJenis === 'ALL' || filterJenis === 'GU') ? `<td class="py-4 px-4 text-xs align-top font-bold text-blue-600">${tglPbText}</td>` : ``;

        tbody.innerHTML += `
            <tr class="${rowHover} border-b border-slate-100 transition-colors">
                <td class="py-4 px-4 text-xs align-top whitespace-nowrap text-slate-500 font-medium">${formatTanggalIndo(item.createdAt)}</td>
                <td class="py-4 px-4 text-xs align-top font-bold ${npdColor} max-w-[160px] whitespace-normal break-words">${escapeHtml(item.npd || '-')}</td>
                ${tdJenisHtml}
                <td class="py-4 px-4 text-xs align-top whitespace-nowrap">${escapeHtml(item.pptk || '-')}${sesiAktif.role === 'PPTK' && isPemilikSpj(item) ? ' <span class="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[9px] font-bold">Milik Saya</span>' : ''}<br><span class="text-[10px] text-slate-500">${escapeHtml(item.unitKerja || '-')}</span></td>
                <td class="py-4 px-4 text-xs align-top leading-relaxed min-w-[200px] whitespace-normal break-words">
                    <span class="font-bold text-slate-800">${escapeHtml(item.program || '-')}</span><br>
                    <span class="text-slate-500">${escapeHtml(item.kegiatan || '-')}</span><br>
                    <span class="text-[10px] text-slate-400">${escapeHtml(item.subKegiatan || '-')}</span>
                </td>
                ${tdCvHtml}
                ${tdTahapHtml}
                ${tdTglPbHtml}
                <td class="py-4 px-4 text-xs align-top text-slate-600 max-w-[220px] whitespace-normal break-words">${uraianPekerjaan}</td>
                <td class="py-4 px-4 text-xs text-right font-bold align-top whitespace-nowrap text-slate-800">${formatRupiah(item.nominal)}</td>
                <td class="py-4 px-4 text-center align-top whitespace-nowrap">${badge}${(!item.linkKeuangan || item.linkKeuangan === '-') && (!item.linkSpj || item.linkSpj === '-') ? '<div class="mt-1"><span class="px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200 text-[9px] font-bold">Belum Upload Berkas</span></div>' : ''}</td>
                <td class="py-4 px-4 text-center align-top whitespace-nowrap sticky right-0 bg-white/90 backdrop-blur-sm shadow-[-8px_0_15px_rgba(0,0,0,0.02)] z-10 border-l border-slate-100">
                    <button onclick="bukaModalVerifikasi('${escapeHtml(item.id)}')" class="px-4 py-1.5 ${actionBtnColor} text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer">${actionBtnText}</button>
                    ${sesiAktif.role === 'SUPER_ADMIN' ? `<button type="button" data-hapus-id="${escapeHtml(item.id)}" onclick="hapusPengajuan(this.getAttribute('data-hapus-id'), this)" class="ml-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer" title="Hapus pengajuan (khusus Super Admin)"><i class="fa-solid fa-trash"></i> Hapus</button>` : ''}
                </td>
            </tr>
        `;
    });
}

// Pemilik SPJ (PPTK) atau SUPER_ADMIN boleh mengunggah selama status BELUM_DIPROSES / REVISI
function bolehUnggah(item) {
    if (sesiAktif.role === 'SUPER_ADMIN') return true;   // override: semua pengajuan & status (tercatat di riwayat/LOG)
    const pemilik = sesiAktif.role === 'PPTK' && String(item.pptk).trim() === String(sesiAktif.namaLengkap).trim();
    return pemilik && (item.status === 'BELUM_DIPROSES' || item.status === 'REVISI');
}

function tombolHapusLampiranHtml(idItem, slot, url, namaFile) {
    return `<button type="button" data-del-id="${escapeHtml(String(idItem))}" data-del-slot="${escapeHtml(slot)}" data-del-url="${escapeHtml(url)}" data-del-nama="${escapeHtml(namaFile)}" onclick="hapusSatuBerkas(this)" title="Hapus lampiran ini" class="shrink-0 w-7 h-7 rounded bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 flex items-center justify-center text-[11px] transition-colors"><i class="fa-solid fa-trash-can"></i></button>`;
}

function catatanFormBelumAktifHtml() {
    const ta = String((typeof CONFIG !== 'undefined' && CONFIG.TAHUN_ANGGARAN) || '');
    return `<div class="w-full text-[10px] text-slate-500 bg-white border border-slate-200 rounded px-2 py-1 mt-1">Form &gt; 10 MB TA ${escapeHtml(ta)} belum diaktifkan &mdash; kompres/pecah file &le; 10 MB untuk upload langsung.</div>`;
}

function jadikanLink(textUrl, idItem, formType, slot, boleh) {
    const idq = escapeHtml(String(idItem));
    const adaForm = typeof adaFormUploadAktif === 'function' ? adaFormUploadAktif(formType) : true;
    const tombolForm = adaForm
        ? `<a href="${escapeHtml(urlFormUploadAktif(formType, idItem))}" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1.5 bg-white text-blue-700 hover:bg-blue-50 border border-blue-300 rounded text-[10px] font-bold"><i class="fa-solid fa-arrow-up-right-from-square me-1"></i> Via Google Form <span class="font-normal opacity-80">(&gt; 10 MB)</span></a>`
        : catatanFormBelumAktifHtml();
    const duaTombol = () => `<div class="flex flex-wrap gap-1.5 mt-2">
        <button type="button" onclick="pilihBerkas('${idq}','${slot}')" class="px-2.5 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded text-[10px] font-bold shadow-sm"><i class="fa-solid fa-cloud-arrow-up me-1"></i> Upload Langsung <span class="font-normal opacity-80">(&le; 10 MB)</span></button>
        ${tombolForm}
    </div>`;
    if (!textUrl || textUrl === "-" || textUrl === "") {
        return `<span class="text-slate-400 italic block">Belum dilampirkan</span>` + (boleh ? duaTombol() : '');
    }
    // Satu sel dapat berisi beberapa berkas (satu per baris): "url|nama"
    const daftar = String(textUrl).split('\n').map(x => x.trim()).filter(Boolean).map(line => {
        let url = line, namaFile = "Dokumen_Lampiran";
        if (line.includes("|")) { const parts = line.split("|"); url = parts[0]; namaFile = parts.slice(1).join("|"); }
        else { const matchId = line.match(/[-\w]{25,}/); if (matchId) namaFile = "File_" + matchId[0].substring(0, 8) + "..."; }
        const btnDel = boleh ? tombolHapusLampiranHtml(idItem, slot, url, namaFile) : '';
        return `<div class="flex items-center gap-1.5 mt-1"><a href="${escapeHtml(amanUrl(url))}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline font-bold bg-blue-50 hover:bg-blue-100 border border-blue-100 px-2 py-1.5 rounded transition-colors inline-flex items-center gap-1.5 max-w-[240px]"><i class="fa-solid fa-file-pdf text-red-500 shrink-0"></i> <span class="truncate">${escapeHtml(namaFile)}</span></a>${btnDel}</div>`;
    }).join('');
    return daftar + (boleh ? duaTombol() : '');
}

function renderListRevisi(textRaw, idItem, boleh) {
    if (!textRaw || textRaw === "-" || textRaw === "") return `<span class="text-slate-400 italic text-[11px]">Belum ada lampiran revisi.</span>`;
    let htmlResult = '<div class="space-y-2 mt-2">';
    String(textRaw).split('\n').forEach(line => {
        let trimmed = line.trim(); if (!trimmed) return;
        const match = trimmed.match(/^(\d+\.)\s*(\[[^\]]+\])\s*(.*)/);
        if (match) {
            const noUtama = match[1]; const tgl = match[2]; const sisaTeks = match[3];
            let url = sisaTeks; let namaFile = "Dokumen_Revisi.pdf";
            if (sisaTeks.includes("|")) { const parts = sisaTeks.split("|"); url = parts[0]; namaFile = parts.slice(1).join("|"); }
            else { const matchId = url.match(/[-\w]{25,}/); if (matchId) namaFile = "Revisi_" + matchId[0].substring(0, 8) + "...pdf"; }
            const btnDel = (boleh && idItem) ? tombolHapusLampiranHtml(idItem, 'revisi', url, namaFile) : '';
            htmlResult += `
            <div class="flex items-center gap-1.5 text-[11px] flex-wrap">
                <span class="font-bold text-slate-700 min-w-[12px]">${escapeHtml(noUtama)}</span>
                <span class="font-bold text-slate-500">${escapeHtml(tgl)}</span>
                <a href="${escapeHtml(amanUrl(url))}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline font-bold bg-blue-50 px-2 py-1.5 rounded inline-flex items-center gap-1 border border-blue-100 max-w-[190px]"><i class="fa-solid fa-file-pdf text-red-500 shrink-0"></i> <span class="truncate">${escapeHtml(namaFile)}</span></a>
                ${btnDel}
            </div>`;
        } else {
            htmlResult += `<div class="text-[11px] text-slate-600">${escapeHtml(trimmed)}</div>`;
        }
    });
    return htmlResult + '</div>';
}

function hapusSatuBerkas(btn) {
    if (!btn) return;
    const id = btn.getAttribute('data-del-id');
    const slot = btn.getAttribute('data-del-slot');
    const url = btn.getAttribute('data-del-url');
    const nama = btn.getAttribute('data-del-nama') || 'berkas ini';
    if (!id || !slot || !url) return;
    if (!confirm(`Hapus lampiran "${nama}"?\n\nTautan akan dicabut dari pengajuan ini dan file di Google Drive dipindahkan ke Trash (masih dapat dipulihkan dalam 30 hari).`)) return;
    const awal = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    apiPost({ action: 'hapus_berkas', id, slot, url, nama })
        .then(res => {
            if (res.status !== 'success') { alert('Gagal menghapus lampiran: ' + (res.message || '')); btn.disabled = false; btn.innerHTML = awal; return; }
            showToast('Lampiran "' + (res.nama || nama) + '" berhasil dihapus.');
            return tarikDataDariServer().then(() => { if (String(activeSelectedId) === String(id)) bukaModalVerifikasi(id); });
        })
        .catch(err => {
            if (String(err.message) !== 'Sesi berakhir') alert('Koneksi terputus: ' + err.message);
            btn.disabled = false; btn.innerHTML = awal;
        });
}

function bukaModalVerifikasi(id) {
    activeSelectedId = id; const item = spjData.find(i => String(i.id) === String(id)); if(!item) return;

    let textUraian = '';
    if (String(item.jenisSurat) === 'LS') {
        textUraian = `<div class="pb-2 mb-2 border-b border-slate-200">
                        <span class="block text-[10px] font-bold text-purple-700 uppercase mb-0.5">Penyedia / CV</span>
                        <span class="text-sm font-bold text-slate-800">${escapeHtml(item.namaCv || '-')}</span>
                      </div>
                      <div class="pb-2 mb-2 border-b border-slate-200">
                        <span class="block text-[10px] font-bold text-purple-700 uppercase mb-0.5">Tahap</span>
                        <span class="text-sm text-slate-700">${escapeHtml(item.tahap || '-')}</span>
                      </div>
                      <div class="pt-1">
                        <span class="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Nama Pekerjaan</span>
                        <div class="text-sm font-medium text-slate-700 leading-relaxed">${escapeHtml(item.uraian || '-')}</div>
                      </div>`;
    } else {
        textUraian = `<div>
                        <span class="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Uraian SPJ</span>
                        <div class="text-sm font-medium text-slate-700 leading-relaxed">${escapeHtml(item.uraian || '-')}</div>
                      </div>`;
    }
    document.getElementById('detailUraian').innerHTML = textUraian;
    document.getElementById('detailPptkNama').innerText = String(item.pptk || "-");
    document.getElementById('detailUnitKerja').innerText = String(item.unitKerja || "-");
    let elEmail = document.getElementById('detailEmailPptk'); if (elEmail) elEmail.innerText = String(item.emailPptk || "-");
    document.getElementById('detailNominal').innerText = formatRupiah(item.nominal || 0);

    let btnCetakEksis = document.getElementById('btnPrintAntrean'); if(btnCetakEksis) btnCetakEksis.remove();

    if (String(item.jenisSurat) === 'LS') {
        const allLS = [...spjData].reverse().filter(i => String(i.jenisSurat) === 'LS');
        const idx = allLS.findIndex(i => String(i.id) === String(item.id)) + 1;
        const noUrut = item.noAntreanLs || ('LS-' + String(idx).padStart(4, '0'));
        const safeNpd = String(item.npd || '-').replace(/'/g, "\\'").replace(/"/g, "&quot;");
        const tgl = String(item.createdAt || '-').split('T')[0];
        
        const btnHtml = `<button id="btnPrintAntrean" onclick="cetakNomorUrut('${noUrut}', '${safeNpd}', '${tgl}')" class="mt-3 px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded text-[11px] font-bold shadow-sm flex items-center gap-2 transition-colors w-full justify-center"><i class="fa-solid fa-print"></i> Cetak Ulang Antrean (${noUrut})</button>`;
        document.getElementById('detailNominal').insertAdjacentHTML('afterend', btnHtml);
    }
    
    const boxBerkas = document.getElementById('berkas-area-gu');
    if (String(item.jenisSurat) === 'LS') {
        boxBerkas.innerHTML = `<div class="text-sm"><span class="font-bold text-slate-700 block mb-1">1. Kwitansi Kontrak / SPK</span><div id="linkDokKeuangan"></div></div><div class="text-sm mt-3"><span class="font-bold text-slate-700 block mb-1">2. Berkas Pencairan LS</span><div id="linkDokSpj"></div></div>`;
    } else {
        boxBerkas.innerHTML = `<div class="text-sm"><span class="font-bold text-slate-700 block mb-1">1. Dok. Keuangan (SPP/SPM/Pajak)</span><div id="linkDokKeuangan"></div></div><div class="text-sm mt-3"><span class="font-bold text-slate-700 block mb-1">2. SPJ Fungsional (Kwitansi/Nota/Absen)</span><div id="linkDokSpj"></div></div>`;
    }
    
    document.getElementById('linkDokKeuangan').innerHTML = jadikanLink(item.linkKeuangan, item.id, item.jenisSurat, 'keuangan', bolehUnggah(item)); 
    document.getElementById('linkDokSpj').innerHTML = jadikanLink(item.linkSpj, item.id, item.jenisSurat, 'spj', bolehUnggah(item)); 
    const adaFormRev = typeof adaFormUploadAktif === 'function' ? adaFormUploadAktif('REVISI') : true;
    const btnFormRevAdmin = adaFormRev
        ? `<a href="${escapeHtml(urlFormUploadAktif('REVISI', item.id))}" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1.5 bg-white text-blue-700 hover:bg-blue-50 border border-blue-300 rounded text-[10px] font-bold"><i class="fa-solid fa-arrow-up-right-from-square me-1"></i> Via Google Form <span class="font-normal opacity-80">(&gt; 10 MB)</span></a>`
        : catatanFormBelumAktifHtml();
    document.getElementById('linkDokRevisi').innerHTML = renderListRevisi(item.linkRevisi, item.id, bolehUnggah(item)) + (sesiAktif.role === 'SUPER_ADMIN'
        ? `<div class="flex flex-wrap gap-1.5 mt-2"><button type="button" onclick="pilihBerkas('${escapeHtml(String(item.id))}','revisi')" class="px-2.5 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded text-[10px] font-bold shadow-sm"><i class="fa-solid fa-cloud-arrow-up me-1"></i> Upload Revisi <span class="font-normal opacity-80">(admin, &le; 10 MB)</span></button>${btnFormRevAdmin}</div>` : '');

    const buktiPbBox = document.getElementById('detailBuktiPbBox');
    if (item.status === 'SUDAH DIPINDAHBUKUKAN' && item.buktiPb) {
        document.getElementById('detailBuktiPbTeks').innerText = `No PB: ${item.noPb} (${formatTanggalIndo(String(item.tglPb))})`;
        let buktiLink = String(item.buktiPb || '');
        if(buktiLink.startsWith('http')) { document.getElementById('detailBuktiPbLink').innerHTML = `<a href="${escapeHtml(amanUrl(buktiLink))}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline font-bold text-xs"><i class="fa-solid fa-file-invoice"></i> Buka Bukti PB</a>`; } 
        else { document.getElementById('detailBuktiPbLink').innerHTML = `<span class="text-slate-700 font-bold">Kata Kunci Arsip: ${escapeHtml(buktiLink)}</span>`; }
        buktiPbBox.classList.remove('hidden');
    } else { buktiPbBox.classList.add('hidden'); }

    let logHtml = '<div class="relative border-l-2 border-slate-200 ml-3 mt-4 pb-2">'; 
    const safeRiwayat = teksCatatan(item.riwayatLog || '');
    if (safeRiwayat.trim() !== "") { 
        let logEntries = [];
        let currentEntry = "";
        safeRiwayat.split('\n').forEach(line => { 
            let trimmed = line.trim(); if (!trimmed) return; 
            
            if (/^\[\d{2}\/\d{2}\/\d{4}/.test(trimmed)) { 
                if (currentEntry) logEntries.push(currentEntry);
                currentEntry = trimmed; 
            } else { 
                if (currentEntry) { currentEntry += '\n' + trimmed; } else { currentEntry = trimmed; } 
            } 
        });
        if (currentEntry) logEntries.push(currentEntry);
        
        logEntries.forEach((entryBlock) => { 
            let dotColor = 'bg-slate-400 ring-slate-100'; 
            let blockLines = entryBlock.split('\n');
            let mainLog = blockLines[0]; let extraLinkHtml = "";
            
            for(let j = 1; j < blockLines.length; j++) {
                if(blockLines[j].startsWith("LinkRevisiLog:")) {
                    let linkData = blockLines[j].replace("LinkRevisiLog:", "").trim();
                    let urlFile = linkData; let nmFile = "Berkas Revisi";
                    if(linkData.includes("|")){ let p = linkData.split("|"); urlFile = p[0]; nmFile = p[1]; }
                    extraLinkHtml += `<div class="mt-1.5"><a href="${amanUrl(urlFile)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 border border-blue-100 text-blue-700 hover:bg-blue-100 rounded text-[10px] font-bold transition-colors underline"><i class="fa-solid fa-file-pdf text-red-500"></i> ${nmFile}</a></div>`;
                }
            }

            let innerHtml = mainLog; let match = mainLog.match(/^(\[[^\]]+\])\s*(.*)$/);
            
            if (match) {
                let tanggal = match[1]; let isiHtml = match[2];
                let isCatatan = isiHtml.includes('- Catatan:');
                let isPb = isiHtml.includes('PINDAHBUKU SELESAI') || isiHtml.includes('DIPINDAHBUKUKAN');
                let isRevisiUpload = isiHtml.includes('BERKAS REVISI DIUPLOAD');
                let isUpload = isiHtml.includes('BERKAS DIUNGGAH');
                let badgeClass = "text-white px-3 py-1.5 rounded-md shadow-sm font-bold uppercase inline-flex items-center gap-1.5 text-xs mb-1";
                
                if (isCatatan) {
                    let parts = isiHtml.split('- Catatan:'); 
                    let statusTeks = parts[0].trim(); let isiCatatan = parts[1].trim();
                    if (statusTeks.includes('REVISI')) {
                        dotColor = 'bg-orange-500 ring-orange-200';
                        isiHtml = `<div><span class="bg-orange-500 ${badgeClass}"><i class="fa-solid fa-rotate-left"></i> ${statusTeks}</span></div>
                            <div class="mt-1 p-2.5 bg-orange-50 border border-orange-200 rounded-lg text-orange-900 text-[11px] leading-relaxed shadow-sm">
                            <i class="fa-solid fa-circle-exclamation me-1 text-orange-600"></i> <b class="text-orange-900">Catatan Revisi:</b><br>${isiCatatan}</div>`;
                    } else if (statusTeks.includes('DITOLAK')) {
                        dotColor = 'bg-red-600 ring-red-200';
                        isiHtml = `<div><span class="bg-red-600 ${badgeClass}"><i class="fa-solid fa-circle-xmark"></i> ${statusTeks}</span></div>
                            <div class="mt-1 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-900 text-[11px] leading-relaxed shadow-sm">
                            <i class="fa-solid fa-circle-xmark me-1 text-red-600"></i> <b class="text-red-900">Alasan Ditolak:</b><br>${isiCatatan}</div>`;
                    }
                }
                else if (isPb) {
                    dotColor = 'bg-blue-600 ring-blue-200'; 
                    if (isiHtml.includes('- No PB:')) {
                        let pbParts = isiHtml.split('- No PB:'); let statusTeks = pbParts[0].trim(); let noPb = pbParts[1].trim();
                        isiHtml = `<div><span class="bg-blue-600 ${badgeClass}"><i class="fa-solid fa-money-bill-transfer"></i> ${statusTeks}</span></div>
                                   <div class="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-md shadow-sm mt-1">
                                   <span class="text-[10px] text-blue-700 font-bold uppercase">NO PB:</span> <span class="text-sm font-black text-blue-900 tracking-widest">${noPb}</span></div>`;
                    } else { isiHtml = `<span class="bg-blue-600 ${badgeClass}"><i class="fa-solid fa-money-bill-transfer"></i> ${isiHtml}</span>`; }
                }
                else if (isUpload) { dotColor = 'bg-blue-500 ring-blue-200'; isiHtml = `<div><span class="bg-blue-600 ${badgeClass}"><i class="fa-solid fa-cloud-arrow-up"></i> ${isiHtml}</span></div>${extraLinkHtml}`; }
                else if (isiHtml.includes('BERKAS DIHAPUS')) { dotColor = 'bg-rose-500 ring-rose-200'; isiHtml = `<span class="bg-rose-600 ${badgeClass}"><i class="fa-solid fa-trash-can"></i> ${isiHtml}</span>`; }
                else if (isRevisiUpload) { dotColor = 'bg-orange-500 ring-orange-200'; isiHtml = `<div><span class="bg-orange-500 ${badgeClass}"><i class="fa-solid fa-cloud-arrow-up"></i> ${isiHtml}</span></div>${extraLinkHtml}`; }
                else if (isiHtml.includes('REVISI')) { dotColor = 'bg-orange-500 ring-orange-200'; isiHtml = `<span class="bg-orange-500 ${badgeClass}"><i class="fa-solid fa-rotate-left"></i> ${isiHtml}</span>`; }
                else if (isiHtml.includes('DITOLAK')) { dotColor = 'bg-red-600 ring-red-200'; isiHtml = `<span class="bg-red-600 ${badgeClass}"><i class="fa-solid fa-circle-xmark"></i> ${isiHtml}</span>`; } 
                else if (isiHtml.includes('DISETUJUI')) { dotColor = 'bg-emerald-500 ring-emerald-200'; isiHtml = `<span class="bg-emerald-500 ${badgeClass}"><i class="fa-solid fa-circle-check"></i> ${isiHtml}</span>`; }
                else if (isiHtml.includes('DIAJUKAN')) { dotColor = 'bg-slate-500 ring-slate-200'; isiHtml = `<span class="bg-slate-600 ${badgeClass}"><i class="fa-solid fa-file-arrow-up"></i> ${isiHtml}</span>`; } 
                else { isiHtml = `<span class="text-slate-800 font-bold">${isiHtml}</span>`; }
                
                innerHtml = `<span class="text-[10px] font-bold text-slate-500 block mb-1.5 tracking-wide">${tanggal}</span>${isiHtml}`;
            } else { 
                innerHtml = `<span class="text-slate-600 italic font-medium block mt-1 pl-2 border-l-2 border-slate-300">${mainLog}</span>`; 
                dotColor = 'bg-transparent ring-transparent'; 
            }
            
            logHtml += `<div class="relative pl-7 mb-6">
                            <div class="absolute -left-[6px] top-1 w-2.5 h-2.5 ${dotColor} rounded-full ${dotColor !== 'bg-transparent ring-transparent' ? 'ring-4' : ''}"></div>
                            <div class="text-[11px] leading-relaxed">${innerHtml}</div>
                        </div>`; 
        }); 
    } else { 
        logHtml += `<div class="relative pl-7"><div class="absolute -left-[6px] top-1 w-2.5 h-2.5 bg-slate-300 rounded-full ring-4 ring-white"></div><p class="text-[11px] text-slate-400 italic">Belum ada riwayat aktivitas.</p></div>`; 
    }
    logHtml += '</div>'; document.getElementById('detailRiwayatBox').innerHTML = logHtml;
    
    document.getElementById('revisiContainer').classList.add('hidden'); 
    document.getElementById('pindahbukuContainer').classList.add('hidden'); 
    document.getElementById('confirmActionContainer').classList.add('hidden'); 
    document.getElementById('panelPptkRevisi').classList.add('hidden');
    document.getElementById('catatanRevisiInput').value = ""; 

    if (bisaVerifikasi()) {
    document.getElementById('panelAksiVerifikator').classList.remove('hidden'); 
    
    // Logika Pemisahan Wewenang Tombol
    const btnSetuju = document.getElementById('btnSetuju');
    const btnRevisi = document.getElementById('btnRevisi');
    const btnTolak = document.getElementById('btnTolak');
    const btnPb = document.getElementById('btnPb');
    
    if(btnSetuju && btnRevisi && btnTolak && btnPb) {
        // SPJ LS berakhir pada DISETUJUI (tanpa tombol PB). SPJ GU lanjut ke PB.
        const isLs = String(item.jenisSurat || 'GU').trim() === 'LS';
        btnSetuju.style.display = 'flex'; btnRevisi.style.display = 'flex'; btnTolak.style.display = 'flex';
        btnPb.style.display = isLs ? 'none' : 'flex';
        document.getElementById('gridTombolAksi').className = isLs ? "grid grid-cols-3 gap-2 mb-2" : "grid grid-cols-4 gap-2 mb-2";
    }
    // Edit teks pengajuan milik PPTK: hanya SUPER_ADMIN (koreksi); VERIFIKATOR tidak boleh
    const btnEditVerif = document.getElementById('btnEditTeksVerif'); if (btnEditVerif) btnEditVerif.style.display = (sesiAktif.role === 'SUPER_ADMIN') ? 'flex' : 'none';

    let cleanPhone = String(item.wa || '').replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) { cleanPhone = '62' + cleanPhone.slice(1); } else if (cleanPhone.startsWith('8')) { cleanPhone = '62' + cleanPhone; }
    const lblRefWa = String(item.jenisSurat || 'GU').trim() === 'LS' ? 'No. Kontrak' : 'NPD';
    let waText = `Yth. PPTK,\nUpdate SPJ ${item.jenisSurat || 'GU'} (${lblRefWa}: ${item.npd}):\n*Status: ${item.status}*\n`;
    if (item.status === 'REVISI' || item.status === 'DITOLAK') waText += `Catatan:\n${String(item.catatanRevisi).replace(/<br>/g, '\n')}\n`;
    const btnSendWa = document.getElementById('btnSendWa');
    if (btnSendWa) {
        if (cleanPhone.length >= 9) {
            btnSendWa.style.display = 'flex';
            btnSendWa.href = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(waText)}`;
        } else {
            btnSendWa.style.display = 'none';
        }
    }
} else {
        document.getElementById('panelAksiVerifikator').classList.add('hidden'); 
        // Panel tindakan PPTK: hanya PPTK pemilik. PIMPINAN (hanya lihat) tidak mendapat tombol apa pun.
        if (sesiAktif.role === 'PPTK' && String(item.pptk).trim() === String(sesiAktif.namaLengkap).trim() && (item.status === 'REVISI' || item.status === 'BELUM_DIPROSES')) {
            document.getElementById('panelPptkRevisi').classList.remove('hidden');
            if(item.status === 'BELUM_DIPROSES') document.getElementById('teksRevisiPptk').innerText = "Anda masih dapat mengubah data teks atau mengunggah ulang berkas.";
            if(item.status === 'REVISI') document.getElementById('teksRevisiPptk').innerHTML = "Catatan Verifikator: <br>" + teksCatatan(item.catatanRevisi || "-");
            const btnRev = document.getElementById('btnUploadRevisi'); btnRev.setAttribute('href', '#'); btnRev.removeAttribute('target'); btnRev.onclick = (ev) => { ev.preventDefault(); pilihBerkas(item.id, 'revisi'); };
            const btnRevForm = document.getElementById('btnUploadRevisiForm');
            const infoRevForm = document.getElementById('infoFormRevisiPptk');
            if (btnRevForm) {
                if (adaFormRev) {
                    btnRevForm.classList.remove('hidden');
                    btnRevForm.setAttribute('href', urlFormUploadAktif('REVISI', item.id));
                    if (infoRevForm) infoRevForm.classList.add('hidden');
                } else {
                    btnRevForm.classList.add('hidden');
                    if (infoRevForm) {
                        infoRevForm.classList.remove('hidden');
                        infoRevForm.textContent = `Form > 10 MB TA ${CONFIG.TAHUN_ANGGARAN || ''} belum diaktifkan — kompres/pecah file ≤ 10 MB untuk upload langsung.`;
                    }
                }
            }
            let existingEditBtnPptk = document.getElementById('btnEditDataPptk'); if(existingEditBtnPptk) existingEditBtnPptk.remove();
            const editBtnPptkHtml = `<button id="btnEditDataPptk" onclick="bukaFormEdit()" class="w-full mt-2 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-1.5"><i class="fa-solid fa-pen-to-square"></i> EDIT DATA TEKS</button>`;
            document.getElementById('panelPptkRevisi').insertAdjacentHTML('beforeend', editBtnPptkHtml);
        }
    }
    openModal('modalVerify');
}

function bukaFormEdit() {
    const item = spjData.find(i => String(i.id) === String(activeSelectedId)); if(!item) return;
    if (!bisaEditItem(item)) { alert('Anda tidak memiliki hak mengubah pengajuan ini.'); return; }
    isEditMode = true; editIdTarget = item.id;
    const existingSukses = document.getElementById('pesanSuksesDiv'); if(existingSukses) existingSukses.remove();
    document.getElementById('formNewSpj').classList.remove('hidden');
    
    try { 
        let rawTglStr = String(item.createdAt || '');
        if (rawTglStr.includes('T')) {
            const parts = rawTglStr.split('T'); let [y, m, dNum] = parts[0].split('-').map(Number);
            let jamUTC = parseInt(parts[1].substring(0, 2), 10);
            let realDate = new Date(y, m - 1, dNum); if (jamUTC >= 12) realDate.setDate(realDate.getDate() + 1); 
            const fDay = String(realDate.getDate()).padStart(2, '0'); const fMonth = String(realDate.getMonth() + 1).padStart(2, '0');
            const fYear = realDate.getFullYear();
            document.getElementById('inputTanggal').value = `${fYear}-${fMonth}-${fDay}`;
        } else if (rawTglStr.includes('/')) { let parts = rawTglStr.split('/'); document.getElementById('inputTanggal').value = `${parts[2]}-${parts[1]}-${parts[0]}`; } 
        else { document.getElementById('inputTanggal').value = rawTglStr; }
    } catch(e){}

    const selJenisEdit = document.getElementById('inputJenisSurat');
    selJenisEdit.value = item.jenisSurat || 'GU';
    selJenisEdit.style.pointerEvents = 'none';
    selJenisEdit.tabIndex = -1;
    selJenisEdit.classList.add('bg-slate-100');
    ubahLabelNpdKontrak();
    document.getElementById('inputNpd').value = item.npd; document.getElementById('inputPptk').value = item.pptk;
    document.getElementById('inputUnitKerja').value = item.unitKerja; document.getElementById('inputEmail').value = item.emailPptk; document.getElementById('inputWa').value = item.wa;
    isiDropdownProgram(); setSelectValue(document.getElementById('inputProgram'), item.program); updateKegiatanDropdown(); setSelectValue(document.getElementById('inputKegiatan'), item.kegiatan); updateSubkegiatanDropdown(); setSelectValue(document.getElementById('inputSubkegiatan'), item.subKegiatan);
    document.getElementById('inputNominal').value = item.nominal; document.getElementById('inputUraian').value = item.uraian;
    if (item.jenisSurat === 'LS') {
        const inputCv = document.getElementById('inputCv'); const inputTahap = document.getElementById('inputTahap');
        if(inputCv) inputCv.value = item.namaCv || ""; if(inputTahap) setSelectValue(inputTahap, item.tahap || "UM");
    }
    
    document.getElementById('btnSubmitNew').innerText = "Simpan Perubahan (Edit)";
    closeModal('modalVerify'); openModal('modalNewSpj');
}

function actionSetujui() { pendingStatusChange = 'DISETUJUI'; prosesUpdateStatusAksi(); }
function toggleActionForm(type) {
    pendingStatusChange = type;
    document.getElementById('revisiContainer').classList.add('hidden'); document.getElementById('pindahbukuContainer').classList.add('hidden'); document.getElementById('confirmActionContainer').classList.remove('hidden');
    if(type === 'REVISI' || type === 'DITOLAK') document.getElementById('revisiContainer').classList.remove('hidden');
    if(type === 'SUDAH DIPINDAHBUKUKAN') document.getElementById('pindahbukuContainer').classList.remove('hidden');
    
    const modalContent = document.getElementById('modalVerify');
    modalContent.scrollTo({ top: modalContent.scrollHeight, behavior: 'smooth' });
}

function prosesUpdateStatusAksi() {
    let payload = { action: 'update_status', id: activeSelectedId, status: pendingStatusChange, noPb: '', tglPb: '', catatanRevisi: '', buktiPb: '' };
    if (pendingStatusChange === 'REVISI' || pendingStatusChange === 'DITOLAK') { payload.catatanRevisi = document.getElementById('catatanRevisiInput').value; if(!payload.catatanRevisi) { alert('Catatan wajib diisi!'); return; } } 
    else if (pendingStatusChange === 'SUDAH DIPINDAHBUKUKAN') { payload.noPb = document.getElementById('noPbInput').value; payload.tglPb = document.getElementById('tglPbInput').value; payload.buktiPb = document.getElementById('buktiPbInput').value; if(!payload.noPb || !payload.tglPb) { alert('No PB & Tgl wajib diisi!'); return; } }
    
    const btn = document.getElementById('btnConfirmAction'); if (btn) { btn.innerText = 'MEMPROSES...'; btn.disabled = true; }
    
    apiPost(payload)
    .then(res => {
        if(res.status === 'success') { showToast(`Sukses memperbarui status.`); document.getElementById('confirmActionContainer').classList.add('hidden'); tarikDataDariServer().then(() => { bukaModalVerifikasi(activeSelectedId); }); } 
        else { alert("GAGAL UPDATE:\n" + res.message); }
    })
    .catch(err => { alert("KONEKSI TERPUTUS:\n" + err.message); })
    .finally(() => { if (btn) { btn.innerText = 'Simpan'; btn.disabled = false; } });
}

function kirimEmailManual() {
    if(!activeSelectedId) return;
    const btn = document.getElementById('btnSendEmailManual');
    if(btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengirim...'; btn.disabled = true; }

    apiPost({ action: 'resend_email', id: activeSelectedId })
    .then(res => {
        if(res.status === 'success') { showToast("Email Notifikasi Berhasil Terkirim!"); }
        else { alert("Gagal kirim email: " + (res.message || "Email PPTK tidak valid")); }
    })
    .catch(err => alert("Koneksi gagal saat mengirim email."))
    .finally(() => { if(btn) { btn.innerHTML = '<i class="fa-solid fa-envelope"></i> KIRIM NOTIFIKASI EMAIL KE PPTK'; btn.disabled = false; } });
}

// ================== UNGGAH BERKAS ==================
// Dua pilihan: (1) Upload Langsung (<= 10 MB, tersimpan otomatis ke folder Drive) dan
// (2) Upload via Google Form (> 10 MB; ID Pengajuan terisi otomatis, diarsipkan otomatis oleh trigger).
const EKSTENSI_BOLEH = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'xls', 'xlsx'];
const MAKS_BYTE_UNGGAH = 10 * 1024 * 1024;
const ACCEPT_UNGGAH = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx';

// ---------- Animasi proses unggah ----------
const IKON_PROSES = `<div style="position:absolute;inset:0;border-radius:50%;border:5px solid #dbeafe"></div>
    <div style="position:absolute;inset:0;border-radius:50%;border:5px solid #2563eb;border-top-color:transparent;animation:unggahPutar .9s linear infinite"></div>
    <i class="fa-solid fa-cloud-arrow-up" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#2563eb;font-size:18px"></i>`;
const IKON_OK = `<div class="unggah-ok" style="position:absolute;inset:0;border-radius:50%;background:#059669;display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px"><i class="fa-solid fa-check"></i></div>`;

function siapkanOverlayUnggah() {
    if (document.getElementById('overlayUnggah')) return;
    const st = document.createElement('style');
    st.textContent = `@keyframes unggahPutar{to{transform:rotate(360deg)}}
        @keyframes unggahGeser{0%{transform:translateX(-110%)}100%{transform:translateX(360%)}}
        @keyframes unggahMuncul{0%{transform:scale(.4);opacity:0}70%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
        .unggah-bar{width:30%;animation:unggahGeser 1.2s ease-in-out infinite}
        .unggah-ok{animation:unggahMuncul .4s ease-out}`;
    document.head.appendChild(st);
    const el = document.createElement('div'); el.id = 'overlayUnggah';
    el.style.cssText = 'display:none;position:fixed;inset:0;z-index:500;background:rgba(16,29,56,.6);backdrop-filter:blur(2px);align-items:center;justify-content:center;padding:16px';
    el.innerHTML = `<div style="background:#fff;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.35);width:100%;max-width:360px;padding:26px;text-align:center">
        <div id="ovIkon" style="position:relative;width:60px;height:60px;margin:0 auto 12px"></div>
        <div id="ovJudul" style="font-weight:700;color:#1e293b;font-size:15px"></div>
        <div id="ovTahap" style="font-size:12px;color:#2563eb;margin-top:4px;font-weight:600;min-height:16px"></div>
        <div id="ovNama" style="font-size:11px;color:#64748b;margin-top:4px;word-break:break-all;min-height:14px"></div>
        <div style="height:8px;background:#e2e8f0;border-radius:99px;margin-top:16px;overflow:hidden"><div id="ovBar" style="height:100%;border-radius:99px"></div></div>
        <div id="ovCatatan" style="font-size:11px;color:#94a3b8;margin-top:12px">Mohon jangan menutup halaman ini</div></div>`;
    document.body.appendChild(el);
}
function ovMulai() {
    siapkanOverlayUnggah();
    document.getElementById('ovIkon').innerHTML = IKON_PROSES;
    document.getElementById('ovJudul').textContent = 'Sedang mengunggah...';
    document.getElementById('ovTahap').textContent = 'Menyiapkan...';
    document.getElementById('ovNama').textContent = '';
    document.getElementById('ovCatatan').textContent = 'Mohon jangan menutup halaman ini';
    const bar = document.getElementById('ovBar'); bar.className = 'unggah-bar'; bar.style.width = ''; bar.style.background = 'linear-gradient(90deg,#3b82f6,#2563eb)';
    document.getElementById('overlayUnggah').style.display = 'flex';
}
function ovFile(i, total, nama) {
    document.getElementById('ovJudul').textContent = total > 1 ? 'Mengunggah berkas ' + i + ' dari ' + total : 'Sedang mengunggah...';
    document.getElementById('ovNama').textContent = nama;
}
function ovTahap(teks) { const el = document.getElementById('ovTahap'); if (el) el.textContent = teks; }
function ovTutup() { const el = document.getElementById('overlayUnggah'); if (el) el.style.display = 'none'; }
// Tampilkan hasil sebentar (centang animasi) lalu tutup
function ovSelesai(ok, gagal) {
    const bar = document.getElementById('ovBar'); bar.className = ''; bar.style.width = '100%';
    if (ok > 0) {
        document.getElementById('ovIkon').innerHTML = IKON_OK; bar.style.background = '#059669';
        document.getElementById('ovJudul').textContent = gagal ? ok + ' berkas berhasil, ' + gagal + ' gagal' : (ok > 1 ? ok + ' berkas berhasil diunggah' : 'Berhasil diunggah');
        document.getElementById('ovTahap').textContent = 'Tersimpan di Google Drive'; document.getElementById('ovNama').textContent = '';
        document.getElementById('ovCatatan').textContent = '';
        return new Promise(r => setTimeout(() => { ovTutup(); r(); }, 1200));
    }
    ovTutup(); return Promise.resolve();
}

// ---------- Unggah langsung ----------
function bacaFileBase64(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1] || '');
        r.onerror = () => reject(new Error('Gagal membaca file "' + file.name + '".'));
        r.readAsDataURL(file);
    });
}

function pesanFileBesar(daftarNama) {
    return 'File berikut lebih dari 10 MB sehingga tidak bisa diunggah langsung:\n- ' + daftarNama.join('\n- ') +
        '\n\nGunakan tombol "Upload via Google Form" untuk file di atas 10 MB (ID Pengajuan akan terisi otomatis).';
}

// onTahap(teks) opsional: dipakai untuk memperbarui animasi proses
async function unggahSatuFile(idSpj, slot, file, onTahap) {
    const ext = (file.name.includes('.') ? file.name.split('.').pop() : '').toLowerCase();
    if (!EKSTENSI_BOLEH.includes(ext)) throw new Error('"' + file.name + '": tipe file tidak diizinkan (PDF, JPG, PNG, DOC, DOCX, XLS, XLSX).');
    if (file.size > MAKS_BYTE_UNGGAH) throw new Error('"' + file.name + '": lebih dari 10 MB. Gunakan Upload via Google Form.');
    if (onTahap) onTahap('Membaca file...');
    const data = await bacaFileBase64(file);
    if (onTahap) onTahap('Mengirim & menyimpan ke Google Drive...');
    const res = await apiPost({ action: 'upload_berkas', id: idSpj, slot: slot, nama: file.name, data: data });
    if (res.status !== 'success') throw new Error('"' + file.name + '": ' + (res.message || 'gagal diunggah.'));
    return res;
}

// Dari modal detail: pilih file lalu unggah
function pilihBerkas(idSpj, slot) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.multiple = true; inp.accept = ACCEPT_UNGGAH;
    inp.onchange = async () => {
        const semua = Array.from(inp.files || []); if (!semua.length) return;
        const besar = semua.filter(f => f.size > MAKS_BYTE_UNGGAH), layak = semua.filter(f => f.size <= MAKS_BYTE_UNGGAH);
        if (besar.length) alert(pesanFileBesar(besar.map(f => f.name)));
        if (!layak.length) return;

        ovMulai();
        let ok = 0; const gagal = [];
        for (let i = 0; i < layak.length; i++) {
            ovFile(i + 1, layak.length, layak[i].name);
            try { await unggahSatuFile(idSpj, slot, layak[i], ovTahap); ok++; }
            catch (e) { if (String(e.message) === 'Sesi berakhir') { ovTutup(); return; } gagal.push(e.message); }
        }
        ovTahap('Memperbarui daftar berkas...');
        await tarikDataDariServer();
        await ovSelesai(ok, gagal.length);
        if (gagal.length) alert('Sebagian berkas gagal:\n' + gagal.join('\n'));
        if (ok) showToast(ok + ' berkas berhasil diunggah.');
        if (String(activeSelectedId) === String(idSpj)) bukaModalVerifikasi(idSpj);
    };
    inp.click();
}

// Panel unggah pada layar "berhasil disimpan": dua pilihan
function panelUploadHtml(idSpj, jenis) {
    const l1 = jenis === 'LS' ? 'Kwitansi Kontrak / SPK' : 'Dok. Keuangan (SPP/SPM/Pajak)';
    const l2 = jenis === 'LS' ? 'Berkas Pencairan LS' : 'SPJ Fungsional (Kwitansi/Nota/Absen)';
    const kotak = (slot, label, no) => `<div><label class="block text-xs font-bold text-slate-700 mb-1">${no}. ${label}</label>
        <input type="file" id="fileUp_${slot}" multiple accept="${ACCEPT_UNGGAH}" class="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-blue-100 file:text-blue-700 file:font-bold">
        <div id="statusUp_${slot}" class="text-[11px] mt-1 space-y-0.5"></div></div>`;
    return `<div class="text-left bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 mb-3">
        <p class="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2"><strong>PENTING:</strong> pengajuan belum lengkap sebelum berkas diunggah. Pilih salah satu cara di bawah.</p>
        <div class="text-[11px] font-bold text-slate-600">Pilihan 1 &mdash; Upload langsung <span class="font-normal text-slate-500">(maks. 10 MB per berkas; PDF/JPG/PNG/Word/Excel)</span></div>
        ${kotak('keuangan', l1, 1)}${kotak('spj', l2, 2)}
        <button type="button" id="btnUnggahPanel" onclick="unggahDariPanel('${escapeHtml(idSpj)}')" class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md text-sm"><i class="fa-solid fa-cloud-arrow-up me-2"></i> Unggah Berkas</button>
        ${(typeof adaFormUploadAktif === 'function' ? adaFormUploadAktif(jenis) : true) ? `
        <div class="flex items-center gap-2 text-[10px] text-slate-400"><div class="flex-1 h-px bg-slate-200"></div>ATAU<div class="flex-1 h-px bg-slate-200"></div></div>
        <div class="text-[11px] font-bold text-slate-600">Pilihan 2 &mdash; Untuk file lebih dari 10 MB</div>
        <a href="${escapeHtml(urlFormUploadAktif(jenis, idSpj))}" target="_blank" rel="noopener noreferrer" class="block w-full text-center py-2.5 bg-white border-2 border-blue-600 text-blue-700 hover:bg-blue-50 font-bold rounded-lg text-sm"><i class="fa-solid fa-arrow-up-right-from-square me-2"></i> Upload via Google Form</a>
        <p class="text-[10px] text-slate-500 leading-relaxed">ID Pengajuan terisi otomatis. Setelah mengirim Form, tunggu &plusmn; 1 menit lalu tekan tombol <b>Refresh</b> pada tabel agar berkas tampil.</p>` : `
        <p class="text-[10px] text-slate-500 bg-white border border-slate-200 rounded p-2 leading-relaxed"><i class="fa-solid fa-circle-info text-blue-500 me-1"></i>Upload via Google Form (&gt; 10 MB) untuk TA ${escapeHtml(String((typeof CONFIG !== 'undefined' && CONFIG.TAHUN_ANGGARAN) || ''))} belum diaktifkan. Kompres atau pecah berkas menjadi &le; 10 MB per file lalu gunakan tombol <b>Unggah Berkas</b> di atas.</p>`}
        <button type="button" onclick="closeModal('modalNewSpj')" class="w-full text-xs text-slate-500 hover:text-slate-800 underline">Unggah nanti (lewat tombol Detail pada tabel)</button>
    </div>`;
}

async function unggahDariPanel(idSpj) {
    const btn = document.getElementById('btnUnggahPanel');
    const antrean = [];
    for (const slot of ['keuangan', 'spj']) {
        const st = document.getElementById('statusUp_' + slot); st.innerHTML = '';
        Array.from(document.getElementById('fileUp_' + slot).files || []).forEach(f => {
            const baris = document.createElement('div'); st.appendChild(baris);
            if (f.size > MAKS_BYTE_UNGGAH) { baris.className = 'text-red-600'; baris.textContent = '✖ ' + f.name + ' lebih dari 10 MB: gunakan Upload via Google Form'; }
            else { baris.className = 'text-slate-500'; baris.textContent = '• ' + f.name + ' (menunggu)'; antrean.push({ slot, f, baris }); }
        });
    }
    if (!antrean.length) { alert('Pilih minimal satu berkas (maks. 10 MB per berkas) terlebih dahulu.'); return; }

    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Mengunggah...';
    ovMulai();
    let ok = 0, gagal = 0;
    for (let i = 0; i < antrean.length; i++) {
        const { slot, f, baris } = antrean[i];
        ovFile(i + 1, antrean.length, f.name);
        baris.className = 'text-blue-600'; baris.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + escapeHtml(f.name);
        try { await unggahSatuFile(idSpj, slot, f, ovTahap); baris.className = 'text-emerald-600'; baris.textContent = '✔ ' + f.name; ok++; }
        catch (e) { if (String(e.message) === 'Sesi berakhir') { ovTutup(); return; } baris.className = 'text-red-600'; baris.textContent = '✖ ' + e.message; gagal++; }
    }
    ovTahap('Memperbarui data...');
    await tarikDataDariServer();
    await ovSelesai(ok, gagal);
    btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up me-2"></i> Unggah Berkas';
    if (ok) showToast(ok + ' berkas tersimpan di Drive' + (gagal ? ' (' + gagal + ' gagal)' : '.'));
}

// ================== HAPUS PENGAJUAN SPJ GU / LS (SUPER_ADMIN saja) ==================
// Tombol hanya dirender untuk SUPER_ADMIN (renderTabelSpj); server memvalidasi ulang role sebelum menghapus.
function hapusPengajuan(id, btn) {
    if (sesiAktif.role !== 'SUPER_ADMIN') return;
    const item = spjData.find(x => String(x.id) === String(id));
    if (!item) { alert('Data pengajuan tidak ditemukan. Muat ulang halaman.'); return; }
    const jenis = String(item.jenisSurat || 'GU');
    const pesan = 'HAPUS PERMANEN pengajuan SPJ ' + jenis + ' ini?\n\n' +
        (jenis === 'LS' ? 'No. Kontrak / ID : ' : 'No. NPD / ID     : ') + (item.npd || '-') + '  [' + item.id + ']\n' +
        'Sub Kegiatan    : ' + (item.subKegiatan || '-') + '\n' +
        'Uraian          : ' + String(item.uraian || '-').slice(0, 120) + '\n' +
        'Nominal         : ' + formatRupiah(item.nominal) + '\n' +
        'Nama Penyedia   : ' + (jenis === 'LS' && item.namaCv ? item.namaCv : '-') + '\n' +
        'PPTK / Status   : ' + (item.pptk || '-') + ' / ' + (item.status || '-') + '\n\n' +
        (item.status === 'SUDAH DIPINDAHBUKUKAN' ? 'PERHATIAN: pengajuan ini sudah dipindahbukukan; realisasi pagu akan berkurang.\n' : '') +
        'Baris di Spreadsheet ikut terhapus dan tidak dapat dikembalikan. Berkas yang sudah diunggah ke Drive tidak ikut terhapus.';
    if (!confirm(pesan)) return;
    const awal = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }
    apiPost({ action: 'delete_pengajuan', id: item.id })
        .then(res => {
            if (res.status !== 'success') { alert('Gagal menghapus: ' + res.message); if (btn) { btn.disabled = false; btn.innerHTML = awal; } return; }
            spjData = spjData.filter(x => String(x.id) !== String(item.id));      // buang dari cache memori
            if (res.realisasi) realisasiPagu = res.realisasi;                       // realisasi terbaru dari server
            koreksiHalamanSpj();
            renderTabelSpj(); hitungAnggaran();                                     // tabel + kartu ringkasan & realisasi pagu
            if (typeof BAP !== 'undefined') BAP.renderTabel();
            showToast('Pengajuan dihapus.');
            tarikDataDariServer();                                                  // muat ulang penuh: tidak ada data sisa
        })
        .catch(err => { if (String(err.message) !== 'Sesi berakhir') alert('Koneksi terputus: ' + err.message); if (btn) { btn.disabled = false; btn.innerHTML = awal; } });
}
// Bila halaman aktif menjadi kosong setelah penghapusan, mundur satu halaman
function koreksiHalamanSpj() {
    const maks = Math.max(1, Math.ceil(getFilteredSpjData().length / rowsPerPage));
    if (currentPage > maks) currentPage = maks;
}
