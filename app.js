// ========================================================
// FILE: app.js (Sistem Logika Utama Terintegrasi Spreadsheet)
// ========================================================

let spjData = []; let referensiData = {}; 
let activeSelectedId = null; let pendingStatusChange = null;
let sesiAktif = { role: "", username: "", namaLengkap: "" };
let isEditMode = false; let editIdTarget = null;
let currentPage = 1; let rowsPerPage = 10;
let filterJenis = 'ALL'; 

let searchQuery = '';
let sortType = 'TGL_DESC';

let editIndexAkun = -1; let editIndexPptk = -1;
let realisasiPagu = null;   // hasil hitung server: PPTK = ringkasan, peran lain = rincian triwulan

// ---------- Helper keamanan tampilan ----------
// Link hanya boleh mengarah ke Google Drive / Docs (cegah link berbahaya dari isian sel)
function amanUrl(u) { u = String(u || '').trim(); return /^https:\/\/(drive|docs)\.google\.com\//.test(u) ? u : '#'; }
// Teks bebas (catatan/log): di-escape, hanya <br> hasil enter yang dipulihkan
function teksCatatan(s) { return escapeHtml(String(s === null || s === undefined ? '' : s)).replace(/&lt;br\s*\/?&gt;/gi, '<br>'); }

function updateSapaanWaktu() {
    const jam = new Date().getHours();
    let sapaan = 'Selamat Pagi';
    
    if (jam >= 3 && jam < 11) sapaan = 'Selamat Pagi';
    else if (jam >= 11 && jam < 15) sapaan = 'Selamat Siang';
    else if (jam >= 15 && jam < 18) sapaan = 'Selamat Sore';
    else sapaan = 'Selamat Malam';

    const loginSapaan = document.getElementById('sapaan-login');
    if (loginSapaan) loginSapaan.innerHTML = `${sapaan} `;
    
    const headerSapaan = document.getElementById('sapaan-header');
    if (headerSapaan) headerSapaan.innerText = sapaan;
}

function formatTanggalIndo(dateStr) {
    if (!dateStr || dateStr === '-') return '-';
    if (dateStr.includes('T')) {
        let rawDate = dateStr.split('T')[0];
        let parts = rawDate.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    if (dateStr.includes('/')) {
       return dateStr;
    }
    return dateStr;
}

function inisialisasiServer() { updateSapaanWaktu(); }
inisialisasiServer();

// Login diperiksa di SERVER. Browser tidak lagi memegang daftar akun/password.
function checkLogin() {
    const uname = document.getElementById('username-input').value.trim().toLowerCase();
    const pass = document.getElementById('password-input').value;
    const pe = document.getElementById('pin-error');
    if (!uname || !pass) { pe.innerText = "Username dan Password wajib diisi!"; pe.classList.remove('hidden'); return; }

    const btn = document.querySelector('button[onclick="checkLogin()"]');
    const teksAsli = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Memeriksa...'; btn.disabled = true; }
    pe.classList.add('hidden');

    apiPost({ action: 'login', username: uname, password: pass })
        .then(res => {
            if (res.status === 'success') {
                sessionStorage.setItem('sesi_token', res.token);
                sesiAktif = { role: res.user.role, username: res.user.username, namaLengkap: res.user.namaLengkap };
                document.getElementById('password-input').value = "";
                return tarikDataDariServer().then(() => masukSistem());
            }
            pe.innerText = res.message || "Username atau Password salah!";
            pe.classList.remove('hidden');
        })
        .catch(e => {
            if (String(e.message) === 'Sesi berakhir') return;
            pe.innerText = "Gagal terhubung ke server. Periksa koneksi lalu coba lagi.";
            pe.classList.remove('hidden');
        })
        .finally(() => { if (btn) { btn.innerHTML = teksAsli; btn.disabled = false; } });
}

function togglePassword() {
    const passwordInput = document.getElementById('password-input'); const eyeIcon = document.getElementById('eye-icon');
    if (!passwordInput || !eyeIcon) return;
    if (passwordInput.type === 'password') { passwordInput.type = 'text'; eyeIcon.classList.replace('fa-eye', 'fa-eye-slash'); } 
    else { passwordInput.type = 'password'; eyeIcon.classList.replace('fa-eye-slash', 'fa-eye'); }
}

function toggleProfileMenu() {
    const dd = document.getElementById('profileDropdown');
    if(dd.classList.contains('hidden')) { dd.classList.remove('hidden'); } else { dd.classList.add('hidden'); }
}

document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('profileDropdown'); if (!dropdown) return;
    const profileBtn = dropdown.previousElementSibling;
    if (!dropdown.contains(event.target) && !profileBtn.contains(event.target)) { dropdown.classList.add('hidden'); }
});

function masukSistem() {
    sessionStorage.setItem('sesiAktif_role', sesiAktif.role);
    sessionStorage.setItem('sesiAktif_username', sesiAktif.username);
    sessionStorage.setItem('sesiAktif_namaLengkap', sesiAktif.namaLengkap);

    document.getElementById('login-screen').style.display = 'none'; 
    document.getElementById('main-app').style.display = 'flex';
    updateSapaanWaktu();
    
    document.getElementById('role-badge').innerText = sesiAktif.role; 
    document.getElementById('user-display').innerText = sesiAktif.namaLengkap;
    const jabatanHeader = document.getElementById('jabatan-header-text'); if(jabatanHeader) jabatanHeader.innerText = sesiAktif.role; 
    const ddNama = document.getElementById('dd-nama'); if(ddNama) ddNama.innerText = sesiAktif.namaLengkap;
    const ddRole = document.getElementById('dd-role'); if(ddRole) ddRole.innerText = sesiAktif.role;

    const sidebarSuperAdmin = document.getElementById('sidebarSuperAdmin');
    if (sesiAktif.role === 'SUPER_ADMIN') {
        if(sidebarSuperAdmin) { sidebarSuperAdmin.classList.remove('hidden'); sidebarSuperAdmin.classList.add('flex'); }
    } else {
        if(sidebarSuperAdmin) { sidebarSuperAdmin.classList.add('hidden'); sidebarSuperAdmin.classList.remove('flex'); }
    }
    
    // Atur Pagu: hanya SUPER_ADMIN
    document.querySelectorAll('.btn-edit-pagu').forEach(btn => btn.style.display = (sesiAktif.role === 'SUPER_ADMIN') ? 'block' : 'none');
    // Buat Pengajuan: hanya PPTK & SUPER_ADMIN (VERIFIKATOR & PIMPINAN hanya melihat / memverifikasi)
    document.querySelectorAll('.btn-buat-spj').forEach(btn => { const li = btn.closest('li'); (li || btn).style.display = bisaBuatSpj() ? '' : 'none'; });
    
    isiDropdownPptkUtama(); kunciPptkLogin(); renderTabelSpj(); hitungAnggaran(); isiDropdownProgram();
}

