// ==========================================
// 1. KONEKSI DATABASE SUPABASE
// ==========================================
const SUPABASE_URL = 'https://fewdxmnrevjbqnryyddx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_EJLeDvbsQPP2Y8sOXiDtPw_LjE93Kpy';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let dataInspeksi = [];
let dataMaster = [];
let passwordAktifCloud = 'tonasa123';
let chartInstance = null;
let editId = null;

// Ambil semua data dari Supabase saat aplikasi dibuka
async function muatDataDariCloud() {
  try {
    const [resInspeksi, resMaster, resSettings] = await Promise.all([
      db.from('inspeksi').select('*').order('waktu', { ascending: false }),
      db.from('master_data').select('*').order('id', { ascending: true }),
      db.from('app_settings').select('value').eq('key', 'admin_password').maybeSingle()
    ]);

    if (resInspeksi.error) throw resInspeksi.error;
    if (resMaster.error) throw resMaster.error;

    dataInspeksi = (resInspeksi.data || []).map(row => ({
      id: row.id,
      lokasi: row.lokasi,
      peralatan: row.peralatan || '',
      titikUkur: row.titik_ukur || '',
      waktu: row.waktu,
      r: Number(row.r),
      s: Number(row.s),
      t: Number(row.t),
      foto: row.foto || ''
    }));

    dataMaster = (resMaster.data || []).map(row => ({
      id: row.id,
      lokasi: row.lokasi,
      peralatan: row.peralatan,
      titikUkur: row.titik_ukur
    }));

    if (resSettings.data && resSettings.data.value) {
      passwordAktifCloud = resSettings.data.value;
    }

    renderDashboard();
    renderPreviewMaster();
    isiDropdownLokasi();
  } catch (err) {
    console.error('Gagal memuat data Supabase:', err);
    alert('Gagal terhubung ke database Supabase. Pastikan Publishable Key sudah benar.');
  }
}

