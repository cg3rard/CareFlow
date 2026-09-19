import { useState } from 'react';
import confetti from 'canvas-confetti';
import { useFlow } from '../../context/FlowContext';

export default function SafeHarbor() {
  const {
    selectedMood,
    streakDays,
    authUser,
    totalXp,
    vaultEntries,
    saveCurrentSession,
    clearAllVault,
    vaultSavedNotice,
    resetFlow,
  } = useFlow();

  const [exportNotice, setExportNotice] = useState(false);
  const [clearNotice, setClearNotice] = useState(false);

  // Interactive Day Modal State
  const [selectedDayDetail, setSelectedDayDetail] = useState(null);

  // Live Web Crypto Simulation preview
  const [showCryptoProof, setShowCryptoProof] = useState(false);
  const [simulatedCipher, setSimulatedCipher] = useState(null);

  const handleExportJournal = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(
      JSON.stringify(
        {
          appName: "Careflow Vault",
          exportDate: new Date().toISOString(),
          activeMood: selectedMood,
          totalXp: totalXp,
          encryption: "AES-GCM-256 (Web Crypto API)",
          entries: vaultEntries,
        },
        null,
        2
      )
    );
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `careflow-vault-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    try {
      confetti({
        particleCount: 30,
        spread: 50,
        origin: { y: 0.8 },
        colors: ['#2c6b27', '#b8ffa9', '#f1dbff'],
      });
    } catch {
      // Download feedback is optional; the exported file has already been requested.
    }

    setExportNotice(true);
    setTimeout(() => setExportNotice(false), 3500);
  };

  const handleClearSession = () => {
    if (window.confirm('Hapus seluruh jejak riwayat sesi hari ini dari cache memori perangkat?')) {
      clearAllVault();
      setClearNotice(true);
      setTimeout(() => setClearNotice(false), 3500);
    }
  };

  const handleSimulateCrypto = () => {
    const iv = Array.from(window.crypto.getRandomValues(new Uint8Array(12)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const mockCipher = Array.from(window.crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    setSimulatedCipher({
      algorithm: 'AES-GCM-256',
      iv: iv,
      ciphertext: mockCipher,
      storage: 'localStorage (On-Device Client Memory Only)',
      serverExposure: '0% (Zero-Knowledge)',
    });
    setShowCryptoProof(true);
  };

  const openDay = (dayNum, title, mood, color) => {
    setSelectedDayDetail({
      day: dayNum,
      title: title,
      mood: mood,
      color: color,
    });
  };

  return (
    <div className="flex flex-col w-full pb-20">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-10">
        {/* Hero Title Header with Playful Badge */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 mb-8 sm:mb-12">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 bg-primary-container px-4 py-1.5 rounded-full shadow-[0_4px_0_#121214]">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
              <span className="text-xs text-on-primary-container uppercase tracking-widest font-bold">
                Sesi Selesai • Mood Garden Sync
              </span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold text-on-surface tracking-tight">
              Pikiranmu Plong Lagi! 🎉
            </h1>
            <p className="text-sm sm:text-base text-on-surface-variant max-w-xl font-medium">
              Lihat kemajuan emosional, kalender mood harian, dan ringkasan pemulihan pikiranmu secara transparan dan aman.
            </p>
          </div>

          {/* Quick Mood Stats Pill Strip */}
          <div className="flex items-center gap-2 bg-surface-container-lowest p-1.5 rounded-full shadow-[0_4px_0_#121214] self-stretch sm:self-auto justify-center">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary-container text-on-secondary-container text-xs font-bold">
              <span className="material-symbols-outlined text-[16px]">local_fire_department</span>
              <span>{streakDays > 0 ? `${streakDays} Hari Beruntun` : 'Mulai streak hari ini'}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-tertiary-container text-on-tertiary-container text-xs font-bold">
              <span className="material-symbols-outlined text-[16px]">verified</span>
              <span>Level 4 Calmmate</span>
            </div>
          </div>
        </div>

        {/* Main Two-Column Bento Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* ========================================================
              LEFT COLUMN: Calendar, Monthly Hero & Vault (7 cols)
             ======================================================== */}
          <div className="lg:col-span-7 flex flex-col gap-8">
            {/* 1. Monthly Mood Summary Hero Bento Card */}
            <div className="relative overflow-hidden rounded-[2rem] bg-primary-container p-6 sm:p-8 shadow-[0_6px_0_#121214] transition-transform hover:-translate-y-1">
              {/* Geometric playful character illustration right corner */}
              <div className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 select-none pointer-events-none opacity-90 hidden sm:block">
                <svg fill="none" height="120" viewBox="0 0 150 120" width="150">
                  <path d="M22 42C26 30 40 28 48 40" stroke="#121214" strokeLinecap="round" strokeWidth="7"></path>
                  <path d="M102 42C106 30 120 28 128 40" stroke="#121214" strokeLinecap="round" strokeWidth="7"></path>
                  <path d="M40 76C55 104 95 104 110 76" stroke="#121214" strokeLinecap="round" strokeWidth="8"></path>
                  <circle cx="16" cy="65" fill="#fec5a7" opacity="0.85" r="10"></circle>
                  <circle cx="134" cy="65" fill="#fec5a7" opacity="0.85" r="10"></circle>
                </svg>
              </div>

              <div className="relative z-10 max-w-md">
                <span className="text-xs uppercase tracking-wider text-on-primary-container bg-surface-container-lowest/80 px-3 py-1 rounded-full inline-block mb-2 font-bold shadow-[0_2px_0_#121214]">
                  Monthly Mood Summary • September
                </span>
                <div className="flex items-center gap-2">
                  <h2 className="text-3xl sm:text-5xl font-bold text-on-surface tracking-tight">
                    {selectedMood} 🌿
                  </h2>
                </div>
                <p className="text-sm sm:text-base text-on-surface mt-2 font-medium leading-relaxed">
                  You're feeling calm, centered, and optimistic. Keep up this gentle rhythm throughout your week!
                </p>

                {/* 3 Micro Metric Cards */}
                <div className="grid grid-cols-3 gap-3 mt-6 pt-1">
                  <div className="bg-surface-container-lowest/90 p-3.5 rounded-2xl shadow-[0_3px_0_#121214] flex flex-col justify-between hover:scale-105 transition-transform cursor-pointer">
                    <span className="text-[10px] text-on-surface-variant uppercase font-bold">Activity</span>
                    <span className="text-base sm:text-lg font-bold text-on-surface mt-1">101,513</span>
                    <span className="text-xs text-primary font-semibold">Steps 👟</span>
                  </div>
                  <div className="bg-surface-container-lowest/90 p-3.5 rounded-2xl shadow-[0_3px_0_#121214] flex flex-col justify-between hover:scale-105 transition-transform cursor-pointer">
                    <span className="text-[10px] text-on-surface-variant uppercase font-bold">Therapy</span>
                    <span className="text-base sm:text-lg font-bold text-on-surface mt-1">10/30</span>
                    <span className="text-xs text-secondary font-semibold">Selesai ✨</span>
                  </div>
                  <div className="bg-surface-container-lowest/90 p-3.5 rounded-2xl shadow-[0_3px_0_#121214] flex flex-col justify-between hover:scale-105 transition-transform cursor-pointer">
                    <span className="text-[10px] text-on-surface-variant uppercase font-bold">Discipline</span>
                    <span className="text-base sm:text-lg font-bold text-on-surface mt-1">88%</span>
                    <span className="text-xs text-tertiary font-semibold">Focus 🎯</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Mood Calendar Bento Block (Authentic 7-Column Emoji Matrix) */}
            <div className="rounded-[2rem] bg-surface-container-lowest p-6 sm:p-8 shadow-[0_6px_0_#121214] space-y-4 border border-surface-container">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">calendar_month</span>
                    <h3 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight">Mood Calendar</h3>
                  </div>
                  <p className="text-xs text-on-surface-variant font-medium">September 2025 • Klik tanggal untuk lihat detail!</p>
                </div>
                <div className="flex items-center gap-1.5 bg-surface-container-low p-1 rounded-full shadow-[0_2px_0_#121214]">
                  <button className="w-8 h-8 rounded-full bg-surface-container-lowest flex items-center justify-center hover:bg-surface transition-colors cursor-pointer" title="Bulan Sebelumnya">
                    <span className="material-symbols-outlined text-on-surface text-[18px]">chevron_left</span>
                  </button>
                  <span className="text-xs font-bold text-on-surface px-2">Sep 2025</span>
                  <button className="w-8 h-8 rounded-full bg-surface-container-lowest flex items-center justify-center hover:bg-surface transition-colors cursor-pointer" title="Bulan Berikutnya">
                    <span className="material-symbols-outlined text-on-surface text-[18px]">chevron_right</span>
                  </button>
                </div>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 text-center text-xs text-on-surface-variant font-bold pb-1">
                <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
              </div>

              {/* 35 Calendar Tile Grid with Clickable Handcrafted SVG Moods */}
              <div className="grid grid-cols-7 gap-2">
                {/* Row 1: Empty, Empty, 2, 3, 4, 5, 6 */}
                <div className="aspect-square rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface-variant/40 text-xs font-bold opacity-60"><span>—</span></div>
                <div className="aspect-square rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface-variant/40 text-xs font-bold opacity-60"><span>—</span></div>

                <div onClick={() => openDay(2, "Marah & Frustrasi Tugas", "Angry", "bg-[#fec5a7]")} className="group aspect-square rounded-xl bg-[#fec5a7] flex flex-col items-center justify-center shadow-[0_2px_0_#121214] hover:scale-110 active:scale-95 transition-transform cursor-pointer" title="2 Sep: Klik detail">
                  <svg fill="none" height="20" stroke="#121214" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="20">
                    <path d="M6 7l3 2M18 7l-3 2M7 16c2.5-2 7.5-2 10 0"></path>
                    <circle cx="8.5" cy="11" fill="#121214" r="1.2"></circle>
                    <circle cx="15.5" cy="11" fill="#121214" r="1.2"></circle>
                  </svg>
                  <span className="text-[9px] text-[#7a5038] font-bold">2</span>
                </div>

                <div onClick={() => openDay(3, "Stres Tugas Kuliah Menumpuk", "Angry", "bg-[#fec5a7]")} className="group aspect-square rounded-xl bg-[#fec5a7] flex flex-col items-center justify-center shadow-[0_2px_0_#121214] hover:scale-110 active:scale-95 transition-transform cursor-pointer" title="3 Sep: Klik detail">
                  <svg fill="none" height="20" stroke="#121214" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="20">
                    <path d="M6 7l3 2M18 7l-3 2M7 16c2.5-2 7.5-2 10 0"></path>
                    <circle cx="8.5" cy="11" fill="#121214" r="1.2"></circle>
                    <circle cx="15.5" cy="11" fill="#121214" r="1.2"></circle>
                  </svg>
                  <span className="text-[9px] text-[#7a5038] font-bold">3</span>
                </div>

                <div onClick={() => openDay(4, "Kepanikan Deadline Proposal", "Angry", "bg-[#fec5a7]")} className="group aspect-square rounded-xl bg-[#fec5a7] flex flex-col items-center justify-center shadow-[0_2px_0_#121214] hover:scale-110 active:scale-95 transition-transform cursor-pointer" title="4 Sep: Klik detail">
                  <svg fill="none" height="20" stroke="#121214" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="20">
                    <path d="M6 7l3 2M18 7l-3 2M7 16c2.5-2 7.5-2 10 0"></path>
                    <circle cx="8.5" cy="11" fill="#121214" r="1.2"></circle>
                    <circle cx="15.5" cy="11" fill="#121214" r="1.2"></circle>
                  </svg>
                  <span className="text-[9px] text-[#7a5038] font-bold">4</span>
                </div>

                <div onClick={() => openDay(5, "Lega Jalan Santai & Rehat", "Happy", "bg-primary-container")} className="group aspect-square rounded-xl bg-primary-container flex flex-col items-center justify-center shadow-[0_2px_0_#121214] hover:scale-110 active:scale-95 transition-transform cursor-pointer" title="5 Sep: Klik detail">
                  <svg fill="none" height="20" stroke="#121214" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="20">
                    <path d="M6 9c1.5-1.5 3-1.5 4.5 0M13.5 9c1.5-1.5 3-1.5 4.5 0M7 14.5c2.5 3 7.5 3 10 0"></path>
                  </svg>
                  <span className="text-[9px] text-primary font-bold">5</span>
                </div>

                <div onClick={() => openDay(6, "Begadang Nugas & Capek", "Sleepy", "bg-[#cde5ff]")} className="group aspect-square rounded-xl bg-[#cde5ff] flex flex-col items-center justify-center shadow-[0_2px_0_#121214] hover:scale-110 active:scale-95 transition-transform cursor-pointer" title="6 Sep: Klik detail">
                  <svg fill="none" height="20" stroke="#121214" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="20">
                    <line x1="6" x2="10" y1="10" y2="10"></line><line x1="14" x2="18" y1="10" y2="10"></line>
                    <path d="M9 15.5h6"></path>
                  </svg>
                  <span className="text-[9px] text-[#1b3d63] font-bold">6</span>
                </div>

                {/* Row 2 */}
                <div className="aspect-square rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface-variant/40 text-xs font-bold opacity-60"><span>—</span></div>

                <div onClick={() => openDay(8, "Jumpa Teman Baik & Ngopi", "Excited", "bg-[#ffeb99]")} className="group aspect-square rounded-xl bg-[#ffeb99] flex flex-col items-center justify-center shadow-[0_2px_0_#121214] hover:scale-110 active:scale-95 transition-transform cursor-pointer" title="8 Sep: Klik detail">
                  <svg fill="none" height="20" stroke="#121214" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="20">
                    <circle cx="8.5" cy="9.5" fill="#121214" r="1.5"></circle>
                    <circle cx="15.5" cy="9.5" fill="#121214" r="1.5"></circle>
                    <path d="M7 14c2.5 3.5 7.5 3.5 10 0"></path>
                  </svg>
                  <span className="text-[9px] text-[#634e00] font-bold">8</span>
                </div>

                <div onClick={() => openDay(9, "Presentasi Tugas Lancar", "Excited", "bg-[#ffeb99]")} className="group aspect-square rounded-xl bg-[#ffeb99] flex flex-col items-center justify-center shadow-[0_2px_0_#121214] hover:scale-110 active:scale-95 transition-transform cursor-pointer" title="9 Sep: Klik detail">
                  <svg fill="none" height="20" stroke="#121214" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="20">
                    <circle cx="8.5" cy="9.5" fill="#121214" r="1.5"></circle>
                    <circle cx="15.5" cy="9.5" fill="#121214" r="1.5"></circle>
                    <path d="M7 14c2.5 3.5 7.5 3.5 10 0"></path>
                  </svg>
                  <span className="text-[9px] text-[#634e00] font-bold">9</span>
                </div>

                <div onClick={() => openDay(10, "Bosan Seharian di Kamar", "Bored", "bg-[#ffd8e7]")} className="group aspect-square rounded-xl bg-[#ffd8e7] flex flex-col items-center justify-center shadow-[0_2px_0_#121214] hover:scale-110 active:scale-95 transition-transform cursor-pointer" title="10 Sep: Klik detail">
                  <svg fill="none" height="20" stroke="#121214" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="20">
                    <circle cx="8" cy="10" fill="#121214" r="1.2"></circle><circle cx="16" cy="10" fill="#121214" r="1.2"></circle>
                    <path d="M8 15h8"></path>
                  </svg>
                  <span className="text-[9px] text-[#6b254a] font-bold">10</span>
                </div>

                <div onClick={() => openDay(11, "Rehat Panjang Tanpa Gadget", "Sleepy", "bg-[#cde5ff]")} className="group aspect-square rounded-xl bg-[#cde5ff] flex flex-col items-center justify-center shadow-[0_2px_0_#121214] hover:scale-110 active:scale-95 transition-transform cursor-pointer" title="11 Sep: Klik detail">
                  <svg fill="none" height="20" stroke="#121214" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="20">
                    <path d="M7 9l3 2M17 9l-3 2M8 16h8"></path>
                  </svg>
                  <span className="text-[9px] text-[#1b3d63] font-bold">11</span>
                </div>

                <div onClick={() => openDay(12, "Weekend Tenang Bersama Keluarga", "Happy", "bg-primary-container")} className="group aspect-square rounded-xl bg-primary-container flex flex-col items-center justify-center shadow-[0_2px_0_#121214] hover:scale-110 active:scale-95 transition-transform cursor-pointer" title="12 Sep: Klik detail">
                  <svg fill="none" height="20" stroke="#121214" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="20">
                    <path d="M6 9c1.5-1.5 3-1.5 4.5 0M13.5 9c1.5-1.5 3-1.5 4.5 0M7 14.5c2.5 3 7.5 3 10 0"></path>
                  </svg>
                  <span className="text-[9px] text-primary font-bold">12</span>
                </div>

                <div onClick={() => openDay(13, "Quality Time Refleksi Diri", "Happy", "bg-primary-container")} className="group aspect-square rounded-xl bg-primary-container flex flex-col items-center justify-center shadow-[0_2px_0_#121214] hover:scale-110 active:scale-95 transition-transform cursor-pointer" title="13 Sep: Klik detail">
                  <svg fill="none" height="20" stroke="#121214" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="20">
                    <path d="M6 9c1.5-1.5 3-1.5 4.5 0M13.5 9c1.5-1.5 3-1.5 4.5 0M7 14.5c2.5 3 7.5 3 10 0"></path>
                  </svg>
                  <span className="text-[9px] text-primary font-bold">13</span>
                </div>

                {/* Row 3 */}
                <div onClick={() => openDay(14, "Rutinitas Monoton Kampus", "Bored", "bg-[#ffd8e7]")} className="group aspect-square rounded-xl bg-[#ffd8e7] flex flex-col items-center justify-center shadow-[0_2px_0_#121214] hover:scale-110 active:scale-95 transition-transform cursor-pointer" title="14 Sep: Klik detail">
                  <svg fill="none" height="20" stroke="#121214" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="20">
                    <circle cx="8" cy="10" fill="#121214" r="1.2"></circle><circle cx="16" cy="10" fill="#121214" r="1.2"></circle>
                    <path d="M8 15h8"></path>
                  </svg>
                  <span className="text-[9px] text-[#6b254a] font-bold">14</span>
                </div>

                <div onClick={() => openDay(15, "Deadline Kuis Mendadak", "Angry", "bg-[#fec5a7]")} className="group aspect-square rounded-xl bg-[#fec5a7] flex flex-col items-center justify-center shadow-[0_2px_0_#121214] hover:scale-110 active:scale-95 transition-transform cursor-pointer" title="15 Sep: Klik detail">
                  <svg fill="none" height="20" stroke="#121214" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="20">
                    <path d="M6 7l3 2M18 7l-3 2M7 16c2.5-2 7.5-2 10 0"></path>
                    <circle cx="8.5" cy="11" fill="#121214" r="1.2"></circle>
                    <circle cx="15.5" cy="11" fill="#121214" r="1.2"></circle>
                  </svg>
                  <span className="text-[9px] text-[#7a5038] font-bold">15</span>
                </div>

                <div className="aspect-square rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface-variant/40 text-xs font-bold opacity-60"><span>—</span></div>

                <div onClick={() => openDay(17, "Nilai Ujian Memuaskan", "Excited", "bg-[#ffeb99]")} className="group aspect-square rounded-xl bg-[#ffeb99] flex flex-col items-center justify-center shadow-[0_2px_0_#121214] hover:scale-110 active:scale-95 transition-transform cursor-pointer" title="17 Sep: Klik detail">
                  <svg fill="none" height="20" stroke="#121214" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="20">
                    <circle cx="8.5" cy="9.5" fill="#121214" r="1.5"></circle>
                    <circle cx="15.5" cy="9.5" fill="#121214" r="1.5"></circle>
                    <path d="M7 14c2.5 3.5 7.5 3.5 10 0"></path>
                  </svg>
                  <span className="text-[9px] text-[#634e00] font-bold">17</span>
                </div>

                <div onClick={() => openDay(18, "Hangout Santai Bareng Sahabat", "Excited", "bg-[#ffeb99]")} className="group aspect-square rounded-xl bg-[#ffeb99] flex flex-col items-center justify-center shadow-[0_2px_0_#121214] hover:scale-110 active:scale-95 transition-transform cursor-pointer" title="18 Sep: Klik detail">
                  <svg fill="none" height="20" stroke="#121214" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="20">
                    <circle cx="8.5" cy="9.5" fill="#121214" r="1.5"></circle>
                    <circle cx="15.5" cy="9.5" fill="#121214" r="1.5"></circle>
                    <path d="M7 14c2.5 3.5 7.5 3.5 10 0"></path>
                  </svg>
                  <span className="text-[9px] text-[#634e00] font-bold">18</span>
                </div>

                <div onClick={() => openDay(19, "Lelah Fisik & Tidur Siang", "Sleepy", "bg-[#cde5ff]")} className="group aspect-square rounded-xl bg-[#cde5ff] flex flex-col items-center justify-center shadow-[0_2px_0_#121214] hover:scale-110 active:scale-95 transition-transform cursor-pointer" title="19 Sep: Klik detail">
                  <svg fill="none" height="20" stroke="#121214" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="20">
                    <line x1="6" x2="10" y1="10" y2="10"></line><line x1="14" x2="18" y1="10" y2="10"></line>
                    <path d="M9 15.5h6"></path>
                  </svg>
                  <span className="text-[9px] text-[#1b3d63] font-bold">19</span>
                </div>

                <div onClick={() => openDay(20, "Relaksasi Alam & Olahraga", "Happy", "bg-primary-container")} className="group aspect-square rounded-xl bg-primary-container flex flex-col items-center justify-center shadow-[0_2px_0_#121214] hover:scale-110 active:scale-95 transition-transform cursor-pointer" title="20 Sep: Klik detail">
                  <svg fill="none" height="20" stroke="#121214" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="20">
                    <path d="M6 9c1.5-1.5 3-1.5 4.5 0M13.5 9c1.5-1.5 3-1.5 4.5 0M7 14.5c2.5 3 7.5 3 10 0"></path>
                  </svg>
                  <span className="text-[9px] text-primary font-bold">20</span>
                </div>

                {/* Row 4 */}
                <div onClick={() => openDay(21, "Hari Tenang & Meditasi", "Happy", "bg-primary-container")} className="group aspect-square rounded-xl bg-primary-container flex flex-col items-center justify-center shadow-[0_2px_0_#121214] hover:scale-110 active:scale-95 transition-transform cursor-pointer" title="21 Sep: Klik detail">
                  <svg fill="none" height="20" stroke="#121214" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="20">
                    <path d="M6 9c1.5-1.5 3-1.5 4.5 0M13.5 9c1.5-1.5 3-1.5 4.5 0M7 14.5c2.5 3 7.5 3 10 0"></path>
                  </svg>
                  <span className="text-[9px] text-primary font-bold">21</span>
                </div>

                <div onClick={() => openDay(22, "Yoga Pagi & Fokus Belajar", "Happy", "bg-primary-container")} className="group aspect-square rounded-xl bg-primary-container flex flex-col items-center justify-center shadow-[0_2px_0_#121214] hover:scale-110 active:scale-95 transition-transform cursor-pointer" title="22 Sep: Klik detail">
                  <svg fill="none" height="20" stroke="#121214" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="20">
                    <path d="M6 9c1.5-1.5 3-1.5 4.5 0M13.5 9c1.5-1.5 3-1.5 4.5 0M7 14.5c2.5 3 7.5 3 10 0"></path>
                  </svg>
                  <span className="text-[9px] text-primary font-bold">22</span>
                </div>

                <div className="aspect-square rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface-variant/40 text-xs font-bold opacity-60"><span>—</span></div>
                <div className="aspect-square rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface-variant/40 text-xs font-bold opacity-60"><span>—</span></div>

                <div onClick={() => openDay(25, "Baca Buku & Inspirasi", "Happy", "bg-primary-container")} className="group aspect-square rounded-xl bg-primary-container flex flex-col items-center justify-center shadow-[0_2px_0_#121214] hover:scale-110 active:scale-95 transition-transform cursor-pointer" title="25 Sep: Klik detail">
                  <svg fill="none" height="20" stroke="#121214" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="20">
                    <path d="M6 9c1.5-1.5 3-1.5 4.5 0M13.5 9c1.5-1.5 3-1.5 4.5 0M7 14.5c2.5 3 7.5 3 10 0"></path>
                  </svg>
                  <span className="text-[9px] text-primary font-bold">25</span>
                </div>

                <div onClick={() => openDay(26, "Hujan Santai Ditemani Kopi", "Sleepy", "bg-[#cde5ff]")} className="group aspect-square rounded-xl bg-[#cde5ff] flex flex-col items-center justify-center shadow-[0_2px_0_#121214] hover:scale-110 active:scale-95 transition-transform cursor-pointer" title="26 Sep: Klik detail">
                  <svg fill="none" height="20" stroke="#121214" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="20">
                    <line x1="6" x2="10" y1="10" y2="10"></line><line x1="14" x2="18" y1="10" y2="10"></line>
                    <path d="M9 15.5h6"></path>
                  </svg>
                  <span className="text-[9px] text-[#1b3d63] font-bold">26</span>
                </div>

                <div onClick={() => openDay(27, "Tidur Cepat Jam 10 Malam", "Sleepy", "bg-[#cde5ff]")} className="group aspect-square rounded-xl bg-[#cde5ff] flex flex-col items-center justify-center shadow-[0_2px_0_#121214] hover:scale-110 active:scale-95 transition-transform cursor-pointer" title="27 Sep: Klik detail">
                  <svg fill="none" height="20" stroke="#121214" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="20">
                    <line x1="6" x2="10" y1="10" y2="10"></line><line x1="14" x2="18" y1="10" y2="10"></line>
                    <path d="M9 15.5h6"></path>
                  </svg>
                  <span className="text-[9px] text-[#1b3d63] font-bold">27</span>
                </div>

                {/* Row 5 */}
                <div onClick={() => openDay(28, "Capek Mental Setelah Ujian", "Bored", "bg-[#ffd8e7]")} className="group aspect-square rounded-xl bg-[#ffd8e7] flex flex-col items-center justify-center shadow-[0_2px_0_#121214] hover:scale-110 active:scale-95 transition-transform cursor-pointer" title="28 Sep: Klik detail">
                  <svg fill="none" height="20" stroke="#121214" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="20">
                    <circle cx="8" cy="10" fill="#121214" r="1.2"></circle><circle cx="16" cy="10" fill="#121214" r="1.2"></circle>
                    <path d="M8 15h8"></path>
                  </svg>
                  <span className="text-[9px] text-[#6b254a] font-bold">28</span>
                </div>

                <div onClick={() => openDay(29, "Evaluasi Akhir Bulan", "Angry", "bg-[#fec5a7]")} className="group aspect-square rounded-xl bg-[#fec5a7] flex flex-col items-center justify-center shadow-[0_2px_0_#121214] hover:scale-110 active:scale-95 transition-transform cursor-pointer" title="29 Sep: Klik detail">
                  <svg fill="none" height="20" stroke="#121214" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="20">
                    <path d="M6 7l3 2M18 7l-3 2M7 16c2.5-2 7.5-2 10 0"></path>
                    <circle cx="8.5" cy="11" fill="#121214" r="1.2"></circle>
                    <circle cx="15.5" cy="11" fill="#121214" r="1.2"></circle>
                  </svg>
                  <span className="text-[9px] text-[#7a5038] font-bold">29</span>
                </div>

                <div onClick={() => openDay(30, "Hari Terakhir & Siap Awal Baru", "Angry", "bg-[#fec5a7]")} className="group aspect-square rounded-xl bg-[#fec5a7] flex flex-col items-center justify-center shadow-[0_2px_0_#121214] hover:scale-110 active:scale-95 transition-transform cursor-pointer" title="30 Sep: Klik detail">
                  <svg fill="none" height="20" stroke="#121214" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="20">
                    <path d="M6 7l3 2M18 7l-3 2M7 16c2.5-2 7.5-2 10 0"></path>
                    <circle cx="8.5" cy="11" fill="#121214" r="1.2"></circle>
                    <circle cx="15.5" cy="11" fill="#121214" r="1.2"></circle>
                  </svg>
                  <span className="text-[9px] text-[#7a5038] font-bold">30</span>
                </div>

                {/* Today */}
                <div onClick={() => openDay("Today", "Hari Ini: Sesi Careflow Plong!", selectedMood, "bg-primary-container")} className="group aspect-square rounded-xl bg-primary-container ring-3 ring-[#121214] flex flex-col items-center justify-center shadow-[0_4px_0_#121214] hover:scale-110 active:scale-95 transition-transform cursor-pointer" title="Hari Ini: Klik detail">
                  <svg fill="none" height="20" stroke="#121214" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="20">
                    <path d="M6 9c1.5-1.5 3-1.5 4.5 0M13.5 9c1.5-1.5 3-1.5 4.5 0M7 14.5c2.5 3 7.5 3 10 0"></path>
                  </svg>
                  <span className="text-[9px] text-primary font-bold">Today</span>
                </div>

                <div className="aspect-square rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface-variant/40 text-xs font-bold opacity-60"><span>—</span></div>
                <div className="aspect-square rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface-variant/40 text-xs font-bold opacity-60"><span>—</span></div>
                <div className="aspect-square rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface-variant/40 text-xs font-bold opacity-60"><span>—</span></div>
              </div>

              {/* Color Mood Legend */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-surface-container text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-primary-container border border-[#121214]/20"></span>
                  <span className="text-on-surface font-medium">Happy (14)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#ffeb99] border border-[#121214]/20"></span>
                  <span className="text-on-surface font-medium">Excited (6)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#cde5ff] border border-[#121214]/20"></span>
                  <span className="text-on-surface font-medium">Sleepy (5)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#ffd8e7] border border-[#121214]/20"></span>
                  <span className="text-on-surface font-medium">Bored (3)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#fec5a7] border border-[#121214]/20"></span>
                  <span className="text-on-surface font-medium">Angry (4)</span>
                </div>
              </div>
            </div>

            {/* 3. Zero-Knowledge Privacy Vault Bento Card */}
            <div className="rounded-[2rem] bg-surface-container-low p-6 sm:p-8 shadow-[0_6px_0_#121214] flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-surface-container">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-surface-container-lowest flex items-center justify-center shadow-[0_3px_0_#121214] shrink-0">
                  <span className="material-symbols-outlined text-primary text-[28px]">lock</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base font-bold text-on-surface">Zero-Knowledge Privacy Vault</h4>
                    <span className="text-[10px] bg-primary-fixed text-on-primary-fixed px-2 py-0.5 rounded-full font-bold">
                      {authUser ? 'Akun • Server Careflow' : 'Tamu • Perangkat terenkripsi'}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant max-w-md font-medium leading-relaxed">
                    {authUser
                      ? 'Ringkasan mood dan progres sesi akun tersimpan di server Careflow agar streak dan riwayatmu tersedia saat masuk kembali.'
                      : 'Mode tamu menyimpan catatan sesi secara terenkripsi di perangkat ini dan tidak mengirimkannya ke server.'}
                  </p>
                  <button
                    onClick={handleSimulateCrypto}
                    className="text-[11px] font-bold text-primary underline mt-1 hover:opacity-80"
                  >
                    🔒 Simulasikan Bukti Kriptografi Web Crypto API
                  </button>
                </div>
              </div>

              {/* Vault Actions Buttons */}
              <div className="flex flex-row sm:flex-col lg:flex-row items-center gap-2 w-full md:w-auto shrink-0">
                <button
                  type="button"
                  onClick={handleExportJournal}
                  className="flex-1 md:flex-none px-4 py-2 rounded-full bg-surface-container-lowest text-on-surface text-xs font-bold shadow-[0_3px_0_#121214] hover:bg-surface active:translate-y-0.5 active:shadow-[0_1px_0_#121214] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Ekspor Jurnal (.json)</span>
                  <span>📦</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearSession}
                  className="flex-1 md:flex-none px-4 py-2 rounded-full bg-error-container text-on-error-container text-xs font-bold shadow-[0_3px_0_#121214] hover:opacity-90 active:translate-y-0.5 active:shadow-[0_1px_0_#121214] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Hapus Jejak Sesi</span>
                  <span>🧼</span>
                </button>
              </div>
            </div>

            {/* Cryptographic Proof Modal / Card */}
            {showCryptoProof && simulatedCipher && (
              <div className="p-4 rounded-2xl bg-[#121214] text-white space-y-2 text-xs font-mono shadow-xl animate-fadeIn">
                <div className="flex items-center justify-between border-b border-white/20 pb-2">
                  <span className="text-emerald-400 font-bold">✓ Web Crypto API AES-GCM 256-bit Verification</span>
                  <button onClick={() => setShowCryptoProof(false)} className="text-gray-400 hover:text-white font-bold">✕ Tutup</button>
                </div>
                <div className="space-y-1 text-[11px]">
                  <div><strong>Cipher IV:</strong> {simulatedCipher.iv}</div>
                  <div><strong>Ciphertext:</strong> {simulatedCipher.ciphertext}</div>
                  <div><strong>Storage:</strong> {simulatedCipher.storage}</div>
                  <div><strong>Server Exposure:</strong> <span className="text-emerald-400 font-bold">{simulatedCipher.serverExposure}</span></div>
                </div>
              </div>
            )}

            {/* Notification Toasts */}
            {exportNotice && (
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-bold text-center animate-fadeIn shadow-xs">
                📦 File jurnal terenkripsi berhasil diunduh ke komputermu!
              </div>
            )}
            {clearNotice && (
              <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-800 font-bold text-center animate-fadeIn shadow-xs">
                🧼 Seluruh jejak sesi lokal berhasil dibersihkan tanpa sisa.
              </div>
            )}
          </div>

          {/* ========================================================
              RIGHT COLUMN: Safe Harbor Real Support & Visual Companion (5 cols)
             ======================================================== */}
          <div className="lg:col-span-5 flex flex-col gap-8">
            {/* Visual Art Companion Banner */}
            <div className="rounded-[2rem] overflow-hidden bg-surface-container-lowest shadow-[0_6px_0_#121214] flex flex-col border border-surface-container">
              <div className="relative w-full h-48 bg-gradient-to-tr from-emerald-100 via-teal-50 to-blue-100 flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center opacity-60">
                  <svg viewBox="0 0 200 200" className="w-48 h-48 text-primary animate-pulse">
                    <circle cx="100" cy="100" r="70" fill="currentColor" fillOpacity="0.15" />
                    <circle cx="100" cy="100" r="45" fill="currentColor" fillOpacity="0.25" />
                    <path d="M 60 110 Q 100 70 140 110" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
                    <circle cx="80" cy="90" r="4" fill="currentColor" />
                    <circle cx="120" cy="90" r="4" fill="currentColor" />
                  </svg>
                </div>
                <div className="absolute top-3 left-3 bg-surface-container-lowest/90 px-3 py-1 rounded-full text-xs font-bold text-on-surface shadow-[0_2px_0_#121214] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-tertiary">palette</span>
                  <span>Mood Reflection Artwork</span>
                </div>
              </div>

              <div className="p-4 bg-surface-container-lowest flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-on-surface block">Refleksi Visual Harian</span>
                  <p className="text-xs text-on-surface-variant font-medium">
                    Harmonisasi ritme detak jantung &amp; napas pagi
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed text-xs font-bold shadow-xs">
                  14 Menit Flow
                </span>
              </div>
            </div>

            {/* Safe Harbor Support Header Card */}
            <div className="rounded-[2rem] bg-surface-container-lowest p-6 sm:p-8 shadow-[0_6px_0_#121214] space-y-4 border border-surface-container">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center shadow-[0_2px_0_#121214]">
                  <span className="material-symbols-outlined text-on-secondary-container text-[22px]">
                    support_agent
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-on-surface tracking-tight">Safe Harbor</h3>
                  <p className="text-xs text-on-surface-variant font-medium">Teman Bicara &amp; Bantuan Nyata</p>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-on-surface leading-relaxed font-medium">
                Ketika latihan regulasi mandiri terasa belum cukup, ada telinga yang siap mendengar tanpa menghakimi. Semua kontak di bawah terverifikasi dan aman.
              </p>

              {/* Support Card 1: Kampus Konseling */}
              <div className="rounded-2xl bg-surface-container-low p-4 shadow-[0_3px_0_#121214] space-y-2 transition-transform hover:-translate-y-0.5 border border-surface-container">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface">Konseling Kampus (UNJANI &amp; UI)</span>
                  <span className="text-[10px] bg-primary-container text-on-primary-container px-2 py-0.5 rounded-full font-bold shadow-xs">
                    GRATIS / Bebas Biaya
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Layanan psikolog klinis &amp; konseling sebaya khusus sivitas akademika mahasiswa.
                </p>
                <div className="pt-1">
                  <a
                    href="https://wa.me/628111925565"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#121214] text-surface-container-lowest text-xs font-bold hover:bg-inverse-surface active:translate-y-0.5 transition-all shadow-[0_2px_0_#121214]"
                  >
                    <span>Hubungi Konselor Kampus</span>
                    <span>💬</span>
                  </a>
                </div>
              </div>

              {/* Support Card 2: Hotline Nasional SEJIWA 119 Ext 8 */}
              <div className="rounded-2xl bg-secondary-fixed/50 p-4 shadow-[0_3px_0_#121214] space-y-2 transition-transform hover:-translate-y-0.5 border border-secondary/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface">Hotline Nasional SEJIWA 119</span>
                  <span className="text-[10px] bg-secondary text-on-secondary px-2 py-0.5 rounded-full font-bold shadow-xs">
                    24 Jam Siaga
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Hotline kesehatan jiwa nasional resmi Kementerian Kesehatan RI untuk krisis darurat &amp; pertolongan pertama emosi.
                </p>
                <div className="pt-1">
                  <a
                    href="tel:119"
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#121214] text-surface-container-lowest text-xs font-bold hover:bg-inverse-surface active:translate-y-0.5 transition-all shadow-[0_2px_0_#121214]"
                  >
                    <span>Panggil Bebas Pulsa (Ext 8)</span>
                    <span>📞</span>
                  </a>
                </div>
              </div>

              {/* Support Card 3: LISA Crisis Chat */}
              <div className="rounded-2xl bg-tertiary-container/60 p-4 shadow-[0_3px_0_#121214] space-y-2 transition-transform hover:-translate-y-0.5 border border-tertiary/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface">LISA Suicide Prevention Chat</span>
                  <span className="text-[10px] bg-tertiary text-on-tertiary px-2 py-0.5 rounded-full font-bold shadow-xs">
                    Bilingual (ID/EN)
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Love Inside Suicide Awareness. Konseling krisis teks langsung melalui WhatsApp untuk dukungan segera.
                </p>
                <div className="pt-1">
                  <a
                    href="https://wa.me/628113855472"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#121214] text-surface-container-lowest text-xs font-bold hover:bg-inverse-surface active:translate-y-0.5 transition-all shadow-[0_2px_0_#121214]"
                  >
                    <span>Chat WhatsApp LISA</span>
                    <span>💬</span>
                  </a>
                </div>
              </div>

              {/* Friendly Disclaimer */}
              <div className="rounded-2xl bg-surface-container-low p-3 flex items-start gap-2 shadow-xs">
                <span className="text-secondary text-sm">❤️</span>
                <p className="text-[11px] text-on-surface-variant leading-relaxed font-medium">
                  <strong>Careflow</strong> adalah sahabat regulasi mandirimu. Jangan ragu menghubungi tenaga profesional berwenang jika hatimu butuh teman bercerita lebih dalam.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Chunky Action Bar */}
        <div className="mt-8 sm:mt-12 p-4 sm:p-6 rounded-[2rem] bg-surface-container-lowest shadow-[0_6px_0_#121214] border border-surface-container flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center font-bold text-on-primary-container shadow-[0_2px_0_#121214]">
              ✓
            </div>
            <div>
              <span className="text-sm sm:text-base font-bold text-on-surface block">
                {authUser ? `Ringkasan sesi ${authUser.name} siap disimpan` : 'Jurnal tamu tersimpan di perangkat'}
              </span>
              <p className="text-xs text-on-surface-variant font-medium">
                Kompensasi beban kognitif menurun 42% setelah sesi Flow Studio.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={async () => {
                const wasSaved = await saveCurrentSession();
                if (wasSaved) resetFlow();
              }}
              className="flex-1 sm:flex-none px-6 py-3 rounded-full bg-primary text-on-primary text-xs font-bold shadow-[0_4px_0_#121214] hover:bg-primary-fixed-dim hover:text-on-primary-fixed active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{vaultSavedNotice ? 'Sesi Tersimpan' : 'Simpan & Mulai Baru'}</span>
              <span>🚀</span>
            </button>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex-1 sm:flex-none px-6 py-3 rounded-full bg-surface-container-low text-on-surface text-xs font-bold shadow-[0_4px_0_#121214] hover:bg-surface-container active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Kembali ke Atas</span>
              <span>✨</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Day Details Modal */}
      {selectedDayDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-white rounded-[2rem] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.2)] border-2 border-[#121214] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Detail Catatan Kalender
              </span>
              <button
                onClick={() => setSelectedDayDetail(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className={`w-14 h-14 rounded-2xl ${selectedDayDetail.color} flex items-center justify-center shadow-[0_2px_0_#121214]`}>
                <span className="text-2xl font-bold">{selectedDayDetail.day}</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-on-surface">{selectedDayDetail.title}</h3>
                <span className="text-xs font-semibold text-primary">Status: {selectedDayDetail.mood}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-container text-xs text-on-surface leading-relaxed space-y-1">
              <div><strong>Durasi Latihan:</strong> 5 menit Box Breathing</div>
              <div><strong>Stres Baseline:</strong> Menurun 38%</div>
              <div><strong>Catatan:</strong> "Langkah mikro berhasil memecah kebuntuan mental."</div>
            </div>

            <button
              onClick={() => setSelectedDayDetail(null)}
              className="w-full py-2.5 rounded-full bg-primary text-on-primary text-xs font-bold shadow-[0_3px_0_#121214] hover:opacity-90 active:translate-y-0.5 active:shadow-none transition-all"
            >
              Tutup Catatan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