// PPTK hanya boleh mengajukan atas namanya sendiri (server juga memaksa hal yang sama)
function kunciPptkLogin() {
    const sel = document.getElementById('inputPptk'); if (!sel) return;
    if (sesiAktif.role === 'PPTK') { setSelectValue(sel, sesiAktif.namaLengkap); sel.style.pointerEvents = 'none'; sel.tabIndex = -1; sel.classList.add('bg-slate-100'); }
    else { sel.style.pointerEvents = 'auto'; sel.tabIndex = 0; sel.classList.remove('bg-slate-100'); }
}

document.addEventListener('DOMContentLoaded', () => {
    const savedRole = sessionStorage.getItem('sesiAktif_role');
    const savedName = sessionStorage.getItem('sesiAktif_namaLengkap');
    
    if (savedRole && savedName && sessionStorage.getItem('sesi_token')) {
        const loader = document.getElementById('global-loader');
        if (loader) { loader.classList.remove('hidden'); loader.classList.add('flex'); }
        document.getElementById('login-screen').style.display = 'none';

        sesiAktif = { 
            role: savedRole, 
            username: sessionStorage.getItem('sesiAktif_username'), 
            namaLengkap: savedName 
        };
        
        tarikDataDariServer().then(() => {
            masukSistem();
            if (loader) { loader.classList.remove('flex'); loader.classList.add('hidden'); }
        });
    }
});

function isiDropdownPptkUtama() {
    const selectPptk = document.getElementById('inputPptk');
    if(selectPptk && window.DATABASE_AKUN) {
        selectPptk.innerHTML = '<option value="" disabled selected>-- Pilih Nama PPTK --</option>';
        window.DATABASE_AKUN.forEach(user => { if(user.role === 'PPTK') { selectPptk.innerHTML += `<option value="${escapeHtml(user.namaLengkap)}">${escapeHtml(user.namaLengkap)}</option>`; } });
    }
}

function tarikDataDariServer() {
    const ic = document.getElementById('refresh-icon'); if (ic) ic.classList.add('animate-spin');
    return apiPost({ action: 'load' })
        .then(data => {
            if (data.status !== 'success') { alert("Gagal mengambil data dari server: " + (data.message || '')); return; }
            window.DATABASE_AKUN = data.akun || [];
            window.DATABASE_KONTRAK = data.kontrakLS || [];
            window.DATABASE_PENYEDIA = data.penyediaCV || [];
            if (data.pagu) { CONFIG.PAGU_TAHUNAN = data.pagu.tahunan || 0; CONFIG.PAGU_TW = data.pagu.tw || [0, 0, 0, 0]; }
            spjData = (data.spj || []).reverse();
            realisasiPagu = data.realisasi || null;
            if (data.tahunAnggaran) CONFIG.TAHUN_ANGGARAN = data.tahunAnggaran;
            referensiData = data.referensi || {};
            renderTabelSpj(); hitungAnggaran(); isiDropdownProgram(); isiDropdownPptkUtama();
            const tbAkun = document.getElementById('tabelAkunBody'); if (tbAkun && tbAkun.innerHTML !== '') renderTabelAkunAdmin();
        })
        .catch(e => console.error(e))
        .finally(() => { if (ic) ic.classList.remove('animate-spin'); });
}

function formatRupiah(amount) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount); }

// ================== PAGU: TAHUNAN + 4 TRIWULAN ==================
const TW_NAMA = ['Triwulan I', 'Triwulan II', 'Triwulan III', 'Triwulan IV'];
const TW_BULAN = ['Jan – Mar', 'Apr – Jun', 'Jul – Sep', 'Okt – Des'];

// Realisasi dihitung di SERVER (Code.gs): GU = bulan pada nomor NPD (.../P2/4/2026 = bulan 4),
// LS = tanggal pindahbuku. PPTK hanya menerima ringkasan; VERIFIKATOR/PIMPINAN/SUPER_ADMIN menerima rincian.
function hitungAnggaran() {
    const real = realisasiPagu || { ringkasan: true, totalCair: 0 };
    const totalCair = Number(real.totalCair) || 0;
    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.innerText = txt; };
    set('sisaTahunanVal', formatRupiah((CONFIG.PAGU_TAHUNAN || 0) - totalCair));
    set('paguTahunanInfo', 'dari pagu ' + formatRupiah(CONFIG.PAGU_TAHUNAN || 0));
    set('totalCairVal', formatRupiah(totalCair));
    set('labelTahunAnggaran', String(CONFIG.TAHUN_ANGGARAN));

    const ringkas = !!real.ringkasan || sesiAktif.role === 'PPTK';
    ['headerTriwulan', 'kartuTriwulan', 'infoPaguCatatan'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = ringkas ? 'none' : ''; });
    if (ringkas) return;

    const paguTw = CONFIG.PAGU_TW || [0, 0, 0, 0];
    const wadah = document.getElementById('kartuTriwulan');
    if (wadah) {
        wadah.innerHTML = TW_NAMA.map((nama, i) => {
            const pagu = Number(paguTw[i]) || 0, cair = Number((real.cair || [])[i]) || 0, proses = Number((real.proses || [])[i]) || 0;
            const sisa = pagu - cair, persen = pagu > 0 ? Math.min(100, cair / pagu * 100) : 0;
            const warnaBar = sisa < 0 ? 'bg-red-500' : (persen >= 85 ? 'bg-amber-500' : 'bg-sipd-emerald');
            return `<div class="bg-white rounded-lg border ${sisa < 0 ? 'border-red-300' : 'border-slate-200'} p-4 shadow-sm">
                <div class="flex justify-between items-baseline"><h4 class="text-[11px] font-bold uppercase tracking-wider text-slate-500">${nama}</h4><span class="text-[10px] text-slate-400">${TW_BULAN[i]}</span></div>
                <div class="text-lg font-bold mt-1 ${sisa < 0 ? 'text-red-600' : 'text-sipd-slate'}">${formatRupiah(sisa)}</div>
                <div class="text-[10px] text-slate-400">sisa dari ${formatRupiah(pagu)}</div>
                <div class="h-1.5 bg-slate-100 rounded mt-2 overflow-hidden"><div class="h-full ${warnaBar}" style="width:${persen.toFixed(1)}%"></div></div>
                <div class="flex justify-between text-[10px] mt-1.5 gap-2"><span class="text-slate-500">Cair ${formatRupiah(cair)}</span><span class="text-amber-600">Proses ${formatRupiah(proses)}</span></div>
            </div>`;
        }).join('');
    }
    let cat = 'Triwulan ditentukan dari bulan pada nomor NPD (contoh <b>.../P2/<u>4</u>/2026</b> = bulan 4) untuk GU, dan dari tanggal pindahbuku untuk LS. “Cair” = sudah dipindahbukukan; “Proses” = diajukan namun belum cair (ditolak tidak dihitung).';
    if (real.tanpaPeriode) cat += ` <span class="text-amber-600">${real.tanpaPeriode} pengajuan tidak terhitung karena bulan tidak dapat dibaca.</span>`;
    if (real.luarTahun) cat += ` <span class="text-slate-500">${real.luarTahun} pengajuan di luar TA ${CONFIG.TAHUN_ANGGARAN} tidak dihitung.</span>`;
    const elCat = document.getElementById('infoPaguCatatan'); if (elCat) elCat.innerHTML = cat;
}

