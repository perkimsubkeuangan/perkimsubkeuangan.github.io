let dataKontrakTersimpan = [];
let dataPenyediaTersimpan = [];
let referensiDataBap = {};
let searchQuery = "";
let roleAktif = sessionStorage.getItem('sesiAktif_role');
let namaPptkAktif = sessionStorage.getItem('sesiAktif_namaLengkap');

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btnTambahBap'); 
    if(btn) btn.classList.remove('hidden'); // Menghapus syarat if (roleAktif === 'PPTK')
    ambilDataBAP();
});

function formatRupiah(angka) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0); }
function formatTanggal(dateStr) { if(!dateStr) return '-'; if(dateStr.includes('T')) return dateStr.split('T')[0]; return dateStr; }

function ambilDataBAP() {
    const tbody = document.getElementById('tabelKontrakBody');
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400 font-medium"><i class="fa-solid fa-spinner fa-spin me-2 text-blue-500"></i> Memuat data dari server...</td></tr>`;

    fetch(CONFIG.APPS_SCRIPT_URL)
        .then(res => res.json())
        .then(data => {
            if (data.status !== 'error') {
                dataKontrakTersimpan = data.kontrakLS || [];
                dataPenyediaTersimpan = data.penyediaCV || [];
                referensiDataBap = data.referensi || {};
                renderTabelKontrak();
            }
        })
        .catch(e => console.error(e));
}

