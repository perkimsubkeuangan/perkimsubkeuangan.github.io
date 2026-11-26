// ========================================================
// FILE 1/3: app.js  (Inti Aplikasi, State Global, Auth, Navigasi, Pagu & Super Admin)
// Pasangan file dalam halaman index.html (urutan pemuatan):
//   1. config.js (Pengaturan URL API, Parameter BAP, Form Upload & apiPost)
//   2. app.js    (Inti Aplikasi, State Global, Auth, Navigasi, Pagu & Super Admin)
//   3. spj.js    (Modul SPJ GU/LS, Verifikasi, Cetak Antrean, Upload Berkas & Hapus SPJ)
//   4. bap.js    (Modul BAP LS, Hitung Pratinjau, Riwayat & Preview/Cetak PDF A4)
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
    BAP.init();   // form (modal) & riwayat BAP (tab sidebar "Modul BAP LS")
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
            if (typeof BAP !== 'undefined') BAP.setelahLoad();
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
function setJenisTampilan(jenis) {
    const modeBap = (jenis === 'BAP');
    if (!modeBap) filterJenis = jenis;      // BAP bukan filter SPJ: filterJenis tetap pada nilai SPJ terakhir
    currentPage = 1;
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
    
    BAP.tampilkanTab(modeBap);              // BAP: tampilkan panel BAP, sembunyikan dashboard/tabel SPJ (tanpa reload halaman)
    if (modeBap) {
        if (title) title.innerText = 'Modul BAP LS';
        if (breadcrumb) breadcrumb.innerText = 'Modul BAP LS';
        return;
    }
    
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

function keluarSistem() {
    const t = sessionStorage.getItem('sesi_token');
    if (t) { try { fetch(CONFIG.APPS_SCRIPT_URL, { method: 'POST', keepalive: true, body: JSON.stringify({ action: 'logout', token: t }) }).catch(() => {}); } catch (e) {} }
    sessionStorage.clear(); sesiAktif = { role: "", username: "", namaLengkap: "" };
    window.location.reload();
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