// ==========================================
// 1A. NAVIGASI HALAMAN PENUH (SIDEBAR)
// ==========================================
function pindahHalaman(halaman) {
  const sections = {
    ringkasan: document.getElementById('ringkasan'),
    kpi: document.getElementById('kpiSection'),
    grafik: document.getElementById('grafik'),
    tabel: document.getElementById('tabel-data'),
    input: document.getElementById('pageInput'),
    master: document.getElementById('pageMaster'),
    password: document.getElementById('pagePassword')
  };

  Object.values(sections).forEach(el => el.classList.add('hidden-view'));

  const breadcrumb = document.getElementById('breadcrumbCurrent');
  const searchBox = document.getElementById('topbarSearch');

  if (halaman === 'dashboard') {
    sections.ringkasan.classList.remove('hidden-view');
    sections.kpi.classList.remove('hidden-view');
    sections.grafik.classList.remove('hidden-view');
    sections.tabel.classList.remove('hidden-view');
    breadcrumb.textContent = '/ Dashboard';
    searchBox.style.visibility = 'visible';
    renderDashboard();
  } else if (halaman === 'grafik') {
    sections.grafik.classList.remove('hidden-view');
    breadcrumb.textContent = '/ Grafik Fasa';
    searchBox.style.visibility = 'hidden';
    renderGrafik();
  } else if (halaman === 'master') {
    sections.master.classList.remove('hidden-view');
    breadcrumb.textContent = '/ Data Master';
    searchBox.style.visibility = 'hidden';
    document.getElementById('importExcelMaster').value = '';
    renderPreviewMaster();
  } else if (halaman === 'inspeksi') {
    sections.tabel.classList.remove('hidden-view');
    breadcrumb.textContent = '/ Data Inspeksi';
    searchBox.style.visibility = 'visible';
    renderDashboard();
  } else if (halaman === 'input') {
    sections.input.classList.remove('hidden-view');
    breadcrumb.textContent = editId !== null ? '/ Edit Data Inspeksi' : '/ Input Data Baru';
    searchBox.style.visibility = 'hidden';
  } else if (halaman === 'password') {
    sections.password.classList.remove('hidden-view');
    breadcrumb.textContent = '/ Ubah Kata Sandi';
    searchBox.style.visibility = 'hidden';
    document.getElementById('changePasswordForm').reset();
    const passMsg = document.getElementById('passMsg');
    passMsg.className = 'auth-msg';
    passMsg.textContent = '';
  }

  document.querySelectorAll('.nav-menu .nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === halaman);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// 1B. MASTER DATA LOKASI, PERALATAN, TITIK UKUR
// ==========================================
function renderPreviewMaster() {
  const tbody = document.getElementById('masterTableBody');
  const jumlahEl = document.getElementById('jumlahMaster');
  jumlahEl.textContent = `${dataMaster.length} data`;

  if (dataMaster.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8;">Belum ada data master.</td></tr>';
    return;
  }

  tbody.innerHTML = dataMaster.map((item) => `
    <tr>
      <td>${item.lokasi}</td>
      <td>${item.peralatan}</td>
      <td>${item.titikUkur}</td>
      <td style="text-align: center;">
        <button type="button" class="action-btn" title="Hapus" onclick="hapusMaster(${item.id})">
          <i class="ri-delete-bin-line"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

async function hapusMaster(id) {
  const { error } = await db.from('master_data').delete().eq('id', id);
  if (error) {
    alert('Gagal menghapus data master: ' + error.message);
    return;
  }
  dataMaster = dataMaster.filter(item => item.id !== id);
  renderPreviewMaster();
  isiDropdownLokasi();
}

document.getElementById('manualMasterForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const lokasi = document.getElementById('manualLokasi').value.trim();
  const peralatan = document.getElementById('manualPeralatan').value.trim();
  const titikUkur = document.getElementById('manualTitikUkur').value.trim();

  if (!lokasi || !peralatan || !titikUkur) return;

  const sudahAda = dataMaster.some(
    item =>
      item.lokasi.toLowerCase() === lokasi.toLowerCase() &&
      item.peralatan.toLowerCase() === peralatan.toLowerCase() &&
      item.titikUkur.toLowerCase() === titikUkur.toLowerCase()
  );

  if (sudahAda) {
    alert('Kombinasi Lokasi, Peralatan, dan Titik Ukur tersebut sudah terdaftar.');
    return;
  }

  const { data, error } = await db
    .from('master_data')
    .insert([{ lokasi, peralatan, titik_ukur: titikUkur }])
    .select()
    .single();

  if (error) {
    alert('Gagal menyimpan data master: ' + error.message);
    return;
  }

  dataMaster.push({
    id: data.id,
    lokasi: data.lokasi,
    peralatan: data.peralatan,
    titikUkur: data.titik_ukur
  });

  renderPreviewMaster();
  isiDropdownLokasi();
  document.getElementById('manualMasterForm').reset();
});

function isiDropdownLokasi(selectedLokasi = '') {
  const inputLokasi = document.getElementById('inputLokasi');
  const listLokasi = document.getElementById('listLokasi');
  const daftarLokasi = [...new Set(dataMaster.map(item => item.lokasi))];

  listLokasi.innerHTML = daftarLokasi
    .map(lok => `<option value="${lok}"></option>`)
    .join('');

  inputLokasi.value = selectedLokasi;
  isiDropdownPeralatan();
}

function isiDropdownPeralatan(selectedPeralatan = '') {
  const lokasiDipilih = document.getElementById('inputLokasi').value.trim();
  const inputPeralatan = document.getElementById('inputPeralatan');
  const listPeralatan = document.getElementById('listPeralatan');

  const daftarPeralatan = [...new Set(
    dataMaster
      .filter(item => item.lokasi === lokasiDipilih)
      .map(item => item.peralatan)
  )];

  listPeralatan.innerHTML = daftarPeralatan
    .map(alat => `<option value="${alat}"></option>`)
    .join('');

  inputPeralatan.value = selectedPeralatan;
  isiDropdownTitikUkur();
}

function isiDropdownTitikUkur(selectedTitik = '') {
  const lokasiDipilih = document.getElementById('inputLokasi').value.trim();
  const peralatanDipilih = document.getElementById('inputPeralatan').value.trim();
  const inputTitik = document.getElementById('inputTitikUkur');
  const listTitik = document.getElementById('listTitikUkur');

  const daftarTitik = [...new Set(
    dataMaster
      .filter(item => item.lokasi === lokasiDipilih && item.peralatan === peralatanDipilih)
      .map(item => item.titikUkur)
  )];

  listTitik.innerHTML = daftarTitik
    .map(titik => `<option value="${titik}"></option>`)
    .join('');

  inputTitik.value = selectedTitik;
}

document.getElementById('inputLokasi').addEventListener('input', () => isiDropdownPeralatan());
document.getElementById('inputPeralatan').addEventListener('input', () => isiDropdownTitikUkur());

document.getElementById('importExcelMaster').addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function (evt) {
    const data = new Uint8Array(evt.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    let headerIdx = rows.findIndex(r => r.some(cell => String(cell).trim().toLowerCase() === 'lokasi'));
    if (headerIdx === -1) {
      alert('Kolom "Lokasi", "Peralatan", dan "Titik Ukur" tidak ditemukan di file Excel.');
      return;
    }

    const headerRow = rows[headerIdx].map(c => String(c).trim().toLowerCase());
    const colLok = headerRow.indexOf('lokasi');
    const colAlat = headerRow.indexOf('peralatan');
    const colTitik = headerRow.indexOf('titik ukur');

    const hasilImport = [];
    let lastLok = '';
    let lastAlat = '';

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      const lok = String(row[colLok] || '').trim();
      const alat = String(row[colAlat] || '').trim();
      const titik = String(row[colTitik] || '').trim();

      if (lok) lastLok = lok;
      if (alat) lastAlat = alat;

      if (lastLok && lastAlat && titik) {
        hasilImport.push({ lokasi: lastLok, peralatan: lastAlat, titik_ukur: titik });
      }
    }

    if (hasilImport.length > 0) {
      // Hapus data master lama lalu masukkan data baru dari Excel
      await db.from('master_data').delete().neq('id', 0);
      const { data: inserted, error } = await db.from('master_data').insert(hasilImport).select();

      if (error) {
        alert('Gagal mengimpor Excel ke database: ' + error.message);
        return;
      }

      dataMaster = inserted.map(row => ({
        id: row.id,
        lokasi: row.lokasi,
        peralatan: row.peralatan,
        titikUkur: row.titik_ukur
      }));

      isiDropdownLokasi();
      renderPreviewMaster();
      alert(`Berhasil mengimpor ${dataMaster.length} data pilihan dari Excel ke database!`);
    } else {
      alert('Tidak ada baris data yang valid di dalam file Excel.');
    }
  };
  reader.readAsArrayBuffer(file);
});

// ==========================================
// 2. EVALUASI STANDAR THERMOVISION PLN & PUIL 2011
// ==========================================
function evaluasiKondisi(r, s, t) {
  const maxSuhu = Math.max(r, s, t);
  const minSuhu = Math.min(r, s, t);
  const deltaT = Number((maxSuhu - minSuhu).toFixed(1));

  if (deltaT <= 5) {
    return {
      deltaT,
      kondisi: 'Kondisi I',
      rekomendasi: 'Lakukan pengujian rutin.',
      badgeClass: 'badge-k1'
    };
  } else if (deltaT <= 30) {
    return {
      deltaT,
      kondisi: 'Kondisi II',
      rekomendasi: 'Jadwalkan perbaikan atau penggantian seperlunya.',
      badgeClass: 'badge-k2'
    };
  } else {
    return {
      deltaT,
      kondisi: 'Kondisi III',
      rekomendasi: 'Perbaiki atau penggantian secepatnya.',
      badgeClass: 'badge-k3'
    };
  }
}

function formatWaktu(waktuISO) {
  if (!waktuISO) return '-';
  const date = new Date(waktuISO);
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ==========================================
// 3. RENDER DASHBOARD (KPI, TABEL, GRAFIK)
// ==========================================
function renderDashboard() {
  const kataKunci = document.getElementById('searchInput').value.toLowerCase();
  const filterKondisi = document.getElementById('filterKondisi').value;
  const filterTanggal = document.getElementById('filterWaktuTabel')?.value || '';

  let k1 = 0, k2 = 0, k3 = 0;
  dataInspeksi.forEach(item => {
    const hasil = evaluasiKondisi(item.r, item.s, item.t);
    if (hasil.kondisi === 'Kondisi I') k1++;
    else if (hasil.kondisi === 'Kondisi II') k2++;
    else k3++;
  });

  document.getElementById('totalInspeksi').textContent = dataInspeksi.length;
  document.getElementById('totalKondisi1').textContent = k1;
  document.getElementById('totalKondisi2').textContent = k2;
  document.getElementById('totalKondisi3').textContent = k3;

  const dataTersaring = dataInspeksi.filter(item => {
    const hasil = evaluasiKondisi(item.r, item.s, item.t);
    const cocokCari =
      item.lokasi.toLowerCase().includes(kataKunci) ||
      (item.peralatan || '').toLowerCase().includes(kataKunci) ||
      (item.titikUkur || '').toLowerCase().includes(kataKunci) ||
      hasil.rekomendasi.toLowerCase().includes(kataKunci) ||
      hasil.kondisi.toLowerCase().includes(kataKunci);
    const cocokFilter = filterKondisi === 'all' || hasil.kondisi === filterKondisi;

    let cocokWaktu = true;
    if (filterTanggal) {
      cocokWaktu = item.waktu && item.waktu.slice(0, 10) === filterTanggal;
    }

    return cocokCari && cocokFilter && cocokWaktu;
  });

  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  if (dataTersaring.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center; padding: 30px; color: #94a3b8;">
          Belum ada data inspeksi. Klik <strong>Input Data Baru</strong> untuk memasukkan data.
        </td>
      </tr>
    `;
  } else {
    dataTersaring.forEach(item => {
      const hasil = evaluasiKondisi(item.r, item.s, item.t);
      const fotoHTML = item.foto
        ? `<img src="${item.foto}" class="thumb-img" alt="Thermal ${item.lokasi}" onclick="bukaModalFoto('${item.id}')">`
        : `<span class="no-photo">Tanpa foto</span>`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <span class="loc-title">${item.lokasi}</span>
          ${item.peralatan ? `<span class="loc-time">${item.peralatan} &bull; ${item.titikUkur || '-'}</span>` : ''}
          <span class="loc-time">${formatWaktu(item.waktu)}</span>
        </td>
        <td>${fotoHTML}</td>
        <td>${item.r.toFixed(1)} &deg;C</td>
        <td>${item.s.toFixed(1)} &deg;C</td>
        <td>${item.t.toFixed(1)} &deg;C</td>
        <td><strong>${hasil.deltaT.toFixed(1)} &deg;C</strong></td>
        <td>
          <span class="badge ${hasil.badgeClass}">${hasil.kondisi}</span>
        </td>
        <td>
          <span class="rec-text">${hasil.rekomendasi}</span>
        </td>
        <td class="no-print">
          <div class="action-group">
            <button class="action-btn edit-btn" title="Edit data" onclick="bukaHalamanEdit(${item.id})">
              <i class="ri-edit-line"></i>
            </button>
            <button class="action-btn" title="Hapus data" onclick="hapusData(${item.id})">
              <i class="ri-delete-bin-line"></i>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  renderGrafik();
}

function renderGrafik() {
  const ctx = document.getElementById('thermalChart').getContext('2d');
  const fasaDipilih = document.getElementById('filterFasaGrafik')?.value || 'all';
  const tanggalGrafik = document.getElementById('filterRentangGrafik')?.value || '';
  const judulEl = document.getElementById('judulGrafik');

  let dataGrafik = dataInspeksi.filter(item => {
    if (!tanggalGrafik) return true;
    return item.waktu && item.waktu.slice(0, 10) === tanggalGrafik;
  });

  dataGrafik.sort((a, b) => new Date(a.waktu) - new Date(b.waktu));

  const labels = dataGrafik.map(item => {
    const tgl = new Date(item.waktu).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short'
    });
    return `${item.lokasi} (${tgl})`;
  });

  let datasets = [];
  let tipeGrafik = 'bar';

  if (fasaDipilih === 'all') {
    if (judulEl) judulEl.textContent = 'Perbandingan Suhu Fasa R, S, dan T (°C)';
    datasets = [
      {
        label: 'Fasa R (°C)',
        data: dataGrafik.map(item => item.r),
        backgroundColor: '#ef4444',
        borderRadius: 6
      },
      {
        label: 'Fasa S (°C)',
        data: dataGrafik.map(item => item.s),
        backgroundColor: '#f59e0b',
        borderRadius: 6
      },
      {
        label: 'Fasa T (°C)',
        data: dataGrafik.map(item => item.t),
        backgroundColor: '#3b82f6',
        borderRadius: 6
      }
    ];
  } else {
    tipeGrafik = 'line';
    const konfigurasiFasa = {
      r: { label: 'Fasa R (°C)', warna: '#ef4444', fill: 'rgba(239, 68, 68, 0.12)', judul: 'Tren Suhu Fasa R (°C)' },
      s: { label: 'Fasa S (°C)', warna: '#f59e0b', fill: 'rgba(245, 158, 11, 0.12)', judul: 'Tren Suhu Fasa S (°C)' },
      t: { label: 'Fasa T (°C)', warna: '#3b82f6', fill: 'rgba(59, 130, 246, 0.12)', judul: 'Tren Suhu Fasa T (°C)' }
    };
    const cfg = konfigurasiFasa[fasaDipilih];
    if (judulEl) judulEl.textContent = cfg.judul;

    datasets = [
      {
        label: cfg.label,
        data: dataGrafik.map(item => item[fasaDipilih]),
        borderColor: cfg.warna,
        backgroundColor: cfg.fill,
        borderWidth: 3,
        pointBackgroundColor: cfg.warna,
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: true,
        tension: 0.3
      }
    ];
  }

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: tipeGrafik,
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { family: 'Plus Jakarta Sans', size: 12 }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Suhu (°C)',
            font: { family: 'Plus Jakarta Sans', weight: '600' }
          }
        },
        x: {
          ticks: {
            font: { family: 'Plus Jakarta Sans', size: 12 }
          }
        }
      }
    }
  });
}

