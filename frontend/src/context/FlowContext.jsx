import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { audioEngine } from '../utils/audioEngine';
import { sliceTaskWithHybridFallback } from '../utils/taskSlicer';
import { loadDecryptedVault, purgeVault, saveReflectionToVault } from '../utils/cryptoVault';

const FlowContext = createContext(null);
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
const TOKEN_KEY = 'careflow_session_token';
const GUEST_KEY = 'careflow_guest_mode';

// Returns today's date ("YYYY-MM-DD") in the Asia/Jakarta timezone, matching
// the backend's daily-metric/streak day boundary so "once per day" limits
// line up between client and server.
function jakartaToday() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

function sessionToVaultEntry(session) {
  return {
    ...session,
    date: new Date(session.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
    completedTasksCount: session.completedTasksCount,
    xpEarned: session.totalXp,
    isEncrypted: false,
  };
}

export function FlowProvider({ children }) {
  const [step, setStep] = useState(1);
  const [selectedMood, setSelectedMood] = useState('Happy');
  const [selectedMascot, setSelectedMascot] = useState('Gentle');
  const [streakDays, setStreakDays] = useState(0);
  const [streakPopup, setStreakPopup] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [guestAllowed, setGuestAllowed] = useState(false);
  const [authError, setAuthError] = useState('');

  const [triageData, setTriageData] = useState({ content: '', tag: 'Tugas Menumpuk 📚', panicLevel: 3 });
  const [activeSound, setActiveSound] = useState(null);
  const [masterVolume, setMasterVolume] = useState(0.65);
  const [microTasks, setMicroTasks] = useState([
    { id: 'task-1', action: 'Buka lembar kerja & beri judul sederhana', duration: '2 menit', guidance: 'Mulai saja dari halaman yang masih kosong.', completed: false, xp: 10 },
    { id: 'task-2', action: 'Tulis 3 poin kasar tanpa mengejar sempurna', duration: '3 menit', guidance: 'Biar belum rapi; yang penting ada pijakan.', completed: false, xp: 20 },
    { id: 'task-3', action: 'Minum air dan regangkan leher', duration: '2 menit', guidance: 'Rehat fisik singkat juga merupakan progres.', completed: false, xp: 15 },
  ]);
  const [affirmation, setAffirmation] = useState('Tenangkan pikiranmu, cukup selesaikan langkah pertama.');
  const [isProcessingSlice, setIsProcessingSlice] = useState(false);
  const [totalXp, setTotalXp] = useState(0);
  const [vaultEntries, setVaultEntries] = useState([]);
  const [isVaultLoading, setIsVaultLoading] = useState(false);
  const [vaultSavedNotice, setVaultSavedNotice] = useState(false);
  const [todayMetric, setTodayMetric] = useState(null);
  const [weeklyMetrics, setWeeklyMetrics] = useState([]);
  // Real timestamps of each completed micro-task this session, used to plot
  // an honest "focus activity" chart instead of hardcoded fake data.
  // taskCompletionLog covers the current browser session (works for guests
  // too); weeklyTaskCompletions is hydrated from the server for logged-in
  // users so the chart spans the last 7 days, not just this session.
  const [taskCompletionLog, setTaskCompletionLog] = useState([]);
  const [weeklyTaskCompletions, setWeeklyTaskCompletions] = useState([]);
  // Lifetime total XP persisted server-side (SUM of every task_completions
  // row for this user). Unlike totalXp (per-session, resets on reload),
  // this is what the Flow Studio Level badge is based on so it survives
  // logout/reload.
  const [lifetimeXp, setLifetimeXp] = useState(0);
  const activeMissionIndex = microTasks.findIndex((task) => !task.completed);

  const hasSavedToday = useMemo(() => {
    const today = new Date().toDateString();
    return vaultEntries.some((entry) => {
      const entryDate = entry.createdAt || entry.timestamp;
      return entryDate && new Date(entryDate).toDateString() === today;
    });
  }, [vaultEntries]);

  // The Daily Mood Triage "Yes or No Quiz" (sleep check-in + stress questions)
  // may only be filled in once per calendar day, mirroring the Daily Pulse rule.
  const GUEST_QUIZ_KEY = 'careflow_guest_quiz_date';

  const token = () => sessionStorage.getItem(TOKEN_KEY);

  const quizLoggedToday = useMemo(() => {
    const today = jakartaToday();
    if (token()) return todayMetric?.metricDate === today && todayMetric?.stressScore != null;
    return localStorage.getItem(GUEST_QUIZ_KEY) === today;
  }, [todayMetric]);

  const request = async (path, options = {}) => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}), ...options.headers },
    });
    const payload = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error || 'Permintaan tidak dapat diproses.');
    return payload;
  };

  const applyStreak = (nextStreak) => {
    setStreakDays((previousStreak) => {
      if (nextStreak > previousStreak) setStreakPopup(nextStreak);
      return nextStreak;
    });
  };

  const refreshStoredSessions = async () => {
    setIsVaultLoading(true);
    try {
      if (token()) {
        const profile = await request('/sessions');
        setVaultEntries((profile.sessions || []).map(sessionToVaultEntry));
        applyStreak(profile.streakDays || 0);
        setLifetimeXp(profile.lifetimeXp || 0);
        setAuthUser((current) => (current ? { ...current, ...profile } : current));
      } else {
        setVaultEntries(await loadDecryptedVault());
      }
    } finally {
      setIsVaultLoading(false);
    }
  };

  // Loads up to the last 30 days of sleep/stress rows so the Yes/No Quiz can
  // be locked once today's entry is complete, so the weekly average can be
  // shown on the Weekly Mood Triage Matrix, and so the Mood Garden's Monthly
  // Mood Summary (sleep/stress/streak) has real data for the current month.
  const refreshTodayMetric = async () => {
    if (!token()) {
      setTodayMetric(null);
      setWeeklyMetrics([]);
      return;
    }
    try {
      const { metrics } = await request('/metrics/daily');
      const today = jakartaToday();
      setWeeklyMetrics(metrics || []);
      setTodayMetric((metrics || []).find((metric) => metric.metricDate === today) || null);
    } catch {
      setTodayMetric(null);
      setWeeklyMetrics([]);
    }
  };

  // Loads the last 7 days of real task-completion timestamps for the
  // "Focus Activity This Week" chart in Flow Studio.
  const refreshWeeklyTaskCompletions = async () => {
    if (!token()) {
      setWeeklyTaskCompletions([]);
      return;
    }
    try {
      const { completions } = await request('/task-completions');
      setWeeklyTaskCompletions(completions || []);
    } catch {
      setWeeklyTaskCompletions([]);
    }
  };

  useEffect(() => {
    let mounted = true;
    const restoreSession = async () => {
      const currentToken = token();
      if (!currentToken) {
        if (mounted) setGuestAllowed(sessionStorage.getItem(GUEST_KEY) === 'true');
        if (mounted) setIsAuthLoading(false);
        return;
      }
      try {
        const profile = await request('/auth/me');
        if (mounted) {
          setAuthUser(profile);
          setStreakDays(profile.streakDays || 0);
          setLifetimeXp(profile.lifetimeXp || 0);
          setGuestAllowed(false);
        }
      } catch {
        sessionStorage.removeItem(TOKEN_KEY);
      } finally {
        if (mounted) setIsAuthLoading(false);
      }
    };
    void restoreSession();
    return () => {
      mounted = false;
      audioEngine.stop();
    };
  }, []);

  useEffect(() => {
    if (!isAuthLoading && (authUser || guestAllowed)) {
      void refreshStoredSessions();
      void refreshTodayMetric();
      void refreshWeeklyTaskCompletions();
    }
  }, [isAuthLoading, authUser?.id, guestAllowed]);

  const authenticate = async (mode, form) => {
    setAuthError('');
    const result = await request(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(form) });
    sessionStorage.setItem(TOKEN_KEY, result.token);
    sessionStorage.removeItem(GUEST_KEY);
    setTodayMetric(null);
    setWeeklyMetrics([]);
    setWeeklyTaskCompletions([]);
    setLifetimeXp(result.user?.lifetimeXp || 0);
    setAuthUser({ ...result.user, streakDays: result.streakDays || 0 });
    setStreakDays(result.streakDays || 0);
    setGuestAllowed(false);
    return result;
  };

  const continueAsGuest = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.setItem(GUEST_KEY, 'true');
    setTodayMetric(null);
    setWeeklyMetrics([]);
    setWeeklyTaskCompletions([]);
    setLifetimeXp(0);
    setAuthUser(null);
    setStreakDays(0);
    setGuestAllowed(true);
    setAuthError('');
  };

  const startLogin = () => {
    setGuestAllowed(false);
    sessionStorage.removeItem(GUEST_KEY);
  };

  const logout = async () => {
    try {
      if (token()) await request('/auth/logout', { method: 'POST' });
    } catch {
      // Local cleanup still safely ends this browser session.
    }
    sessionStorage.removeItem(TOKEN_KEY);
    setTodayMetric(null);
    setWeeklyMetrics([]);
    setWeeklyTaskCompletions([]);
    setLifetimeXp(0);
    setAuthUser(null);
    setStreakDays(0);
    setGuestAllowed(false);
    setVaultEntries([]);
    setStep(1);
  };

  const toggleSoundscape = (mode = 'rain') => {
    const isNowPlaying = audioEngine.playMode(mode);
    setActiveSound(isNowPlaying ? mode : null);
    if (isNowPlaying) audioEngine.setVolume(masterVolume);
  };

  const handleVolumeChange = (value) => {
    const nextVolume = Math.max(0, Math.min(1, value));
    setMasterVolume(nextVolume);
    audioEngine.setVolume(nextVolume);
  };

  const processTriage = async (options = {}) => {
    const { shareWithPsychologist = false } = options;
    setIsProcessingSlice(true);
    try {
      const result = await sliceTaskWithHybridFallback(triageData.content, triageData.tag, triageData.panicLevel);
      if (result.affirmation) setAffirmation(result.affirmation);
      if (result.tasks?.length >= 3) {
        setMicroTasks(result.tasks.slice(0, 3).map((task, index) => ({ ...task, completed: false, xp: [10, 20, 15][index] })));
        setTotalXp(0);
      }
      if (token()) {
        try {
          await request('/declutter', {
            method: 'POST',
            body: JSON.stringify({ content: triageData.content, tag: triageData.tag, panicLevel: triageData.panicLevel, shareWithPsychologist }),
          });
        } catch {
          // Cognitive de-clutter logging is best-effort; it must not block the triage flow.
        }
      }
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsProcessingSlice(false);
    }
  };

  const toggleTaskDone = (taskId) => {
    // IMPORTANT: the updater function passed to setMicroTasks must stay pure
    // (no side effects). React StrictMode intentionally invokes state
    // updater functions twice in development to catch impurities — if XP
    // awarding, API calls, or confetti live inside the updater, they get
    // double-invoked too (this was the root cause of XP being awarded 2x).
    const activeTask = microTasks.find((task) => !task.completed);
    if (!activeTask || activeTask.id !== taskId) return;

    setMicroTasks((previous) => previous.map((task) => task.id === taskId ? { ...task, completed: true } : task));

    const xpEarned = activeTask.xp || 15;
    setTotalXp((xp) => xp + xpEarned);
    const completedAt = new Date().toISOString();
    setTaskCompletionLog((log) => [...log, { taskId, xp: xpEarned, completedAt }]);
    if (token()) {
      request('/task-completions', { method: 'POST', body: JSON.stringify({ xp: xpEarned }) })
        .then((completion) => {
          if (completion) {
            setWeeklyTaskCompletions((previousCompletions) => [...previousCompletions, completion]);
            setLifetimeXp((xp) => xp + xpEarned);
          }
        })
        .catch(() => {
          // Best-effort: the local chart still works from taskCompletionLog even if this fails.
        });
    }
    try {
      confetti({ particleCount: 35, spread: 55, origin: { y: 0.7 }, colors: ['#2c6b27', '#b8ffa9', '#fec5a7'] });
    } catch {
      // Confetti is only decorative; completing the task must still work.
    }
  };

  const sliceTaskSmaller = (taskId) => {
    setMicroTasks((previous) => previous.map((task) => task.id === taskId ? {
      ...task,
      action: `Mulai dengan satu kata: ${task.action.slice(0, 36)}`,
      duration: '1 menit',
      guidance: 'Fokus hanya pada 60 detik pertama. Kamu belum perlu memikirkan langkah setelahnya.',
    } : task));
  };

  // Kembalikan semua misi ke status belum selesai (dipakai saat memulai putaran misi 5 menit yang baru)
  const resetMicroTasks = () => {
    setMicroTasks((previous) => previous.map((task) => ({ ...task, completed: false })));
  };

  const addCustomMicroAction = (action) => {
    const cleanAction = action.trim();
    if (!cleanAction) return false;
    setMicroTasks((previous) => {
      const next = [...previous];
      const replaceAt = next.findIndex((task) => !task.completed);
      next[replaceAt === -1 ? next.length - 1 : replaceAt] = { id: `custom-${Date.now()}`, action: cleanAction, duration: '2 menit', guidance: 'Tugas pilihanmu sudah menjadi misi aktif. Mulai dari langkah paling kecil.', completed: false, xp: 10 };
      return next;
    });
    return true;
  };

  // Persists today's sleep duration immediately (independent of "Simpan Sesi"),
  // so the value is safely stored in daily_metrics as soon as the user logs it.
  const upsertWeeklyMetric = (metric) => {
    setWeeklyMetrics((previous) => {
      const others = previous.filter((entry) => entry.metricDate !== metric.metricDate);
      return [metric, ...others];
    });
  };

  const logSleepHours = async (hours) => {
    if (token()) {
      const metric = await request('/metrics/daily', { method: 'POST', body: JSON.stringify({ sleepHours: hours }) });
      setTodayMetric((current) => (current ? { ...current, ...metric } : metric));
      upsertWeeklyMetric(metric);
    } else {
      localStorage.setItem(GUEST_QUIZ_KEY, jakartaToday());
    }
  };

  // Persists today's quiz-derived stress indicator immediately once the
  // Yes/No Quiz is completed.
  const logQuizStress = async (score, label) => {
    if (token()) {
      const metric = await request('/metrics/daily', { method: 'POST', body: JSON.stringify({ stressScore: score, stressLabel: label }) });
      setTodayMetric((current) => (current ? { ...current, ...metric } : metric));
      upsertWeeklyMetric(metric);
    } else {
      localStorage.setItem(GUEST_QUIZ_KEY, jakartaToday());
    }
  };

  const saveCurrentSession = async () => {
    if (hasSavedToday) {
      setAuthError('Daily Pulse hari ini sudah tersimpan. Coba lagi besok, ya.');
      return false;
    }
    const entry = {
      mood: selectedMood,
      mascot: selectedMascot,
      completedTasksCount: microTasks.filter((task) => task.completed).length,
      totalXp,
    };
    try {
      if (token()) {
        await request('/sessions', { method: 'POST', body: JSON.stringify(entry) });
        await refreshStoredSessions();
      } else {
        await saveReflectionToVault({
          ...entry,
          xpEarned: totalXp,
          date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
          reflection: 'Sesi tamu Careflow tersimpan di perangkat ini.',
        });
        await refreshStoredSessions();
      }
      setVaultSavedNotice(true);
      window.setTimeout(() => setVaultSavedNotice(false), 3500);
      return true;
    } catch (error) {
      setAuthError(error.message);
      return false;
    }
  };

  const clearAllVault = async () => {
    if (token()) return;
    purgeVault();
    setVaultEntries([]);
  };

  const resetFlow = () => {
    setTriageData({ content: '', tag: 'Tugas Menumpuk 📚', panicLevel: 3 });
    setMicroTasks((previous) => previous.map((task) => ({ ...task, completed: false })));
    setTotalXp(0);
    setStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const value = useMemo(() => ({
    step, setStep, selectedMood, setSelectedMood, selectedMascot, setSelectedMascot,
    streakDays, streakPopup, dismissStreakPopup: () => setStreakPopup(null), authUser, isAuthLoading, guestAllowed, authError, setAuthError,
    authenticate, continueAsGuest, startLogin, logout,
    triageData, setTriageData, processTriage, isProcessingSlice,
    activeSound, toggleSoundscape, masterVolume, handleVolumeChange,
    microTasks, activeMissionIndex, toggleTaskDone, sliceTaskSmaller, resetMicroTasks, addCustomMicroAction, affirmation, totalXp, taskCompletionLog, weeklyTaskCompletions, lifetimeXp,
    vaultEntries, isVaultLoading, vaultSavedNotice, hasSavedToday, saveCurrentSession, clearAllVault,
    quizLoggedToday, todayMetric, weeklyMetrics, logSleepHours, logQuizStress,
    resetFlow,
  }), [step, selectedMood, selectedMascot, streakDays, streakPopup, authUser, isAuthLoading, guestAllowed, authError, triageData, isProcessingSlice, activeSound, masterVolume, microTasks, affirmation, totalXp, taskCompletionLog, weeklyTaskCompletions, lifetimeXp, vaultEntries, isVaultLoading, vaultSavedNotice, hasSavedToday, quizLoggedToday, todayMetric, weeklyMetrics]);

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}

export function useFlow() {
  const context = useContext(FlowContext);
  if (!context) throw new Error('useFlow must be used within FlowProvider');
  return context;
}
