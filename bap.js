let dataKontrakTersimpan = [];
let dataPenyediaTersimpan = [];
let referensiDataBap = {};
let searchQuery = "";
let roleAktif = sessionStorage.getItem('sesiAktif_role');
let namaPptkAktif = sessionStorage.getItem('sesiAktif_namaLengkap');

document.addEventListener('DOMContentLoaded', () => {
    const inputCari = document.getElementById('cariKontrak');
    if (inputCari) {
        inputCari.addEventListener('keyup', renderTabelKontrak);
    }
    ambilDataBAP();
});

function formatRupiah(angka) { 
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0); 
}

function formatTanggal(dateStr) { 
    if (!dateStr || dateStr === '-') return '-'; 
    if (String(dateStr).includes('T')) return String(dateStr).split('T')[0]; 
    return dateStr; 
}

// Ambil tanggal lokal hari ini (YYYY-MM-DD) tanpa selisih zona waktu UTC
function getTanggalHariIniLocal() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// Konversi tanggal YYYY-MM-DD menjadi detail Hari, Tanggal, Bulan, Tahun Indonesia untuk cetakan BAP
function parseTanggalIndo(dateStr) {
    const cleanDate = formatTanggal(dateStr);
    if (!cleanDate || cleanDate === '-') {
        return { hari: '...........', tanggal: '...........', bulan: '...........', tahun: new Date().getFullYear() };
    }
    const parts = cleanDate.split('-');
    if (parts.length !== 3) {
        return { hari: '...........', tanggal: cleanDate, bulan: '', tahun: '' };
    }
    const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return {
        hari: namaHari[dt.getDay()],
        tanggal: String(dt.getDate()),
        bulan: namaBulan[dt.getMonth()],
        tahun: String(dt.getFullYear())
    };
}

