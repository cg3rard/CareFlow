import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { audioEngine } from '../utils/audioEngine';
import { sliceTaskWithHybridFallback } from '../utils/taskSlicer';
import { loadDecryptedVault, purgeVault, saveReflectionToVault } from '../utils/cryptoVault';

const FlowContext = createContext(null);
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
const TOKEN_KEY = 'careflow_session_token';
const GUEST_KEY = 'careflow_guest_mode';

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
  const [step, setStep] = useState(() => window.location.pathname.startsWith('/community') ? 'community' : 1);
  const [selectedMood, setSelectedMood] = useState('Happy');
  const [selectedMascot, setSelectedMascot] = useState('Gentle');
  const [streakDays, setStreakDays] = useState(0);
  const [streakPopup, setStreakPopup] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [guestAllowed, setGuestAllowed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [consultationModalOpen, setConsultationModalOpen] = useState(false);
  const [consentChoice, setConsentChoice] = useState(null);
  const [psychologists, setPsychologists] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatAvailableDates, setChatAvailableDates] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [psychologistClients, setPsychologistClients] = useState([]);
  const [clientData, setClientData] = useState(null);
  const [communityPosts, setCommunityPosts] = useState([]);
  const [communityActivity, setCommunityActivity] = useState(null);
  const [brainDumpOutcome, setBrainDumpOutcome] = useState(null);
  const chatSocketRef = useRef(null);

  const [triageData, setTriageData] = useState({ content: '', tag: 'Tasks Piling Up 📚', panicLevel: 3 });
  const [activeSound, setActiveSound] = useState(null);
  const [masterVolume, setMasterVolume] = useState(0.65);
  const [microTasks, setMicroTasks] = useState([
    { id: 'task-1', action: 'Open your worksheet & give it a simple title', duration: '2 minutes', guidance: 'Just start from a blank page.', completed: false, xp: 10 },
    { id: 'task-2', action: 'Jot down 3 rough points without chasing perfection', duration: '3 minutes', guidance: 'It doesn\'t need to be tidy yet; what matters is having a foothold.', completed: false, xp: 20 },
    { id: 'task-3', action: 'Drink some water and stretch your neck', duration: '2 minutes', guidance: 'A short physical break counts as progress too.', completed: false, xp: 15 },
  ]);
  const [affirmation, setAffirmation] = useState('Calm your mind, just finish the first step.');
  const [isProcessingSlice, setIsProcessingSlice] = useState(false);
  const [totalXp, setTotalXp] = useState(0);
  const [vaultEntries, setVaultEntries] = useState([]);
  const [isVaultLoading, setIsVaultLoading] = useState(false);
  const [vaultSavedNotice, setVaultSavedNotice] = useState(false);
  const [todayMetric, setTodayMetric] = useState(null);
  const [weeklyMetrics, setWeeklyMetrics] = useState([]);
  const [taskCompletionLog, setTaskCompletionLog] = useState([]);
  const [weeklyTaskCompletions, setWeeklyTaskCompletions] = useState([]);
  const [lifetimeXp, setLifetimeXp] = useState(0);
  const activeMissionIndex = microTasks.findIndex((task) => !task.completed);

  const hasSavedToday = useMemo(() => {
    const today = new Date().toDateString();
    return vaultEntries.some((entry) => {
      const entryDate = entry.createdAt || entry.timestamp;
      return entryDate && new Date(entryDate).toDateString() === today;
    });
  }, [vaultEntries]);

  const GUEST_QUIZ_KEY = 'careflow_guest_quiz_date';

  const token = () => sessionStorage.getItem(TOKEN_KEY);
  const navigateTo = (nextStep) => {
    const nextPath = nextStep === 'community' ? '/community/' : '/';
    if (window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath);
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const openCommunityFeed = (postId) => {
    window.history.pushState({}, '', `/community/feed/${postId}`);
    setStep('community');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const syncPath = () => setStep(window.location.pathname.startsWith('/community') ? 'community' : 1);
    window.addEventListener('popstate', syncPath);
    return () => window.removeEventListener('popstate', syncPath);
  }, []);

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
    if (!response.ok) {
      const error = new Error(payload?.error || 'Your request could not be processed.');
      error.status = response.status;
      throw error;
    }
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
    if (!authUser || !token()) return undefined;
    const socketUrl = `${API_BASE_URL.replace(/^http/, 'ws')}/chat/ws?token=${encodeURIComponent(token())}`;
    const socket = new WebSocket(socketUrl);
    chatSocketRef.current = socket;
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'message' && payload.message) setChatMessages((previous) => previous.some((item) => item.id === payload.message.id) ? previous : [...previous, payload.message]);
        if (payload.type === 'error') setAuthError(payload.error);
      } catch { }
    };
    return () => { socket.close(); if (chatSocketRef.current === socket) chatSocketRef.current = null; };
  }, [authUser?.id]);

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
    setCommunityPosts([]);
    setCommunityActivity(null);
    navigateTo(1);
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

  const processTriage = async () => {
    const shareWithPsychologist = Boolean(authUser?.role === 'user' && authUser?.psychologistId && authUser?.shareDataWithPsychologist);
    let savedBrainDump = null;
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
          savedBrainDump = await request('/declutter', {
            method: 'POST',
            body: JSON.stringify({ content: triageData.content, tag: triageData.tag, panicLevel: triageData.panicLevel, shareWithPsychologist }),
          });
          setBrainDumpOutcome({
            shared: Boolean(savedBrainDump.shareWithPsychologist),
            createdAt: savedBrainDump.createdAt,
          });
        } catch (error) {
          setBrainDumpOutcome(null);
          if (error?.status === 401) {
            sessionStorage.removeItem(TOKEN_KEY);
            setAuthUser(null);
            setAuthError('Your gentle steps are ready, but your session has expired. Please sign in again to save your notes.');
          } else {
            setAuthError('Your gentle steps are ready, but your notes could not be saved yet. Try again once your connection is back.');
          }
        }
      }
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsProcessingSlice(false);
    }
    return savedBrainDump;
  };

  const toggleTaskDone = (taskId) => {
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
        });
    }
    try {
      confetti({ particleCount: 35, spread: 55, origin: { y: 0.7 }, colors: ['#2c6b27', '#b8ffa9', '#fec5a7'] });
    } catch {
    }
  };

  const sliceTaskSmaller = (taskId) => {
    setMicroTasks((previous) => previous.map((task) => task.id === taskId ? {
      ...task,
      action: `Start with one word: ${task.action.slice(0, 36)}`,
      duration: '1 minute',
      guidance: 'Focus only on the first 60 seconds. You don\'t need to think about what comes next yet.',
    } : task));
  };

  const resetMicroTasks = () => {
    setMicroTasks((previous) => previous.map((task) => ({ ...task, completed: false })));
  };

  const addCustomMicroAction = (action) => {
    const cleanAction = action.trim();
    if (!cleanAction) return false;
    setMicroTasks((previous) => {
      const next = [...previous];
      const replaceAt = next.findIndex((task) => !task.completed);
      next[replaceAt === -1 ? next.length - 1 : replaceAt] = { id: `custom-${Date.now()}`, action: cleanAction, duration: '2 minutes', guidance: 'Your chosen task is now the active mission. Start with the smallest step.', completed: false, xp: 10 };
      return next;
    });
    return true;
  };

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
      setAuthError('Today\'s Daily Pulse is already saved. Come back and try again tomorrow.');
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
          reflection: 'Careflow guest session saved on this device.',
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
    setTriageData({ content: '', tag: 'Tasks Piling Up 📚', panicLevel: 3 });
    setBrainDumpOutcome(null);
    setMicroTasks((previous) => previous.map((task) => ({ ...task, completed: false })));
    setTotalXp(0);
    navigateTo(1);
  };

  const loadPsychologists = async () => {
    if (!token()) return;
    try { const result = await request('/psychologists'); setPsychologists(result.psychologists || []); }
    catch (error) { setAuthError(error.message); }
  };

  const openPsychologistFlow = () => {
    if (!authUser) { startLogin(); return; }
    if (authUser.role === 'admin') { navigateTo('admin'); return; }
    if (authUser.role === 'psychologist') { navigateTo('psychologist'); return; }
    navigateTo(3);
    setConsultationModalOpen(true);
  };

  const selectPsychologist = async (psychologistId, shareDataWithPsychologist) => {
    const profile = await request('/psychologists/select', { method: 'POST', body: JSON.stringify({ psychologistId, shareDataWithPsychologist }) });
    setAuthUser(profile);
    setConsentChoice(shareDataWithPsychologist);
    return profile;
  };
  const disconnectPsychologist = async () => {
    const profile = await request('/psychologists/disconnect', { method: 'POST' });
    setAuthUser(profile);
    setChatMessages([]);
    setConsentChoice(null);
    return profile;
  };

  const loadChat = async (withUserId, date = '') => {
    if (!withUserId) {
      setChatMessages([]);
      setChatAvailableDates([]);
      return;
    }
    const query = new URLSearchParams({ withUserId });
    if (date) query.set('date', date);
    const result = await request(`/chat/messages?${query.toString()}`);
    setChatMessages(result.messages || []);
    setChatAvailableDates(result.availableDates || []);
  };

  const sendChat = async (recipientId, content) => {
    if (chatSocketRef.current?.readyState === WebSocket.OPEN) { chatSocketRef.current.send(JSON.stringify({ recipientId, content })); return; }
    const message = await request('/chat/messages', { method: 'POST', body: JSON.stringify({ recipientId, content }) });
    setChatMessages((previous) => [...previous, message]);
    return message;
  };

  const loadAdminUsers = async () => {
    try { const result = await request('/admin/users'); setAdminUsers(result.users || []); }
    catch (error) { setAuthError(error.message); }
  };
  const updateAdminUser = async (userId, patch) => {
    const updated = await request(`/admin/users/${userId}`, { method: 'PATCH', body: JSON.stringify(patch) });
    setAdminUsers((previous) => previous.map((user) => user.id === updated.id ? updated : user));
    return updated;
  };
  const createAdminUser = async (input) => {
    const created = await request('/admin/users', { method: 'POST', body: JSON.stringify(input) });
    setAdminUsers((previous) => [created, ...previous]);
    return created;
  };
  const deleteAdminUser = async (userId) => {
    await request(`/admin/users/${userId}`, { method: 'DELETE' });
    setAdminUsers((previous) => previous.filter((user) => user.id !== userId));
  };
  const loadPsychologistClients = async () => {
    try { const result = await request('/psychologist/clients'); setPsychologistClients(result.clients || []); }
    catch (error) { setAuthError(error.message); }
  };
  const loadClientData = async (clientId) => {
    try { const result = await request(`/psychologist/clients/${clientId}`); setClientData(result); }
    catch (error) { setAuthError(error.message); setClientData(null); }
  };
  const loadCommunity = async () => {
    const result = await request('/community/posts');
    setCommunityPosts(result.posts || []);
    return result.posts || [];
  };
  const loadCommunityPost = async (postId) => request(`/community/posts/${postId}`);
  const createCommunityPost = async (input) => {
    const created = await request('/community/posts', { method: 'POST', body: JSON.stringify(input) });
    await loadCommunity();
    return created;
  };
  const addCommunityComment = async (postId, body) => {
    const created = await request(`/community/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
    await loadCommunity();
    return created;
  };
  const toggleCommunityLike = async (postId) => {
    const result = await request(`/community/posts/${postId}/like`, { method: 'POST' });
    setCommunityPosts((previous) => previous.map((post) => post.id === postId ? { ...post, likedByMe: result.liked, likeCount: Math.max(0, post.likeCount + (result.liked ? 1 : -1)) } : post));
    return result;
  };
  const recordCommunityShare = async (postId) => {
    const result = await request(`/community/posts/${postId}/share`, { method: 'POST' });
    setCommunityPosts((previous) => previous.map((post) => post.id === postId ? { ...post, shareCount: post.shareCount + 1 } : post));
    return result;
  };
  const loadCommunityActivity = async (clientId) => {
    try { const result = await request(`/psychologist/clients/${clientId}/community-activity`); setCommunityActivity(result); return result; }
    catch (error) { setAuthError(error.message); setCommunityActivity(null); return null; }
  };

  const value = useMemo(() => ({
    step, setStep, navigateTo, openCommunityFeed, selectedMood, setSelectedMood, selectedMascot, setSelectedMascot,
    streakDays, streakPopup, dismissStreakPopup: () => setStreakPopup(null), authUser, isAuthLoading, guestAllowed, authError, setAuthError,
    authenticate, continueAsGuest, startLogin, logout,
    consultationModalOpen, setConsultationModalOpen, consentChoice, setConsentChoice, openPsychologistFlow,
    psychologists, loadPsychologists, selectPsychologist, disconnectPsychologist, chatMessages, chatAvailableDates, loadChat, sendChat,
    adminUsers, loadAdminUsers, updateAdminUser, createAdminUser, deleteAdminUser, psychologistClients, loadPsychologistClients, clientData, loadClientData,
    communityPosts, loadCommunity, loadCommunityPost, createCommunityPost, addCommunityComment, toggleCommunityLike, recordCommunityShare, communityActivity, loadCommunityActivity,
    triageData, setTriageData, processTriage, isProcessingSlice, brainDumpOutcome,
    activeSound, toggleSoundscape, masterVolume, handleVolumeChange,
    microTasks, activeMissionIndex, toggleTaskDone, sliceTaskSmaller, resetMicroTasks, addCustomMicroAction, affirmation, totalXp, taskCompletionLog, weeklyTaskCompletions, lifetimeXp,
    vaultEntries, isVaultLoading, vaultSavedNotice, hasSavedToday, saveCurrentSession, clearAllVault,
    quizLoggedToday, todayMetric, weeklyMetrics, logSleepHours, logQuizStress,
    resetFlow,
  }), [step, selectedMood, selectedMascot, streakDays, streakPopup, authUser, isAuthLoading, guestAllowed, authError, triageData, isProcessingSlice, brainDumpOutcome, activeSound, masterVolume, microTasks, affirmation, totalXp, taskCompletionLog, weeklyTaskCompletions, lifetimeXp, vaultEntries, isVaultLoading, vaultSavedNotice, hasSavedToday, quizLoggedToday, todayMetric, weeklyMetrics, consultationModalOpen, consentChoice, psychologists, chatMessages, chatAvailableDates, adminUsers, psychologistClients, clientData, communityPosts, communityActivity]);

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}

export function useFlow() {
  const context = useContext(FlowContext);
  if (!context) throw new Error('useFlow must be used within FlowProvider');
  return context;
}