function renderTabelKontrak() {
    const tbody = document.getElementById('tabelKontrakBody'); tbody.innerHTML = '';
    searchQuery = document.getElementById('cariKontrak').value.toLowerCase();

    let filteredData = dataKontrakTersimpan.filter(item => {
        if (roleAktif === 'PPTK' && String(item.pptk).trim() !== String(namaPptkAktif).trim()) return false;
        return `${item.pelaksana} ${item.noKontrak} ${item.uraian}`.toLowerCase().includes(searchQuery);
    });

    if (filteredData.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400 font-medium">Data Kontrak belum tersedia.</td></tr>`; return; }

    filteredData.forEach((kontrak) => {
        const profilCV = dataPenyediaTersimpan.find(cv => String(cv.pelaksana).trim().toUpperCase() === String(kontrak.pelaksana).trim().toUpperCase());
        const adaDataCV = profilCV ? `<span class="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold ms-2">CV Terdaftar</span>` : `<span class="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold ms-2">Bank Kosong</span>`;

        tbody.innerHTML += `
            <tr class="hover:bg-blue-50/30 border-b border-slate-100">
                <td class="py-3 px-4 font-bold text-slate-700">${kontrak.noKontrak || '-'}<br><span class="text-[10px] text-slate-400 font-normal">Tgl: ${formatTanggal(kontrak.tglKontrak)}</span></td>
                <td class="py-3 px-4 font-bold text-purple-700">${kontrak.pelaksana || '-'}${adaDataCV}<br><span class="text-[10px] text-slate-500 font-normal block w-64 truncate" title="${kontrak.uraian}">${kontrak.uraian || '-'}</span></td>
                <td class="py-3 px-4 font-bold text-slate-800">${formatRupiah(kontrak.nilaiBayar)}</td>
                <td class="py-3 px-4 font-bold text-blue-600 text-xs">${kontrak.tahapBayar || '-'}</td>
                <td class="py-3 px-4 text-center"><button onclick="cetakBapBerdasarkanJenis('${kontrak.kodeSpj}')" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[10px] shadow-sm"><i class="fa-solid fa-print"></i> CETAK BAP</button></td>
            </tr>`;
    });
}

document.getElementById('cariKontrak').addEventListener('keyup', renderTabelKontrak);

// --- LOGIKA FORM BAP ---
function bukaFormBap() {
    document.getElementById('formBap').reset();
    isiDropdownProgramBap();
    document.getElementById('modalInputBap').classList.remove('hidden');
}

function isiDropdownProgramBap() {
    const sel = document.getElementById('bapProgram'); sel.innerHTML = '<option value="" disabled selected>-- Pilih Program --</option>';
    for (let prog in referensiDataBap) sel.innerHTML += `<option value="${prog}">${prog}</option>`;
}
function updateKegiatanBap() {
    const p = document.getElementById('bapProgram').value; const sel = document.getElementById('bapKegiatan'); document.getElementById('bapSubKegiatan').innerHTML = '';
    sel.innerHTML = '<option value="" disabled selected>-- Pilih Kegiatan --</option>';
    if(p && referensiDataBap[p]) for (let keg in referensiDataBap[p]) sel.innerHTML += `<option value="${keg}">${keg}</option>`;
}
function updateSubkegiatanBap() {
    const p = document.getElementById('bapProgram').value; const k = document.getElementById('bapKegiatan').value; const sel = document.getElementById('bapSubKegiatan');
    sel.innerHTML = '<option value="" disabled selected>-- Pilih Subkegiatan --</option>';
    if(p && k && referensiDataBap[p][k]) referensiDataBap[p][k].forEach(sub => sel.innerHTML += `<option value="${sub}">${sub}</option>`);
}

// Auto-fill CV jika sudah pernah didaftarkan
function cekCvOtomatis() {
    const inputCv = document.getElementById('bapPelaksanaCv').value.toUpperCase();
    const cvEksis = dataPenyediaTersimpan.find(cv => String(cv.pelaksana).trim().toUpperCase() === inputCv.trim());
    if(cvEksis) {
        document.getElementById('bapDirektur').value = cvEksis.direktur || "";
        document.getElementById('bapNpwp').value = cvEksis.npwp || "";
        document.getElementById('bapBank').value = cvEksis.bank || "";
        document.getElementById('bapNoRek').value = cvEksis.noRek || "";
    }
}

function simpanBapKeServer(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitBap'); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Menyimpan...'; btn.disabled = true;

    // Generate ID BAP
    const now = new Date();
    const idBapBaru = `BAP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

    const payload = {
        action: 'create_bap',
        kodeSpj: idBapBaru,
        pptk: namaPptkAktif,
        kegiatan: document.getElementById('bapKegiatan').value,
        subKegiatan: document.getElementById('bapSubKegiatan').value,
        uraian: document.getElementById('bapUraian').value,
        noKontrak: document.getElementById('bapNoKontrak').value,
        tglKontrak: document.getElementById('bapTglKontrak').value,
        nilaiKontrak: document.getElementById('bapNilaiKontrak').value,
        tahapBayar: document.getElementById('bapTahap').value,
        nilaiBayar: document.getElementById('bapNilaiBayar').value,
        noBap: document.getElementById('bapNoBap').value || "-",
        tglBap: "-", 
        pelaksanaCv: document.getElementById('bapPelaksanaCv').value,
        direktur: document.getElementById('bapDirektur').value,
        npwp: document.getElementById('bapNpwp').value,
        alamatCv: "-",
        bank: document.getElementById('bapBank').value,
        noRek: document.getElementById('bapNoRek').value
    };

    fetch(CONFIG.APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) })
        .then(res => res.json())
        .then(res => {
            if(res.status === 'success') {
                document.getElementById('modalInputBap').classList.add('hidden');
                alert("Data Kontrak & BAP Berhasil Disimpan!");
                ambilDataBAP(); 
            } else { alert("Gagal Menyimpan: " + res.message); }
        })
        .catch(err => alert("Koneksi Terputus: " + err.message))
        .finally(() => { btn.innerHTML = '<i class="fa-solid fa-save"></i> Simpan Data BAP'; btn.disabled = false; });
}

// --- FUNGSI CETAK ---
function cetakBapBerdasarkanJenis(kodeSpj) {
    const kontrak = dataKontrakTersimpan.find(k => k.kodeSpj === kodeSpj);
    if (!kontrak) return alert("Data kontrak tidak ditemukan!");
    const profilCV = dataPenyediaTersimpan.find(cv => String(cv.pelaksana).trim().toUpperCase() === String(kontrak.pelaksana).trim().toUpperCase());
    if (!profilCV) return alert("Data Bank untuk Penyedia ini belum lengkap!");

    const jenisBapTipe = document.getElementById('jenisBapSelector').value; let htmlBapKonten = "";

    if (jenisBapTipe === 'UM') {
        htmlBapKonten = `
            <div style="text-align:center; border-bottom: 3px solid black; margin-bottom: 20px; padding-bottom: 10px;">
                <h3 style="margin:0; font-size:16px;">PEMERINTAH KABUPATEN BLITAR</h3><h2 style="margin:0; font-size:20px; font-weight:bold;">DINAS PERUMAHAN RAKYAT, KAWASAN PERMUKIMAN, DAN PERTANAHAN</h2><p style="margin:0; font-size:12px;">Jl. S. Supriyadi No. 86 Pos Box. 24 Telp. (0342) 801317</p>
            </div>
            <h3 style="text-align:center; text-decoration:underline; font-size:14px; margin-bottom:5px;">BERITA ACARA PEMBAYARAN UANG MUKA</h3><p style="text-align:center; margin-top:0; font-size:12px;">Nomor : ${kontrak.noBap !== '-' ? kontrak.noBap : '.....................'}</p>
            <p style="text-align:justify; margin-top:20px; line-height:1.5;">Pada hari ini <strong>.................</strong> tanggal <strong>.................</strong> bulan <strong>.................</strong> tahun <strong>Dua Ribu Dua Puluh Enam</strong>, kami yang bertanda tangan di bawah ini :</p>
            <table style="width:100%; margin-top:10px; line-height:1.5;">
                <tr><td style="width:5%;">I.</td><td style="width:25%;">Nama</td><td style="width:2%;">:</td><td><strong>${kontrak.pptk}</strong></td></tr>
                <tr><td></td><td>Jabatan</td><td>:</td><td>Pejabat Pembuat Komitmen (PPTK)</td></tr><tr><td></td><td colspan="3">Selanjutnya disebut sebagai <strong>PIHAK KESATU</strong></td></tr>
                <tr><td colspan="4" style="height:10px;"></td></tr>
                <tr><td>II.</td><td>Nama</td><td>:</td><td><strong>${profilCV.direktur}</strong></td></tr>
                <tr><td></td><td>Jabatan</td><td>:</td><td>Direktur ${kontrak.pelaksana}</td></tr><tr><td></td><td colspan="3">Selanjutnya disebut sebagai <strong>PIHAK KEDUA</strong></td></tr>
            </table>
            <p style="text-align:justify; margin-top:15px; line-height:1.5;">Sesuai dengan Surat Perjanjian (Kontrak) Nomor: <strong>${kontrak.noKontrak}</strong> tanggal <strong>${formatTanggal(kontrak.tglKontrak)}</strong>, maka PIHAK KESATU setuju untuk melakukan pembayaran Uang Muka kepada PIHAK KEDUA dengan rincian:</p>
            <table style="width:100%; margin-top:10px; line-height:1.5;">
                <tr><td style="width:5%; vertical-align:top;">1.</td><td style="width:30%; vertical-align:top;">Nama Pekerjaan</td><td style="width:2%; vertical-align:top;">:</td><td style="vertical-align:top;">${kontrak.uraian}</td></tr>
                <tr><td>2.</td><td>Nilai Kontrak</td><td>:</td><td>${formatRupiah(kontrak.nilaiKontrak)}</td></tr>
                <tr><td>3.</td><td>Nilai Uang Muka</td><td>:</td><td><strong>${formatRupiah(kontrak.nilaiBayar)}</strong></td></tr>
                <tr><td style="vertical-align:top;">4.</td><td style="vertical-align:top;">Rekening Pembayaran</td><td style="vertical-align:top;">:</td><td style="vertical-align:top;">Bank ${profilCV.bank}<br>No Rek. ${profilCV.noRek}<br>a.n ${kontrak.pelaksana}</td></tr>
            </table>
            <table style="width:100%; margin-top:50px; text-align:center;">
                <tr><td style="width:50%;"><strong>PIHAK KEDUA</strong><br>Direktur ${kontrak.pelaksana}<br><br><br><br><br><u><strong>${profilCV.direktur}</strong></u></td><td style="width:50%;"><strong>PIHAK KESATU</strong><br>Pejabat Pembuat Komitmen<br><br><br><br><br><u><strong>${kontrak.pptk}</strong></u></td></tr>
            </table>
        `;
    } else { htmlBapKonten = `<h2 style="text-align:center; color:red;">Template belum tersedia.</h2>`; }

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    printWindow.document.write(`<html><head><title>Cetak BAP</title><style>@media print { @page { margin: 20mm; } } body { font-family: 'Times New Roman', serif; font-size: 14px; padding: 15px; }</style></head><body>${htmlBapKonten}<script>setTimeout(function(){ window.print(); }, 800);<\/script></body></html>`);
    printWindow.document.close();
}

// Tambahkan 3 fungsi ini di file bap.js
function populasiProgramBap() {
    const progSelect = document.getElementById('bapProgram');
    if(!progSelect) return;
    progSelect.innerHTML = '<option value="" disabled selected>-- Pilih Program --</option>';
    for (let prog in referensiDataBap) {
        progSelect.innerHTML += `<option value="${prog}">${prog}</option>`;
    }
}

function updateKegiatanBap() {
    const prog = document.getElementById('bapProgram').value;
    const kegSelect = document.getElementById('bapKegiatan');
    const subSelect = document.getElementById('bapSubKegiatan');
    
    kegSelect.innerHTML = '<option value="" disabled selected>-- Pilih Kegiatan --</option>';
    subSelect.innerHTML = '<option value="" disabled selected>-- Pilih Subkegiatan --</option>';
    
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
    
    subSelect.innerHTML = '<option value="" disabled selected>-- Pilih Subkegiatan --</option>';
    
    if (prog && keg && referensiDataBap[prog][keg]) {
        referensiDataBap[prog][keg].forEach(sub => {
            subSelect.innerHTML += `<option value="${sub}">${sub}</option>`;
        });
    }
}

function generateNomorBap() {
    // Menghitung jumlah data BAP di database untuk nomor urut selanjutnya
    const urutanKe = dataKontrakTersimpan.length + 1; 
    
    // Mengubah angka "1" menjadi "00001"
    const urutanFormat = String(urutanKe).padStart(5, '0');
    const tahun = new Date().getFullYear(); 
    
    // Format otomatis dinas
    const otomatisNoBap = `B/BAP-LS/${urutanFormat}/409.13.1/${tahun}`;
    
    const inputNomor = document.getElementById('bapNomor'); // Sesuaikan dengan ID form Anda
    if (inputNomor) {
        inputNomor.value = otomatisNoBap;
        inputNomor.readOnly = true; // Kunci agar tidak diketik manual
        inputNomor.classList.add('bg-slate-100', 'cursor-not-allowed', 'text-slate-500'); 
    }
}
