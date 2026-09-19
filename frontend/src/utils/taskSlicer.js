/**
 * Hybrid Micro-Task Slicer Engine
 * Connects to Go Backend API (/api/slice) with intelligent client-side fallback.
 * Ensures 100% resilience even if the backend is temporarily offline or in flight mode during jury demo.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

export async function sliceTaskWithHybridFallback(content, tag, panicLevel) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000); // 7s timeout

    const res = await fetch(`${API_BASE_URL}/slice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: content || 'Beban akademik menumpuk',
        tag: tag || 'Deadline',
        panicLevel: Number(panicLevel) || 3,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.tasks && data.tasks.length >= 3) {
        return {
          ...data,
          source: data.source || 'backend-api',
        };
      }
    }
  } catch (err) {
    console.warn('[Careflow Slicer] Backend API unavailable or timed out. Triggering Client Heuristic Engine:', err.message);
  }

  // Pure Client Fallback (100% offline safety)
  return getClientHeuristicSlice(content, tag, panicLevel);
}

function getClientHeuristicSlice(content = '', tag = 'Deadline', panicLevel = 3) {
  const text = content.toLowerCase();
  const category = tag.toLowerCase();

  let affirmation = 'Tarik napas perlahan. Jangan selesaikan semuanya sekarang, cukup selesaikan 1 langkah mikro pertama.';
  if (panicLevel >= 4) {
    affirmation = 'Detak jantungmu sedang terpacu tinggi. Tenang, beban ini bisa dipecah menjadi bagian-bagian sangat kecil.';
  }

  let tasks;

  if (text.includes('skripsi') || category.includes('skripsi') || text.includes('bab')) {
    tasks = [
      {
        id: 'task-1',
        action: 'Buka dokumen skripsimu dan tulis 1 kalimat bebas tanpa editing',
        duration: '2 menit',
        guidance: 'Abaikan tata bahasa atau formalitas dulu. Kuncinya adalah kursor mulai mengetik.',
      },
      {
        id: 'task-2',
        action: 'Buka 1 jurnal rujukan dan tandai 2 kalimat penting',
        duration: '3 menit',
        guidance: 'Cari 1 data atau kutipan yang paling relevan dengan paragraf berikutnya.',
      },
      {
        id: 'task-3',
        action: 'Ubah kutipan tersebut menjadi 2 baris kalimat dengan bahasamu sendiri',
        duration: '4 menit',
        guidance: 'Simpan file dokumenmu (Ctrl+S). Kamu resmi telah keluar dari task paralysis!',
      },
    ];
  } else if (text.includes('ujian') || category.includes('ujian') || text.includes('kuis')) {
    tasks = [
      {
        id: 'task-1',
        action: 'Buka silabus dan pilih 1 materi yang paling kamu sukai',
        duration: '2 menit',
        guidance: 'Memulai dari materi yang dikuasai merangsang dopamin dan meredakan kecemasan.',
      },
      {
        id: 'task-2',
        action: 'Tulis 3 konsep kunci dari materi tersebut di kertas coretan',
        duration: '3 menit',
        guidance: 'Tulis dengan gaya santaimu sendiri untuk mempermudah daya ingat kinestetik.',
      },
      {
        id: 'task-3',
        action: 'Baca dan pahami pembahasan 1 contoh soal latihan',
        duration: '4 menit',
        guidance: 'Cukup 1 soal saja. Selesai memahaminya, berikan apresiasi pada dirimu.',
      },
    ];
  } else if (text.includes('coding') || text.includes('koding') || text.includes('bug')) {
    tasks = [
      {
        id: 'task-1',
        action: 'Buka file kode dan tulis komentar deskripsi masalah secara sederhana',
        duration: '2 menit',
        guidance: 'Gunakan bahasa sehari-hari untuk mendefinisikan apa yang sebenarnya terjadi.',
      },
      {
        id: 'task-2',
        action: 'Pasang 1 console.log atau debugger di input variabel utama',
        duration: '3 menit',
        guidance: 'Verifikasi apakah tipe dan nilai datanya sudah sesuai yang diharapkan.',
      },
      {
        id: 'task-3',
        action: 'Coba 1 perubahan kecil dan jalankan pengujian sekali lagi',
        duration: '4 menit',
        guidance: 'Apapun hasilnya, kamu telah memutus kebuntuan mental dengan aksi nyata.',
      },
    ];
  } else {
    tasks = [
      {
        id: 'task-1',
        action: 'Rapikan meja dari 2 benda pengalih perhatian dan minum seteguk air',
        duration: '2 menit',
        guidance: 'Fisik yang segar dan ruang yang rapi langsung menurunkan level hormon stres.',
      },
      {
        id: 'task-2',
        action: 'Buka file/aplikasi tugas dan tulis 1 langkah paling mudah untuk dimulai',
        duration: '3 menit',
        guidance: 'Fokus pada apa yang ada di depan mata selama 3 menit tanpa membuka tab lain.',
      },
      {
        id: 'task-3',
        action: 'Selesaikan aksi mikro itu dan beri tanda centang selesai',
        duration: '4 menit',
        guidance: 'Langkah pertama selesai! Momentum telah terbentuk, kamu memegang kendali.',
      },
    ];
  }

  return {
    source: 'client-heuristic-engine',
    affirmation,
    tag,
    tasks,
  };
}