// Generate Nomor BAP otomatis berurutan (Contoh: B/BAP-LS/00001/409.13.1/2026)
function generateNomorBapOtomatis() {
    const tahun = new Date().getFullYear();
    let maxUrut = 0;

    dataKontrakTersimpan.forEach(item => {
        const no = String(item.noBap || '').trim();
        const match = no.match(/B\/BAP-LS\/(\d+)\//i) || no.match(/(\d{5})/);
        if (match) {
            const angka = parseInt(match[1], 10);
            if (!isNaN(angka) && angka > maxUrut) {
                maxUrut = angka;
            }
        }
    });

    const urutBerikutnya = String(maxUrut + 1).padStart(5, '0');
    return `B/BAP-LS/${urutBerikutnya}/409.13.1/${tahun}`;
}

function ambilDataBAP() {
    const tbody = document.getElementById('tabelKontrakBody');
    const btnTambah = document.getElementById('btnTambahBap');
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-400 font-medium"><i class="fa-solid fa-spinner fa-spin me-2 text-blue-500"></i> Memuat data dari server...</td></tr>`;

    fetch(CONFIG.APPS_SCRIPT_URL)
        .then(res => res.json())
        .then(data => {
            if (data.status !== 'error') {
                dataKontrakTersimpan = data.kontrakLS || [];
                dataPenyediaTersimpan = data.penyediaCV || [];
                referensiDataBap = data.referensi || {};

                isiDropdownProgramBap();
                renderTabelKontrak();

                if (btnTambah) {
                    btnTambah.disabled = false;
                    btnTambah.classList.remove('bg-slate-400', 'cursor-not-allowed', 'hidden');
                    btnTambah.classList.add('bg-emerald-600', 'hover:bg-emerald-700', 'cursor-pointer');
                    btnTambah.innerHTML = `<i class="fa-solid fa-plus"></i> Input Data BAP`;
                }
            } else {
                alert("Gagal memuat data server: " + data.message);
            }
        })
        .catch(e => {
            console.error(e);
            if (btnTambah) {
                btnTambah.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Gagal Koneksi`;
            }
        });
}

function renderTabelKontrak() {
    const tbody = document.getElementById('tabelKontrakBody'); 
    tbody.innerHTML = '';
    const inputCari = document.getElementById('cariKontrak');
    searchQuery = inputCari ? inputCari.value.toLowerCase() : "";

    let filteredData = dataKontrakTersimpan.filter(item => {
        if (roleAktif === 'PPTK' && String(item.pptk).trim() !== String(namaPptkAktif).trim()) return false;
        return `${item.noBap} ${item.pelaksana} ${item.noKontrak} ${item.uraian}`.toLowerCase().includes(searchQuery);
    });

    if (filteredData.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-400 font-medium">Data Kontrak belum tersedia.</td></tr>`; 
        return; 
    }

    filteredData.forEach((kontrak) => {
        const profilCV = dataPenyediaTersimpan.find(cv => String(cv.pelaksana).trim().toUpperCase() === String(kontrak.pelaksana).trim().toUpperCase());
        const adaDataCV = profilCV 
            ? `<span class="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold ms-2">CV Terdaftar</span>` 
            : `<span class="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold ms-2">Bank Kosong</span>`;

        tbody.innerHTML += `
            <tr class="hover:bg-blue-50/30 border-b border-slate-100">
                <td class="py-3 px-4 font-mono font-bold text-emerald-700 text-xs">${kontrak.noBap || '-'}<br><span class="font-sans text-[10px] text-slate-400 font-normal">Tgl BAP: ${formatTanggal(kontrak.tglBap)}</span></td>
                <td class="py-3 px-4 font-bold text-slate-700">${kontrak.noKontrak || '-'}<br><span class="text-[10px] text-slate-400 font-normal">Tgl: ${formatTanggal(kontrak.tglKontrak)}</span></td>
                <td class="py-3 px-4 font-bold text-purple-700">${kontrak.pelaksana || '-'}${adaDataCV}<br><span class="text-[10px] text-slate-500 font-normal block w-64 truncate" title="${kontrak.uraian}">${kontrak.uraian || '-'}</span></td>
                <td class="py-3 px-4 font-bold text-slate-800">${formatRupiah(kontrak.nilaiBayar)}</td>
                <td class="py-3 px-4 font-bold text-blue-600 text-xs">${kontrak.tahapBayar || '-'}</td>
                <td class="py-3 px-4 text-center"><button onclick="cetakBapBerdasarkanJenis('${kontrak.kodeSpj}')" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[10px] shadow-sm"><i class="fa-solid fa-print"></i> CETAK BAP</button></td>
            </tr>`;
    });
}

// --- LOGIKA FORM BAP ---
function bukaFormBap() {
    document.getElementById('formBap').reset();
    isiDropdownProgramBap();
    
    // Isi Nomor BAP & Tanggal BAP otomatis setiap kali form dibuka
    document.getElementById('bapNoBap').value = generateNomorBapOtomatis();
    document.getElementById('bapTglBap').value = getTanggalHariIniLocal();
    
    document.getElementById('modalInputBap').classList.remove('hidden');
}

function isiDropdownProgramBap() {
    const progSelect = document.getElementById('bapProgram');
    const kegSelect = document.getElementById('bapKegiatan');
    const subSelect = document.getElementById('bapSubKegiatan');
    if (!progSelect) return;

    progSelect.innerHTML = '<option value="" disabled selected>-- Pilih Program --</option>';
    if (kegSelect) kegSelect.innerHTML = '<option value="" disabled selected>-- Pilih Program Terlebih Dahulu --</option>';
    if (subSelect) subSelect.innerHTML = '<option value="" disabled selected>-- Pilih Kegiatan Terlebih Dahulu --</option>';

    for (let prog in referensiDataBap) {
        progSelect.innerHTML += `<option value="${prog}">${prog}</option>`;
    }
}

function updateKegiatanBap() {
    const prog = document.getElementById('bapProgram').value;
    const kegSelect = document.getElementById('bapKegiatan');
    const subSelect = document.getElementById('bapSubKegiatan');
    
    kegSelect.innerHTML = '<option value="" disabled selected>-- Pilih Kegiatan --</option>';
    subSelect.innerHTML = '<option value="" disabled selected>-- Pilih Kegiatan Terlebih Dahulu --</option>';
    
    if (prog && referensiDataBap[prog]) {
        for (let keg in referensiDataBap[prog]) {
            kegSelect.innerHTML += `<option value="${keg}">${keg}</option>`;
        }
    }
}

function updateSubkegiatanBap() {
    const prog = document.getElementById('bapProgram').value;
    const keg = document.getElementById('bapKegiatan').value;
    const subSelect = document.getElementById('bapSubKegiatan');
    
    subSelect.innerHTML = '<option value="" disabled selected>-- Pilih Sub Kegiatan --</option>';
    
    if (prog && keg && referensiDataBap[prog] && referensiDataBap[prog][keg]) {
        referensiDataBap[prog][keg].forEach(sub => {
            subSelect.innerHTML += `<option value="${sub}">${sub}</option>`;
        });
    }
}

// Auto-fill CV termasuk Alamat jika sudah pernah didaftarkan di DB_PENYEDIA
function cekCvOtomatis() {
    const inputCv = document.getElementById('bapPelaksanaCv').value.toUpperCase();
    const cvEksis = dataPenyediaTersimpan.find(cv => String(cv.pelaksana).trim().toUpperCase() === inputCv.trim());
    if (cvEksis) {
        document.getElementById('bapDirektur').value = cvEksis.direktur || "";
        document.getElementById('bapNpwp').value = cvEksis.npwp || "";
        document.getElementById('bapAlamatCv').value = (cvEksis.alamat && cvEksis.alamat !== '-') ? cvEksis.alamat : (cvEksis.alamatCv || "");
        document.getElementById('bapBank').value = cvEksis.bank || "";
        document.getElementById('bapNoRek').value = cvEksis.noRek || "";
    }
}

function simpanBapKeServer(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitBap'); 
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Menyimpan...'; 
    btn.disabled = true;

    const now = new Date();
    const idBapBaru = `BAP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const alamatInput = document.getElementById('bapAlamatCv').value.trim();

    const payload = {
        action: 'create_bap',
        kodeSpj: idBapBaru,
        pptk: namaPptkAktif,
        program: document.getElementById('bapProgram').value,
        kegiatan: document.getElementById('bapKegiatan').value,
        subKegiatan: document.getElementById('bapSubKegiatan').value,
        uraian: document.getElementById('bapUraian').value,
        noKontrak: document.getElementById('bapNoKontrak').value,
        tglKontrak: document.getElementById('bapTglKontrak').value,
        nilaiKontrak: document.getElementById('bapNilaiKontrak').value,
        tahapBayar: document.getElementById('bapTahap').value,
        nilaiBayar: document.getElementById('bapNilaiBayar').value,
        noBap: document.getElementById('bapNoBap').value || generateNomorBapOtomatis(),
        tglBap: document.getElementById('bapTglBap').value || getTanggalHariIniLocal(),
        pelaksanaCv: document.getElementById('bapPelaksanaCv').value,
        direktur: document.getElementById('bapDirektur').value,
        npwp: document.getElementById('bapNpwp').value,
        alamatCv: alamatInput,
        alamat: alamatInput,
        bank: document.getElementById('bapBank').value,
        noRek: document.getElementById('bapNoRek').value
    };

    fetch(CONFIG.APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) })
        .then(res => res.json())
        .then(res => {
            if (res.status === 'success') {
                document.getElementById('modalInputBap').classList.add('hidden');
                alert("Data Kontrak & BAP Berhasil Disimpan!");
                ambilDataB