// ==========================================
// 4. HALAMAN INPUT / EDIT DATA & HITUNG OTOMATIS ΔT
// ==========================================
function bukaHalamanInput() {
  editId = null;
  document.getElementById('modalInputTitle').textContent = 'Tambah Data Inspeksi Thermal';
  document.getElementById('inspeksiForm').reset();
  isiDropdownLokasi();

  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById('inputWaktu').value = now.toISOString().slice(0, 16);

  document.getElementById('previewDeltaT').textContent = '- °C';
  document.getElementById('previewStatus').innerHTML = 'Isi suhu R, S, dan T untuk melihat status';
  pindahHalaman('input');
}

function bukaHalamanEdit(id) {
  const item = dataInspeksi.find(d => d.id === id);
  if (!item) return;

  editId = id;
  document.getElementById('modalInputTitle').textContent = 'Edit Data Inspeksi Thermal';
  document.getElementById('inspeksiForm').reset();

  isiDropdownLokasi(item.lokasi);
  isiDropdownPeralatan(item.peralatan || '');
  isiDropdownTitikUkur(item.titikUkur || '');

  document.getElementById('inputWaktu').value = item.waktu;
  document.getElementById('inputR').value = item.r;
  document.getElementById('inputS').value = item.s;
  document.getElementById('inputT').value = item.t;

  updatePreviewDeltaT();
  pindahHalaman('input');
}

