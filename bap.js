// ========================================================
// FILE: bap.js (Logika Khusus Cetak BAP LS)
// ========================================================

let dataKontrakTersimpan = [];
let dataPenyediaTersimpan = [];
let dataSpjGlobal = []; // Menyimpan daftar SPJ untuk dropdown
let searchQuery = "";
let roleAktif = sessionStorage.getItem('sesiAktif_role');
let namaPptkAktif = sessionStorage.getItem('sesiAktif_namaLengkap');

// Cek Role (Munculkan tombol input jika PPTK)
document.addEventListener('DOMContentLoaded', () => {
    if (roleAktif === 'PPTK') {
        const btnTambah = document.getElementById('btnTambahBap');
        if(btnTambah) btnTambah.classList.remove('hidden');
    }
    ambilDataBAP();
});

function formatRupiah(angka) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0);
}

// Ambil Data dari Server
function ambilDataBAP() {
    const tbody = document.getElementById('tabelKontrakBody');
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400 font-medium"><i class="fa-solid fa-spinner fa-spin me-2 text-blue-500"></i> Memuat data dari server...</td></tr>`;

    fetch(CONFIG.APPS_SCRIPT_URL)
        .then(res => res.json())
        .then(data => {
            if (data.status !== 'error') {
                dataKontrakTersimpan = data.kontrakLS || [];
                dataPenyediaTersimpan = data.penyediaCV || [];
                dataSpjGlobal = data.spj || [];
                renderTabelKontrak();
            } else {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-red-500 font-bold">Error Server: ${data.message}</td></tr>`;
            }
        })
        .catch(e => {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-red-500 font-bold">Koneksi Terputus / Gagal Memuat Data.</td></tr>`;
            console.error(e);
        });
}

// Render Tabel Daftar Kontrak
function renderTabelKontrak() {
    const tbody = document.getElementById('tabelKontrakBody');
    tbody.innerHTML = '';
    searchQuery = document.getElementById('cariKontrak').value.toLowerCase();

    let filteredData = dataKontrakTersimpan.filter(item => {
        // Jika PPTK, hanya tampilkan kontrak miliknya
        if (roleAktif === 'PPTK' && String(item.pptk).trim() !== String(namaPptkAktif).trim()) return false;
        
        const textToSearch = `${item.pelaksana} ${item.noKontrak} ${item.uraian}`.toLowerCase();
        return textToSearch.includes(searchQuery);
    });

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400 font-medium">Data Kontrak belum tersedia atau tidak ditemukan.</td></tr>`;
        return;
    }

    filteredData.forEach((kontrak) => {
        const profilCV = dataPenyediaTersimpan.find(cv => String(cv.pelaksana).trim().toUpperCase() === String(kontrak.pelaksana).trim().toUpperCase());
        const adaDataCV = profilCV ? `<span class="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold ms-2"><i class="fa-solid fa-check"></i> CV Terdaftar</span>` : `<span class="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold ms-2" title="PPTK Belum input data Bank"><i class="fa-solid fa-xmark"></i> Data Bank Kosong</span>`;

        tbody.innerHTML += `
            <tr class="hover:bg-blue-50/30 transition-colors border-b border-slate-100">
                <td class="py-3 px-4 font-bold text-slate-700">${kontrak.noKontrak || '-'}<br><span class="text-[10px] text-slate-400 font-normal">Tgl: ${formatTanggal(kontrak.tglKontrak)}</span></td>
                <td class="py-3 px-4 font-bold text-purple-700">${kontrak.pelaksana || '-'}${adaDataCV}<br><span class="text-[10px] text-slate-500 font-normal w-64 truncate block" title="${kontrak.uraian}">${kontrak.uraian || '-'}</span></td>
                <td class="py-3 px-4 font-bold text-slate-800">${formatRupiah(kontrak.nilaiBayar)}</td>
                <td class="py-3 px-4 font-bold text-blue-600 text-xs">${kontrak.tahapBayar || '-'}</td>
                <td class="py-3 px-4 text-center">
                    <button onclick="cetakBapBerdasarkanJenis('${kontrak.kodeSpj}')" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[10px] shadow-sm flex items-center gap-1.5 mx-auto transition-colors"><i class="fa-solid fa-print"></i> CETAK BAP</button>
                </td>
            </tr>
        `;
    });
}

document.getElementById('cariKontrak').addEventListener('keyup', renderTabelKontrak);

function formatTanggal(dateStr) {
    if(!dateStr) return '-';
    if(dateStr.includes('T')) return dateStr.split('T')[0];
    return dateStr;
}

// ==========================================
// LOGIKA FORM INPUT BAP (KHUSUS PPTK)
// ==========================================
function bukaFormBap() {
    document.getElementById('formBap').reset();
    isiDropdownSpj();
    document.getElementById('modalInputBap').classList.remove('hidden');
}