function hitungSelisihPagu() {
    const th = Number(document.getElementById('inputPaguTahunan').value) || 0;
    let jml = 0; for (let i = 1; i <= 4; i++) jml += Number(document.getElementById('inputPaguTw' + i).value) || 0;
    const el = document.getElementById('infoSelisihPagu'); if (!el) return;
    const selisih = th - jml;
    el.innerHTML = `Jumlah 4 triwulan: <b>${formatRupiah(jml)}</b>` + (th > 0 ? (selisih === 0 ? ' <span class="text-emerald-600">(sama dengan pagu tahunan)</span>' : ` <span class="text-amber-600">(selisih ${formatRupiah(selisih)} dari pagu tahunan)</span>`) : '');
}

function bukaModalEditPagu() {
    document.getElementById('inputPaguTahunan').value = CONFIG.PAGU_TAHUNAN || '';
    for (let i = 0; i < 4; i++) document.getElementById('inputPaguTw' + (i + 1)).value = (CONFIG.PAGU_TW && CONFIG.PAGU_TW[i]) || '';
    hitungSelisihPagu();
    openModal('modalEditPagu');
}

function simpanPaguBaru() {
    const tahunan = Number(document.getElementById('inputPaguTahunan').value) || 0;
    const tw = [1, 2, 3, 4].map(i => Number(document.getElementById('inputPaguTw' + i).value) || 0);
    if (tahunan < 0 || tw.some(x => x < 0)) { alert('Nominal tidak boleh minus!'); return; }
    const btn = document.getElementById('btnSimpanPagu'); if (btn) { btn.disabled = true; btn.innerText = 'Menyimpan...'; }
    apiPost({ action: 'sync_pagu', tahunan, tw })
        .then(res => {
            if (res.status !== 'success') { alert('Gagal menyimpan pagu: ' + res.message); return; }
            CONFIG.PAGU_TAHUNAN = tahunan; CONFIG.PAGU_TW = tw;
            hitungAnggaran(); closeModal('modalEditPagu'); showToast('Pagu tersimpan ke server.');
        })
        .catch(e => { if (String(e.message) !== 'Sesi berakhir') alert('Koneksi gagal: ' + e.message); })
        .finally(() => { if (btn) { btn.disabled = false; btn.innerText = 'Simpan Pagu'; } });
}

