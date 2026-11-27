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
let sesiAktif = { role: "", username: "", namaLengkap: "", nip: "", unitKerja: "", email: "", wa: "" };
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

let filterStatus = 'ALL';

// ---------- Manajemen Tahun Anggaran (Multi-Server / Multi-Folder Drive) ----------
function daftarServerTahun() {
    if (window.SERVER_TAHUN && typeof window.SERVER_TAHUN === 'object' && Object.keys(window.SERVER_TAHUN).length > 0) {
        return window.SERVER_TAHUN;
    }
    // Fallback otomatis bila config.js belum ditambahkan SERVER_TAHUN
    const taDef = String((typeof CONFIG !== 'undefined' && CONFIG.TAHUN_ANGGARAN) ? CONFIG.TAHUN_ANGGARAN : 2026);
    const taNext = String(Number(taDef) + 1);
    const peta = {};
    peta[taDef] = {
        label: `TA ${taDef} (Aktif)`,
        appsScriptUrl: (typeof CONFIG !== 'undefined' && CONFIG.APPS_SCRIPT_URL) ? CONFIG.APPS_SCRIPT_URL : '',
        forms: null
    };
    peta[taNext] = {
        label: `TA ${taNext} (Siap Diaktifkan)`,
        appsScriptUrl: '',
        forms: null
    };
    return peta;
}

function terapkanTahunAnggaran(tahun) {
    const peta = daftarServerTahun();
    const keys = Object.keys(peta);
    const t = peta[String(tahun)] ? String(tahun) : (keys[0] || '2026');
    const cfg = peta[t] || {};
    if (typeof CONFIG !== 'undefined') {
        if (cfg.appsScriptUrl) CONFIG.APPS_SCRIPT_URL = cfg.appsScriptUrl;
        CONFIG.TAHUN_ANGGARAN = Number(t) || 2026;
        CONFIG._TAHUN_TERPILIH = t;
        CONFIG._TAHUN_SIAP = !!cfg.appsScriptUrl;
        CONFIG._ACTIVE_FORMS = (cfg.forms && typeof cfg.forms === 'object') ? cfg.forms : null;
    }
    const hv = document.getElementById('header-tahun-val'); if (hv) hv.innerText = t;
    const sv = document.getElementById('sidebar-tahun-txt'); if (sv) sv.innerText = 'TA ' + t;
    return { tahun: t, cfg };
}

function initPilihTahunLogin() {
    const sel = document.getElementById('tahun-input');
    if (!sel) return;
    const peta = daftarServerTahun();
    const saved = sessionStorage.getItem('sesi_tahun');
    const keys = Object.keys(peta).sort((a, b) => Number(b) - Number(a));
    // Default ke tahun terakhir yang URL servernya sudah aktif
    const defKey = (saved && peta[saved]) ? saved : (keys.find(k => peta[k] && peta[k].appsScriptUrl) || keys[0] || '2026');
    sel.innerHTML = keys.map(k => `<option value="${escapeHtml(k)}">${escapeHtml(peta[k].label || ('TA ' + k))}</option>`).join('');
    sel.value = defKey;
    ubahTahunLogin();
}

function ubahTahunLogin() {
    const sel = document.getElementById('tahun-input');
    const info = document.getElementById('tahun-status-info');
    if (!sel) return;
    const { tahun, cfg } = terapkanTahunAnggaran(sel.value);
    if (info) {
        if (!cfg.appsScriptUrl) {
            info.className = 'text-[10px] text-amber-600 mt-1 font-semibold';
            info.textContent = `Server & folder penyimpanan TA ${tahun} belum diisi pada config.js.`;
        } else {
            info.className = 'text-[10px] text-emerald-600 mt-1';
            info.textContent = `Terhubung ke server database TA ${tahun}.`;
        }
    }
}

let filterPemilikSpj = 'ALL';

// Cek apakah Google Form (> 10 MB) tersedia khusus untuk tahun anggaran aktif.
// Mencegah berkas tahun baru (mis. TA 2027) nyasar ke Google Form & Drive TA 2026.
function adaFormUploadAktif(jenis) {
    const key = String(jenis || 'GU').toUpperCase();
    if (typeof CONFIG !== 'undefined' && CONFIG._ACTIVE_FORMS) {
        return !!(CONFIG._ACTIVE_FORMS[key] || CONFIG._ACTIVE_FORMS[key.toLowerCase()]);
    }
    const taAktif = String((typeof CONFIG !== 'undefined' && (CONFIG._TAHUN_TERPILIH || CONFIG.TAHUN_ANGGARAN)) || '2026');
    if (taAktif === '2026' && typeof FORM_UPLOAD !== 'undefined' && FORM_UPLOAD[key]) {
        return true;
    }
    return false;
}

function urlFormUploadAktif(jenis, idSpj) {
    if (!adaFormUploadAktif(jenis)) return '';
    const key = String(jenis || 'GU').toUpperCase();
    if (typeof CONFIG !== 'undefined' && CONFIG._ACTIVE_FORMS) {
        const raw = CONFIG._ACTIVE_FORMS[key] || CONFIG._ACTIVE_FORMS[key.toLowerCase()];
        if (raw) {
            return raw.indexOf('{ID}') > -1
                ? raw.replace(/\{ID\}/g, encodeURIComponent(String(idSpj || '')))
                : raw + encodeURIComponent(String(idSpj || ''));
        }
    }
    return typeof urlFormUpload === 'function' ? urlFormUpload(key, idSpj) : '';
}

// ---------- Mobile Sidebar Drawer ----------
function toggleMobileSidebar() {
    const sb = document.getElementById('appSidebar');
    const bd = document.getElementById('mobileSidebarBackdrop');
    if (!sb) return;
    const buka = sb.classList.contains('hidden');
    sb.classList.toggle('hidden', !buka);
    sb.classList.toggle('flex', buka);
    if (bd) bd.classList.toggle('hidden', !buka);
}
function tutupMobileSidebar() {
    if (window.innerWidth >= 768) return;
    const sb = document.getElementById('appSidebar');
    const bd = document.getElementById('mobileSidebarBackdrop');
    if (sb) { sb.classList.add('hidden'); sb.classList.remove('flex'); }
    if (bd) bd.classList.add('hidden');
}

function tampilkanFlashLogin() {
    let msg = '';
    try { msg = sessionStorage.getItem('login_flash_msg') || ''; if (msg) sessionStorage.removeItem('login_flash_msg'); } catch (e) {}
    const pe = document.getElementById('pin-error');
    if (msg && pe) { pe.innerText = msg; pe.classList.remove('hidden'); }
}

// Banner otomatis saat membuka Tahun Anggaran Arsip (tahun lalu) atau Tahun Uji Coba (tahun depan)
function perbaruiBannerTahun() {
    const box = document.getElementById('bannerTahunStatus');
    if (!box) return;
    const ta = Number(CONFIG.TAHUN_ANGGARAN) || 2026;
    const thKini = new Date().getFullYear();
    const peta = daftarServerTahun();
    const labelTa = (peta[String(ta)] && peta[String(ta)].label) ? String(peta[String(ta)].label) : ('TA ' + ta);
    const ikon = document.getElementById('bannerTahunIkon');
    const judul = document.getElementById('bannerTahunJudul');
    const teks = document.getElementById('bannerTahunTeks');

    if (ta < thKini) {
        box.className = 'mb-4 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-sm';
        if (ikon) ikon.className = 'fa-solid fa-box-archive text-amber-600 text-base shrink-0';
        if (judul) judul.textContent = `Mode Arsip TA ${ta}:`;
        if (teks) teks.textContent = `Anda sedang membuka data arsip tahun anggaran lama. Pastikan tidak salah menginput transaksi TA ${thKini} di sini.`;
    } else if (ta > thKini || /uji\s*coba|persiapan/i.test(labelTa)) {
        box.className = 'mb-4 rounded-lg border border-sky-300 bg-sky-50 text-sky-900 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-sm';
        if (ikon) ikon.className = 'fa-solid fa-flask text-sky-600 text-base shrink-0';
        if (judul) judul.textContent = `Mode Uji Coba (${labelTa}):`;
        if (teks) teks.textContent = `Data sesi ini tersimpan terpisah pada database & folder Drive TA ${ta} dan tidak memengaruhi TA ${thKini}.`;
    } else {
        box.className = 'hidden';
    }
}

async function gantiTahunDariBanner() {
    const ok = await tanyaKonfirmasi({
        judul: 'Ganti Tahun Anggaran?',
        pesan: 'Anda akan keluar dari sesi saat ini untuk memilih Tahun Anggaran lain di layar login.',
        labelYa: 'Ya, Ganti Tahun',
        tipe: 'primary'
    });
    if (ok) keluarSistem();
}

function skeletonRowsHtml(colSpan, jumlah = 4) {
    let h = '';
    for (let i = 0; i < jumlah; i++) {
        const w1 = i % 2 === 0 ? 'w-full' : 'w-11/12';
        h += `<tr class="animate-pulse border-b border-slate-100"><td colspan="${colSpan}" class="py-3.5 px-4"><div class="flex items-center gap-3"><div class="h-3.5 bg-slate-200 rounded w-20 shrink-0"></div><div class="h-3.5 bg-slate-200 rounded ${w1}"></div><div class="h-3.5 bg-slate-200 rounded w-24 shrink-0"></div></div></td></tr>`;
    }
    return h;
}

function tampilkanSkeletonSemua() {
    const tbSpj = document.getElementById('spjTableBody');
    if (tbSpj) tbSpj.innerHTML = skeletonRowsHtml(9, 5);
    const tbBap = document.getElementById('tabelBapBody');
    if (tbBap) tbBap.innerHTML = skeletonRowsHtml(5, 4);
    const tbRls = document.getElementById('tabelRekapLsBody');
    if (tbRls) tbRls.innerHTML = skeletonRowsHtml(10, 4);
}

function inisialisasiServer() { updateSapaanWaktu(); initPilihTahunLogin(); tampilkanFlashLogin(); }
inisialisasiServer();

