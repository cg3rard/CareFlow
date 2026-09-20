import { useState } from 'react';
import { useFlow } from '../../context/FlowContext';

export default function SafeHarbor() {
  const {
    selectedMood,
    streakDays,
    authUser,
    vaultEntries,
    weeklyMetrics,
    saveCurrentSession,
    vaultSavedNotice,
    resetFlow,
  } = useFlow();

  // Interactive Day Modal State
  const [selectedDayDetail, setSelectedDayDetail] = useState(null);

  const MOOD_STYLES = {
    Happy: { bg: 'bg-primary-container', textColor: 'text-primary', label: 'Happy' },
    Excited: { bg: 'bg-[#ffeb99]', textColor: 'text-[#634e00]', label: 'Excited' },
    Sleepy: { bg: 'bg-[#cde5ff]', textColor: 'text-[#1b3d63]', label: 'Sleepy' },
    Bored: { bg: 'bg-[#ffd8e7]', textColor: 'text-[#6b254a]', label: 'Bored' },
    Angry: { bg: 'bg-[#fec5a7]', textColor: 'text-[#7a5038]', label: 'Angry' },
  };
  const getMoodStyle = (mood) => MOOD_STYLES[mood] || MOOD_STYLES.Happy;

  // The calendar shows September 2026 (the app's current month), built from
  // real Daily Pulse mood entries (vaultEntries) instead of hardcoded data.
  const CALENDAR_YEAR = 2026;
  const CALENDAR_MONTH = 8; // 0-indexed: August=7, September=8
  const monthMoodByDay = (() => {
    const byDay = new Map();
    vaultEntries.forEach((entry) => {
      const entryDate = entry.createdAt ? new Date(entry.createdAt) : (entry.date ? new Date(entry.date) : null);
      if (!entryDate || Number.isNaN(entryDate.getTime())) return;
      if (entryDate.getFullYear() !== CALENDAR_YEAR || entryDate.getMonth() !== CALENDAR_MONTH) return;
      const day = entryDate.getDate();
      // Last entry recorded for a given day wins (most recent mood that day).
      byDay.set(day, { mood: entry.mood, entry });
    });
    return byDay;
  })();
  const moodCountsThisMonth = (() => {
    const counts = {};
    monthMoodByDay.forEach(({ mood }) => {
      const label = getMoodStyle(mood).label;
      counts[label] = (counts[label] || 0) + 1;
    });
    return counts;
  })();

  // Monthly Mood Summary: real sleep duration & stress level averages for
  // the current month (from weeklyMetrics, which now covers up to 30 days),
  // plus the real current streak — replacing the old hardcoded
  // Activity/Therapy/Discipline metrics.
  const monthlySleepSamples = weeklyMetrics.filter((m) => m.sleepHours != null).map((m) => m.sleepHours);
  const monthlyAverageSleep = monthlySleepSamples.length > 0
    ? Math.round((monthlySleepSamples.reduce((sum, v) => sum + v, 0) / monthlySleepSamples.length) * 10) / 10
    : null;
  const monthlyStressSamples = weeklyMetrics.filter((m) => m.stressScore != null).map((m) => m.stressScore);
  const monthlyAverageStress = monthlyStressSamples.length > 0
    ? Math.round(monthlyStressSamples.reduce((sum, v) => sum + v, 0) / monthlyStressSamples.length)
    : null;
  const stressLevelText = monthlyAverageStress == null ? '—' : monthlyAverageStress >= 70 ? 'Tinggi' : monthlyAverageStress >= 40 ? 'Sedang' : 'Ringan';

  const openDay = (day, moodEntry) => {
    const style = getMoodStyle(moodEntry?.mood);
    setSelectedDayDetail({
      day,
      title: moodEntry ? `Mood tercatat: ${style.label}` : 'Belum ada catatan mood',
      mood: moodEntry?.mood || null,
      color: style.bg,
      entry: moodEntry?.entry || null,
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
                  Monthly Mood Summary • September 2026
                </span>
                <div className="flex items-center gap-2">
                  <h2 className="text-3xl sm:text-5xl font-bold text-on-surface tracking-tight">
                    {selectedMood} 🌿
                  </h2>
                </div>
                <p className="text-sm sm:text-base text-on-surface mt-2 font-medium leading-relaxed">
                  Ringkasan tidur, tingkat stres, dan streak-mu bulan ini, berdasarkan data yang kamu isi sendiri di Daily Pulse.
                </p>

                {/* 3 Micro Metric Cards: real Sleep Duration, Stress Level, and Streak */}
                <div className="grid grid-cols-3 gap-3 mt-6 pt-1">
                  <div className="bg-surface-container-lowest/90 p-3.5 rounded-2xl shadow-[0_3px_0_#121214] flex flex-col justify-between hover:scale-105 transition-transform cursor-pointer">
                    <span className="text-[10px] text-on-surface-variant uppercase font-bold">Sleep Duration</span>
                    <span className="text-base sm:text-lg font-bold text-on-surface mt-1">{monthlyAverageSleep != null ? `${monthlyAverageSleep} jam` : '—'}</span>
                    <span className="text-xs text-primary font-semibold">Rata-rata 😴</span>
                  </div>
                  <div className="bg-surface-container-lowest/90 p-3.5 rounded-2xl shadow-[0_3px_0_#121214] flex flex-col justify-between hover:scale-105 transition-transform cursor-pointer">
                    <span className="text-[10px] text-on-surface-variant uppercase font-bold">Stress Level</span>
                    <span className="text-base sm:text-lg font-bold text-on-surface mt-1">{monthlyAverageStress != null ? monthlyAverageStress : '—'}</span>
                    <span className="text-xs text-secondary font-semibold">{stressLevelText} 🧠</span>
                  </div>
                  <div className="bg-surface-container-lowest/90 p-3.5 rounded-2xl shadow-[0_3px_0_#121214] flex flex-col justify-between hover:scale-105 transition-transform cursor-pointer">
                    <span className="text-[10px] text-on-surface-variant uppercase font-bold">Streak</span>
                    <span className="text-base sm:text-lg font-bold text-on-surface mt-1">{streakDays} hari</span>
                    <span className="text-xs text-tertiary font-semibold">Beruntun 🔥</span>
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
                  <p className="text-xs text-on-surface-variant font-medium">September 2026 • Klik tanggal untuk lihat detail!</p>
                </div>
                <div className="flex items-center gap-1.5 bg-surface-container-low p-1 rounded-full shadow-[0_2px_0_#121214]">
                  <button className="w-8 h-8 rounded-full bg-surface-container-lowest flex items-center justify-center hover:bg-surface transition-colors cursor-not-allowed opacity-50" title="Bulan Sebelumnya" disabled>
                    <span className="material-symbols-outlined text-on-surface text-[18px]">chevron_left</span>
                  </button>
                  <span className="text-xs font-bold text-on-surface px-2">Sep 2026</span>
                  <button className="w-8 h-8 rounded-full bg-surface-container-lowest flex items-center justify-center hover:bg-surface transition-colors cursor-not-allowed opacity-50" title="Bulan Berikutnya" disabled>
                    <span className="material-symbols-outlined text-on-surface text-[18px]">chevron_right</span>
                  </button>
                </div>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 text-center text-xs text-on-surface-variant font-bold pb-1">
                <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
              </div>

              {/* Calendar Tile Grid built from real Daily Pulse mood entries (vaultEntries) */}
              <div className="grid grid-cols-7 gap-2">
                {(() => {
                  const firstWeekday = new Date(CALENDAR_YEAR, CALENDAR_MONTH, 1).getDay();
                  const daysInMonth = new Date(CALENDAR_YEAR, CALENDAR_MONTH + 1, 0).getDate();
                  const todayReal = new Date();
                  const isCurrentMonth = todayReal.getFullYear() === CALENDAR_YEAR && todayReal.getMonth() === CALENDAR_MONTH;
                  const todayDate = isCurrentMonth ? todayReal.getDate() : null;
                  const cells = [];
                  for (let i = 0; i < firstWeekday; i++) cells.push(null);
                  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

                  return cells.map((day, index) => {
                    if (day == null) {
                      return (
                        <div key={`empty-${index}`} className="aspect-square rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface-variant/40 text-xs font-bold opacity-60">
                          <span>—</span>
                        </div>
                      );
                    }
                    const moodData = monthMoodByDay.get(day);
                    const style = getMoodStyle(moodData?.mood);
                    const isToday = day === todayDate;
                    return (
                      <div
                        key={day}
                        onClick={() => openDay(day, moodData)}
                        className={`group aspect-square rounded-xl flex flex-col items-center justify-center shadow-[0_2px_0_#121214] hover:scale-110 active:scale-95 transition-transform cursor-pointer ${
                          moodData ? style.bg : 'bg-surface-container-low'
                        } ${isToday ? 'ring-3 ring-[#121214]' : ''}`}
                        title={`${day} Sep${isToday ? ' (Hari ini)' : ''}: ${moodData ? `Mood ${style.label}` : 'Belum ada catatan'}`}
                      >
                        {moodData ? (
                          <span className="material-symbols-outlined text-[18px]" style={{ color: '#121214' }}>
                            {moodData.mood === 'Happy' ? 'sentiment_very_satisfied'
                              : moodData.mood === 'Angry' ? 'sentiment_very_dissatisfied'
                              : moodData.mood === 'Sleepy' ? 'bedtime'
                              : moodData.mood === 'Bored' ? 'sentiment_neutral'
                              : 'mood'}
                          </span>
                        ) : (
                          <span className="text-on-surface-variant/50 text-xs">·</span>
                        )}
                        <span className={`text-[9px] font-bold ${moodData ? style.textColor : 'text-on-surface-variant/50'}`}>{day}</span>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Color Mood Legend: real counts from this month's Daily Pulse entries */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-surface-container text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-primary-container border border-[#121214]/20"></span>
                  <span className="text-on-surface font-medium">Happy ({moodCountsThisMonth.Happy || 0})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#fec5a7] border border-[#121214]/20"></span>
                  <span className="text-on-surface font-medium">Angry ({moodCountsThisMonth.Angry || 0})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#cde5ff] border border-[#121214]/20"></span>
                  <span className="text-on-surface font-medium">Sleepy ({moodCountsThisMonth.Sleepy || 0})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#ffd8e7] border border-[#121214]/20"></span>
                  <span className="text-on-surface font-medium">Bored ({moodCountsThisMonth.Bored || 0})</span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================
              RIGHT COLUMN: Safe Harbor Real Support & Visual Companion (5 cols)
             ======================================================== */}
          <div className="lg:col-span-5 flex flex-col gap-8">

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