function isiDropdownSpj() {
    const select = document.getElementById('bapPilihSpj');
    select.innerHTML = '<option value="" disabled selected>-- Pilih Pengajuan SPJ LS --</option>';
    
    // Filter: Hanya SPJ LS milik PPTK yang sedang login, dan belum ada di tabel Kontrak
    const listSpjPptk = dataSpjGlobal.filter(spj => {
        const isLS = spj.jenisSurat === 'LS';
        const isMilikSendiri = spj.pptk === namaPptkAktif;
        const belumDiinput = !dataKontrakTersimpan.find(k => k.kodeSpj === spj.id);
        return isLS && isMilikSendiri && belumDiinput;
    });

    if (listSpjPptk.length === 0) {
        select.innerHTML = '<option value="" disabled selected>Tidak ada SPJ LS baru yang perlu diinput</option>';
        return;
    }

    listSpjPptk.forEach(spj => {
        select.innerHTML += `<option value="${spj.id}">${spj.id} - ${spj.uraian.substring(0,40)}...</option>`;
    });
}

function isiOtomatisDariSpj() {
    const idSpj = document.getElementById('bapPilihSpj').value;
    const spj = dataSpjGlobal.find(s => s.id === idSpj);
    if(!spj) return;

    document.getElementById('bapKegiatan').value = spj.kegiatan || "";
    document.getElementById('bapSubKegiatan').value = spj.subKegiatan || "";
    document.getElementById('bapUraian').value = spj.uraian || "";
    document.getElementById('bapNoKontrak').value = spj.npd || ""; // Biasanya NPD diisi No Kontrak saat pengajuan LS
    document.getElementById('bapNilaiKontrak').value = spj.nominal || "";
    document.getElementById('bapNilaiBayar').value = spj.nominal || "";
    if(spj.tahap) document.getElementById('bapTahap').value = spj.tahap;
    if(spj.namaCv) document.getElementById('bapPelaksanaCv').value = spj.namaCv;
    
    // Auto-fill Profil CV jika sudah pernah terdaftar di DB_PENYEDIA
    if(spj.namaCv) {
        const cvEksis = dataPenyediaTersimpan.find(cv => String(cv.pelaksana).trim().toUpperCase() === String(spj.namaCv).trim().toUpperCase());
        if(cvEksis) {
            document.getElementById('bapDirektur').value = cvEksis.direktur || "";
            document.getElementById('bapNpwp').value = cvEksis.npwp || "";
            document.getElementById('bapAlamat').value = cvEksis.alamat || "";
            document.getElementById('bapBank').value = cvEksis.bank || "";
            document.getElementById('bapNoRek').value = cvEksis.noRek || "";
        }
    }
}

function simpanBapKeServer(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitBap');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Menyimpan...';
    btn.disabled = true;

    const payload = {
        action: 'create_bap',
        kodeSpj: document.getElementById('bapPilihSpj').value,
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
        tglBap: "-", // Bisa dikembangkan nanti
        
        pelaksanaCv: document.getElementById('bapPelaksanaCv').value,
        direktur: document.getElementById('bapDirektur').value,
        npwp: document.getElementById('bapNpwp').value,
        alamatCv: document.getElementById('bapAlamat').value || "-",
        bank: document.getElementById('bapBank').value,
        noRek: document.getElementById('bapNoRek').value
    };

    fetch(CONFIG.APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) })
        .then(res => res.json())
        .then(res => {
            if(res.status === 'success') {
                document.getElementById('modalInputBap').classList.add('hidden');
                alert("Data Kontrak & BAP Berhasil Disimpan!");
                ambilDataBAP(); // Refresh tabel
            } else {
                alert("Gagal Menyimpan: " + res.message);
            }
        })
        .catch(err => alert("Koneksi Terputus: " + err.message))
        .finally(() => {
            btn.innerHTML = '<i class="fa-solid fa-save"></i> Simpan Data BAP';
            btn.disabled = false;
        });
}