// Login diperiksa di SERVER. Browser tidak lagi memegang daftar akun/password.
function checkLogin() {
    const uname = document.getElementById('username-input').value.trim().toLowerCase();
    const pass = document.getElementById('password-input').value;
    const pe = document.getElementById('pin-error');
    const selTh = document.getElementById('tahun-input');
    const { tahun, cfg } = terapkanTahunAnggaran(selTh ? selTh.value : '2026');
    if (!cfg.appsScriptUrl) { pe.innerText = `Server Tahun Anggaran ${tahun} belum diaktifkan oleh Admin.`; pe.classList.remove('hidden'); return; }
    if (!uname || !pass) { pe.innerText = "Username dan Password wajib diisi!"; pe.classList.remove('hidden'); return; }
    sessionStorage.setItem('sesi_tahun', tahun);

    const btn = document.querySelector('button[onclick="checkLogin()"]');
    const teksAsli = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Memeriksa...'; btn.disabled = true; }
    pe.classList.add('hidden');

    apiPost({ action: 'login', username: uname, password: pass })
        .then(res => {
            if (res.status === 'success') {
                sessionStorage.setItem('sesi_token', res.token);
                setSesiUser(res.user);
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

function setSesiUser(u) {
    if (!u) return;
    sesiAktif = {
        role: u.role || sesiAktif.role || "",
        username: u.username || sesiAktif.username || "",
        namaLengkap: u.namaLengkap || sesiAktif.namaLengkap || "",
        nip: u.nip !== undefined ? (u.nip || "") : (sesiAktif.nip || ""),
        unitKerja: u.unitKerja !== undefined ? (u.unitKerja || "") : (sesiAktif.unitKerja || ""),
        email: u.email !== undefined ? (u.email || "") : (sesiAktif.email || ""),
        wa: u.wa !== undefined ? (u.wa || "") : (sesiAktif.wa || "")
    };
    sessionStorage.setItem('sesiAktif_role', sesiAktif.role);
    sessionStorage.setItem('sesiAktif_username', sesiAktif.username);
    sessionStorage.setItem('sesiAktif_namaLengkap', sesiAktif.namaLengkap);
    sessionStorage.setItem('sesiAktif_nip', sesiAktif.nip);
    sessionStorage.setItem('sesiAktif_unitKerja', sesiAktif.unitKerja);
    sessionStorage.setItem('sesiAktif_email', sesiAktif.email);
    sessionStorage.setItem('sesiAktif_wa', sesiAktif.wa);
    perbaruiHeaderProfil();
}

function perbaruiHeaderProfil() {
    const rb = document.getElementById('role-badge'); if (rb) rb.innerText = sesiAktif.role;
    const ud = document.getElementById('user-display'); if (ud) ud.innerText = sesiAktif.namaLengkap;
    const jh = document.getElementById('jabatan-header-text'); if (jh) jh.innerText = sesiAktif.role;
    const dn = document.getElementById('dd-nama'); if (dn) dn.innerText = sesiAktif.namaLengkap;
    const dr = document.getElementById('dd-role'); if (dr) dr.innerText = sesiAktif.role;
    const du = document.getElementById('dd-unit'); if (du) du.innerText = sesiAktif.unitKerja || (sesiAktif.nip ? 'NIP ' + sesiAktif.nip : '');
}

function masukSistem() {
    setSesiUser(sesiAktif);

    document.getElementById('login-screen').style.display = 'none'; 
    document.getElementById('main-app').style.display = 'flex';
    updateSapaanWaktu();

    const sidebarSuperAdmin = document.getElementById('sidebarSuperAdmin');
    const sidebarMasterPenyedia = document.getElementById('sidebarMasterPenyedia');
    if (sesiAktif.role === 'SUPER_ADMIN') {
        if (sidebarSuperAdmin) { sidebarSuperAdmin.classList.remove('hidden'); sidebarSuperAdmin.classList.add('flex'); }
        if (sidebarMasterPenyedia) { sidebarMasterPenyedia.classList.add('hidden'); sidebarMasterPenyedia.classList.remove('flex'); }
    } else {
        if (sidebarSuperAdmin) { sidebarSuperAdmin.classList.add('hidden'); sidebarSuperAdmin.classList.remove('flex'); }
        const bolehKelolaCv = (sesiAktif.role === 'VERIFIKATOR' || sesiAktif.role === 'BENDAHARA');
        if (sidebarMasterPenyedia) {
            sidebarMasterPenyedia.classList.toggle('hidden', !bolehKelolaCv);
            sidebarMasterPenyedia.classList.toggle('flex', bolehKelolaCv);
        }
    }
    const liRekapLs = document.getElementById('li-menu-rekap-ls');
    if (liRekapLs) liRekapLs.classList.toggle('hidden', !bisaRekapPencairanLs());
    const isPptk = sesiAktif.role === 'PPTK';
    const fSpjP = document.getElementById('filterPemilikSpj');
    if (fSpjP) { fSpjP.classList.toggle('hidden', !isPptk); if (!isPptk) { fSpjP.value = 'ALL'; filterPemilikSpj = 'ALL'; } }
    const fBapP = document.getElementById('filterPemilikBap');
    if (fBapP) { fBapP.classList.toggle('hidden', !isPptk); if (!isPptk) fBapP.value = 'ALL'; }
    const hv = document.getElementById('header-tahun-val'); if (hv) hv.innerText = String(CONFIG.TAHUN_ANGGARAN || '2026');
    perbaruiBannerTahun();
    const sv = document.getElementById('sidebar-tahun-txt'); if (sv) sv.innerText = 'TA ' + String(CONFIG.TAHUN_ANGGARAN || '2026');
    
    // Atur Pagu: hanya SUPER_ADMIN
    document.querySelectorAll('.btn-edit-pagu').forEach(btn => btn.style.display = (sesiAktif.role === 'SUPER_ADMIN') ? 'block' : 'none');
    // Buat Pengajuan: hanya PPTK & SUPER_ADMIN (VERIFIKATOR & PIMPINAN hanya melihat / memverifikasi)
    document.querySelectorAll('.btn-buat-spj').forEach(btn => { const li = btn.closest('li'); (li || btn).style.display = bisaBuatSpj() ? '' : 'none'; });
    
    isiDropdownPptkUtama(); kunciPptkLogin(); hitungAnggaran(); isiDropdownProgram();
    BAP.init();   // form (modal) & riwayat BAP (tab sidebar "Modul BAP LS")
    setJenisTampilan(filterJenis || 'ALL');
}

document.addEventListener('DOMContentLoaded', () => {
    const savedRole = sessionStorage.getItem('sesiAktif_role');
    const savedName = sessionStorage.getItem('sesiAktif_namaLengkap');
    
    if (savedRole && savedName && sessionStorage.getItem('sesi_token')) {
        terapkanTahunAnggaran(sessionStorage.getItem('sesi_tahun') || '2026');
        const loader = document.getElementById('global-loader');
        if (loader) { loader.classList.remove('hidden'); loader.classList.add('flex'); }
        document.getElementById('login-screen').style.display = 'none';

        sesiAktif = { 
            role: savedRole, 
            username: sessionStorage.getItem('sesiAktif_username') || '', 
            namaLengkap: savedName,
            nip: sessionStorage.getItem('sesiAktif_nip') || '',
            unitKerja: sessionStorage.getItem('sesiAktif_unitKerja') || '',
            email: sessionStorage.getItem('sesiAktif_email') || '',
            wa: sessionStorage.getItem('sesiAktif_wa') || ''
        };
        
        tarikDataDariServer().then(() => {
            masukSistem();
            if (loader) { loader.classList.remove('flex'); loader.classList.add('hidden'); }
        });
    }
});

// ringan = true (Smart Reload): hanya menarik data transaksi (Data_SPJ, DB_KONTRAK_LS, DB_PENCAIRAN_LS)
// ringan = false (default: Login, Refresh manual, Panel Admin): muat penuh langsung dari semua Spreadsheet tanpa cache
function tarikDataDariServer(ringan = false) {
    const ic = document.getElementById('refresh-icon'); if (ic) ic.classList.add('animate-spin');
    const masterSiap = Array.isArray(window.DATABASE_AKUN) && window.DATABASE_AKUN.length > 0 && referensiData && Object.keys(referensiData).length > 0;
    const modeRingan = (ringan === true) && masterSiap;
    if (!modeRingan && (!spjData || spjData.length === 0)) tampilkanSkeletonSemua();
    return apiPost({ action: modeRingan ? 'load_transaksi' : 'load' })
        .then(data => {
            if (data.status !== 'success') { showToast("Gagal mengambil data dari server: " + (data.message || ''), 'error'); return; }
            if (!modeRingan) {
                if (data.user) setSesiUser(data.user);
                window.DATABASE_AKUN = data.akun || [];
                window.DATABASE_PENYEDIA = data.penyediaCV || [];
                if (data.pagu) { CONFIG.PAGU_TAHUNAN = data.pagu.tahunan || 0; CONFIG.PAGU_TW = data.pagu.tw || [0, 0, 0, 0]; }
                referensiData = data.referensi || {};
            }
            window.DATABASE_KONTRAK = data.kontrakLS || [];
            window.DATABASE_REKAP_LS = data.rekapPencairanLs || [];
            spjData = (data.spj || []).reverse();
            realisasiPagu = data.realisasi || null;
            if (data.tahunAnggaran) {
                CONFIG.TAHUN_ANGGARAN = data.tahunAnggaran;
                const hv = document.getElementById('header-tahun-val'); if (hv) hv.innerText = String(data.tahunAnggaran);
                const sv = document.getElementById('sidebar-tahun-txt'); if (sv) sv.innerText = 'TA ' + String(data.tahunAnggaran);
                perbaruiBannerTahun();
            }
            renderTabelSpj(); hitungAnggaran();
            if (!modeRingan) { isiDropdownProgram(); isiDropdownPptkUtama(); }
            if (typeof BAP !== 'undefined') BAP.setelahLoad();
            if (typeof REKAP_LS !== 'undefined') REKAP_LS.render();
            if (!modeRingan) {
                const tbAkun = document.getElementById('tabelAkunBody'); if (tbAkun && tbAkun.innerHTML !== '') renderTabelAkunAdmin();
                const tbPen = document.getElementById('tabelPenyediaBody'); if (tbPen && tbPen.innerHTML !== '') renderTabelPenyediaAdmin();
                const tbRef = document.getElementById('tabelReferensiBody'); if (tbRef && tbRef.innerHTML !== '') renderTabelReferensiAdmin();
            }
        })
        .catch(e => console.error(e))
        .finally(() => { if (ic) ic.classList.remove('animate-spin'); });
}

function formatRupiah(amount) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount); }

// ================== PAGU, GRAFIK REALISASI (CHART.JS) & RINCIAN TRIWULAN ==================
const TW_NAMA = ['Triwulan I', 'Triwulan II', 'Triwulan III', 'Triwulan IV'];
const TW_BULAN = ['Jan – Mar', 'Apr – Jun', 'Jul – Sep', 'Okt – Des'];
let chartRealisasiInst = null;

function formatRingkasRp(v) {
    const n = Number(v) || 0;
    const abs = Math.abs(n);
    if (abs >= 1e9) return 'Rp ' + (n / 1e9).toFixed(1).replace(/\.0$/, '').replace('.', ',') + ' M';
    if (abs >= 1e6) return 'Rp ' + (n / 1e6).toFixed(1).replace(/\.0$/, '').replace('.', ',') + ' Jt';
    if (abs >= 1e3) return 'Rp ' + Math.round(n / 1e3) + ' Rb';
    return 'Rp ' + Math.round(n);
}

function toggleRincianTriwulan() {
    const wrap = document.getElementById('wrapKartuTriwulan');
    const ik = document.getElementById('ikonToggleTriwulan');
    if (!wrap) return;
    const buka = wrap.classList.contains('hidden');
    wrap.classList.toggle('hidden', !buka);
    if (ik) ik.className = buka ? 'fa-solid fa-chevron-up text-[9px]' : 'fa-solid fa-chevron-down text-[9px]';
}

function renderGrafikDashboard() {
    const canvas = document.getElementById('chartRealisasi');
    if (!canvas || typeof Chart === 'undefined') return;

    const ringkas = !!(realisasiPagu && realisasiPagu.ringkasan) || sesiAktif.role === 'PPTK';
    const judulEl = document.getElementById('judulGrafikDashboard');
    const subEl = document.getElementById('subGrafikDashboard');

    if (chartRealisasiInst) { chartRealisasiInst.destroy(); chartRealisasiInst = null; }

    if (ringkas) {
        // Grafik status berkas GU vs LS khusus PPTK
        if (judulEl) judulEl.innerHTML = `<i class="fa-solid fa-chart-column text-sipd-emerald"></i> <span>Ringkasan Status Berkas SPJ &mdash; TA <span id="labelTahunAnggaran">${escapeHtml(String(CONFIG.TAHUN_ANGGARAN || '2026'))}</span></span>`;
        if (subEl) subEl.textContent = (filterPemilikSpj === 'MINE') ? 'Perbandingan jumlah berkas GU & LS milik Anda' : 'Perbandingan jumlah berkas GU & LS seluruh PPTK';

        let gu = [0, 0, 0, 0], ls = [0, 0, 0, 0];
        (spjData || []).forEach(x => {
            if (sesiAktif.role === 'PPTK' && filterPemilikSpj === 'MINE' && typeof isPemilikSpj === 'function' && !isPemilikSpj(x)) return;
            const arr = String(x.jenisSurat || 'GU').trim() === 'LS' ? ls : gu;
            if (x.status === 'BELUM_DIPROSES') arr[0]++;
            else if (x.status === 'REVISI') arr[1]++;
            else if (x.status === 'DISETUJUI') arr[2]++;
            else if (x.status === 'SUDAH DIPINDAHBUKUKAN') arr[3]++;
        });
        chartRealisasiInst = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['Menunggu', 'Perlu Revisi', 'Disetujui', 'Selesai PB'],
                datasets: [
                    { label: 'SPJ GU', data: gu, backgroundColor: '#4f46e5', borderRadius: 4, barPercentage: 0.72 },
                    { label: 'SPJ LS', data: ls, backgroundColor: '#9333ea', borderRadius: 4, barPercentage: 0.72 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'top', align: 'end', labels: { boxWidth: 10, font: { size: 10, weight: 'bold' } } } },
                scales: {
                    y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 } }, grid: { color: '#f1f5f9' } },
                    x: { ticks: { font: { size: 10, weight: '600' } }, grid: { display: false } }
                }
            }
        });
        return;
    }

    if (judulEl) judulEl.innerHTML = `<i class="fa-solid fa-chart-column text-sipd-emerald"></i> <span>Realisasi Anggaran Per Triwulan &mdash; TA <span id="labelTahunAnggaran">${escapeHtml(String(CONFIG.TAHUN_ANGGARAN || '2026'))}</span></span>`;
    if (subEl) subEl.textContent = 'Perbandingan Pagu, Realisasi Cair, dan Pengajuan Dalam Proses';

    const paguTw = CONFIG.PAGU_TW || [0, 0, 0, 0];
    const cairTw = (realisasiPagu && realisasiPagu.cair) ? realisasiPagu.cair : [0, 0, 0, 0];
    const prosesTw = (realisasiPagu && realisasiPagu.proses) ? realisasiPagu.proses : [0, 0, 0, 0];

    chartRealisasiInst = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: ['TW I', 'TW II', 'TW III', 'TW IV'],
            datasets: [
                { label: 'Pagu', data: paguTw, backgroundColor: '#cbd5e1', borderRadius: 4, barPercentage: 0.8 },
                { label: 'Cair', data: cairTw, backgroundColor: '#059669', borderRadius: 4, barPercentage: 0.8 },
                { label: 'Proses', data: prosesTw, backgroundColor: '#f59e0b', borderRadius: 4, barPercentage: 0.8 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', align: 'end', labels: { boxWidth: 10, font: { size: 10, weight: 'bold' } } },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${formatRupiah(ctx.raw || 0)}`
                    }
                }
            },
            scales: {
                y: { beginAtZero: true, ticks: { font: { size: 10 }, callback: (val) => formatRingkasRp(val) }, grid: { color: '#f1f5f9' } },
                x: { ticks: { font: { size: 11, weight: 'bold' } }, grid: { display: false } }
            }
        }
    });
}

// Realisasi dihitung di SERVER (Code.gs): GU = bulan pada nomor NPD (.../P2/4/2026 = bulan 4),
// LS = tanggal pengajuan. PPTK hanya menerima ringkasan; VERIFIKATOR/BENDAHARA/PIMPINAN/SUPER_ADMIN menerima rincian.
function hitungAnggaran() {
    const real = realisasiPagu || { ringkasan: true, totalCair: 0 };
    const totalCair = Number(real.totalCair) || 0;
    const paguTh = Number(CONFIG.PAGU_TAHUNAN) || 0;
    const sisaTh = paguTh - totalCair;
    const persenSerap = paguTh > 0 ? Math.min(100, Math.max(0, (totalCair / paguTh) * 100)) : 0;

    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.innerText = txt; };
    set('sisaTahunanVal', formatRupiah(sisaTh));
    set('paguTahunanInfo', 'dari pagu ' + formatRupiah(paguTh));
    set('persenSerapanTahunan', persenSerap.toFixed(1) + '%');
    const bar = document.getElementById('barSerapanTahunan');
    if (bar) {
        bar.style.width = persenSerap.toFixed(1) + '%';
        bar.className = 'h-full transition-all duration-500 ' + (sisaTh < 0 ? 'bg-red-500' : (persenSerap >= 85 ? 'bg-amber-500' : 'bg-sipd-emerald'));
    }
    set('totalCairVal', formatRupiah(totalCair));
    set('labelTahunAnggaran', String(CONFIG.TAHUN_ANGGARAN));

    const ringkas = !!real.ringkasan || sesiAktif.role === 'PPTK';
    const btnToggle = document.getElementById('btnToggleTriwulan');
    if (btnToggle) btnToggle.style.display = ringkas ? 'none' : '';
    const wrapTw = document.getElementById('wrapKartuTriwulan');
    if (ringkas && wrapTw) wrapTw.classList.add('hidden');

    if (!ringkas) {
        const paguTw = CONFIG.PAGU_TW || [0, 0, 0, 0];
        const wadah = document.getElementById('kartuTriwulan');
        if (wadah) {
            wadah.innerHTML = TW_NAMA.map((nama, i) => {
                const pagu = Number(paguTw[i]) || 0, cair = Number((real.cair || [])[i]) || 0, proses = Number((real.proses || [])[i]) || 0;
                const sisa = pagu - cair, persen = pagu > 0 ? Math.min(100, cair / pagu * 100) : 0;
                const warnaBar = sisa < 0 ? 'bg-red-500' : (persen >= 85 ? 'bg-amber-500' : 'bg-sipd-emerald');
                return `<div class="bg-slate-50/70 rounded-lg border ${sisa < 0 ? 'border-red-300' : 'border-slate-200'} p-3">
                    <div class="flex justify-between items-baseline"><h4 class="text-[10px] font-bold uppercase tracking-wider text-slate-500">${nama}</h4><span class="text-[9px] text-slate-400">${TW_BULAN[i]}</span></div>
                    <div class="text-sm font-bold font-mono mt-1 ${sisa < 0 ? 'text-red-600' : 'text-sipd-slate'}">${formatRupiah(sisa)}</div>
                    <div class="text-[9px] text-slate-400">sisa dari ${formatRupiah(pagu)}</div>
                    <div class="h-1.5 bg-slate-200 rounded mt-1.5 overflow-hidden"><div class="h-full ${warnaBar}" style="width:${persen.toFixed(1)}%"></div></div>
                    <div class="flex justify-between text-[9px] mt-1 gap-1"><span class="text-slate-600">Cair ${formatRingkasRp(cair)}</span><span class="text-amber-600">Proses ${formatRingkasRp(proses)}</span></div>
                </div>`;
            }).join('');
        }
        let cat = 'Triwulan ditentukan dari bulan pada nomor NPD (contoh <b>.../P2/<u>4</u>/2026</b> = bulan 4) untuk GU, dan dari tanggal pengajuan untuk LS. “Cair” = GU sudah dipindahbukukan &amp; LS sudah disetujui; “Proses” = diajukan namun belum selesai (ditolak tidak dihitung).';
        if (real.tanpaPeriode) cat += ` <span class="text-amber-600">${real.tanpaPeriode} pengajuan tidak terhitung karena bulan tidak dapat dibaca.</span>`;
        if (real.luarTahun) cat += ` <span class="text-slate-500">${real.luarTahun} pengajuan di luar TA ${CONFIG.TAHUN_ANGGARAN} tidak dihitung.</span>`;
        const elCat = document.getElementById('infoPaguCatatan'); if (elCat) elCat.innerHTML = cat;
    }

    renderGrafikDashboard();
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
    if (tahunan < 0 || tw.some(x => x < 0)) { showToast('Nominal tidak boleh minus!', 'warning'); return; }
    const btn = document.getElementById('btnSimpanPagu'); if (btn) { btn.disabled = true; btn.innerText = 'Menyimpan...'; }
    apiPost({ action: 'sync_pagu', tahunan, tw })
        .then(res => {
            if (res.status !== 'success') { showToast('Gagal menyimpan pagu: ' + res.message, 'error'); return; }
            CONFIG.PAGU_TAHUNAN = tahunan; CONFIG.PAGU_TW = tw;
            hitungAnggaran(); closeModal('modalEditPagu'); showToast('Pagu tersimpan ke server.');
        })
        .catch(e => { if (String(e.message) !== 'Sesi berakhir') showToast('Koneksi gagal: ' + e.message, 'error'); })
        .finally(() => { if (btn) { btn.disabled = false; btn.innerText = 'Simpan Pagu'; } });
}