// ---------- Hak akses di tampilan (penegakan sebenarnya ada di server / Code.gs) ----------
function bisaBuatSpj() { return sesiAktif.role === 'PPTK' || sesiAktif.role === 'SUPER_ADMIN'; }
function bisaVerifikasi() { return sesiAktif.role === 'VERIFIKATOR' || sesiAktif.role === 'SUPER_ADMIN'; }
function bisaEditItem(item) {
    if (sesiAktif.role === 'SUPER_ADMIN') return true;
    return sesiAktif.role === 'PPTK' && String(item.pptk).trim() === String(sesiAktif.namaLengkap).trim() && (item.status === 'BELUM_DIPROSES' || item.status === 'REVISI');
}
function bukaFormSpjBaru() {
    if (!bisaBuatSpj()) { alert('Peran Anda tidak memiliki hak membuat pengajuan.'); return; }
    isEditMode = false; editIdTarget = null; openModal('modalNewSpj');
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

function setJenisTampilan(jenis) {
    filterJenis = jenis; currentPage = 1;
    document.querySelectorAll('.menu-item').forEach(el => {
        el.classList.remove('bg-emerald-50', 'text-emerald-700', 'border-emerald-100', 'active-menu', 'font-bold');
        el.classList.add('text-slate-600', 'hover:bg-slate-50', 'hover:text-emerald-600', 'font-medium', 'border-transparent');
        const icon = el.querySelector('.menu-icon'); if(icon) icon.classList.replace('text-emerald-500', 'text-slate-400');
        const dot = el.querySelector('.indicator-dot'); if(dot) dot.remove();
    });
    const activeEl = document.getElementById('menu-' + jenis.toLowerCase());
    if (activeEl) {
        activeEl.classList.remove('text-slate-600', 'hover:bg-slate-50', 'hover:text-emerald-600', 'font-medium', 'border-transparent');
        activeEl.classList.add('bg-emerald-50', 'text-emerald-700', 'border-emerald-100', 'active-menu', 'font-bold');
        const icon = activeEl.querySelector('.menu-icon'); if(icon) icon.classList.replace('text-slate-400', 'text-emerald-500');
        if (!activeEl.querySelector('.indicator-dot')) { const dot = document.createElement('div'); dot.className = 'w-1.5 h-1.5 bg-emerald-500 rounded-full indicator-dot'; activeEl.appendChild(dot); }
    }
    
    const title = document.getElementById('page-title'); 
    const breadcrumb = document.getElementById('breadcrumb-text'); 
    const tbTitle = document.getElementById('tabel-judul-jenis');
    
    if (jenis === 'ALL') { 
        if(title) title.innerText = 'Dashboard Utama'; 
        if(breadcrumb) breadcrumb.innerText = 'Dashboard Semua'; 
        if(tbTitle) tbTitle.innerText = 'GU & LS'; 
    } else if (jenis === 'GU') { 
        if(title) title.innerText = 'Data SPJ Ganti Uang (GU)'; 
        if(breadcrumb) breadcrumb.innerText = 'Data SPJ GU'; 
        if(tbTitle) tbTitle.innerText = 'Ganti Uang (GU)'; 
    } else if (jenis === 'LS') { 
        if(title) title.innerText = 'Data SPJ Langsung (LS)'; 
        if(breadcrumb) breadcrumb.innerText = 'Data SPJ LS'; 
        if(tbTitle) tbTitle.innerText = 'Langsung (LS)'; 
    }
    
    const thJenis = document.getElementById('th-jenis'); 
    const thCv = document.getElementById('th-cv');
    const thTahap = document.getElementById('th-tahap');
    const thTglPb = document.getElementById('th-tglpb');
    
    if (jenis === 'ALL') { 
        if(thJenis) thJenis.style.display = 'table-cell'; 
        if(thCv) thCv.style.display = 'table-cell';
        if(thTahap) thTahap.style.display = 'table-cell';
        if(thTglPb) thTglPb.style.display = 'table-cell';
    } 
    else if (jenis === 'GU') { 
        if(thJenis) thJenis.style.display = 'none'; 
        if(thCv) thCv.style.display = 'none';
        if(thTahap) thTahap.style.display = 'none';
        if(thTglPb) thTglPb.style.display = 'table-cell';
    }
    else if (jenis === 'LS') {
        if(thJenis) thJenis.style.display = 'none'; 
        if(thCv) thCv.style.display = 'table-cell';
        if(thTahap) thTahap.style.display = 'table-cell';
        if(thTglPb) thTglPb.style.display = 'none';
    }
    
    renderTabelSpj();
}

function escapeHtml(s) {
    return String(s === null || s === undefined ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Isi <select>; kalau nilainya belum ada di daftar opsi, opsinya ditambahkan dulu
function setSelectValue(el, val) {
    if (!el) return;
    val = String(val === null || val === undefined ? '' : val);
    if (val && !Array.from(el.options).some(o => o.value === val)) {
        el.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(val)}">${escapeHtml(val)}</option>`);
    }
    el.value = val;
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

        // Data LS diambil dari BAP -> kolom dikunci
        if (boxBap) boxBap.classList.remove('hidden');
        inputTeks.forEach(el => { if (el) { el.readOnly = true; el.classList.add('bg-slate-100'); } });
        selectAnggaran.forEach(el => { if (el) { el.style.pointerEvents = 'none'; el.tabIndex = -1; el.classList.add('bg-slate-100'); } });

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
                        const noUrut = 'LS-' + String(jumlahLSSaatIni + 1).padStart(4, '0');
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
            } else { alert("GAGAL MENYIMPAN!\n" + res.message); }
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

function gantiPageSize() { rowsPerPage = parseInt(document.getElementById('selectPageSize').value); currentPage = 1; renderTabelSpj(); }
function gantiHalaman(arah) { const tData = spjData.filter(i => filterJenis === 'ALL' || String(i.jenisSurat || 'GU') === filterJenis); const totalPages = Math.ceil(tData.length / rowsPerPage); currentPage += arah; if (currentPage < 1) currentPage = 1; if (currentPage > totalPages) currentPage = totalPages; renderTabelSpj(); }

function terapkanFilterDanSort() {
    searchQuery = document.getElementById('inputSearchSpj') ? document.getElementById('inputSearchSpj').value.toLowerCase() : '';
    sortType = document.getElementById('selectSortSpj') ? document.getElementById('selectSortSpj').value : 'TGL_DESC';
    currentPage = 1; 
    renderTabelSpj();
}

function renderTabelSpj() {
    const tbody = document.getElementById('spjTableBody'); tbody.innerHTML = '';
    // --- TAMBAHAN LOGIKA ACTIONABLE COUNTERS ---
    let totalMenunggu = 0;
    let totalRevisi = 0;
    let totalSiapPb = 0;

    spjData.forEach(item => {
        if (sesiAktif.role === 'PPTK' && item.pptk !== sesiAktif.namaLengkap) return;
        if (item.status === 'BELUM_DIPROSES') totalMenunggu++;
        if (item.status === 'REVISI') totalRevisi++;
        if (item.status === 'DISETUJUI') totalSiapPb++; 
    });

    const elMenunggu = document.getElementById('countMenunggu');
    const elRevisi = document.getElementById('countRevisi');
    const elSiapPb = document.getElementById('countSiapPb');

    if(elMenunggu) elMenunggu.innerText = totalMenunggu;
    if(elRevisi) elRevisi.innerText = totalRevisi;
    if(elSiapPb) elSiapPb.innerText = totalSiapPb;
    
    let filteredData = [...spjData]; 
    if (filterJenis !== 'ALL') {
        filteredData = filteredData.filter(item => String(item.jenisSurat || 'GU') === filterJenis);
    }
    if (searchQuery) {
        filteredData = filteredData.filter(item => {
            const textToSearch = `${item.npd} ${item.kegiatan} ${item.pptk} ${item.uraian} ${item.namaCv}`.toLowerCase();
            return textToSearch.includes(searchQuery);
        });
    }

    filteredData.sort((a, b) => {
        let valA = Number(a.nominal) || 0;
        let valB = Number(b.nominal) || 0;
        let dateA = new Date(a.createdAt);
        let dateB = new Date(b.createdAt);
        if (sortType === 'NOMINAL_DESC') return valB - valA;
        if (sortType === 'NOMINAL_ASC') return valA - valB;
        if (sortType === 'TGL_ASC') return dateA - dateB;
        return dateB - dateA;
    });

    const totalData = filteredData.length; const totalPages = Math.ceil(totalData / rowsPerPage) || 1;
    const startIndex = (currentPage - 1) * rowsPerPage; const endIndex = Math.min(startIndex + rowsPerPage, totalData);
    const infoEl = document.getElementById('infoHalaman'); const btnPrev = document.getElementById('btnPrevPage'); const btnNext = document.getElementById('btnNextPage');
    if (infoEl) infoEl.innerText = `Hal ${currentPage} dari ${totalPages}`;
    if (btnPrev) btnPrev.disabled = currentPage === 1; if (btnNext) btnNext.disabled = currentPage === totalPages || totalPages === 0;
    const dataHalamanIni = filteredData.slice(startIndex, endIndex);

    let colSpanNum = filterJenis === 'ALL' ? 12 : (filterJenis === 'LS' ? 10 : 9);
    if (dataHalamanIni.length === 0) { tbody.innerHTML = `<tr><td colspan="${colSpanNum}" class="text-center py-10 text-slate-500 font-medium">Belum ada data SPJ untuk ditampilkan.</td></tr>`; return; }

    dataHalamanIni.forEach(item => {
        let badge = `<span class="px-2.5 py-1 rounded-full border border-slate-200 font-bold text-slate-600 bg-slate-100 text-[10px] tracking-wide">MENUNGGU</span>`;
        if(item.status === 'DISETUJUI') badge = `<span class="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 text-[10px] tracking-wide">DISETUJUI</span>`;
        if(item.status === 'REVISI') badge = `<span class="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200 text-[10px] tracking-wide">REVISI</span>`;
        if(item.status === 'DITOLAK') badge = `<span class="px-2.5 py-1 rounded-full bg-red-50 text-red-700 font-bold border border-red-200 text-[10px] tracking-wide">DITOLAK</span>`;
        if(item.status === 'SUDAH DIPINDAHBUKUKAN') badge = `<span class="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200 text-[10px] tracking-wide">SELESAI PB</span>`;
        
        const bacaSaja = (sesiAktif.role === 'PPTK' || sesiAktif.role === 'PIMPINAN');
        let actionBtnText = bacaSaja ? '<i class="fa-solid fa-folder-open"></i> DETAIL' : '<i class="fa-solid fa-clipboard-check"></i> VERIFIKASI';
        let actionBtnColor = bacaSaja ? 'bg-slate-700 hover:bg-slate-800' : 'bg-sipd-navy hover:bg-slate-800';

        let jenisSurat = String(item.jenisSurat || 'GU');
        let jenisBadge = jenisSurat === 'LS' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200';
        let tdJenisHtml = filterJenis === 'ALL' ? `<td class="py-4 px-4 text-xs align-top text-center whitespace-nowrap"><span class="px-2 py-1 rounded-md border font-bold text-[10px] ${jenisBadge}">${jenisSurat}</span></td>` : ``;

        let cvText = jenisSurat === 'LS' && item.namaCv ? escapeHtml(item.namaCv) : '-';
        let tahapText = jenisSurat === 'LS' && item.tahap ? escapeHtml(item.tahap) : '-';
        let tglPbText = item.tglPb ? formatTanggalIndo(String(item.tglPb)) : '-';
        let uraianPekerjaan = escapeHtml(item.uraian || '-');

        let tdCvHtml = (filterJenis === 'ALL' || filterJenis === 'LS') ? `<td class="py-4 px-4 text-xs align-top font-bold text-purple-700">${cvText}</td>` : ``;
        let tdTahapHtml = (filterJenis === 'ALL' || filterJenis === 'LS') ? `<td class="py-4 px-4 text-xs align-top text-center">${tahapText}</td>` : ``;
        let tdTglPbHtml = (filterJenis === 'ALL' || filterJenis === 'GU') ? `<td class="py-4 px-4 text-xs align-top font-bold text-blue-600">${tglPbText}</td>` : ``;

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50/50 border-b border-slate-100 transition-colors">
                <td class="py-4 px-4 text-xs align-top whitespace-nowrap text-slate-500 font-medium">${formatTanggalIndo(item.createdAt)}</td>
                <td class="py-4 px-4 text-xs align-top font-bold text-slate-800 max-w-[150px] whitespace-normal break-words">${escapeHtml(item.npd || '-')}</td>
                ${tdJenisHtml}
                <td class="py-4 px-4 text-xs align-top whitespace-nowrap">${escapeHtml(item.pptk || '-')}<br><span class="text-[10px] text-slate-500">${escapeHtml(item.unitKerja || '-')}</span></td>
                <td class="py-4 px-4 text-xs align-top leading-relaxed min-w-[200px] whitespace-normal break-words">
                    <span class="font-bold text-slate-800">${escapeHtml(item.program || '-')}</span><br>
                    <span class="text-slate-500">${escapeHtml(item.kegiatan || '-')}</span><br>
                    <span class="text-[10px] text-slate-400">${escapeHtml(item.subKegiatan || '-')}</span>
                </td>
                ${tdCvHtml}
                ${tdTahapHtml}
                ${tdTglPbHtml}
                <td class="py-4 px-4 text-xs align-top text-slate-600 max-w-[200px] whitespace-normal break-words">${uraianPekerjaan}</td>
                <td class="py-4 px-4 text-xs text-right font-bold align-top whitespace-nowrap text-slate-800">${formatRupiah(item.nominal)}</td>
                <td class="py-4 px-4 text-center align-top whitespace-nowrap">${badge}</td>
                <td class="py-4 px-4 text-center align-top whitespace-nowrap sticky right-0 bg-white/90 backdrop-blur-sm shadow-[-8px_0_15px_rgba(0,0,0,0.02)] z-10 border-l border-slate-100">
                    <button onclick="bukaModalVerifikasi('${escapeHtml(item.id)}')" class="px-4 py-1.5 ${actionBtnColor} text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer">${actionBtnText}</button>
                </td>
            </tr>
        `;
    });
}

function openModal(id) { 
    if(id === 'modalNewSpj' && !isEditMode) { 
        document.getElementById('formNewSpj').reset(); ubahLabelNpdKontrak(); kunciPptkLogin();
        const existingSukses = document.getElementById('pesanSuksesDiv'); if(existingSukses) existingSukses.remove();
        document.getElementById('formNewSpj').classList.remove('hidden'); document.getElementById('btnSubmitNew').innerText = "Lanjut ke Form Upload"; 
    }
    document.getElementById(id).classList.remove('hidden'); 
}

function switchTabAdmin(tabName) {
    document.querySelectorAll('.admin-tab-content').forEach(el => { el.classList.add('hidden'); el.classList.remove('flex'); });
    document.querySelectorAll('.admin-tab-btn').forEach(el => {
        el.classList.remove('bg-sipd-navy', 'text-white', 'font-bold');
        el.classList.add('text-slate-600', 'hover:bg-slate-100', 'font-medium');
    });
    const activeTab = document.getElementById(`tab-content-${tabName}`); const activeBtn = document.getElementById(`tab-btn-${tabName}`);
    if (activeTab) { activeTab.classList.remove('hidden'); activeTab.classList.add('flex'); }
    if (activeBtn) {
        activeBtn.classList.remove('text-slate-600', 'hover:bg-slate-100', 'font-medium');
        activeBtn.classList.add('bg-sipd-navy', 'text-white', 'font-bold');
    }
}

function infoPasswordAkun(akun) {
    if (!akun.username) return '<span class="text-slate-400 text-[10px]">-</span>';
    const peta = { HASH: ['bg-emerald-50 text-emerald-700 border-emerald-200', 'Ter-hash ✔'], TEKS_BIASA: ['bg-red-50 text-red-700 border-red-200', 'Teks biasa ⚠'], KOSONG: ['bg-slate-100 text-slate-600 border-slate-200', 'Belum ada'] };
    const f = peta[akun.passwordFormat] || peta.KOSONG;
    let html = `<span class="px-2 py-0.5 ${f[0]} border rounded text-[9px] font-bold">${f[1]}</span>`;
    if (akun.passwordDefault) html += ` <span class="px-2 py-0.5 bg-red-600 text-white rounded text-[9px] font-bold">Password default</span>`;
    html += `<div class="text-[9px] text-slate-400 mt-0.5">${akun.passwordDiubah ? 'Diubah: ' + escapeHtml(akun.passwordDiubah) + (akun.passwordDiubahOleh ? '<br>oleh ' + escapeHtml(akun.passwordDiubahOleh) : '') : 'Perubahan belum tercatat'}</div>`;
    if (akun.roleValid === false) html += '<div class="text-[9px] text-red-600 font-bold mt-0.5">ROLE TIDAK VALID — ubah ke salah satu dari 4 role</div>';
    return html;
}

function renderTabelAkunAdmin() {
    const tbody = document.getElementById('tabelAkunBody'); const tbPptk = document.getElementById('tabelPptkBody');
    if (!tbody || !tbPptk) return; tbody.innerHTML = ''; tbPptk.innerHTML = '';
    (window.DATABASE_AKUN || []).forEach((akun, index) => {
        const nama = escapeHtml(akun.namaLengkap);
        if (akun.role === 'PPTK') {
            tbPptk.innerHTML += `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="p-3 px-4 border-b border-slate-200 font-bold text-slate-800 text-xs">${nama}</td>
                <td class="p-3 px-4 border-b border-slate-200 text-slate-500 font-mono text-[11px]">${escapeHtml(akun.nip || '-')}</td>
                <td class="p-3 px-4 border-b border-slate-200 text-center whitespace-nowrap">
                    <button onclick="editDataPptk(${index})" class="px-2 py-1 bg-amber-50 text-amber-600 border border-amber-200 rounded text-[10px] font-bold hover:bg-amber-100"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="hapusDataAkun(${index})" class="px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded text-[10px] font-bold hover:bg-red-100 ml-1"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
        }
        const warna = { SUPER_ADMIN: 'bg-amber-50 text-amber-700 border-amber-200', PPTK: 'bg-blue-50 text-blue-700 border-blue-200', VERIFIKATOR: 'bg-emerald-50 text-emerald-700 border-emerald-200' }[akun.role] || 'bg-slate-100 text-slate-700 border-slate-200';
        const roleBadge = `<span class="px-2.5 py-1 ${warna} text-[10px] font-bold rounded-md border">${escapeHtml(akun.role)}</span>`;
        const infoPw = infoPasswordAkun(akun);
        const tombolUji = akun.username ? `<button onclick="bukaUjiPassword(${index})" title="Uji kecocokan password" class="px-2 py-1 bg-sky-50 text-sky-700 border border-sky-200 rounded text-[10px] font-bold hover:bg-sky-100 mr-1"><i class="fa-solid fa-key"></i></button>` : '';
        const identitasLogin = akun.username
            ? `<span class="text-blue-600 font-bold">${escapeHtml(akun.username)}</span>`
            : `<span class="text-red-500 italic text-[10px]">Belum Punya Akun</span>`;
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="p-3 px-4 border-b border-slate-200 font-bold text-slate-800 text-xs">${nama}</td>
                <td class="p-3 px-4 border-b border-slate-200 text-slate-500 font-mono text-[11px]">${identitasLogin}</td>
                <td class="p-3 px-4 border-b border-slate-200 text-xs">${roleBadge}</td>
                <td class="p-3 px-4 border-b border-slate-200 text-xs">${infoPw}</td>
                <td class="p-3 px-4 border-b border-slate-200 text-center whitespace-nowrap">
                    ${tombolUji}<button onclick="editDataAkun(${index})" class="px-2 py-1 bg-amber-50 text-amber-600 border border-amber-200 rounded text-[10px] font-bold hover:bg-amber-100"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="hapusDataAkun(${index})" class="px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded text-[10px] font-bold hover:bg-red-100 ml-1"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
    });
    isiDropdownPptkUtama();
}

// Kirim perubahan akun ke server (server yang meng-hash password & memeriksa hak akses)
function kirimAkunKeServer(payload, pesanSukses) {
    return apiPost(payload)
        .then(res => {
            if (res.status !== 'success') { alert('Gagal: ' + res.message); return false; }
            return tarikDataDariServer().then(() => { renderTabelAkunAdmin(); showToast(pesanSukses); return true; });
        })
        .catch(e => { if (String(e.message) !== 'Sesi berakhir') alert('Koneksi gagal: ' + e.message); return false; });
}

function simpanDataPptk() {
    const nama = document.getElementById('pptkNama').value.trim(); const nip = document.getElementById('pptkNip').value.trim();
    if (!nama) { alert('Nama Lengkap wajib diisi!'); return; }
    const lama = editIndexPptk > -1 ? window.DATABASE_AKUN[editIndexPptk] : null;
    kirimAkunKeServer({ action: 'akun_simpan', namaLama: lama ? lama.namaLengkap : '', namaLengkap: nama,
        username: lama ? lama.username : '', role: lama ? lama.role : 'PPTK', nip: nip, password: '' }, 'Data PPTK tersimpan.')
        .then(ok => { if (ok) resetFormPptk(); });
}
function editDataPptk(index) {
    editIndexPptk = index; const ak = window.DATABASE_AKUN[index];
    document.getElementById('titleFormPptk').innerHTML = `<i class="fa-solid fa-pen text-emerald-600"></i> Edit Data PPTK`;
    document.getElementById('pptkNama').value = ak.namaLengkap || ""; document.getElementById('pptkNip').value = ak.nip || "";
}
function resetFormPptk() {
    editIndexPptk = -1; document.getElementById('titleFormPptk').innerHTML = `<i class="fa-solid fa-plus-circle text-emerald-600"></i> Tambah / Edit PPTK`;
    document.getElementById('pptkNama').value = ""; document.getElementById('pptkNip').value = "";
}

function simpanDataAkun() {
    const nama = document.getElementById('akunNama').value.trim(); const user = document.getElementById('akunUsername').value.trim().toLowerCase();
    const pass = document.getElementById('akunPassword').value; const role = document.getElementById('akunRole').value;
    const lama = editIndexAkun > -1 ? window.DATABASE_AKUN[editIndexAkun] : null;
    if (!nama || !user) { alert('Nama dan username wajib diisi!'); return; }
    if (!lama && pass.length < 8) { alert('Password akun baru minimal 8 karakter.'); return; }
    if (pass && pass.length < 8) { alert('Password minimal 8 karakter.'); return; }
    kirimAkunKeServer({ action: 'akun_simpan', namaLama: lama ? lama.namaLengkap : '', namaLengkap: nama,
        username: user, password: pass, role: role, nip: lama ? lama.nip : '' }, 'Akun tersimpan.')
        .then(ok => { if (ok) resetFormAkun(); });
}
function editDataAkun(index) {
    editIndexAkun = index; const ak = window.DATABASE_AKUN[index];
    document.getElementById('titleFormAkun').innerHTML = `<i class="fa-solid fa-pen text-blue-600"></i> Buat / Edit Detail Akun`;
    document.getElementById('akunNama').value = ak.namaLengkap || ""; document.getElementById('akunUsername').value = ak.username || "";
    const pw = document.getElementById('akunPassword'); pw.value = ""; pw.placeholder = "Kosongkan jika tidak diubah";
    document.getElementById('akunRole').value = ak.role || "PPTK";
}
function resetFormAkun() {
    editIndexAkun = -1; document.getElementById('titleFormAkun').innerHTML = `<i class="fa-solid fa-user-plus text-blue-600"></i> Buat / Edit Detail Akun`;
    document.getElementById('akunNama').value = ""; document.getElementById('akunUsername').value = "";
    const pw = document.getElementById('akunPassword'); pw.value = ""; pw.placeholder = "Min. 8 karakter";
    document.getElementById('akunRole').value = "VERIFIKATOR";
}
function hapusDataAkun(index) {
    const ak = window.DATABASE_AKUN[index]; if (!ak) return;
    if (confirm('Anda yakin ingin menghapus "' + ak.namaLengkap + '"?')) kirimAkunKeServer({ action: 'akun_hapus', namaLengkap: ak.namaLengkap }, 'Berhasil dihapus dari server.');
}
function bukaModalSuperAdmin() { const profileDd = document.getElementById('profileDropdown'); if(profileDd) profileDd.classList.add('hidden'); renderTabelAkunAdmin(); switchTabAdmin('pptk'); openModal('modalSuperAdmin'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function showToast(msg) { const toast = document.getElementById('toast'); document.getElementById('toastMessage').innerText = msg; toast.classList.remove('-translate-y-20', 'opacity-0'); setTimeout(() => toast.classList.add('-translate-y-20', 'opacity-0'), 3500); }

// Pemilik SPJ (PPTK) atau SUPER_ADMIN boleh mengunggah selama status BELUM_DIPROSES / REVISI
function bolehUnggah(item) {
    if (sesiAktif.role === 'SUPER_ADMIN') return true;   // override: semua pengajuan & status (tercatat di riwayat/LOG)
    const pemilik = sesiAktif.role === 'PPTK' && String(item.pptk).trim() === String(sesiAktif.namaLengkap).trim();
    return pemilik && (item.status === 'BELUM_DIPROSES' || item.status === 'REVISI');
}

function jadikanLink(textUrl, idItem, formType, slot, boleh) {
    const idq = escapeHtml(String(idItem));
    // Dua pilihan unggah: langsung (<= 10 MB) atau lewat Google Form (> 10 MB, ID Pengajuan terisi otomatis)
    const duaTombol = () => `<div class="flex flex-wrap gap-1.5 mt-2">
        <button type="button" onclick="pilihBerkas('${idq}','${slot}')" class="px-2.5 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded text-[10px] font-bold shadow-sm"><i class="fa-solid fa-cloud-arrow-up me-1"></i> Upload Langsung <span class="font-normal opacity-80">(&le; 10 MB)</span></button>
        <a href="${escapeHtml(urlFormUpload(formType, idItem))}" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1.5 bg-white text-blue-700 hover:bg-blue-50 border border-blue-300 rounded text-[10px] font-bold"><i class="fa-solid fa-arrow-up-right-from-square me-1"></i> Via Google Form <span class="font-normal opacity-80">(&gt; 10 MB)</span></a>
    </div>`;
    if (!textUrl || textUrl === "-" || textUrl === "") {
        return `<span class="text-slate-400 italic block">Belum dilampirkan</span>` + (boleh ? duaTombol() : '');
    }
    // Satu sel dapat berisi beberapa berkas (satu per baris): "url|nama"
    const daftar = String(textUrl).split('\n').map(x => x.trim()).filter(Boolean).map(line => {
        let url = line, namaFile = "Dokumen_Lampiran";
        if (line.includes("|")) { const parts = line.split("|"); url = parts[0]; namaFile = parts.slice(1).join("|"); }
        else { const matchId = line.match(/[-\w]{25,}/); if (matchId) namaFile = "File_" + matchId[0].substring(0, 8) + "..."; }
        return `<a href="${escapeHtml(amanUrl(url))}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline font-bold bg-blue-50 hover:bg-blue-100 border border-blue-100 px-2 py-1.5 rounded inline-block mt-1 transition-colors flex items-center gap-1.5 w-fit"><i class="fa-solid fa-file-pdf text-red-500"></i> <span class="truncate max-w-[200px]">${escapeHtml(namaFile)}</span></a>`;
    }).join('');
    return daftar + (boleh ? duaTombol() : '');
}

function renderListRevisi(textRaw) {
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
            htmlResult += `
            <div class="flex items-start gap-2 text-[11px]">
                <span class="font-bold text-slate-700 min-w-[12px] pt-1.5">${escapeHtml(noUtama)}</span>
                <span class="font-bold text-slate-500 pt-1.5">${escapeHtml(tgl)}</span>
                <a href="${escapeHtml(amanUrl(url))}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline font-bold bg-blue-50 px-2 py-1.5 rounded flex items-center gap-1 border border-blue-100"><i class="fa-solid fa-file-pdf text-red-500"></i> <span class="truncate max-w-[150px]">${escapeHtml(namaFile)}</span></a>
            </div>`;
        } else {
            htmlResult += `<div class="text-[11px] text-slate-600">${escapeHtml(trimmed)}</div>`;
        }
    });
    return htmlResult + '</div>';
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
        const noUrut = 'LS-' + String(idx).padStart(4, '0');
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
    document.getElementById('linkDokRevisi').innerHTML = renderListRevisi(item.linkRevisi) + (sesiAktif.role === 'SUPER_ADMIN'
        ? `<div class="flex flex-wrap gap-1.5 mt-2"><button type="button" onclick="pilihBerkas('${escapeHtml(String(item.id))}','revisi')" class="px-2.5 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded text-[10px] font-bold shadow-sm"><i class="fa-solid fa-cloud-arrow-up me-1"></i> Upload Revisi <span class="font-normal opacity-80">(admin, &le; 10 MB)</span></button>
           <a href="${escapeHtml(urlFormUpload('REVISI', item.id))}" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1.5 bg-white text-blue-700 hover:bg-blue-50 border border-blue-300 rounded text-[10px] font-bold"><i class="fa-solid fa-arrow-up-right-from-square me-1"></i> Via Google Form <span class="font-normal opacity-80">(&gt; 10 MB)</span></a></div>` : '');

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
        // VERIFIKATOR: Setuju/Revisi/Tolak + PB. SUPER_ADMIN: sama (override/cadangan).
        btnSetuju.style.display = 'flex'; btnRevisi.style.display = 'flex'; btnTolak.style.display = 'flex'; btnPb.style.display = 'flex';
        document.getElementById('gridTombolAksi').className = "grid grid-cols-4 gap-2 mb-2";
    }
    // Edit teks pengajuan milik PPTK: hanya SUPER_ADMIN (koreksi); VERIFIKATOR tidak boleh
    const btnEditVerif = document.getElementById('btnEditTeksVerif'); if (btnEditVerif) btnEditVerif.style.display = (sesiAktif.role === 'SUPER_ADMIN') ? 'flex' : 'none';

    let cleanPhone = String(item.wa || '').replace(/[^0-9]/g, ''); if (cleanPhone.startsWith('0')) { cleanPhone = '62' + cleanPhone.slice(1); } else if (cleanPhone.startsWith('8')) { cleanPhone = '62' + cleanPhone; }        
    let waText = `Yth. PPTK,\nUpdate SPJ (NPD: ${item.npd}):\n*Status: ${item.status}*\n`; if(item.status === 'REVISI' || item.status === 'DITOLAK') waText += `Catatan:\n${String(item.catatanRevisi).replace(/<br>/g, '\n')}\n`;
    const btnSendWa = document.getElementById('btnSendWa'); if (btnSendWa) btnSendWa.href = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(waText)}`;
} else {
        document.getElementById('panelAksiVerifikator').classList.add('hidden'); 
        // Panel tindakan PPTK: hanya PPTK pemilik. PIMPINAN (hanya lihat) tidak mendapat tombol apa pun.
        if (sesiAktif.role === 'PPTK' && String(item.pptk).trim() === String(sesiAktif.namaLengkap).trim() && (item.status === 'REVISI' || item.status === 'BELUM_DIPROSES')) {
            document.getElementById('panelPptkRevisi').classList.remove('hidden');
            if(item.status === 'BELUM_DIPROSES') document.getElementById('teksRevisiPptk').innerText = "Anda masih dapat mengubah data teks atau mengunggah ulang berkas.";
            if(item.status === 'REVISI') document.getElementById('teksRevisiPptk').innerHTML = "Catatan Verifikator: <br>" + teksCatatan(item.catatanRevisi || "-");
            const btnRev = document.getElementById('btnUploadRevisi'); btnRev.setAttribute('href', '#'); btnRev.removeAttribute('target'); btnRev.onclick = (ev) => { ev.preventDefault(); pilihBerkas(item.id, 'revisi'); };
            const btnRevForm = document.getElementById('btnUploadRevisiForm'); if (btnRevForm) btnRevForm.setAttribute('href', urlFormUpload('REVISI', item.id));
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

    document.getElementById('inputJenisSurat').value = item.jenisSurat || 'GU'; ubahLabelNpdKontrak();
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

function keluarSistem() {
    const t = sessionStorage.getItem('sesi_token');
    if (t) { try { fetch(CONFIG.APPS_SCRIPT_URL, { method: 'POST', keepalive: true, body: JSON.stringify({ action: 'logout', token: t }) }).catch(() => {}); } catch (e) {} }
    sessionStorage.clear(); sesiAktif = { role: "", username: "", namaLengkap: "" };
    window.location.reload();
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
        <div class="flex items-center gap-2 text-[10px] text-slate-400"><div class="flex-1 h-px bg-slate-200"></div>ATAU<div class="flex-1 h-px bg-slate-200"></div></div>
        <div class="text-[11px] font-bold text-slate-600">Pilihan 2 &mdash; Untuk file lebih dari 10 MB</div>
        <a href="${escapeHtml(urlFormUpload(jenis, idSpj))}" target="_blank" rel="noopener noreferrer" class="block w-full text-center py-2.5 bg-white border-2 border-blue-600 text-blue-700 hover:bg-blue-50 font-bold rounded-lg text-sm"><i class="fa-solid fa-arrow-up-right-from-square me-2"></i> Upload via Google Form</a>
        <p class="text-[10px] text-slate-500 leading-relaxed">ID Pengajuan terisi otomatis. Setelah mengirim Form, tunggu &plusmn; 1 menit lalu tekan tombol <b>Refresh</b> pada tabel agar berkas tampil.</p>
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

// ================== CEK PASSWORD (SUPER_ADMIN) ==================
// Password tidak pernah dikirim/ditampilkan: server hanya menjawab COCOK / TIDAK COCOK.
let indexUjiPassword = -1;
function bukaUjiPassword(index) {
    const ak = (window.DATABASE_AKUN || [])[index]; if (!ak || !ak.username) return;
    indexUjiPassword = index;
    document.getElementById('ujiAkunLabel').textContent = ak.namaLengkap + ' (' + ak.username + ')';
    document.getElementById('ujiPasswordInput').value = ''; document.getElementById('ujiHasil').innerHTML = '';
    openModal('modalUjiPassword');
    setTimeout(() => document.getElementById('ujiPasswordInput').focus(), 100);
}

function jalankanUjiPassword() {
    const ak = (window.DATABASE_AKUN || [])[indexUjiPassword]; if (!ak) return;
    const inp = document.getElementById('ujiPasswordInput'), hasil = document.getElementById('ujiHasil'), btn = document.getElementById('btnUjiPassword');
    if (!inp.value) { hasil.innerHTML = '<span class="text-amber-600">Isi password yang akan diuji.</span>'; return; }
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; hasil.innerHTML = '';
    apiPost({ action: 'akun_uji_password', username: ak.username, password: inp.value })
        .then(res => {
            if (res.status !== 'success') hasil.innerHTML = '<span class="text-red-600">' + escapeHtml(res.message || 'Gagal menguji.') + '</span>';
            else hasil.innerHTML = res.cocok ? '<span class="text-emerald-600"><i class="fa-solid fa-circle-check me-1"></i>COCOK</span>' : '<span class="text-red-600"><i class="fa-solid fa-circle-xmark me-1"></i>TIDAK COCOK</span>';
            inp.value = '';
        })
        .catch(e => { if (String(e.message) !== 'Sesi berakhir') hasil.innerHTML = '<span class="text-red-600">Koneksi gagal.</span>'; })
        .finally(() => { btn.disabled = false; btn.textContent = 'Uji'; });
}

function auditPasswordAkun() {
    const btn = document.getElementById('btnAuditPassword'), wadah = document.getElementById('hasilAuditPassword');
    const asli = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Memeriksa...';
    apiPost({ action: 'akun_audit_password' })
        .then(res => {
            wadah.classList.remove('hidden');
            if (res.status !== 'success') { wadah.innerHTML = '<div class="p-2 bg-red-50 border border-red-200 text-red-700 text-[11px] rounded">' + escapeHtml(res.message || 'Audit gagal.') + '</div>'; return; }
            const bermasalah = res.hasil.filter(h => h.temuan);
            wadah.innerHTML = bermasalah.length
                ? '<div class="p-3 bg-red-50 border border-red-200 rounded text-[11px] text-red-800"><b>' + bermasalah.length + ' akun perlu direset:</b><ul class="list-disc ml-5 mt-1">' +
                  bermasalah.map(h => '<li><b>' + escapeHtml(h.username) + '</b> (' + escapeHtml(h.namaLengkap) + ') — ' + escapeHtml(h.temuan) + '</li>').join('') + '</ul></div>'
                : '<div class="p-3 bg-emerald-50 border border-emerald-200 rounded text-[11px] text-emerald-800"><i class="fa-solid fa-circle-check me-1"></i> ' + res.hasil.length + ' akun diperiksa: tidak ada yang memakai password awal/default.</div>';
        })
        .catch(e => { if (String(e.message) !== 'Sesi berakhir') alert('Koneksi gagal: ' + e.message); })
        .finally(() => { btn.disabled = false; btn.innerHTML = asli; });
}