// ==========================================
// FUNGSI UTAMA CETAK BAP (SAMA SEPERTI KEMARIN)
// ==========================================
function cetakBapBerdasarkanJenis(kodeSpj) {
    const kontrak = dataKontrakTersimpan.find(k => k.kodeSpj === kodeSpj);
    if (!kontrak) return alert("Data kontrak tidak ditemukan!");

    const profilCV = dataPenyediaTersimpan.find(cv => String(cv.pelaksana).trim().toUpperCase() === String(kontrak.pelaksana).trim().toUpperCase());
    if (!profilCV) return alert("Data Bank/Direktur untuk Penyedia ini belum terdaftar di sistem!");

    const jenisBapTipe = document.getElementById('jenisBapSelector').value;
    let htmlBapKonten = "";

    if (jenisBapTipe === 'UM') {
        htmlBapKonten = `
            <div class="header-surat" style="text-align:center; border-bottom: 3px solid black; margin-bottom: 20px; padding-bottom: 10px;">
                <h3 style="margin:0; font-size:16px;">PEMERINTAH KABUPATEN BLITAR</h3>
                <h2 style="margin:0; font-size:20px; font-weight:bold;">DINAS PERUMAHAN RAKYAT, KAWASAN PERMUKIMAN, DAN PERTANAHAN</h2>
                <p style="margin:0; font-size:12px;">Jl. S. Supriyadi No. 86 Pos Box. 24 Telp. (0342) 801317 Kode Pos 66132</p>
            </div>
            
            <h3 style="text-align:center; text-decoration:underline; font-size:14px; margin-bottom:5px;">BERITA ACARA PEMBAYARAN UANG MUKA</h3>
            <p style="text-align:center; margin-top:0; font-size:12px;">Nomor : ${kontrak.noBap || '.....................'}</p>

            <p style="text-align:justify; margin-top:20px; line-height:1.5;">
                Pada hari ini <strong>.................</strong> tanggal <strong>.................</strong> bulan <strong>.................</strong> tahun <strong>Dua Ribu Dua Puluh Enam</strong>, kami yang bertanda tangan di bawah ini :
            </p>

            <table style="width:100%; margin-top:10px; line-height:1.5;">
                <tr><td style="width:5%;">I.</td><td style="width:25%;">Nama</td><td style="width:2%;">:</td><td><strong>${kontrak.pptk || '..................'}</strong></td></tr>
                <tr><td></td><td>Jabatan</td><td>:</td><td>Pejabat Pembuat Komitmen (PPTK)</td></tr>
                <tr><td></td><td colspan="3">Selanjutnya disebut sebagai <strong>PIHAK KESATU</strong></td></tr>
                <tr><td colspan="4" style="height:10px;"></td></tr>
                <tr><td>II.</td><td>Nama</td><td>:</td><td><strong>${profilCV.direktur || '..................'}</strong></td></tr>
                <tr><td></td><td>Jabatan</td><td>:</td><td>Direktur ${kontrak.pelaksana}</td></tr>
                <tr><td></td><td colspan="3">Selanjutnya disebut sebagai <strong>PIHAK KEDUA</strong></td></tr>
            </table>

            <p style="text-align:justify; margin-top:15px; line-height:1.5;">
                Sesuai dengan Surat Perjanjian (Kontrak) Nomor: <strong>${kontrak.noKontrak}</strong> tanggal <strong>${formatTanggal(kontrak.tglKontrak)}</strong>, maka PIHAK KESATU setuju untuk melakukan pembayaran Uang Muka Pekerjaan sebesar persentase yang disepakati kepada PIHAK KEDUA dengan rincian sebagai berikut:
            </p>

            <table style="width:100%; margin-top:10px; line-height:1.5;">
                <tr><td style="width:5%; vertical-align:top;">1.</td><td style="width:30%; vertical-align:top;">Nama Pekerjaan</td><td style="width:2%; vertical-align:top;">:</td><td style="vertical-align:top;">${kontrak.uraian}</td></tr>
                <tr><td>2.</td><td>Nilai Kontrak</td><td>:</td><td>${formatRupiah(kontrak.nilaiKontrak)}</td></tr>
                <tr><td>3.</td><td>Nilai Uang Muka</td><td>:</td><td><strong>${formatRupiah(kontrak.nilaiBayar)}</strong></td></tr>
                <tr><td style="vertical-align:top;">4.</td><td style="vertical-align:top;">Rekening Pembayaran</td><td style="vertical-align:top;">:</td><td style="vertical-align:top;">Bank ${profilCV.bank}<br>No Rek. ${profilCV.noRek}<br>a.n ${kontrak.pelaksana}</td></tr>
            </table>

            <p style="text-align:justify; margin-top:15px; line-height:1.5;">
                Demikian Berita Acara ini dibuat dengan sebenarnya dalam rangkap secukupnya untuk dipergunakan sebagaimana mestinya.
            </p>

            <table style="width:100%; margin-top:40px; text-align:center;">
                <tr>
                    <td style="width:50%;">
                        <strong>PIHAK KEDUA</strong><br>
                        Direktur ${kontrak.pelaksana}
                        <br><br><br><br><br>
                        <u><strong>${profilCV.direktur}</strong></u>
                    </td>
                    <td style="width:50%;">
                        <strong>PIHAK KESATU</strong><br>
                        Pejabat Pembuat Komitmen
                        <br><br><br><br><br>
                        <u><strong>${kontrak.pptk}</strong></u>
                    </td>
                </tr>
            </table>
        `;
    } else {
        htmlBapKonten = `<h2 style="text-align:center; margin-top:50px; color:red;">Template untuk Jenis BAP ini belum dibuat. Silakan tambahkan kode templatenya.</h2>`;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    printWindow.document.write(`
        <html><head><title>Cetak BAP - ${kontrak.pelaksana}</title>
        <style>
            @media print { @page { margin: 20mm; } body { -webkit-print-color-adjust: exact; } }
            body { font-family: 'Times New Roman', Times, serif; font-size: 14px; color: #000; background: #fff; padding: 15px; }
        </style></head><body>
            ${htmlBapKonten}
            <script>setTimeout(function(){ window.print(); }, 800);<\/script>
        </body></html>
    `);
    printWindow.document.close();
}