// ---------- Hak akses di tampilan (penegakan sebenarnya ada di server / Code.gs) ----------
function bisaBuatSpj() { return sesiAktif.role === 'PPTK' || sesiAktif.role === 'SUPER_ADMIN'; }
function bisaVerifikasi() { return sesiAktif.role === 'VERIFIKATOR' || sesiAktif.role === 'BENDAHARA' || sesiAktif.role === 'SUPER_ADMIN'; }
function bisaRekapPencairanLs() { return sesiAktif.role === 'BENDAHARA' || sesiAktif.role === 'SUPER_ADMIN'; }
function bisaEditItem(item) {
    if (sesiAktif.role === 'SUPER_ADMIN') return true;
    return sesiAktif.role === 'PPTK' && String(item.pptk).trim() === String(sesiAktif.namaLengkap).trim() && (item.status === 'BELUM_DIPROSES' || item.status === 'REVISI');
}
function setJenisTampilan(jenis) {
    if (jenis === 'REKAP_LS' && !bisaRekapPencairanLs()) {
        showToast('Menu Rekap Pencairan LS khusus untuk role BENDAHARA dan SUPER_ADMIN.', 'warning');
        return;
    }
    tutupMobileSidebar();
    const modeBap = (jenis === 'BAP');
    const modeRekapLs = (jenis === 'REKAP_LS');
    if (!modeBap && !modeRekapLs) {
        filterJenis = jenis;
        filterStatus = 'ALL';
        const selSt = document.getElementById('selectStatusSpj'); if (selSt) selSt.value = 'ALL';
    }
    currentPage = 1;

    const temaMenu = {
        ALL:      { aktif: ['bg-emerald-50', 'text-emerald-700', 'border-emerald-100'], ikon: 'text-emerald-500', dot: 'bg-emerald-500' },
        GU:       { aktif: ['bg-indigo-50', 'text-indigo-700', 'border-indigo-100'],   ikon: 'text-indigo-600',  dot: 'bg-indigo-600' },
        LS:       { aktif: ['bg-purple-50', 'text-purple-700', 'border-purple-100'],   ikon: 'text-purple-600',  dot: 'bg-purple-600' },
        BAP:      { aktif: ['bg-blue-50', 'text-blue-700', 'border-blue-100'],         ikon: 'text-blue-600',    dot: 'bg-blue-600' },
        REKAP_LS: { aktif: ['bg-teal-50', 'text-teal-700', 'border-teal-200'],         ikon: 'text-teal-600',    dot: 'bg-teal-600' }
    };
    const semuaKelasAktif = [
        'bg-emerald-50', 'text-emerald-700', 'border-emerald-100', 'text-sipd-emerald',
        'bg-indigo-50', 'text-indigo-700', 'border-indigo-100',
        'bg-purple-50', 'text-purple-700', 'border-purple-100',
        'bg-blue-50', 'text-blue-700', 'border-blue-100',
        'bg-teal-50', 'text-teal-700', 'border-teal-200',
        'active-menu', 'font-bold', 'justify-between'
    ];
    const semuaKelasIkon = ['text-emerald-500', 'text-indigo-600', 'text-purple-600', 'text-blue-600', 'text-teal-600'];

    document.querySelectorAll('.menu-item').forEach(el => {
        el.classList.remove(...semuaKelasAktif);
        el.classList.add('text-slate-600', 'hover:bg-slate-50', 'hover:text-emerald-600', 'font-medium', 'border-transparent');
        const icon = el.querySelector('.menu-icon');
        if (icon) { icon.classList.remove(...semuaKelasIkon); icon.classList.add('text-slate-400'); }
        const dot = el.querySelector('.indicator-dot'); if (dot) dot.remove();
    });
    const activeEl = document.getElementById('menu-' + jenis.toLowerCase());
    const tm = temaMenu[jenis] || temaMenu.ALL;
    if (activeEl) {
        activeEl.classList.remove('text-slate-600', 'hover:bg-slate-50', 'hover:text-emerald-600', 'font-medium', 'border-transparent');
        activeEl.classList.add(...tm.aktif, 'active-menu', 'font-bold');
        const icon = activeEl.querySelector('.menu-icon');
        if (icon) { icon.classList.remove('text-slate-400'); icon.classList.add(tm.ikon); }
        if (!activeEl.querySelector('.indicator-dot')) {
            const dot = document.createElement('div');
            dot.className = `w-1.5 h-1.5 ${tm.dot} rounded-full indicator-dot ml-auto`;
            activeEl.appendChild(dot);
        }
    }

    const title = document.getElementById('page-title');
    const sub = document.getElementById('page-subtitle');
    const tbTitle = document.getElementById('tabel-judul-jenis');

    const vRekap = document.getElementById('viewRekapLs');
    if (vRekap) vRekap.classList.toggle('hidden', !modeRekapLs);

    if (modeRekapLs) {
        const vSpj = document.getElementById('viewSpj'); if (vSpj) vSpj.classList.add('hidden');
        const vBap = document.getElementById('viewBap'); if (vBap) vBap.classList.add('hidden');
        const hAksi = document.getElementById('headerAksiSpj'); if (hAksi) hAksi.classList.add('hidden');
        if (title) title.innerText = 'Rekap Pencairan LS';
        if (sub) sub.innerText = 'Monitoring SPM UM, SPM Termin, potongan pajak, dan nilai bersih kontrak LS disetujui';
        if (typeof REKAP_LS !== 'undefined') REKAP_LS.render();
        return;
    }

    BAP.tampilkanTab(modeBap);              // BAP: tampilkan panel BAP, sembunyikan dashboard/tabel SPJ (tanpa reload halaman)
    if (modeBap) {
        if (title) title.innerText = 'Modul BAP LS';
        if (sub) sub.innerText = 'Input, edit, riwayat, dan cetak dokumen PDF A4 Berita Acara Pembayaran LS';
        return;
    }

    // Tampilkan panel sesuai mode (ALL vs GU vs LS)
    const pSemua = document.getElementById('panelDashboardSemua');
    const pGu = document.getElementById('panelModeGu');
    const pLs = document.getElementById('panelModeLs');
    if (pSemua) pSemua.classList.toggle('hidden', jenis !== 'ALL');
    if (pGu) pGu.classList.toggle('hidden', jenis !== 'GU');
    if (pLs) pLs.classList.toggle('hidden', jenis !== 'LS');

    // Tombol header & aksen tabel yang berbeda untuk GU dan LS
    const btnBuat = document.getElementById('btnHeaderBuatSpj');
    const lblBuat = document.getElementById('lblHeaderBuatSpj');
    const btnKeBap = document.getElementById('btnHeaderKeBap');
    const secTabel = document.getElementById('sectionTabelSpj');
    const headTabel = document.getElementById('spjTableHead');
    const thAksi = document.getElementById('th-aksi');
    const ikonTabel = document.getElementById('ikonTabelSpj');
    const thNpd = document.getElementById('th-npd-kontrak');
    const thUraian = document.getElementById('th-uraian');
    const inpCari = document.getElementById('inputSearchSpj');

    if (btnKeBap) {
        btnKeBap.classList.toggle('hidden', jenis !== 'LS');
        btnKeBap.classList.toggle('flex', jenis === 'LS');
    }

    if (jenis === 'ALL') {
        if (title) title.innerText = 'Dashboard Utama';
        if (sub) sub.innerText = 'Ringkasan pagu, total berkas pencairan GU & LS, serta antrean verifikasi';
        if (tbTitle) tbTitle.innerText = 'GU & LS';
        if (lblBuat) lblBuat.innerText = 'Buat SPJ Baru';
        if (btnBuat) btnBuat.className = 'btn-buat-spj px-4 py-2 bg-sipd-navy hover:bg-slate-800 border border-transparent rounded text-xs font-bold text-white shadow-sm transition-colors flex items-center gap-2 whitespace-nowrap';
        if (secTabel) secTabel.className = 'bg-white rounded-lg shadow-sm border border-slate-200 p-4 relative z-0 transition-colors';
        if (headTabel) headTabel.className = 'bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] sticky top-0 z-20 shadow-sm border-b border-slate-200';
        if (thAksi) thAksi.className = 'py-3.5 px-4 border-b border-slate-200 text-center sticky right-0 bg-slate-50 shadow-[-4px_0_10px_rgba(0,0,0,0.02)] z-20 border-l border-slate-200';
        if (ikonTabel) ikonTabel.className = 'fa-solid fa-list-check text-sipd-emerald me-2';
        if (thNpd) thNpd.innerText = 'No. NPD / Kontrak';
        if (thUraian) thUraian.innerText = 'Nama Pekerjaan / Uraian';
        if (inpCari) inpCari.placeholder = 'Cari NPD, Kontrak, Kegiatan, CV...';
    } else if (jenis === 'GU') {
        if (title) title.innerText = 'Data SPJ Ganti Uang (GU)';
        if (sub) sub.innerText = 'Daftar pengajuan GU berbasis Nomor NPD hingga tahap Transfer PB';
        if (tbTitle) tbTitle.innerText = 'Ganti Uang (GU)';
        if (lblBuat) lblBuat.innerText = 'Buat SPJ GU';
        if (btnBuat) btnBuat.className = 'btn-buat-spj px-4 py-2 bg-indigo-600 hover:bg-indigo-700 border border-transparent rounded text-xs font-bold text-white shadow-sm transition-colors flex items-center gap-2 whitespace-nowrap';
        if (secTabel) secTabel.className = 'bg-white rounded-lg shadow-sm border border-indigo-200 border-t-4 border-t-indigo-600 p-4 relative z-0 transition-colors';
        if (headTabel) headTabel.className = 'bg-indigo-50 text-indigo-900 font-bold uppercase tracking-wider text-[10px] sticky top-0 z-20 shadow-sm border-b border-indigo-200';
        if (thAksi) thAksi.className = 'py-3.5 px-4 border-b border-indigo-200 text-center sticky right-0 bg-indigo-50 shadow-[-4px_0_10px_rgba(0,0,0,0.02)] z-20 border-l border-indigo-200';
        if (ikonTabel) ikonTabel.className = 'fa-solid fa-file-invoice-dollar text-indigo-600 me-2';
        if (thNpd) thNpd.innerText = 'Nomor NPD';
        if (thUraian) thUraian.innerText = 'Uraian SPJ';
        if (inpCari) inpCari.placeholder = 'Cari Nomor NPD, Kegiatan, Uraian GU...';
    } else if (jenis === 'LS') {
        if (title) title.innerText = 'Data SPJ Langsung (LS)';
        if (sub) sub.innerText = 'Daftar pengajuan LS berbasis BAP & Kontrak (berakhir pada status Disetujui)';
        if (tbTitle) tbTitle.innerText = 'Langsung (LS)';
        if (lblBuat) lblBuat.innerText = 'Buat SPJ LS';
        if (btnBuat) btnBuat.className = 'btn-buat-spj px-4 py-2 bg-purple-600 hover:bg-purple-700 border border-transparent rounded text-xs font-bold text-white shadow-sm transition-colors flex items-center gap-2 whitespace-nowrap';
        if (secTabel) secTabel.className = 'bg-white rounded-lg shadow-sm border border-purple-200 border-t-4 border-t-purple-600 p-4 relative z-0 transition-colors';
        if (headTabel) headTabel.className = 'bg-purple-50 text-purple-900 font-bold uppercase tracking-wider text-[10px] sticky top-0 z-20 shadow-sm border-b border-purple-200';
        if (thAksi) thAksi.className = 'py-3.5 px-4 border-b border-purple-200 text-center sticky right-0 bg-purple-50 shadow-[-4px_0_10px_rgba(0,0,0,0.02)] z-20 border-l border-purple-200';
        if (ikonTabel) ikonTabel.className = 'fa-solid fa-file-signature text-purple-600 me-2';
        if (thNpd) thNpd.innerText = 'No. Kontrak / SPK';
        if (thUraian) thUraian.innerText = 'Nama Pekerjaan';
        if (inpCari) inpCari.placeholder = 'Cari No. Kontrak, Penyedia/CV, Pekerjaan...';
    }

    // Re-apply hak akses tombol Buat SPJ (karena className berubah di atas)
    if (btnBuat) btnBuat.style.display = bisaBuatSpj() ? '' : 'none';

    const thCv = document.getElementById('th-cv');
    if (thCv) thCv.style.display = (jenis === 'GU') ? 'none' : 'table-cell';

    renderTabelSpj();
}

function validasiDaftarEmail(raw, maks = 5) {
    const teks = String(raw || '').trim();
    if (!teks) return { ok: true, teks: '' };
    const arr = teks.split(/[,;\n]+/).map(x => x.trim()).filter(Boolean);
    if (arr.length > maks) return { ok: false, pesan: `Maksimal ${maks} alamat email.` };
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const unik = [], seen = {};
    for (const em of arr) {
        if (!re.test(em)) return { ok: false, pesan: `Format email tidak valid: ${em}` };
        const k = em.toLowerCase();
        if (!seen[k]) { seen[k] = true; unik.push(em); }
    }
    return { ok: true, teks: unik.join(', ') };
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
        document.getElementById('formNewSpj').reset();
        const selJenis = document.getElementById('inputJenisSurat');
        if (selJenis) {
            selJenis.style.pointerEvents = 'auto';
            selJenis.tabIndex = 0;
            selJenis.classList.remove('bg-slate-100');
            if (window._defaultJenisSpjBaru && (window._defaultJenisSpjBaru === 'GU' || window._defaultJenisSpjBaru === 'LS')) {
                selJenis.value = window._defaultJenisSpjBaru;
            }
        }
        const tglEl = document.getElementById('inputTanggal');
        if (tglEl && !tglEl.value) {
            const d = new Date();
            tglEl.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
        const kodeBapInit = window._defaultKodeBapBaru || '';
        window._defaultJenisSpjBaru = '';
        window._defaultKodeBapBaru = '';
        ubahLabelNpdKontrak(); kunciPptkLogin();
        if (kodeBapInit && selJenis && selJenis.value === 'LS') {
            const selBap = document.getElementById('inputPilihBap');
            if (selBap) {
                selBap.value = kodeBapInit;
                if (typeof autoFillDariBap === 'function') autoFillDariBap();
            }
            const dataBap = (window.DATABASE_KONTRAK || []).find(k => String(k.kodeSpj) === String(kodeBapInit));
            if (dataBap && dataBap.pptk && sesiAktif.role !== 'PPTK') {
                setSelectValue(document.getElementById('inputPptk'), dataBap.pptk);
            }
        }
        if (typeof autoFillKontakPptk === 'function') autoFillKontakPptk();
        const existingSukses = document.getElementById('pesanSuksesDiv'); if(existingSukses) existingSukses.remove();
        document.getElementById('formNewSpj').classList.remove('hidden'); document.getElementById('btnSubmitNew').innerText = "Lanjut ke Form Upload"; 
    }
    document.getElementById(id).classList.remove('hidden'); 
}

function bisaKelolaMasterPenyedia() {
    return sesiAktif.role === 'SUPER_ADMIN' || sesiAktif.role === 'VERIFIKATOR' || sesiAktif.role === 'BENDAHARA';
}

function switchTabAdmin(tabName) {
    const isAdmin = sesiAktif.role === 'SUPER_ADMIN';
    if (!isAdmin && tabName !== 'penyedia') tabName = 'penyedia';
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
    if (tabName === 'penyedia') renderTabelPenyediaAdmin();
    else if (tabName === 'referensi') renderTabelReferensiAdmin();
    else if (tabName === 'log') muatLogSistemAdmin();
}

function infoPasswordAkun(akun) {
    if (!akun.username) return '<span class="text-slate-400 text-[10px]">-</span>';
    const peta = { HASH: ['bg-emerald-50 text-emerald-700 border-emerald-200', 'Ter-hash ✔'], TEKS_BIASA: ['bg-red-50 text-red-700 border-red-200', 'Teks biasa ⚠'], KOSONG: ['bg-slate-100 text-slate-600 border-slate-200', 'Belum ada'] };
    const f = peta[akun.passwordFormat] || peta.KOSONG;
    let html = `<span class="px-2 py-0.5 ${f[0]} border rounded text-[9px] font-bold">${f[1]}</span>`;
    if (akun.passwordDefault) html += ` <span class="px-2 py-0.5 bg-red-600 text-white rounded text-[9px] font-bold">Password default</span>`;
    html += `<div class="text-[9px] text-slate-400 mt-0.5">${akun.passwordDiubah ? 'Diubah: ' + escapeHtml(akun.passwordDiubah) + (akun.passwordDiubahOleh ? '<br>oleh ' + escapeHtml(akun.passwordDiubahOleh) : '') : 'Perubahan belum tercatat'}</div>`;
    if (akun.roleValid === false) html += '<div class="text-[9px] text-red-600 font-bold mt-0.5">ROLE TIDAK VALID — ubah ke salah satu dari 5 role</div>';
    return html;
}

function badgeStatusAkun(status) {
    return String(status || 'AKTIF').toUpperCase() === 'NONAKTIF'
        ? '<span class="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded text-[9px] font-bold">NONAKTIF</span>'
        : '<span class="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[9px] font-bold">AKTIF</span>';
}

