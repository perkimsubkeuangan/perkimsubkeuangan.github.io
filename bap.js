// ========================================================
// FILE: bap.js (Logika Khusus Cetak BAP LS)
// ========================================================

let dataKontrakTersimpan = [];
let dataPenyediaTersimpan = [];
let searchQuery = "";

// Fungsi Format Uang
function formatRupiah(angka) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0);
}

// Ambil Data dari Server saat halaman dimuat
function ambilDataBAP() {
    const tbody = document.getElementById('tabelKontrakBody');
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400 font-medium"><i class="fa-solid fa-spinner fa-spin me-2 text-blue-500"></i> Memuat data dari server...</td></tr>`;

    fetch(CONFIG.APPS_SCRIPT_URL)
        .then(res => res.json())
        .then(data => {
            if (data.status !== 'error') {
                dataKontrakTersimpan = data.kontrakLS || [];
                dataPenyediaTersimpan = data.penyediaCV || [];
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

// Render Tabel Kontrak
function renderTabelKontrak() {
    const tbody = document.getElementById('tabelKontrakBody');
    tbody.innerHTML = '';
    searchQuery = document.getElementById('cariKontrak').value.toLowerCase();

    let filteredData = dataKontrakTersimpan.filter(item => {
        const textToSearch = `${item.pelaksana} ${item.noKontrak} ${item.uraian}`.toLowerCase();
        return textToSearch.includes(searchQuery);
    });

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400 font-medium">Data Kontrak belum tersedia atau tidak ditemukan.</td></tr>`;
        return;
    }

    filteredData.forEach((kontrak, index) => {
        // Cari data Direktur/NPWP berdasarkan nama Pelaksana (CV)
        const profilCV = dataPenyediaTersimpan.find(cv => String(cv.pelaksana).trim().toUpperCase() === String(kontrak.pelaksana).trim().toUpperCase());
        const adaDataCV = profilCV ? `<span class="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold ms-2"><i class="fa-solid fa-check"></i> CV Terdaftar</span>` : `<span class="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold ms-2" title="PPTK Belum input data Bank"><i class="fa-solid fa-xmark"></i> Data Bank Kosong</span>`;

        tbody.innerHTML += `
            <tr class="hover:bg-blue-50/30 transition-colors">
                <td class="py-3 px-4 font-bold text-slate-700">${kontrak.noKontrak || '-'}<br><span class="text-[10px] text-slate-400 font-normal">Tgl: ${kontrak.tglKontrak || '-'}</span></td>
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

// Trigger pencarian saat mengetik
document.getElementById('cariKontrak').addEventListener('keyup', renderTabelKontrak);

// FUNGSI UTAMA CETAK BAP
function cetakBapBerdasarkanJenis(kodeSpj) {
    const kontrak = dataKontrakTersimpan.find(k => k.kodeSpj === kodeSpj);
    if (!kontrak) return alert("Data kontrak tidak ditemukan!");

    const profilCV = dataPenyediaTersimpan.find(cv => String(cv.pelaksana).trim().toUpperCase() === String(kontrak.pelaksana).trim().toUpperCase());
    if (!profilCV) return alert("Data Bank/Direktur untuk Penyedia ini belum diinput oleh PPTK di database!");

    const jenisBapTipe = document.getElementById('jenisBapSelector').value;
    let htmlBapKonten = "";

    // ==========================================
    // TEMPLATE 1: BAP UANG MUKA (FISIK)
    // ==========================================
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
                Sesuai dengan Surat Perjanjian (Kontrak) Nomor: <strong>${kontrak.noKontrak}</strong> tanggal <strong>${kontrak.tglKontrak}</strong>, maka PIHAK KESATU setuju untuk melakukan pembayaran Uang Muka Pekerjaan sebesar persentase yang disepakati kepada PIHAK KEDUA dengan rincian sebagai berikut:
            </p>

            <table style="width:100%; margin-top:10px; line-height:1.5;">
                <tr><td style="width:5%;">1.</td><td style="width:30%;">Nama Pekerjaan</td><td style="width:2%;">:</td><td>${kontrak.uraian}</td></tr>
                <tr><td>2.</td><td>Nilai Kontrak</td><td>:</td><td>${formatRupiah(kontrak.nilaiKontrak)}</td></tr>
                <tr><td>3.</td><td>Nilai Uang Muka</td><td>:</td><td><strong>${formatRupiah(kontrak.nilaiBayar)}</strong></td></tr>
                <tr><td>4.</td><td>Rekening Pembayaran</td><td>:</td><td>Bank ${profilCV.bank} No Rek. ${profilCV.noRek} a.n ${kontrak.pelaksana}</td></tr>
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
    } 
    // ==========================================
    // TEMPLATE LAIN BISA DITAMBAHKAN DI SINI...
    // ==========================================
    else {
        htmlBapKonten = `<h2 style="text-align:center; margin-top:50px; color:red;">Template untuk Jenis BAP ini belum dibuat. Silakan tambahkan kode templatenya.</h2>`;
    }

    // Buka Jendela Cetak
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

// Jalankan Saat Halaman Terbuka
document.addEventListener('DOMContentLoaded', () => {
    ambilDataBAP();
});