function updatePreviewDeltaT() {
  const r = parseFloat(document.getElementById('inputR').value);
  const s = parseFloat(document.getElementById('inputS').value);
  const t = parseFloat(document.getElementById('inputT').value);

  if (!isNaN(r) && !isNaN(s) && !isNaN(t)) {
    const hasil = evaluasiKondisi(r, s, t);
    document.getElementById('previewDeltaT').textContent = `${hasil.deltaT.toFixed(1)} °C`;
    document.getElementById('previewStatus').innerHTML =
      `<span class="badge ${hasil.badgeClass}">${hasil.kondisi}</span> — ${hasil.rekomendasi}`;
  } else {
    document.getElementById('previewDeltaT').textContent = '- °C';
    document.getElementById('previewStatus').innerHTML = 'Isi suhu R, S, dan T untuk melihat status';
  }
}

['inputR', 'inputS', 'inputT'].forEach(id => {
  document.getElementById(id).addEventListener('input', updatePreviewDeltaT);
});

function bacaDanKompresFoto(file, callback) {
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement('canvas');
      const maxWidth = 800;
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      callback(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

document.getElementById('inspeksiForm').addEventListener('submit', function (e) {
  e.preventDefault();

  const lokasi = document.getElementById('inputLokasi').value.trim();
  const peralatan = document.getElementById('inputPeralatan').value.trim();
  const titikUkur = document.getElementById('inputTitikUkur').value.trim();

  const validMaster = dataMaster.some(
    item => item.lokasi === lokasi && item.peralatan === peralatan && item.titikUkur === titikUkur
  );
  if (!validMaster && editId === null) {
    alert('Lokasi, Peralatan, dan Titik Ukur harus dipilih dari daftar Data Master yang tersedia.');
    return;
  }

  const waktu = document.getElementById('inputWaktu').value;
  const r = parseFloat(document.getElementById('inputR').value);
  const s = parseFloat(document.getElementById('inputS').value);
  const t = parseFloat(document.getElementById('inputT').value);
  const fileFoto = document.getElementById('inputFoto').files[0];

  const simpanEntri = async (fotoBase64) => {
    if (editId !== null) {
      const lama = dataInspeksi.find(item => item.id === editId);
      const fotoFinal = fotoBase64 !== null ? fotoBase64 : (lama ? lama.foto : '');

      const { error } = await db
        .from('inspeksi')
        .update({
          lokasi,
          peralatan,
          titik_ukur: titikUkur,
          waktu,
          r,
          s,
          t,
          foto: fotoFinal
        })
        .eq('id', editId);

      if (error) {
        alert('Gagal memperbarui data: ' + error.message);
        return;
      }
    } else {
      const { error } = await db.from('inspeksi').insert([{
        id: Date.now(),
        lokasi,
        peralatan,
        titik_ukur: titikUkur,
        waktu,
        r,
        s,
        t,
        foto: fotoBase64 || ''
      }]);

      if (error) {
        alert('Gagal menyimpan data: ' + error.message);
        return;
      }
    }

    editId = null;
    await muatDataDariCloud();
    pindahHalaman('dashboard');
  };

  if (fileFoto) {
    bacaDanKompresFoto(fileFoto, simpanEntri);
  } else {
    simpanEntri(null);
  }
});

// ==========================================
// 5. HAPUS DATA, PERBESAR FOTO, FILTER & EXPORT CSV
// ==========================================
async function hapusData(id) {
  if (confirm('Yakin ingin menghapus data inspeksi ini?')) {
    const { error } = await db.from('inspeksi').delete().eq('id', id);
    if (error) {
      alert('Gagal menghapus data: ' + error.message);
      return;
    }
    dataInspeksi = dataInspeksi.filter(item => item.id !== id);
    renderDashboard();
  }
}

function bukaModalFoto(id) {
  const item = dataInspeksi.find(d => d.id == id);
  if (!item || !item.foto) return;

  const hasil = evaluasiKondisi(item.r, item.s, item.t);
  const detailAlat = item.peralatan ? ` • ${item.peralatan} (${item.titikUkur || '-'})` : '';
  document.getElementById('enlargedPhoto').src = item.foto;
  document.getElementById('photoCaption').textContent =
    `${item.lokasi}${detailAlat} (${formatWaktu(item.waktu)}) — R: ${item.r}°C | S: ${item.s}°C | T: ${item.t}°C | ΔT: ${hasil.deltaT}°C (${hasil.kondisi})`;
  document.getElementById('photoModal').classList.add('show');
}

function tutupModalFoto() {
  document.getElementById('photoModal').classList.remove('show');
}

function exportCSV() {
  let csv = 'Lokasi,Peralatan,Titik Ukur,Waktu Inspeksi,Fasa R (C),Fasa S (C),Fasa T (C),Delta T (C),Kondisi,Rekomendasi\n';

  dataInspeksi.forEach(item => {
    const hasil = evaluasiKondisi(item.r, item.s, item.t);
    csv += `"${item.lokasi}","${item.peralatan || '-'}","${item.titikUkur || '-'}","${formatWaktu(item.waktu)}",${item.r},${item.s},${item.t},${hasil.deltaT},"${hasil.kondisi}","${hasil.rekomendasi}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Report_Thermal_Tower_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
}

function resetFilterTanggal() {
  document.getElementById('filterWaktuTabel').value = '';
  renderDashboard();
}

function resetFilterTanggalGrafik() {
  document.getElementById('filterRentangGrafik').value = '';
  renderGrafik();
}

document.getElementById('searchInput').addEventListener('input', renderDashboard);
document.getElementById('filterKondisi').addEventListener('change', renderDashboard);
document.getElementById('filterWaktuTabel').addEventListener('change', renderDashboard);
document.getElementById('filterFasaGrafik').addEventListener('change', renderGrafik);
document.getElementById('filterRentangGrafik').addEventListener('change', renderGrafik);

// ==========================================
// 6. SISTEM LOGIN 1 AKUN & UBAH KATA SANDI (CLOUD)
// ==========================================
const SESSION_KEY = 'ethermal_logged_in_v1';

const AKUN_UTAMA = {
  username: 'admin',
  email: 'alpiyeyy@gmail.com',
  nama: 'Unit Distribusi Daya'
};

function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  const icon = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'ri-eye-off-line';
  } else {
    input.type = 'password';
    icon.className = 'ri-eye-line';
  }
}

function tampilkanPesan(elementId, teksHTML, tipe) {
  const el = document.getElementById(elementId);
  el.innerHTML = teksHTML;
  el.className = `auth-msg ${tipe}`;
}

document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const inputUser = document.getElementById('loginEmail').value.trim().toLowerCase();
  const inputPass = document.getElementById('loginPassword').value;

  const { data } = await db.from('app_settings').select('value').eq('key', 'admin_password').maybeSingle();
  if (data && data.value) passwordAktifCloud = data.value;

  const userCocok = (inputUser === AKUN_UTAMA.username || inputUser === AKUN_UTAMA.email);

  if (userCocok && inputPass === passwordAktifCloud) {
    localStorage.setItem(SESSION_KEY, 'true');
    document.getElementById('authMsg').className = 'auth-msg';
    cekSesiLogin();
  } else if (!userCocok) {
    tampilkanPesan(
      'authMsg',
      'Email atau username tidak terdaftar. <a href="#" onclick="tampilkanFormLupa(true); return false;" style="color: inherit; font-weight: 700; text-decoration: underline;">Lupa Kata Sandi?</a>',
      'error'
    );
  } else {
    tampilkanPesan(
      'authMsg',
      'Kata sandi salah. <a href="#" onclick="tampilkanFormLupa(true); return false;" style="color: inherit; font-weight: 700; text-decoration: underline;">Lupa Kata Sandi?</a>',
      'error'
    );
  }
});

async function cekSesiLogin() {
  const sudahLogin = localStorage.getItem(SESSION_KEY) === 'true';
  const authScreen = document.getElementById('authScreen');
  const appLayout = document.getElementById('appLayout');

  if (sudahLogin) {
    authScreen.style.display = 'none';
    appLayout.style.display = 'flex';
    document.getElementById('userName').textContent = AKUN_UTAMA.nama;
    document.getElementById('userEmail').textContent = AKUN_UTAMA.email;
    document.getElementById('userAvatar').textContent = 'UD';
    await muatDataDariCloud();
    pindahHalaman('dashboard');
  } else {
    authScreen.style.display = 'flex';
    appLayout.style.display = 'none';
  }
}

function logout() {
  if (confirm('Keluar dari dashboard E-Thermal?')) {
    localStorage.removeItem(SESSION_KEY);
    document.getElementById('loginForm').reset();
    cekSesiLogin();
  }
}

document.getElementById('changePasswordForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const oldPass = document.getElementById('oldPassword').value;
  const newPass = document.getElementById('newPassword').value;
  const confirmPass = document.getElementById('confirmNewPassword').value;

  if (oldPass !== passwordAktifCloud) {
    tampilkanPesan('passMsg', 'Kata sandi lama tidak sesuai.', 'error');
    return;
  }

  if (newPass !== confirmPass) {
    tampilkanPesan('passMsg', 'Konfirmasi kata sandi baru tidak cocok.', 'error');
    return;
  }

  const { error } = await db
    .from('app_settings')
    .upsert({ key: 'admin_password', value: newPass });

  if (error) {
    tampilkanPesan('passMsg', 'Gagal menyimpan sandi ke database.', 'error');
    return;
  }

  passwordAktifCloud = newPass;
  tampilkanPesan('passMsg', 'Kata sandi berhasil diubah!', 'success');
  document.getElementById('changePasswordForm').reset();
});

// ==========================================
// 7. FITUR LUPA KATA SANDI (TANPA VERIFIKASI)
// ==========================================
function tampilkanFormLupa(tampilkan) {
  const loginForm = document.getElementById('loginForm');
  const forgotForm = document.getElementById('forgotForm');
  const cardTitle = document.getElementById('authCardTitle');
  const authMsg = document.getElementById('authMsg');

  authMsg.className = 'auth-msg';
  authMsg.textContent = '';

  if (tampilkan) {
    loginForm.style.display = 'none';
    forgotForm.style.display = 'block';
    cardTitle.textContent = 'Reset Kata Sandi';
  } else {
    loginForm.style.display = 'block';
    forgotForm.style.display = 'none';
    cardTitle.textContent = 'Masuk ke Sistem';
  }
}

document.getElementById('forgotForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const newPass = document.getElementById('forgotNewPass').value;
  const confirmPass = document.getElementById('forgotConfirmPass').value;

  if (newPass !== confirmPass) {
    tampilkanPesan('authMsg', 'Konfirmasi kata sandi baru tidak cocok.', 'error');
    return;
  }

  const { error } = await db
    .from('app_settings')
    .upsert({ key: 'admin_password', value: newPass });

  if (error) {
    tampilkanPesan('authMsg', 'Gagal mereset kata sandi di database.', 'error');
    return;
  }

  passwordAktifCloud = newPass;
  tampilkanPesan('authMsg', 'Kata sandi berhasil direset! Silakan masuk dengan sandi baru.', 'success');
  document.getElementById('forgotForm').reset();

  setTimeout(() => {
    tampilkanFormLupa(false);
  }, 1500);
});

// ==========================================
// 8. CETAK REPORT PER SECTION
// ==========================================
function bukaModalCetak() {
  document.getElementById('printModal').classList.add('show');
}

function tutupModalCetak() {
  document.getElementById('printModal').classList.remove('show');
}

function eksekusiCetak() {
  const cetakKPI = document.getElementById('chkPrintKPI').checked;
  const cetakGrafik = document.getElementById('chkPrintGrafik').checked;
  const cetakTabel = document.getElementById('chkPrintTabel').checked;

  if (!cetakKPI && !cetakGrafik && !cetakTabel) {
    alert('Pilih minimal satu section untuk dicetak.');
    return;
  }

  const kpiEl = document.getElementById('kpiSection');
  const grafikEl = document.getElementById('grafik');
  const tabelEl = document.getElementById('tabel-data');

  kpiEl.classList.toggle('hide-on-print', !cetakKPI);
  grafikEl.classList.toggle('hide-on-print', !cetakGrafik);
  tabelEl.classList.toggle('hide-on-print', !cetakTabel);

  tutupModalCetak();

  setTimeout(() => {
    window.print();
    kpiEl.classList.remove('hide-on-print');
    grafikEl.classList.remove('hide-on-print');
    tabelEl.classList.remove('hide-on-print');
  }, 200);
}

// Jalankan pengecekan login saat halaman dibuka
cekSesiLogin();