function renderTabelAkunAdmin() {
    const tbody = document.getElementById('tabelAkunBody'); const tbPptk = document.getElementById('tabelPptkBody');
    if (!tbody || !tbPptk) return; tbody.innerHTML = ''; tbPptk.innerHTML = '';
    (window.DATABASE_AKUN || []).forEach((akun, index) => {
        const nama = escapeHtml(akun.namaLengkap);
        const nonaktif = String(akun.status || 'AKTIF').toUpperCase() === 'NONAKTIF';
        const rowDim = nonaktif ? 'bg-slate-50/70 opacity-75' : '';
        const kontakTxt = [akun.email, akun.wa].filter(Boolean).map(escapeHtml).join(' · ');
        const unitTxt = akun.unitKerja ? `<div class="text-[10px] text-slate-400 font-normal mt-0.5">${escapeHtml(akun.unitKerja)}</div>` : '';
        const btnToggle = nonaktif
            ? `<button onclick="toggleStatusAkun(${index})" title="Aktifkan kembali akun" class="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold hover:bg-emerald-100 mr-1"><i class="fa-solid fa-power-off"></i></button>`
            : `<button onclick="toggleStatusAkun(${index})" title="Nonaktifkan akun (putus akses &amp; jaga riwayat)" class="px-2 py-1 bg-slate-100 text-slate-600 border border-slate-300 rounded text-[10px] font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200 mr-1"><i class="fa-solid fa-power-off"></i></button>`;

        if (akun.role === 'PPTK') {
            tbPptk.innerHTML += `
            <tr class="hover:bg-slate-50 transition-colors ${rowDim}">
                <td class="p-3 px-4 border-b border-slate-200 font-bold text-slate-800 text-xs">${nama}${unitTxt}</td>
                <td class="p-3 px-4 border-b border-slate-200 text-slate-500 text-[11px]"><div class="font-mono">${escapeHtml(akun.nip || '-')}</div>${kontakTxt ? `<div class="text-[10px] text-slate-400 mt-0.5">${kontakTxt}</div>` : ''}</td>
                <td class="p-3 px-4 border-b border-slate-200 text-center whitespace-nowrap">${badgeStatusAkun(akun.status)}</td>
                <td class="p-3 px-4 border-b border-slate-200 text-center whitespace-nowrap">
                    ${btnToggle}<button onclick="editDataPptk(${index})" title="Edit PPTK" class="px-2 py-1 bg-amber-50 text-amber-600 border border-amber-200 rounded text-[10px] font-bold hover:bg-amber-100"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="hapusDataAkun(${index})" title="Hapus permanen" class="px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded text-[10px] font-bold hover:bg-red-100 ml-1"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
        }
        const warna = { SUPER_ADMIN: 'bg-amber-50 text-amber-700 border-amber-200', PPTK: 'bg-blue-50 text-blue-700 border-blue-200', VERIFIKATOR: 'bg-emerald-50 text-emerald-700 border-emerald-200', BENDAHARA: 'bg-teal-50 text-teal-700 border-teal-200' }[akun.role] || 'bg-slate-100 text-slate-700 border-slate-200';
        const roleBadge = `<span class="px-2.5 py-1 ${warna} text-[10px] font-bold rounded-md border">${escapeHtml(akun.role)}</span>`;
        const infoPw = infoPasswordAkun(akun);
        const tombolUji = akun.username ? `<button onclick="bukaUjiPassword(${index})" title="Uji kecocokan password" class="px-2 py-1 bg-sky-50 text-sky-700 border border-sky-200 rounded text-[10px] font-bold hover:bg-sky-100 mr-1"><i class="fa-solid fa-key"></i></button>` : '';
        const tombolCabut = (akun.username && !nonaktif && akun.username.toLowerCase() !== String(sesiAktif.username || '').toLowerCase())
            ? `<button onclick="cabutSesiAkun(${index})" title="Keluarkan paksa (cabut sesi aktif)" class="px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[10px] font-bold hover:bg-purple-100 mr-1"><i class="fa-solid fa-right-from-bracket"></i></button>` : '';
        const identitasLogin = akun.username
            ? `<div class="text-blue-600 font-bold font-mono">${escapeHtml(akun.username)}</div>`
            : `<div class="text-red-500 italic text-[10px]">Belum Punya Akun</div>`;
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 transition-colors ${rowDim}">
                <td class="p-3 px-4 border-b border-slate-200 font-bold text-slate-800 text-xs">${nama}${unitTxt}${kontakTxt ? `<div class="text-[10px] text-slate-400 font-normal">${kontakTxt}</div>` : ''}</td>
                <td class="p-3 px-4 border-b border-slate-200 text-slate-500 text-[11px]">${identitasLogin}<div class="mt-1">${badgeStatusAkun(akun.status)}</div></td>
                <td class="p-3 px-4 border-b border-slate-200 text-xs">${roleBadge}</td>
                <td class="p-3 px-4 border-b border-slate-200 text-xs">${infoPw}</td>
                <td class="p-3 px-4 border-b border-slate-200 text-center whitespace-nowrap">
                    ${tombolUji}${tombolCabut}${btnToggle}<button onclick="editDataAkun(${index})" title="Edit akun" class="px-2 py-1 bg-amber-50 text-amber-600 border border-amber-200 rounded text-[10px] font-bold hover:bg-amber-100"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="hapusDataAkun(${index})" title="Hapus permanen" class="px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded text-[10px] font-bold hover:bg-red-100 ml-1"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
    });
    isiDropdownPptkUtama();
}

// Kirim perubahan akun ke server (server yang meng-hash password & memeriksa hak akses)
function kirimAkunKeServer(payload, pesanSukses) {
    return apiPost(payload)
        .then(res => {
            if (res.status !== 'success') { showToast('Gagal: ' + res.message, 'error'); return false; }
            return tarikDataDariServer().then(() => { renderTabelAkunAdmin(); showToast(pesanSukses); return true; });
        })
        .catch(e => { if (String(e.message) !== 'Sesi berakhir') showToast('Koneksi gagal: ' + e.message, 'error'); return false; });
}

function simpanDataPptk() {
    const nama = document.getElementById('pptkNama').value.trim(); const nip = document.getElementById('pptkNip').value.trim();
    const unitKerja = document.getElementById('pptkUnit') ? document.getElementById('pptkUnit').value : '';
    const email = document.getElementById('pptkEmail') ? document.getElementById('pptkEmail').value.trim() : '';
    const wa = document.getElementById('pptkWa') ? document.getElementById('pptkWa').value.trim() : '';
    if (!nama) { showToast('Nama Lengkap wajib diisi!', 'warning'); return; }
    const lama = editIndexPptk > -1 ? window.DATABASE_AKUN[editIndexPptk] : null;
    kirimAkunKeServer({
        action: 'akun_simpan', namaLama: lama ? lama.namaLengkap : '', namaLengkap: nama,
        username: lama ? lama.username : '', role: lama ? lama.role : 'PPTK', nip: nip, password: '',
        status: lama ? (lama.status || 'AKTIF') : 'AKTIF', unitKerja: unitKerja, email: email, wa: wa
    }, 'Data PPTK tersimpan.').then(ok => { if (ok) resetFormPptk(); });
}
function editDataPptk(index) {
    editIndexPptk = index; const ak = window.DATABASE_AKUN[index];
    document.getElementById('titleFormPptk').innerHTML = `<i class="fa-solid fa-pen text-emerald-600"></i> Edit Data PPTK`;
    document.getElementById('pptkNama').value = ak.namaLengkap || ""; document.getElementById('pptkNip').value = ak.nip || "";
    if (document.getElementById('pptkUnit')) document.getElementById('pptkUnit').value = ak.unitKerja || "";
    if (document.getElementById('pptkEmail')) document.getElementById('pptkEmail').value = ak.email || "";
    if (document.getElementById('pptkWa')) document.getElementById('pptkWa').value = ak.wa || "";
}
function resetFormPptk() {
    editIndexPptk = -1; document.getElementById('titleFormPptk').innerHTML = `<i class="fa-solid fa-plus-circle text-emerald-600"></i> Tambah / Edit PPTK`;
    document.getElementById('pptkNama').value = ""; document.getElementById('pptkNip').value = "";
    if (document.getElementById('pptkUnit')) document.getElementById('pptkUnit').value = "";
    if (document.getElementById('pptkEmail')) document.getElementById('pptkEmail').value = "";
    if (document.getElementById('pptkWa')) document.getElementById('pptkWa').value = "";
}

function simpanDataAkun() {
    const nama = document.getElementById('akunNama').value.trim(); const user = document.getElementById('akunUsername').value.trim().toLowerCase();
    const pass = document.getElementById('akunPassword').value; const role = document.getElementById('akunRole').value;
    const status = document.getElementById('akunStatus') ? document.getElementById('akunStatus').value : 'AKTIF';
    const unitKerja = document.getElementById('akunUnit') ? document.getElementById('akunUnit').value : '';
    const email = document.getElementById('akunEmail') ? document.getElementById('akunEmail').value.trim() : '';
    const wa = document.getElementById('akunWa') ? document.getElementById('akunWa').value.trim() : '';
    const lama = editIndexAkun > -1 ? window.DATABASE_AKUN[editIndexAkun] : null;
    if (!nama || !user) { showToast('Nama dan username wajib diisi!', 'warning'); return; }
    if (!lama && pass.length < 8) { showToast('Password akun baru minimal 8 karakter.', 'warning'); return; }
    if (pass && pass.length < 8) { showToast('Password minimal 8 karakter.', 'warning'); return; }
    kirimAkunKeServer({
        action: 'akun_simpan', namaLama: lama ? lama.namaLengkap : '', namaLengkap: nama,
        username: user, password: pass, role: role, nip: lama ? lama.nip : '',
        status: status, unitKerja: unitKerja, email: email, wa: wa
    }, 'Akun tersimpan.').then(ok => { if (ok) resetFormAkun(); });
}
function editDataAkun(index) {
    editIndexAkun = index; const ak = window.DATABASE_AKUN[index];
    document.getElementById('titleFormAkun').innerHTML = `<i class="fa-solid fa-pen text-blue-600"></i> Buat / Edit Detail Akun`;
    document.getElementById('akunNama').value = ak.namaLengkap || ""; document.getElementById('akunUsername').value = ak.username || "";
    const pw = document.getElementById('akunPassword'); pw.value = ""; pw.placeholder = "Kosongkan jika tidak diubah";
    document.getElementById('akunRole').value = ak.role || "PPTK";
    if (document.getElementById('akunStatus')) document.getElementById('akunStatus').value = ak.status || "AKTIF";
    if (document.getElementById('akunUnit')) document.getElementById('akunUnit').value = ak.unitKerja || "";
    if (document.getElementById('akunEmail')) document.getElementById('akunEmail').value = ak.email || "";
    if (document.getElementById('akunWa')) document.getElementById('akunWa').value = ak.wa || "";
}
function resetFormAkun() {
    editIndexAkun = -1; document.getElementById('titleFormAkun').innerHTML = `<i class="fa-solid fa-user-plus text-blue-600"></i> Buat / Edit Detail Akun`;
    document.getElementById('akunNama').value = ""; document.getElementById('akunUsername').value = "";
    const pw = document.getElementById('akunPassword'); pw.value = ""; pw.placeholder = "Min. 8 karakter";
    document.getElementById('akunRole').value = "VERIFIKATOR";
    if (document.getElementById('akunStatus')) document.getElementById('akunStatus').value = "AKTIF";
    if (document.getElementById('akunUnit')) document.getElementById('akunUnit').value = "";
    if (document.getElementById('akunEmail')) document.getElementById('akunEmail').value = "";
    if (document.getElementById('akunWa')) document.getElementById('akunWa').value = "";
}
async function toggleStatusAkun(index) {
    const ak = window.DATABASE_AKUN[index]; if (!ak) return;
    const akanAktif = String(ak.status || 'AKTIF').toUpperCase() === 'NONAKTIF';
    const ok = await tanyaKonfirmasi({
        judul: akanAktif ? 'Aktifkan Kembali Akun?' : 'Nonaktifkan Akun?',
        pesan: akanAktif
            ? `Akun "${ak.namaLengkap}" akan diaktifkan kembali dan dapat masuk ke sistem.`
            : `Akun "${ak.namaLengkap}" tidak dapat login lagi dan sesi aktifnya langsung dicabut.`,
        catatan: akanAktif ? '' : 'Seluruh riwayat SPJ & BAP milik pegawai ini tetap tersimpan utuh.',
        labelYa: akanAktif ? 'Aktifkan' : 'Nonaktifkan',
        tipe: akanAktif ? 'primary' : 'warning'
    });
    if (!ok) return;
    kirimAkunKeServer({ action: 'akun_toggle_status', namaLengkap: ak.namaLengkap }, akanAktif ? 'Akun diaktifkan kembali.' : 'Akun dinonaktifkan & sesi dicabut.');
}
async function cabutSesiAkun(index) {
    const ak = window.DATABASE_AKUN[index]; if (!ak || !ak.username) return;
    const ok = await tanyaKonfirmasi({
        judul: 'Keluarkan Paksa Sesi Aktif?',
        pesan: `Seluruh sesi aktif untuk "${ak.namaLengkap}" (${ak.username}) akan segera dicabut. User harus login ulang pada perangkat yang sedang terbuka.`,
        labelYa: 'Cabut Sesi',
        tipe: 'warning'
    });
    if (!ok) return;
    apiPost({ action: 'akun_cabut_sesi', username: ak.username })
        .then(res => {
            if (res.status !== 'success') { showToast('Gagal: ' + res.message, 'error'); return; }
            showToast('Sesi ' + ak.username + ' berhasil dicabut.', 'success');
        })
        .catch(e => { if (String(e.message) !== 'Sesi berakhir') showToast('Koneksi gagal: ' + e.message, 'error'); });
}
async function hapusDataAkun(index) {
    const ak = window.DATABASE_AKUN[index]; if (!ak) return;
    const ok = await tanyaKonfirmasi({
        judul: 'Hapus Permanen Akun?',
        pesan: `Anda akan menghapus permanen akun "${ak.namaLengkap}".`,
        catatan: 'Tip: Bila pegawai hanya mutasi atau pensiun, sebaiknya gunakan tombol Nonaktifkan (ikon daya) agar arsip akun tetap tercatat.',
        labelYa: 'Ya, Hapus Permanen',
        tipe: 'danger'
    });
    if (ok) kirimAkunKeServer({ action: 'akun_hapus', namaLengkap: ak.namaLengkap }, 'Berhasil dihapus dari server.');
}
function bukaModalSuperAdmin(tabAwal) {
    const isAdmin = sesiAktif.role === 'SUPER_ADMIN';
    if (!isAdmin && !bisaKelolaMasterPenyedia()) {
        showToast('Anda tidak memiliki hak membuka Pengaturan Master.', 'warning');
        return;
    }
    const profileDd = document.getElementById('profileDropdown');
    if (profileDd) profileDd.classList.add('hidden');

    // Sembunyikan tab khusus SUPER_ADMIN bila dibuka oleh VERIFIKATOR / BENDAHARA
    document.querySelectorAll('.admin-only-tab').forEach(el => el.classList.toggle('hidden', !isAdmin));
    const jdl = document.getElementById('judulModalMaster');
    if (jdl) {
        jdl.innerHTML = isAdmin
            ? '<i class="fa-solid fa-gears text-amber-500"></i> Pengaturan Master'
            : '<i class="fa-solid fa-building text-purple-600"></i> Master Penyedia';
    }
    if (isAdmin) renderTabelAkunAdmin();
    renderTabelPenyediaAdmin();
    if (isAdmin) renderTabelReferensiAdmin();
    switchTabAdmin(isAdmin ? (tabAwal || 'pptk') : 'penyedia');
    openModal('modalSuperAdmin');
}

// ============================================================================
// TAB 3: MASTER PENYEDIA / CV (DB_PENYEDIA)
// ============================================================================
let editPelaksanaLama = '';

function hitungPakaiPenyediaLokal(namaCv) {
    const key = String(namaCv || '').trim().toUpperCase();
    if (!key) return { bap: 0, spj: 0 };
    const bap = (window.DATABASE_KONTRAK || []).filter(k => String(k.pelaksana || '').trim().toUpperCase() === key).length;
    const spj = (spjData || []).filter(s => String(s.namaCv || '').trim().toUpperCase() === key).length;
    return { bap, spj };
}

function renderTabelPenyediaAdmin() {
    const tbody = document.getElementById('tabelPenyediaBody');
    if (!tbody) return;
    const q = (document.getElementById('cariMasterPenyedia') ? document.getElementById('cariMasterPenyedia').value : '').trim().toLowerCase();
    const semua = [...(window.DATABASE_PENYEDIA || [])].sort((a, b) => String(a.pelaksana || '').localeCompare(String(b.pelaksana || ''), 'id'));
    const countEl = document.getElementById('countMasterPenyedia');
    if (countEl) countEl.textContent = `${semua.length} Penyedia`;

    const tampil = semua.filter(c => {
        if (!q) return true;
        return `${c.pelaksana} ${c.direktur} ${c.jabatan} ${c.npwp} ${c.alamat} ${c.bank} ${c.noRek} ${c.aktaNo}`.toLowerCase().includes(q);
    });

    if (tampil.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400 font-medium">${q ? 'Tidak ada penyedia yang cocok dengan pencarian.' : 'Belum ada data penyedia.'}</td></tr>`;
        return;
    }

    const isAdmin = sesiAktif.role === 'SUPER_ADMIN';
    tbody.innerHTML = tampil.map(c => {
        const pakai = hitungPakaiPenyediaLokal(c.pelaksana);
        const terpakai = (pakai.bap > 0 || pakai.spj > 0);
        const badgePakai = terpakai
            ? `<span class="px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[9px] font-bold">${pakai.bap} BAP &middot; ${pakai.spj} SPJ</span>`
            : `<span class="text-[10px] text-slate-400">Belum dipakai</span>`;
        const aktaInfo = (c.aktaNo || c.aktaTgl)
            ? `<div class="text-[10px] text-slate-400 mt-0.5">Akta: ${escapeHtml(c.aktaNo || '-')}${c.aktaTgl ? ' (' + formatTanggalIndo(c.aktaTgl) + ')' : ''}</div>` : '';
        const btnHapus = isAdmin
            ? `<button type="button" data-cv="${escapeHtml(c.pelaksana)}" onclick="hapusDataPenyedia(this.getAttribute('data-cv'))" title="${terpakai ? 'Tidak bisa dihapus karena masih dipakai transaksi' : 'Hapus penyedia'}" class="px-2 py-1 ${terpakai ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'} border rounded text-[10px] font-bold ml-1"><i class="fa-solid fa-trash"></i></button>`
            : '';
        return `<tr class="hover:bg-purple-50/30 transition-colors">
            <td class="p-2.5 align-top">
                <div class="font-bold text-purple-800">${escapeHtml(c.pelaksana)}</div>
                <div class="text-[10px] text-slate-500 mt-0.5">${escapeHtml(c.direktur || '-')} <span class="text-slate-400">(${escapeHtml(c.jabatan || 'Direktur')})</span></div>
                ${aktaInfo}
            </td>
            <td class="p-2.5 align-top max-w-[230px] whitespace-normal">
                <div class="font-mono text-[11px] text-slate-700">${escapeHtml(c.npwp || '-')}</div>
                <div class="text-[10px] text-slate-500 mt-0.5 leading-snug">${escapeHtml(c.alamat || '-')}</div>
            </td>
            <td class="p-2.5 align-top whitespace-nowrap">
                <div class="font-bold text-slate-700">${escapeHtml(c.bank || '-')}</div>
                <div class="font-mono text-[11px] text-blue-700 font-bold mt-0.5">${escapeHtml(c.noRek || '-')}</div>
            </td>
            <td class="p-2.5 text-center align-top whitespace-nowrap">${badgePakai}</td>
            <td class="p-2.5 text-center align-top whitespace-nowrap">
                <button type="button" data-cv="${escapeHtml(c.pelaksana)}" onclick="editDataPenyedia(this.getAttribute('data-cv'))" title="Edit penyedia" class="px-2 py-1 bg-amber-50 text-amber-600 border border-amber-200 rounded text-[10px] font-bold hover:bg-amber-100"><i class="fa-solid fa-pen"></i></button>${btnHapus}
            </td>
        </tr>`;
    }).join('');
}

function editDataPenyedia(namaPelaksana) {
    const cv = (window.DATABASE_PENYEDIA || []).find(c => String(c.pelaksana).trim().toUpperCase() === String(namaPelaksana || '').trim().toUpperCase());
    if (!cv) { showToast('Data penyedia tidak ditemukan.', 'error'); return; }
    editPelaksanaLama = cv.pelaksana;
    const jdl = document.getElementById('titleFormPenyedia');
    if (jdl) jdl.innerHTML = `<i class="fa-solid fa-pen text-amber-600 me-1"></i> Edit Penyedia: <span class="text-purple-700">${escapeHtml(cv.pelaksana)}</span>`;
    document.getElementById('penPelaksana').value = cv.pelaksana || '';
    document.getElementById('penDirektur').value = cv.direktur || '';
    document.getElementById('penJabatan').value = cv.jabatan || 'Direktur';
    document.getElementById('penNpwp').value = cv.npwp || '';
    document.getElementById('penBank').value = cv.bank || '';
    document.getElementById('penNoRek').value = cv.noRek || '';
    document.getElementById('penAlamat').value = (cv.alamat && cv.alamat !== '-') ? cv.alamat : '';
    document.getElementById('penAktaNo').value = cv.aktaNo || '';
    document.getElementById('penAktaTgl').value = cv.aktaTgl ? String(cv.aktaTgl).split('T')[0] : '';
    const tabScroll = document.querySelector('#tab-content-penyedia .overflow-y-auto');
    if (tabScroll) tabScroll.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetFormPenyedia() {
    editPelaksanaLama = '';
    const jdl = document.getElementById('titleFormPenyedia');
    if (jdl) jdl.innerHTML = '<i class="fa-solid fa-plus-circle text-purple-600 me-1"></i> Tambah / Edit Penyedia (CV / PT)';
    ['penPelaksana', 'penDirektur', 'penNpwp', 'penBank', 'penNoRek', 'penAlamat', 'penAktaNo', 'penAktaTgl'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    const jb = document.getElementById('penJabatan'); if (jb) jb.value = 'Direktur';
}

async function simpanDataPenyedia() {
    if (!bisaKelolaMasterPenyedia()) { showToast('Anda tidak memiliki hak mengubah Master Penyedia.', 'error'); return; }
    const pelaksana = (document.getElementById('penPelaksana').value || '').trim();
    const direktur = (document.getElementById('penDirektur').value || '').trim();
    const jabatan = (document.getElementById('penJabatan').value || '').trim() || 'Direktur';
    const npwp = (document.getElementById('penNpwp').value || '').trim();
    const bank = (document.getElementById('penBank').value || '').trim();
    const noRek = (document.getElementById('penNoRek').value || '').replace(/\s+/g, '');
    const alamat = (document.getElementById('penAlamat').value || '').trim();
    const aktaNo = (document.getElementById('penAktaNo').value || '').trim();
    const aktaTgl = (document.getElementById('penAktaTgl').value || '').trim();

    if (!pelaksana || !direktur || !npwp || !bank || !noRek || !alamat) {
        showToast('Nama Penyedia, Direktur, NPWP, Bank, No. Rekening, dan Alamat wajib diisi!', 'warning');
        return;
    }
    if (!/^[0-9]{5,30}$/.test(noRek)) {
        showToast('No. Rekening harus berupa angka 5-30 digit.', 'warning');
        return;
    }

    // Jika mengedit dan Nama CV berubah, tampilkan konfirmasi jumlah BAP & SPJ yang akan ikut diubah
    if (editPelaksanaLama && editPelaksanaLama.trim() !== pelaksana) {
        const pakai = hitungPakaiPenyediaLokal(editPelaksanaLama);
        const ok = await tanyaKonfirmasi({
            judul: 'Ubah Nama Penyedia & Selaraskan Transaksi?',
            pesan: 'Perubahan nama CV akan otomatis memperbarui seluruh riwayat BAP & SPJ terkait pada Tahun Anggaran aktif.',
            detailList: [
                ['Nama Lama', editPelaksanaLama],
                ['Nama Baru', pelaksana],
                ['Data Ikut Diubah', `${pakai.bap} BAP & ${pakai.spj} SPJ (TA ${CONFIG.TAHUN_ANGGARAN})`]
            ],
            catatan: 'Gunakan hanya untuk koreksi penulisan/penyesuaian nama buku rekening, bukan mengganti ke perusahaan yang berbeda.',
            labelYa: 'Ya, Simpan & Selaraskan',
            tipe: 'warning'
        });
        if (!ok) return;
    }

    const btn = document.getElementById('btnSimpanPenyedia');
    const asli = btn ? btn.innerHTML : 'Simpan';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }

    apiPost({
        action: 'penyedia_simpan',
        pelaksanaLama: editPelaksanaLama,
        pelaksana, direktur, jabatan, npwp, bank, noRek, alamat, aktaNo, aktaTgl
    })
        .then(res => {
            if (res.status !== 'success') { showToast('Gagal menyimpan penyedia: ' + res.message, 'error'); return; }
            const infoSinkron = (res.diubahBap || res.diubahSpj)
                ? ` (${res.diubahBap || 0} BAP & ${res.diubahSpj || 0} SPJ ikut diselaraskan)` : '';
            resetFormPenyedia();
            return tarikDataDariServer().then(() => {
                renderTabelPenyediaAdmin();
                showToast('Data penyedia tersimpan' + infoSinkron + '.', 'success');
            });
        })
        .catch(e => { if (String(e.message) !== 'Sesi berakhir') showToast('Koneksi gagal: ' + e.message, 'error'); })
        .finally(() => { if (btn) { btn.disabled = false; btn.innerHTML = asli; } });
}

async function hapusDataPenyedia(namaPelaksana) {
    if (sesiAktif.role !== 'SUPER_ADMIN') { showToast('Hapus penyedia hanya untuk SUPER_ADMIN.', 'warning'); return; }
    const pakai = hitungPakaiPenyediaLokal(namaPelaksana);
    if (pakai.bap > 0 || pakai.spj > 0) {
        showToast(`Penyedia "${namaPelaksana}" masih dipakai pada ${pakai.bap} BAP dan ${pakai.spj} SPJ sehingga tidak dapat dihapus.`, 'warning');
        return;
    }
    const ok = await tanyaKonfirmasi({
        judul: 'Hapus Penyedia dari Master?',
        pesan: `Data "${namaPelaksana}" akan dihapus permanen dari DB_PENYEDIA.`,
        labelYa: 'Ya, Hapus',
        tipe: 'danger'
    });
    if (!ok) return;
    apiPost({ action: 'penyedia_hapus', pelaksana: namaPelaksana })
        .then(res => {
            if (res.status !== 'success') { showToast('Gagal menghapus: ' + res.message, 'error'); return; }
            if (editPelaksanaLama && editPelaksanaLama.toUpperCase() === String(namaPelaksana).toUpperCase()) resetFormPenyedia();
            return tarikDataDariServer().then(() => {
                renderTabelPenyediaAdmin();
                showToast('Penyedia berhasil dihapus.');
            });
        })
        .catch(e => { if (String(e.message) !== 'Sesi berakhir') showToast('Koneksi gagal: ' + e.message, 'error'); });
}

// ============================================================================
// TAB 4: MASTER PROGRAM / KEGIATAN / SUB KEGIATAN (DB_CONTROL J:L)
// ============================================================================
let editReferensiLama = null;

function daftarReferensiFlat() {
    const out = [];
    const ref = referensiData || {};
    Object.keys(ref).sort((a, b) => a.localeCompare(b, 'id')).forEach(prog => {
        const kegObj = ref[prog] || {};
        Object.keys(kegObj).sort((a, b) => a.localeCompare(b, 'id')).forEach(keg => {
            const subs = Array.isArray(kegObj[keg]) ? [...kegObj[keg]] : [];
            subs.sort((a, b) => a.localeCompare(b, 'id')).forEach(sub => {
                out.push({ program: prog, kegiatan: keg, subKegiatan: sub });
            });
        });
    });
    return out;
}

function hitungPakaiReferensiLokal(prog, keg, sub) {
    const spj = (spjData || []).filter(x =>
        String(x.program || '').trim() === prog &&
        String(x.kegiatan || '').trim() === keg &&
        String(x.subKegiatan || '').trim() === sub
    ).length;
    const bap = (window.DATABASE_KONTRAK || []).filter(k =>
        (!k.program || String(k.program).trim() === prog) &&
        String(k.kegiatan || '').trim() === keg &&
        String(k.subKegiatan || '').trim() === sub
    ).length;
    return { spj, bap };
}

function isiDatalistReferensi() {
    const dlP = document.getElementById('datalistRefProgram');
    const dlK = document.getElementById('datalistRefKegiatan');
    const ref = referensiData || {};
    if (dlP) {
        dlP.innerHTML = Object.keys(ref).sort((a, b) => a.localeCompare(b, 'id'))
            .map(p => `<option value="${escapeHtml(p)}"></option>`).join('');
    }
    if (dlK) {
        const kegSet = new Set();
        Object.keys(ref).forEach(p => Object.keys(ref[p] || {}).forEach(k => kegSet.add(k)));
        dlK.innerHTML = Array.from(kegSet).sort((a, b) => a.localeCompare(b, 'id'))
            .map(k => `<option value="${escapeHtml(k)}"></option>`).join('');
    }
}

function renderTabelReferensiAdmin() {
    const tbody = document.getElementById('tabelReferensiBody');
    if (!tbody) return;
    isiDatalistReferensi();
    const semua = daftarReferensiFlat();
    const countEl = document.getElementById('countMasterReferensi');
    if (countEl) countEl.textContent = `${semua.length} Sub Kegiatan`;

    const q = (document.getElementById('cariMasterReferensi') ? document.getElementById('cariMasterReferensi').value : '').trim().toLowerCase();
    const tampil = semua.filter(x => !q || `${x.program} ${x.kegiatan} ${x.subKegiatan}`.toLowerCase().includes(q));

    if (tampil.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400 font-medium">${q ? 'Tidak ada nomenklatur yang cocok dengan pencarian.' : 'Belum ada data Program/Kegiatan/Sub Kegiatan.'}</td></tr>`;
        return;
    }

    window._cacheRefAdmin = tampil;
    tbody.innerHTML = tampil.map((x, idx) => {
        const pakai = hitungPakaiReferensiLokal(x.program, x.kegiatan, x.subKegiatan);
        const terpakai = (pakai.spj > 0 || pakai.bap > 0);
        const badgePakai = terpakai
            ? `<span class="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[9px] font-bold">${pakai.spj} SPJ &middot; ${pakai.bap} BAP</span>`
            : `<span class="text-[10px] text-slate-400">Belum</span>`;
        return `<tr class="hover:bg-emerald-50/30 transition-colors">
            <td class="p-2.5 align-top font-bold text-slate-800 max-w-[200px] whitespace-normal break-words">${escapeHtml(x.program)}</td>
            <td class="p-2.5 align-top text-slate-600 max-w-[220px] whitespace-normal break-words">${escapeHtml(x.kegiatan)}</td>
            <td class="p-2.5 align-top text-slate-700 font-medium max-w-[240px] whitespace-normal break-words">${escapeHtml(x.subKegiatan)}</td>
            <td class="p-2.5 text-center align-top whitespace-nowrap">${badgePakai}</td>
            <td class="p-2.5 text-center align-top whitespace-nowrap">
                <button type="button" onclick="editDataReferensi(${idx})" title="Edit nomenklatur" class="px-2 py-1 bg-amber-50 text-amber-600 border border-amber-200 rounded text-[10px] font-bold hover:bg-amber-100"><i class="fa-solid fa-pen"></i></button>
                <button type="button" onclick="hapusDataReferensi(${idx})" title="${terpakai ? 'Tidak bisa dihapus karena masih dipakai transaksi' : 'Hapus'}" class="px-2 py-1 ${terpakai ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'} border rounded text-[10px] font-bold ml-1"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
}

function editDataReferensi(idx) {
    const x = (window._cacheRefAdmin || [])[idx];
    if (!x) return;
    editReferensiLama = { program: x.program, kegiatan: x.kegiatan, subKegiatan: x.subKegiatan };
    const jdl = document.getElementById('titleFormReferensi');
    if (jdl) jdl.innerHTML = '<i class="fa-solid fa-pen text-amber-600 me-1"></i> Edit Nomenklatur Program / Kegiatan / Sub Kegiatan';
    document.getElementById('refProgram').value = x.program;
    document.getElementById('refKegiatan').value = x.kegiatan;
    document.getElementById('refSubKegiatan').value = x.subKegiatan;
    const wrap = document.getElementById('wrapRefSinkron');
    if (wrap) wrap.classList.remove('hidden');
    const chk = document.getElementById('chkRefSinkron');
    if (chk) chk.checked = true;
    const tabScroll = document.querySelector('#tab-content-referensi .overflow-y-auto');
    if (tabScroll) tabScroll.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetFormReferensi() {
    editReferensiLama = null;
    const jdl = document.getElementById('titleFormReferensi');
    if (jdl) jdl.innerHTML = '<i class="fa-solid fa-plus-circle text-emerald-600 me-1"></i> Tambah / Edit Program, Kegiatan &amp; Sub Kegiatan';
    ['refProgram', 'refKegiatan', 'refSubKegiatan'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const wrap = document.getElementById('wrapRefSinkron');
    if (wrap) wrap.classList.add('hidden');
}

async function simpanDataReferensi() {
    if (sesiAktif.role !== 'SUPER_ADMIN') { showToast('Hanya SUPER_ADMIN yang dapat mengubah Master Program.', 'warning'); return; }
    const program = (document.getElementById('refProgram').value || '').trim();
    const kegiatan = (document.getElementById('refKegiatan').value || '').trim();
    const subKegiatan = (document.getElementById('refSubKegiatan').value || '').trim();
    if (!program || !kegiatan || !subKegiatan) {
        showToast('Program, Kegiatan, dan Sub Kegiatan wajib diisi semua!', 'warning');
        return;
    }
    const sinkronTransaksi = editReferensiLama ? !!(document.getElementById('chkRefSinkron') && document.getElementById('chkRefSinkron').checked) : false;

    if (editReferensiLama && sinkronTransaksi) {
        const pakai = hitungPakaiReferensiLokal(editReferensiLama.program, editReferensiLama.kegiatan, editReferensiLama.subKegiatan);
        if (pakai.spj > 0 || pakai.bap > 0) {
            const ok = await tanyaKonfirmasi({
                judul: 'Simpan & Selaraskan Nomenklatur?',
                pesan: `Perubahan ini akan ikut memperbarui ${pakai.spj} SPJ dan ${pakai.bap} BAP pada TA ${CONFIG.TAHUN_ANGGARAN}.`,
                detailList: [
                    ['Program', program],
                    ['Kegiatan', kegiatan],
                    ['Sub Kegiatan', subKegiatan]
                ],
                labelYa: 'Ya, Simpan',
                tipe: 'warning'
            });
            if (!ok) return;
        }
    }

    const btn = document.getElementById('btnSimpanReferensi');
    const asli = btn ? btn.innerHTML : 'Simpan';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }

    apiPost({
        action: 'referensi_simpan',
        program, kegiatan, subKegiatan,
        lama: editReferensiLama,
        sinkronTransaksi
    })
        .then(res => {
            if (res.status !== 'success') { showToast('Gagal menyimpan: ' + res.message, 'error'); return; }
            const infoS = (res.diubahSpj || res.diubahBap) ? ` (${res.diubahSpj || 0} SPJ & ${res.diubahBap || 0} BAP diselaraskan)` : '';
            resetFormReferensi();
            return tarikDataDariServer().then(() => {
                renderTabelReferensiAdmin();
                showToast('Master Program & Sub Kegiatan tersimpan' + infoS + '.', 'success');
            });
        })
        .catch(e => { if (String(e.message) !== 'Sesi berakhir') showToast('Koneksi gagal: ' + e.message, 'error'); })
        .finally(() => { if (btn) { btn.disabled = false; btn.innerHTML = asli; } });
}

async function hapusDataReferensi(idx) {
    if (sesiAktif.role !== 'SUPER_ADMIN') return;
    const x = (window._cacheRefAdmin || [])[idx];
    if (!x) return;
    const pakai = hitungPakaiReferensiLokal(x.program, x.kegiatan, x.subKegiatan);
    if (pakai.spj > 0 || pakai.bap > 0) {
        showToast(`Sub Kegiatan ini masih dipakai pada ${pakai.spj} SPJ dan ${pakai.bap} BAP sehingga tidak dapat dihapus.`, 'warning');
        return;
    }
    const ok = await tanyaKonfirmasi({
        judul: 'Hapus Sub Kegiatan dari Master?',
        pesan: 'Nomenklatur ini akan dihapus dari daftar pilihan Program/Kegiatan/Sub Kegiatan.',
        detailList: [
            ['Program', x.program],
            ['Kegiatan', x.kegiatan],
            ['Sub Kegiatan', x.subKegiatan]
        ],
        labelYa: 'Ya, Hapus',
        tipe: 'danger'
    });
    if (!ok) return;
    apiPost({ action: 'referensi_hapus', program: x.program, kegiatan: x.kegiatan, subKegiatan: x.subKegiatan })
        .then(res => {
            if (res.status !== 'success') { showToast('Gagal menghapus: ' + res.message, 'error'); return; }
            resetFormReferensi();
            return tarikDataDariServer().then(() => {
                renderTabelReferensiAdmin();
                showToast('Sub Kegiatan berhasil dihapus dari master.');
            });
        })
        .catch(e => { if (String(e.message) !== 'Sesi berakhir') showToast('Koneksi gagal: ' + e.message, 'error'); });
}

// ============================================================================
// TAB 5: LOG AKTIVITAS & AUDIT (LOG_SISTEM — MUAT ON-DEMAND)
// ============================================================================
let cacheLogSistem = [];
let totalLogServer = 0;

const LOG_RISIKO_TINGGI = ['ERROR', 'LOGIN_GAGAL', 'AKSES_DITOLAK', 'SPJ_HAPUS', 'BAP_HAPUS', 'HAPUS_BERKAS', 'PENYEDIA_HAPUS', 'REFERENSI_HAPUS', 'OTP_HANGUS', 'OTP_ERROR', 'UPLOAD_ERROR', 'ARSIP_ERROR'];
const LOG_RISIKO_SEDANG = ['PENYEDIA_EDIT', 'RESET_PASSWORD', 'RESET_PASSWORD_OTP', 'CABUT_SESI', 'AKUN_STATUS', 'LOGIN_NONAKTIF', 'OTP_SALAH', 'OTP_DITOLAK_ADMIN', 'GANTI_PASSWORD_GAGAL', 'UPLOAD_DITOLAK'];
const LOG_POSITIF = ['LOGIN', 'SPJ_BARU', 'BAP_BARU', 'PENYEDIA_BARU', 'REFERENSI_BARU', 'GANTI_PASSWORD'];

function muatLogSistemAdmin() {
    if (sesiAktif.role !== 'SUPER_ADMIN') return;
    const tbody = document.getElementById('tabelLogBody');
    const ic = document.getElementById('ikonRefreshLog');
    const btn = document.getElementById('btnMuatLog');
    const lim = Number(document.getElementById('limitLogSistem') ? document.getElementById('limitLogSistem').value : 250) || 250;
    if (ic) ic.classList.add('animate-spin');
    if (btn) btn.disabled = true;
    if (tbody) tbody.innerHTML = skeletonRowsHtml(4, 6);

    apiPost({ action: 'log_baca', limit: lim })
        .then(res => {
            if (res.status !== 'success') {
                if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-red-500 font-medium">${escapeHtml(res.message || 'Gagal memuat log.')}</td></tr>`;
                return;
            }
            cacheLogSistem = res.logs || [];
            totalLogServer = Number(res.totalBaris) || cacheLogSistem.length;
            const sel = document.getElementById('filterJenisLog');
            if (sel) {
                const prev = sel.value || 'ALL';
                sel.innerHTML = '<option value="ALL">Semua Aktivitas</option><option value="__RISIKO__">⚠ Hanya Risiko &amp; Hapus</option>' +
                    (res.jenisList || []).map(j => `<option value="${escapeHtml(j)}">${escapeHtml(j)}</option>`).join('');
                if (Array.from(sel.options).some(o => o.value === prev)) sel.value = prev;
            }
            renderTabelLogAdmin();
        })
        .catch(e => {
            if (String(e.message) !== 'Sesi berakhir') {
                if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-red-500">Koneksi terputus saat memuat log.</td></tr>`;
            }
        })
        .finally(() => {
            if (ic) ic.classList.remove('animate-spin');
            if (btn) btn.disabled = false;
        });
}

function getFilteredLogAdmin() {
    const q = (document.getElementById('cariLogSistem') ? document.getElementById('cariLogSistem').value : '').trim().toLowerCase();
    const fJenis = document.getElementById('filterJenisLog') ? document.getElementById('filterJenisLog').value : 'ALL';
    return (cacheLogSistem || []).filter(item => {
        if (fJenis === '__RISIKO__') {
            if (!LOG_RISIKO_TINGGI.includes(item.jenis) && !LOG_RISIKO_SEDANG.includes(item.jenis)) return false;
        } else if (fJenis !== 'ALL' && item.jenis !== fJenis) {
            return false;
        }
        if (q && !`${item.waktu} ${item.jenis} ${item.pelaku} ${item.detail}`.toLowerCase().includes(q)) return false;
        return true;
    });
}

function badgeJenisLogHtml(jenis) {
    let cls = 'bg-slate-100 text-slate-700 border-slate-200';
    if (LOG_RISIKO_TINGGI.includes(jenis)) cls = 'bg-red-50 text-red-700 border-red-200';
    else if (LOG_RISIKO_SEDANG.includes(jenis)) cls = 'bg-amber-50 text-amber-800 border-amber-200';
    else if (LOG_POSITIF.includes(jenis)) cls = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    else if (jenis.indexOf('BAP') === 0 || jenis === 'REKAP_LS') cls = 'bg-purple-50 text-purple-700 border-purple-200';
    else if (jenis.indexOf('UPLOAD') === 0 || jenis === 'STATUS') cls = 'bg-blue-50 text-blue-700 border-blue-200';
    return `<span class="px-2 py-0.5 border rounded font-mono font-bold text-[9px] whitespace-nowrap ${cls}">${escapeHtml(jenis || '-')}</span>`;
}

function renderTabelLogAdmin() {
    const tbody = document.getElementById('tabelLogBody');
    if (!tbody) return;
    const rows = getFilteredLogAdmin();
    const info = document.getElementById('infoLogSistem');
    if (info) info.textContent = `Menampilkan ${rows.length} dari ${cacheLogSistem.length} log terbaru (total arsip LOG_SISTEM: ${totalLogServer} baris).`;

    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-slate-400 font-medium">Tidak ada catatan log yang cocok.</td></tr>';
        return;
    }
    tbody.innerHTML = rows.map(r => `<tr class="hover:bg-slate-50 transition-colors">
        <td class="p-2 align-top font-mono text-[10px] text-slate-500 whitespace-nowrap">${escapeHtml(r.waktu || '-')}</td>
        <td class="p-2 align-top whitespace-nowrap">${badgeJenisLogHtml(r.jenis)}</td>
        <td class="p-2 align-top text-[11px] font-semibold text-slate-700 max-w-[200px] whitespace-normal break-words">${escapeHtml(r.pelaku || '-')}</td>
        <td class="p-2 align-top text-[11px] text-slate-600 whitespace-normal break-words">${escapeHtml(r.detail || '-')}</td>
    </tr>`).join('');
}

function exportLogSistemExcel() {
    const rows = getFilteredLogAdmin();
    if (!rows.length) { showToast('Tidak ada data log untuk diekspor.', 'warning'); return; }
    const ta = String(CONFIG.TAHUN_ANGGARAN || '2026');
    const head = ['No', 'Waktu', 'Jenis Aktivitas', 'Pelaku', 'Detail'];
    const data = rows.map((r, i) => [i + 1, r.waktu, r.jenis, r.pelaku, r.detail]);
    const namaFile = `LOG_AKTIVITAS_ERP_${ta}`;
    if (typeof XLSX !== 'undefined') {
        const ws = XLSX.utils.aoa_to_sheet([head, ...data]);
        ws['!cols'] = [{ wch: 6 }, { wch: 18 }, { wch: 22 }, { wch: 30 }, { wch: 70 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'LOG_SISTEM');
        XLSX.writeFile(wb, namaFile + '.xlsx');
        showToast('File Excel ' + namaFile + '.xlsx berhasil diunduh.');
    } else {
        const csv = [head, ...data].map(r => r.map(v => '"' + String(v || '').replace(/"/g, '""') + '"').join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = namaFile + '.csv';
        document.body.appendChild(a); a.click(); a.remove();
        showToast('File CSV ' + namaFile + '.csv berhasil diunduh.');
    }
}
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ================== TOAST MULTI-WARNA & MODAL KONFIRMASI KUSTOM ==================
let _toastTimer = null;
function sembunyiToast() {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.classList.add('-translate-y-24', 'opacity-0', 'pointer-events-none');
    if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; }
}
function showToast(msg, tipe = 'success', durasiMs = 4000) {
    const toast = document.getElementById('toast');
    const txt = document.getElementById('toastMessage');
    const ic = document.getElementById('toastIcon');
    if (!toast || !txt) return;
    const gaya = {
        success: { bg: 'bg-sipd-navy', ic: 'fa-solid fa-circle-check text-emerald-400' },
        error:   { bg: 'bg-red-700',   ic: 'fa-solid fa-circle-xmark text-red-200' },
        warning: { bg: 'bg-amber-600', ic: 'fa-solid fa-triangle-exclamation text-amber-100' },
        info:    { bg: 'bg-sky-700',   ic: 'fa-solid fa-circle-info text-sky-200' }
    }[tipe] || { bg: 'bg-sipd-navy', ic: 'fa-solid fa-circle-check text-emerald-400' };

    toast.className = `fixed top-5 right-5 max-w-md ${gaya.bg} text-white px-4 py-3 rounded-lg shadow-xl transform transition-all duration-300 z-[9999] flex items-start gap-2.5 border border-white/15`;
    if (ic) ic.className = `${gaya.ic} text-sm mt-0.5 shrink-0`;
    txt.textContent = String(msg || '');
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(sembunyiToast, tipe === 'error' ? Math.max(durasiMs, 5200) : durasiMs);
}

let _konfResolver = null;
function tutupModalKonfirmasi(hasil) {
    const el = document.getElementById('modalKonfirmasi');
    if (el) el.classList.add('hidden');
    if (_konfResolver) { const r = _konfResolver; _konfResolver = null; r(!!hasil); }
}
document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && _konfResolver) tutupModalKonfirmasi(false);
});

function tanyaKonfirmasi(opts) {
    opts = opts || {};
    const modal = document.getElementById('modalKonfirmasi');
    if (!modal) return Promise.resolve(false);
    const tipe = opts.tipe || 'warning';
    const tema = {
        danger:  { wrap: 'bg-red-100 text-red-600',       ik: 'fa-solid fa-trash-can',            btn: 'bg-red-600 hover:bg-red-700 text-white',       cat: 'bg-red-50 border-red-200 text-red-800' },
        warning: { wrap: 'bg-amber-100 text-amber-600',   ik: 'fa-solid fa-triangle-exclamation', btn: 'bg-amber-600 hover:bg-amber-700 text-white',   cat: 'bg-amber-50 border-amber-200 text-amber-900' },
        primary: { wrap: 'bg-emerald-100 text-emerald-700', ik: 'fa-solid fa-circle-check',       btn: 'bg-sipd-emerald hover:bg-emerald-700 text-white', cat: 'bg-slate-50 border-slate-200 text-slate-700' },
        info:    { wrap: 'bg-sky-100 text-sky-700',       ik: 'fa-solid fa-circle-info',          btn: 'bg-sipd-navy hover:bg-slate-800 text-white',   cat: 'bg-sky-50 border-sky-200 text-sky-900' }
    }[tipe] || { wrap: 'bg-amber-100 text-amber-600', ik: 'fa-solid fa-triangle-exclamation', btn: 'bg-sipd-navy hover:bg-slate-800 text-white', cat: 'bg-amber-50 border-amber-200 text-amber-900' };

    document.getElementById('konfIkonWrap').className = `w-10 h-10 rounded-full ${tema.wrap} flex items-center justify-center text-lg shrink-0 mt-0.5`;
    document.getElementById('konfIkon').className = tema.ik;
    document.getElementById('konfJudul').textContent = opts.judul || 'Konfirmasi';
    document.getElementById('konfPesan').textContent = opts.pesan || '';

    const detEl = document.getElementById('konfDetail');
    if (Array.isArray(opts.detailList) && opts.detailList.length) {
        detEl.innerHTML = opts.detailList.map(([k, val]) =>
            `<div class="flex justify-between gap-3"><span class="text-slate-500 shrink-0">${escapeHtml(k)}</span><span class="font-bold text-slate-800 text-right break-words">${escapeHtml(val)}</span></div>`
        ).join('');
        detEl.classList.remove('hidden');
    } else {
        detEl.innerHTML = '';
        detEl.classList.add('hidden');
    }

    const catEl = document.getElementById('konfCatatan');
    if (opts.catatan) {
        catEl.className = `mt-2.5 text-[11px] rounded-lg p-2.5 border leading-relaxed ${tema.cat}`;
        catEl.textContent = opts.catatan;
    } else {
        catEl.textContent = '';
        catEl.className = 'hidden';
    }

    const btnBatal = document.getElementById('btnKonfBatal');
    const btnYa = document.getElementById('btnKonfYa');
    btnBatal.classList.toggle('hidden', !!opts.hanyaInfo);
    btnBatal.textContent = opts.labelBatal || 'Batal';
    btnYa.className = `px-4 py-2 ${tema.btn} font-bold rounded-lg shadow-sm text-xs transition-colors`;
    btnYa.textContent = opts.labelYa || (opts.hanyaInfo ? 'Mengerti' : 'Ya, Lanjutkan');

    modal.classList.remove('hidden');
    setTimeout(() => btnYa.focus(), 50);
    return new Promise((resolve) => { _konfResolver = resolve; });
}

function tampilPeringatan(judul, pesan, tipe = 'warning') {
    return tanyaKonfirmasi({ judul, pesan, tipe, hanyaInfo: true, labelYa: 'Mengerti' });
}

function keluarSistem() {
    const t = sessionStorage.getItem('sesi_token');
    if (t) { try { fetch(CONFIG.APPS_SCRIPT_URL, { method: 'POST', keepalive: true, body: JSON.stringify({ action: 'logout', token: t }) }).catch(() => {}); } catch (e) {} }
    sessionStorage.clear(); sesiAktif = { role: "", username: "", namaLengkap: "", nip: "", unitKerja: "", email: "", wa: "" };
    window.location.reload();
}

// ================== AKUN SAYA (PROFIL MANDIRI & GANTI PASSWORD) ==================
function bukaModalAkunSaya(tab) {
    const dd = document.getElementById('profileDropdown'); if (dd) dd.classList.add('hidden');
    document.getElementById('akunSayaSub').textContent = sesiAktif.namaLengkap + ' (' + sesiAktif.role + ')';
    document.getElementById('profilNamaTxt').textContent = sesiAktif.namaLengkap || '-';
    document.getElementById('profilRoleTxt').textContent = sesiAktif.role || '-';
    document.getElementById('profilUserTxt').textContent = sesiAktif.username || '-';
    document.getElementById('profilNipTxt').textContent = sesiAktif.nip || '-';
    setSelectValue(document.getElementById('profilUnitKerja'), sesiAktif.unitKerja || '');
    document.getElementById('profilEmail').value = sesiAktif.email || '';
    document.getElementById('profilWa').value = sesiAktif.wa || '';

    document.getElementById('pwLamaInput').value = '';
    document.getElementById('pwBaruInput').value = '';
    document.getElementById('pwKonfirmInput').value = '';
    const chk = document.getElementById('chkLihatPwMandiri'); if (chk) { chk.checked = false; toggleLihatPwMandiri(); }
    const msg = document.getElementById('pwMandiriPesan'); if (msg) { msg.classList.add('hidden'); msg.textContent = ''; }

    switchTabAkunSaya(tab || 'profil');
    openModal('modalAkunSaya');
}

function switchTabAkunSaya(tab) {
    const isProfil = tab !== 'password';
    document.getElementById('tabAkunSayaProfil').classList.toggle('hidden', !isProfil);
    document.getElementById('tabAkunSayaPassword').classList.toggle('hidden', isProfil);
    const b1 = document.getElementById('btnTabSayaProfil'), b2 = document.getElementById('btnTabSayaPassword');
    if (b1 && b2) {
        b1.className = 'px-3 py-2 text-xs transition-colors border-b-2 ' + (isProfil ? 'font-bold border-sipd-emerald text-sipd-emerald' : 'font-medium border-transparent text-slate-500 hover:text-slate-700');
        b2.className = 'px-3 py-2 text-xs transition-colors border-b-2 ' + (!isProfil ? 'font-bold border-sky-600 text-sky-600' : 'font-medium border-transparent text-slate-500 hover:text-slate-700');
    }
    if (!isProfil) setTimeout(() => { const el = document.getElementById('pwLamaInput'); if (el) el.focus(); }, 80);
}

function toggleLihatPwMandiri() {
    const show = !!(document.getElementById('chkLihatPwMandiri') && document.getElementById('chkLihatPwMandiri').checked);
    ['pwLamaInput', 'pwBaruInput', 'pwKonfirmInput'].forEach(id => {
        const el = document.getElementById(id); if (el) el.type = show ? 'text' : 'password';
    });
}

function simpanProfilMandiri(ev) {
    ev.preventDefault();
    const unitKerja = document.getElementById('profilUnitKerja').value;
    const email = document.getElementById('profilEmail').value.trim();
    const wa = document.getElementById('profilWa').value.trim();
    const btn = document.getElementById('btnSimpanProfilSaya');
    const teksAsli = btn.textContent;
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Menyimpan...';
    apiPost({ action: 'akun_update_profil', unitKerja, email, wa })
        .then(res => {
            if (res.status !== 'success') { showToast('Gagal menyimpan profil: ' + res.message, 'error'); return; }
            if (res.user) setSesiUser(res.user);
            tarikDataDariServer();
            closeModal('modalAkunSaya');
            showToast('Profil & kontak tersimpan.');
        })
        .catch(e => { if (String(e.message) !== 'Sesi berakhir') showToast('Koneksi gagal: ' + e.message, 'error'); })
        .finally(() => { btn.disabled = false; btn.textContent = teksAsli; });
}

function simpanPasswordMandiri(ev) {
    ev.preventDefault();
    const passwordLama = document.getElementById('pwLamaInput').value;
    const passwordBaru = document.getElementById('pwBaruInput').value;
    const konfirm = document.getElementById('pwKonfirmInput').value;
    const msg = document.getElementById('pwMandiriPesan');
    const tampilPesan = (teks, err) => {
        msg.className = 'text-xs font-medium p-2 rounded border ' + (err ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700');
        msg.textContent = teks;
    };
    if (passwordBaru.length < 8) { tampilPesan('Password baru minimal 8 karakter.', true); return; }
    if (passwordBaru !== konfirm) { tampilPesan('Konfirmasi password baru tidak cocok.', true); return; }
    if (passwordBaru === passwordLama) { tampilPesan('Password baru tidak boleh sama dengan password saat ini.', true); return; }

    const btn = document.getElementById('btnSimpanPwMandiri');
    const teksAsli = btn.textContent;
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Memproses...';
    msg.classList.add('hidden');
    apiPost({ action: 'akun_ganti_password', passwordLama, passwordBaru })
        .then(res => {
            if (res.status !== 'success') { tampilPesan(res.message || 'Gagal mengganti password.', true); return; }
            if (res.token) sessionStorage.setItem('sesi_token', res.token);
            closeModal('modalAkunSaya');
            showToast('Password berhasil diganti. Sesi di perangkat lain dicabut.');
        })
        .catch(e => { if (String(e.message) !== 'Sesi berakhir') tampilPesan('Koneksi gagal: ' + e.message, true); })
        .finally(() => { btn.disabled = false; btn.textContent = teksAsli; });
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
        .catch(e => { if (String(e.message) !== 'Sesi berakhir') showToast('Koneksi gagal: ' + e.message, 'error'); })
        .finally(() => { btn.disabled = false; btn.innerHTML = asli; });
}

// ================== LUPA PASSWORD VIA OTP EMAIL ==================
let lupaUsernameTarget = '';

function bukaModalLupaPassword() {
    const uLogin = document.getElementById('username-input');
    const uLupa = document.getElementById('lupaUsernameInput');
    lupaUsernameTarget = (uLogin ? uLogin.value.trim().toLowerCase() : '');
    if (uLupa) uLupa.value = lupaUsernameTarget;
    ['lupaOtpInput', 'lupaPwBaruInput', 'lupaPwKonfirmInput'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    const chk = document.getElementById('chkLihatPwLupa');
    if (chk) { chk.checked = false; toggleLihatPwLupa(); }
    sembunyiPesanLupa();
    setStepLupaPassword('minta');
    openModal('modalLupaPassword');
    setTimeout(() => { if (uLupa) uLupa.focus(); }, 80);
}

function tutupModalLupaPassword() {
    closeModal('modalLupaPassword');
}

function setStepLupaPassword(step) {
    const isMinta = step !== 'verif';
    document.getElementById('stepLupaMinta').classList.toggle('hidden', !isMinta);
    document.getElementById('stepLupaVerif').classList.toggle('hidden', isMinta);
    if (!isMinta) {
        const b = document.getElementById('lupaUserBadge');
        if (b) b.textContent = lupaUsernameTarget || '-';
        setTimeout(() => { const el = document.getElementById('lupaOtpInput'); if (el) el.focus(); }, 80);
    }
}

function sembunyiPesanLupa() {
    const box = document.getElementById('lupaPesanBox');
    if (box) { box.classList.add('hidden'); box.textContent = ''; }
}

function tampilPesanLupa(teks, tipe) {
    const box = document.getElementById('lupaPesanBox');
    if (!box) return;
    const gaya = tipe === 'ok'
        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
        : (tipe === 'info' ? 'bg-sky-50 border-sky-200 text-sky-800' : 'bg-red-50 border-red-200 text-red-700');
    box.className = 'mb-3 text-xs font-medium p-2.5 rounded border leading-relaxed ' + gaya;
    box.textContent = teks;
}

function toggleLihatPwLupa() {
    const show = !!(document.getElementById('chkLihatPwLupa') && document.getElementById('chkLihatPwLupa').checked);
    ['lupaPwBaruInput', 'lupaPwKonfirmInput'].forEach(id => {
        const el = document.getElementById(id); if (el) el.type = show ? 'text' : 'password';
    });
}

function lanjutMasukkanOtp() {
    const uname = (document.getElementById('lupaUsernameInput').value || '').trim().toLowerCase();
    if (!uname) { tampilPesanLupa('Isi Username / NIP terlebih dahulu.', 'err'); return; }
    lupaUsernameTarget = uname;
    sembunyiPesanLupa();
    setStepLupaPassword('verif');
}

function kirimPermintaanOtp(ev) {
    ev.preventDefault();
    const uname = (document.getElementById('lupaUsernameInput').value || '').trim().toLowerCase();
    if (!uname) { tampilPesanLupa('Masukkan Username / NIP Anda.', 'err'); return; }
    lupaUsernameTarget = uname;

    const btn = document.getElementById('btnKirimOtp');
    const teksAsli = btn.textContent;
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Mengirim...';
    sembunyiPesanLupa();

    apiPost({ action: 'lupa_password_minta', username: uname })
        .then(res => {
            if (res.status !== 'success') { tampilPesanLupa(res.message || 'Gagal meminta kode OTP.', 'err'); return; }
            tampilPesanLupa(res.message || 'Kode OTP telah dikirim ke email terdaftar.', 'info');
            setStepLupaPassword('verif');
        })
        .catch(e => { tampilPesanLupa('Gagal terhubung ke server. Periksa koneksi lalu coba lagi.', 'err'); })
        .finally(() => { btn.disabled = false; btn.textContent = teksAsli; });
}

function prosesResetPasswordOtp(ev) {
    ev.preventDefault();
    const uname = lupaUsernameTarget || (document.getElementById('lupaUsernameInput').value || '').trim().toLowerCase();
    const otp = (document.getElementById('lupaOtpInput').value || '').replace(/\s+/g, '');
    const passwordBaru = document.getElementById('lupaPwBaruInput').value;
    const konfirm = document.getElementById('lupaPwKonfirmInput').value;

    if (!/^\d{6}$/.test(otp)) { tampilPesanLupa('Kode OTP harus berupa 6 digit angka.', 'err'); return; }
    if (passwordBaru.length < 8) { tampilPesanLupa('Password baru minimal 8 karakter.', 'err'); return; }
    if (passwordBaru !== konfirm) { tampilPesanLupa('Konfirmasi password baru tidak cocok.', 'err'); return; }

    const btn = document.getElementById('btnSimpanResetOtp');
    const teksAsli = btn.textContent;
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Memproses...';
    sembunyiPesanLupa();

    apiPost({ action: 'lupa_password_reset', username: uname, otp: otp, passwordBaru: passwordBaru })
        .then(res => {
            if (res.status !== 'success') { tampilPesanLupa(res.message || 'Reset password gagal.', 'err'); return; }
            tutupModalLupaPassword();
            const uInp = document.getElementById('username-input');
            const pInp = document.getElementById('password-input');
            const pe = document.getElementById('pin-error');
            if (uInp) uInp.value = uname;
            if (pInp) { pInp.value = ''; pInp.focus(); }
            if (pe) pe.classList.add('hidden');
            showToast('Password berhasil direset! Silakan masuk dengan password baru.');
        })
        .catch(e => { tampilPesanLupa('Gagal terhubung ke server. Periksa koneksi lalu coba lagi.', 'err'); })
        .finally(() => { btn.disabled = false; btn.textContent = teksAsli; });
}


// ============================================================================
// MODUL REKAP PENCAIRAN LS (Khusus Role BENDAHARA & SUPER_ADMIN)
// Menggabungkan SPJ LS yang berstatus DISETUJUI dengan data kontrak BAP (UM & Termin)
// serta isian manual Bendahara (SPM UM, SPM Termin, dan koreksi pajak opsional).
// ============================================================================
const REKAP_LS = (function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const rp = (n) => formatRupiah(Math.round(Number(n) || 0));
    const isUm = (t) => t === 'UM' || t === 'UM JASA';
    const isJasa = (t) => t === 'UM JASA' || t === '100 JASA';

    let cacheBaris = [];
    let aktifRow = null;

    // Bangun daftar 1 baris per nomor kontrak, HANYA dari kontrak yang SPJ LS-nya sudah DISETUJUI
    function susunData() {
        const semuaSpj = spjData || [];
        const semuaKontrak = window.DATABASE_KONTRAK || [];
        const tersimpanMap = {};
        (window.DATABASE_REKAP_LS || []).forEach(r => {
            if (r && r.noKontrak) tersimpanMap[String(r.noKontrak).trim()] = r;
        });

        // Cari semua SPJ LS yang sudah disetujui (termasuk data lama berstatus SUDAH DIPINDAHBUKUKAN bila ada)
        const spjDisetujui = semuaSpj.filter(x =>
            String(x.jenisSurat || '').trim() === 'LS' &&
            (x.status === 'DISETUJUI' || x.status === 'SUDAH DIPINDAHBUKUKAN')
        );

        const grup = {};
        const urutan = [];

        spjDisetujui.forEach(s => {
            // Cocokkan dengan baris BAP di DB_KONTRAK_LS
            const k = semuaKontrak.find(b =>
                (s.kodeBap && String(b.kodeSpj) === String(s.kodeBap)) ||
                (String(b.noKontrak).trim() === String(s.npd).trim() && String(b.tahapBayar).trim() === String(s.tahap).trim())
            );
            const noK = String((k && k.noKontrak) || s.npd || '').trim();
            if (!noK) return;

            if (!grup[noK]) {
                grup[noK] = {
                    noKontrak: noK,
                    kodeBerkas: '',
                    pelaksana: (k && k.pelaksana) || s.namaCv || '-',
                    uraian: (k && k.uraian) || s.uraian || '-',
                    pptk: (k && k.pptk) || s.pptk || '-',
                    nilaiKontrak: 0,
                    nilaiUm: 0,
                    autoPpnUm: 0,
                    autoPphUm: 0,
                    nilaiTermin: 0,
                    autoPpnTermin: 0,
                    autoPphTermin: 0,
                    jenisPph: '',
                    tahapList: []
                };
                urutan.push(noK);
            }

            const g = grup[noK];
            const tahap = String((k && k.tahapBayar) || s.tahap || '').trim();
            const nilaiAktif = k ? (Number(k.nilaiKontrakAktif) || Number(k.nilaiKontrak) || 0) : (Number(s.nominal) || 0);
            if (nilaiAktif > g.nilaiKontrak) g.nilaiKontrak = Math.round(nilaiAktif);
            if (k && k.kodeBerkas && !g.kodeBerkas) g.kodeBerkas = String(k.kodeBerkas).trim();
            if (tahap && g.tahapList.indexOf(tahap) === -1) g.tahapList.push(tahap);

            const bayar = Math.round(Number(k ? k.pembayaranBapIni : s.nominal) || 0);
            const ppn = Math.round(Number(k ? k.ppn : Math.round(bayar - bayar / 1.11)) || 0);
            const pph = Math.round(Number(k ? k.nilaiPph : 0) || 0);

            if (isUm(tahap)) {
                g.nilaiUm += bayar;
                g.autoPpnUm += ppn;
                g.autoPphUm += pph;
            } else {
                g.nilaiTermin += bayar;
                g.autoPpnTermin += ppn;
                g.autoPphTermin += pph;
            }
            if (!g.jenisPph) {
                g.jenisPph = isJasa(tahap) || String((k && k.jenisPph) || '').includes('23') ? '23' : '4(2)';
            }
        });

        return urutan.map((noK, idx) => {
            const g = grup[noK];
            const saved = tersimpanMap[noK] || {};
            const kode = saved.kodeBerkas || g.kodeBerkas || '';
            const ppnUm = (saved.ppnUm !== null && saved.ppnUm !== undefined) ? Number(saved.ppnUm) : g.autoPpnUm;
            const pphUm = (saved.pphUm !== null && saved.pphUm !== undefined) ? Number(saved.pphUm) : g.autoPphUm;
            const ppnTermin = (saved.ppnTermin !== null && saved.ppnTermin !== undefined) ? Number(saved.ppnTermin) : g.autoPpnTermin;
            const pphTermin = (saved.pphTermin !== null && saved.pphTermin !== undefined) ? Number(saved.pphTermin) : g.autoPphTermin;

            const bersihUm = g.nilaiUm - ppnUm - pphUm;
            const bersihTermin = g.nilaiTermin - ppnTermin - pphTermin;
            const selisih = g.nilaiKontrak - g.nilaiUm - g.nilaiTermin;

            return {
                no: idx + 1,
                noKontrak: g.noKontrak,
                kodeBerkas: kode,
                pelaksana: g.pelaksana,
                uraian: g.uraian,
                pptk: g.pptk,
                tahapList: g.tahapList,
                nilaiKontrak: g.nilaiKontrak,
                spmUm: saved.spmUm || '',
                nilaiUm: g.nilaiUm,
                spmTermin: saved.spmTermin || '',
                nilaiTermin: g.nilaiTermin,
                selisih: selisih,
                autoPpnUm: g.autoPpnUm,
                autoPphUm: g.autoPphUm,
                ppnUm: ppnUm,
                pphUm: pphUm,
                bersihUm: bersihUm,
                autoPpnTermin: g.autoPpnTermin,
                autoPphTermin: g.autoPphTermin,
                ppnTermin: ppnTermin,
                pphTermin: pphTermin,
                bersihTermin: bersihTermin,
                jenisPph: g.jenisPph || '4(2)',
                overrideUm: (saved.ppnUm !== null && saved.ppnUm !== undefined) || (saved.pphUm !== null && saved.pphUm !== undefined),
                overrideTermin: (saved.ppnTermin !== null && saved.ppnTermin !== undefined) || (saved.pphTermin !== null && saved.pphTermin !== undefined),
                catatan: saved.catatan || '',
                diubah: saved.diubah || '',
                oleh: saved.oleh || ''
            };
        });
    }

    function render() {
        const tbody = $('tabelRekapLsBody');
        const tfoot = $('tabelRekapLsFoot');
        if (!tbody) return;
        const jTh = $('rlsJudulTahun'); if (jTh) jTh.innerText = 'TA ' + String(CONFIG.TAHUN_ANGGARAN || '2026');

        const semua = susunData();
        cacheBaris = semua;

        // Ringkasan kartu
        let totKontrak = 0, totUm = 0, totTermin = 0, totSelisih = 0;
        let totPpn = 0, totPph = 0, totBersih = 0, belumSpm = 0;
        semua.forEach(r => {
            totKontrak += r.nilaiKontrak;
            totUm += r.nilaiUm;
            totTermin += r.nilaiTermin;
            totSelisih += r.selisih;
            totPpn += r.ppnUm + r.ppnTermin;
            totPph += r.pphUm + r.pphTermin;
            totBersih += r.bersihUm + r.bersihTermin;
            const butuhSpmUm = r.nilaiUm > 0 && !r.spmUm;
            const butuhSpmTermin = r.nilaiTermin > 0 && !r.spmTermin;
            if (butuhSpmUm || butuhSpmTermin) belumSpm++;
        });
        const setT = (id, t) => { const el = $(id); if (el) el.innerText = t; };
        setT('rlsStatKontrak', String(semua.length));
        setT('rlsStatBelumSpm', `Belum input SPM: ${belumSpm}`);
        setT('rlsStatNilaiKontrak', rp(totKontrak));
        setT('rlsStatSelisih', `Sisa / Selisih: ${rp(totSelisih)}`);
        setT('rlsStatBruto', rp(totUm + totTermin));
        setT('rlsStatUmTermin', `UM ${rp(totUm)} · Termin ${rp(totTermin)}`);
        setT('rlsStatPajak', rp(totPpn + totPph));
        setT('rlsStatPpnPph', `PPN ${rp(totPpn)} · PPh ${rp(totPph)}`);
        setT('rlsStatBersih', rp(totBersih));

        const q = ($('cariRekapLs') ? $('cariRekapLs').value : '').trim().toLowerCase();
        const fSpm = $('filterSpmRekapLs') ? $('filterSpmRekapLs').value : 'ALL';

        const btnReset = $('btnResetFilterRekapLs');
        const adaFilter = !!(q || fSpm !== 'ALL');
        if (btnReset) { btnReset.classList.toggle('hidden', !adaFilter); btnReset.classList.toggle('inline-flex', adaFilter); }

        const tampilData = semua.filter(r => {
            const adaSpm = !!(r.spmUm || r.spmTermin);
            const lengkapSpm = (r.nilaiUm === 0 || !!r.spmUm) && (r.nilaiTermin === 0 || !!r.spmTermin);
            if (fSpm === 'BELUM_SPM' && lengkapSpm) return false;
            if (fSpm === 'SUDAH_SPM' && !adaSpm) return false;
            if (q) {
                const hay = `${r.kodeBerkas} ${r.noKontrak} ${r.pelaksana} ${r.uraian} ${r.spmUm} ${r.spmTermin} ${r.pptk}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });

        if (tampilData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center py-10 text-slate-400 font-medium">
                <div>${adaFilter ? 'Tidak ada kontrak yang cocok dengan pencarian/filter saat ini.' : 'Belum ada kontrak SPJ LS berstatus DISETUJUI.'}</div>
                ${adaFilter ? '<button type="button" onclick="REKAP_LS.resetFilter()" class="mt-2.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded text-xs font-bold"><i class="fa-solid fa-rotate-left me-1"></i>Reset Filter</button>' : ''}
            </td></tr>`;
            if (tfoot) tfoot.innerHTML = '';
            return;
        }

        let sKontrak = 0, sUm = 0, sTermin = 0, sSelisih = 0, sPpnUm = 0, sPphUm = 0, sBersihUm = 0, sPpnT = 0, sPphT = 0, sBersihT = 0;

        tbody.innerHTML = tampilData.map((r, i) => {
            sKontrak += r.nilaiKontrak; sUm += r.nilaiUm; sTermin += r.nilaiTermin; sSelisih += r.selisih;
            sPpnUm += r.ppnUm; sPphUm += r.pphUm; sBersihUm += r.bersihUm;
            sPpnT += r.ppnTermin; sPphT += r.pphTermin; sBersihT += r.bersihTermin;

            const kodeBadge = r.kodeBerkas
                ? `<span class="px-1.5 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 rounded font-mono font-bold text-[10px]">${escapeHtml(r.kodeBerkas)}</span>`
                : `<span class="text-[10px] text-amber-600 italic">Tanpa kode</span>`;
            const spmUmHtml = r.spmUm
                ? `<div class="font-mono text-[10px] text-slate-500 break-all mt-0.5">${escapeHtml(r.spmUm)}</div>`
                : (r.nilaiUm > 0 ? `<div class="text-[10px] text-amber-600 italic mt-0.5">SPM UM belum diisi</div>` : '');
            const spmTerminHtml = r.spmTermin
                ? `<div class="font-mono text-[10px] text-slate-500 break-all mt-0.5">${escapeHtml(r.spmTermin)}</div>`
                : (r.nilaiTermin > 0 ? `<div class="text-[10px] text-amber-600 italic mt-0.5">SPM Termin belum diisi</div>` : '');

            const pajakUmHtml = r.nilaiUm
                ? `<div class="font-mono text-[10px] text-slate-600">PPN: ${rp(r.ppnUm)}</div><div class="font-mono text-[10px] text-slate-500">PPh: ${rp(r.pphUm)}</div>`
                : `<span class="text-slate-300">-</span>`;
            const pajakTerminHtml = r.nilaiTermin
                ? `<div class="font-mono text-[10px] text-slate-600">PPN: ${rp(r.ppnTermin)}</div><div class="font-mono text-[10px] text-slate-500">PPh: ${rp(r.pphTermin)}</div>`
                : `<span class="text-slate-300">-</span>`;
            const selCls = r.selisih < 0 ? 'text-red-600 font-bold' : (r.selisih > 0 ? 'text-amber-700' : 'text-slate-400');

            return `<tr class="hover:bg-teal-50/30 transition-colors">
                <td class="py-3 px-2.5 text-center text-slate-500 font-medium align-top">${i + 1}</td>
                <td class="py-3 px-3 align-top max-w-[230px] whitespace-normal">
                    <div class="flex items-center gap-1.5 flex-wrap mb-0.5">${kodeBadge}<span class="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded font-bold text-[9px] text-slate-600">PPh ${escapeHtml(r.jenisPph)}</span></div>
                    <div class="font-bold text-slate-800 text-[11px] break-words">${escapeHtml(r.noKontrak)}</div>
                    <div class="text-[10px] text-purple-700 font-semibold">${escapeHtml(r.pelaksana)}</div>
                    <div class="text-[10px] text-slate-400 truncate max-w-[210px]" title="${escapeHtml(r.uraian)}">${escapeHtml(r.uraian)}</div>
                </td>
                <td class="py-3 px-3 text-right align-top whitespace-nowrap">
                    <div class="font-mono font-bold text-slate-800">${rp(r.nilaiKontrak)}</div>
                    <div class="text-[10px] font-mono mt-0.5 ${selCls}">Sisa: ${rp(r.selisih)}</div>
                </td>
                <td class="py-3 px-3 align-top max-w-[180px] whitespace-normal">
                    <div class="font-mono font-bold text-slate-800">${r.nilaiUm ? rp(r.nilaiUm) : '<span class="text-slate-300 font-normal">-</span>'}</div>
                    ${spmUmHtml}
                </td>
                <td class="py-3 px-3 text-right align-top whitespace-nowrap">${pajakUmHtml}</td>
                <td class="py-3 px-3 text-right font-mono font-bold text-emerald-700 bg-emerald-50/40 align-top whitespace-nowrap">${r.nilaiUm ? rp(r.bersihUm) : '<span class="text-slate-300 font-normal">-</span>'}</td>
                <td class="py-3 px-3 align-top max-w-[180px] whitespace-normal">
                    <div class="font-mono font-bold text-slate-800">${r.nilaiTermin ? rp(r.nilaiTermin) : '<span class="text-slate-300 font-normal">-</span>'}</div>
                    ${spmTerminHtml}
                </td>
                <td class="py-3 px-3 text-right align-top whitespace-nowrap">${pajakTerminHtml}</td>
                <td class="py-3 px-3 text-right font-mono font-bold text-emerald-700 bg-emerald-50/40 align-top whitespace-nowrap">${r.nilaiTermin ? rp(r.bersihTermin) : '<span class="text-slate-300 font-normal">-</span>'}</td>
                <td class="py-3 px-3 text-center align-top whitespace-nowrap sticky right-0 bg-white/95 border-l border-slate-100 z-10">
                    <button type="button" data-rls-kontrak="${escapeHtml(r.noKontrak)}" onclick="REKAP_LS.bukaModal(this.getAttribute('data-rls-kontrak'))" class="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded text-[10px] font-bold shadow-sm transition-colors"><i class="fa-solid fa-pen-to-square me-1"></i>Input / Edit</button>
                </td>
            </tr>`;
        }).join('');

        if (tfoot) {
            tfoot.innerHTML = `<tr>
                <td colspan="2" class="py-3 px-3 text-right uppercase tracking-wider text-[10px]">Total (${tampilData.length} Kontrak)</td>
                <td class="py-3 px-3 text-right font-mono whitespace-nowrap"><div>${rp(sKontrak)}</div><div class="text-[9px] text-slate-500">Sisa: ${rp(sSelisih)}</div></td>
                <td class="py-3 px-3 font-mono whitespace-nowrap">${rp(sUm)}</td>
                <td class="py-3 px-3 text-right font-mono whitespace-nowrap text-[10px]"><div>PPN: ${rp(sPpnUm)}</div><div>PPh: ${rp(sPphUm)}</div></td>
                <td class="py-3 px-3 text-right font-mono text-emerald-800 bg-emerald-100/60 whitespace-nowrap">${rp(sBersihUm)}</td>
                <td class="py-3 px-3 font-mono whitespace-nowrap">${rp(sTermin)}</td>
                <td class="py-3 px-3 text-right font-mono whitespace-nowrap text-[10px]"><div>PPN: ${rp(sPpnT)}</div><div>PPh: ${rp(sPphT)}</div></td>
                <td class="py-3 px-3 text-right font-mono text-emerald-800 bg-emerald-100/60 whitespace-nowrap">${rp(sBersihT)}</td>
                <td class="py-3 px-3"></td>
            </tr>`;
        }
    }

    function resetFilter() {
        if ($('cariRekapLs')) $('cariRekapLs').value = '';
        if ($('filterSpmRekapLs')) $('filterSpmRekapLs').value = 'ALL';
        render();
    }

    function bukaModal(noKontrak) {
        if (!bisaRekapPencairanLs()) { showToast('Hanya BENDAHARA atau SUPER_ADMIN yang dapat mengubah data ini.', 'warning'); return; }
        const r = cacheBaris.find(x => x.noKontrak === noKontrak);
        if (!r) { showToast('Data kontrak tidak ditemukan. Muat ulang data.', 'error'); return; }
        aktifRow = r;
        $('rlsNoKontrak').value = r.noKontrak;
        $('rlsModalSub').textContent = `${r.noKontrak} · Tahap disetujui: ${r.tahapList.join(', ')}`;
        $('rlsInfoCv').textContent = r.pelaksana;
        $('rlsInfoNilai').textContent = rp(r.nilaiKontrak);
        $('rlsInfoPph').textContent = 'PPh ' + r.jenisPph;
        $('rlsValUm').textContent = rp(r.nilaiUm);
        $('rlsValTermin').textContent = rp(r.nilaiTermin);

        $('rlsKodeBerkas').value = r.kodeBerkas || '';
        $('rlsSpmUm').value = r.spmUm || '';
        $('rlsSpmTermin').value = r.spmTermin || '';
        $('rlsPpnUm').value = r.nilaiUm > 0 ? String(r.ppnUm) : '';
        $('rlsPphUm').value = r.nilaiUm > 0 ? String(r.pphUm) : '';
        $('rlsPpnTermin').value = r.nilaiTermin > 0 ? String(r.ppnTermin) : '';
        $('rlsPphTermin').value = r.nilaiTermin > 0 ? String(r.pphTermin) : '';
        $('rlsCatatan').value = r.catatan || '';

        hitungModal();
        openModal('modalRekapLs');
    }

    function resetPajakOtomatis() {
        if (!aktifRow) return;
        $('rlsPpnUm').value = aktifRow.nilaiUm > 0 ? String(aktifRow.autoPpnUm) : '';
        $('rlsPphUm').value = aktifRow.nilaiUm > 0 ? String(aktifRow.autoPphUm) : '';
        $('rlsPpnTermin').value = aktifRow.nilaiTermin > 0 ? String(aktifRow.autoPpnTermin) : '';
        $('rlsPphTermin').value = aktifRow.nilaiTermin > 0 ? String(aktifRow.autoPphTermin) : '';
        hitungModal();
        showToast('Nominal pajak dikembalikan ke hitungan otomatis BAP.');
    }

    function hitungModal() {
        if (!aktifRow) return;
        const val = (id, def) => {
            const raw = ($(id) ? $(id).value : '').trim();
            return raw === '' ? def : (Number(raw) || 0);
        };
        const ppnUm = aktifRow.nilaiUm > 0 ? val('rlsPpnUm', aktifRow.autoPpnUm) : 0;
        const pphUm = aktifRow.nilaiUm > 0 ? val('rlsPphUm', aktifRow.autoPphUm) : 0;
        const ppnT = aktifRow.nilaiTermin > 0 ? val('rlsPpnTermin', aktifRow.autoPpnTermin) : 0;
        const pphT = aktifRow.nilaiTermin > 0 ? val('rlsPphTermin', aktifRow.autoPphTermin) : 0;

        $('rlsBersihUm').textContent = rp(aktifRow.nilaiUm - ppnUm - pphUm);
        $('rlsBersihTermin').textContent = rp(aktifRow.nilaiTermin - ppnT - pphT);
        $('rlsSelisihModal').textContent = rp(aktifRow.selisih);
    }

    function simpan(ev) {
        ev.preventDefault();
        if (!aktifRow || !bisaRekapPencairanLs()) return;
        const btn = $('btnSimpanRekapLs');
        const asli = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Menyimpan...';

        // Kirim "" bila sama dengan otomatis BAP (agar tetap otomatis bila BAP diperbarui), kirim angka bila dikoreksi manual
        const pajakKirim = (id, autoVal, adaNilai) => {
            if (!adaNilai) return '';
            const raw = ($(id).value || '').trim();
            if (raw === '') return '';
            const n = Math.round(Number(raw) || 0);
            return n === autoVal ? '' : n;
        };

        const payload = {
            action: 'rekap_ls_simpan',
            noKontrak: aktifRow.noKontrak,
            kodeBerkas: $('rlsKodeBerkas').value.trim(),
            spmUm: $('rlsSpmUm').value.trim(),
            ppnUm: pajakKirim('rlsPpnUm', aktifRow.autoPpnUm, aktifRow.nilaiUm > 0),
            pphUm: pajakKirim('rlsPphUm', aktifRow.autoPphUm, aktifRow.nilaiUm > 0),
            spmTermin: $('rlsSpmTermin').value.trim(),
            ppnTermin: pajakKirim('rlsPpnTermin', aktifRow.autoPpnTermin, aktifRow.nilaiTermin > 0),
            pphTermin: pajakKirim('rlsPphTermin', aktifRow.autoPphTermin, aktifRow.nilaiTermin > 0),
            catatan: $('rlsCatatan').value.trim()
        };

        apiPost(payload)
            .then(res => {
                if (res.status !== 'success') { showToast('Gagal menyimpan: ' + res.message, 'error'); return; }
                closeModal('modalRekapLs');
                showToast('Data Rekap Pencairan LS tersimpan.');
                tarikDataDariServer(true);
            })
            .catch(e => { if (String(e.message) !== 'Sesi berakhir') showToast('Koneksi gagal: ' + e.message, 'error'); })
            .finally(() => { btn.disabled = false; btn.innerHTML = asli; });
    }

    function exportExcel() {
        const data = susunData();
        if (!data.length) { showToast('Belum ada data kontrak LS yang disetujui untuk diekspor.', 'warning'); return; }
        const ta = String(CONFIG.TAHUN_ANGGARAN || '2026');
        const head = [
            'NO', 'KODE', 'NO KONTRAK', 'PENYEDIA', 'URAIAN PEKERJAAN',
            'NILAI', 'SPM UM', 'NILAI UM', 'SPM TERMIN', 'NILAI TERMIN', 'SELISIH',
            'Nilai PPN UM', 'Nilai PPh UM', 'NILAI BERSIH UM',
            'Nilai PPN Termin', 'Nilai PPh Termin', 'NILAI BERSIH TERMIN', 'PPh', 'CATATAN'
        ];
        const rows = data.map((r, i) => [
            i + 1, r.kodeBerkas || '-', r.noKontrak, r.pelaksana, r.uraian,
            r.nilaiKontrak, r.spmUm, r.nilaiUm, r.spmTermin, r.nilaiTermin, r.selisih,
            r.ppnUm, r.pphUm, r.bersihUm,
            r.ppnTermin, r.pphTermin, r.bersihTermin, r.jenisPph, r.catatan
        ]);
        const sum = (fn) => data.reduce((a, r) => a + fn(r), 0);
        rows.push([
            '', 'TOTAL', '', '', '',
            sum(r => r.nilaiKontrak), '', sum(r => r.nilaiUm), '', sum(r => r.nilaiTermin), sum(r => r.selisih),
            sum(r => r.ppnUm), sum(r => r.pphUm), sum(r => r.bersihUm),
            sum(r => r.ppnTermin), sum(r => r.pphTermin), sum(r => r.bersihTermin), '', ''
        ]);

        const namaSheet = 'PENCAIRAN ' + ta.slice(-2);
        const namaFile = `REKAP_PENCAIRAN_LS_${ta}`;
        if (typeof XLSX !== 'undefined') {
            const ws = XLSX.utils.aoa_to_sheet([head, ...rows]);
            ws['!cols'] = [
                { wch: 5 }, { wch: 16 }, { wch: 30 }, { wch: 28 }, { wch: 38 },
                { wch: 16 }, { wch: 34 }, { wch: 16 }, { wch: 34 }, { wch: 16 }, { wch: 16 },
                { wch: 15 }, { wch: 15 }, { wch: 17 },
                { wch: 15 }, { wch: 15 }, { wch: 17 }, { wch: 8 }, { wch: 24 }
            ];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, namaSheet);
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

    return { render, resetFilter, bukaModal, hitungModal, resetPajakOtomatis, simpan, exportExcel };
})();
