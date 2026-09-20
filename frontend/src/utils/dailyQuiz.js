const QUESTION_BANK = {
  'Pola Tidur': [
    'Have you been sleeping well recently?',
    'Did you wake up feeling rested this morning?',
    'Have you been going to bed later than usual this week?',
    'Do you feel like your sleep schedule is all over the place?',
    'Did you check your phone right before falling asleep last night?',
  ],
  'Tension Fisik': [
    'Felt muscle tightness in your neck or shoulders today?',
    'Have you had a headache or eye strain today?',
    'Does your jaw or back feel tense right now?',
    'Have you been sitting still for long stretches without stretching?',
    'Do you feel physically restless or fidgety today?',
  ],
  'Cognitive Loop': [
    'Do you have multiple unfinished deadlines looping in your head?',
    'Do you keep replaying the same worry over and over?',
    'Is it hard to focus on one task without your mind wandering?',
    'Have you been avoiding a task because just thinking about it feels heavy?',
    'Do you feel like there is too much on your plate right now?',
  ],
  'Action Readiness': [
    'Ready to let our 5-minute micro-slicer take the wheel?',
    'Do you feel like you could use one small win right now?',
    'Are you open to trying a tiny 2-minute step before anything else?',
    'Would a short breathing pause help you reset right now?',
    'Do you want today\'s check-in saved to your Flow Studio?',
  ],
};

const TAG_ORDER = ['Pola Tidur', 'Tension Fisik', 'Cognitive Loop', 'Action Readiness'];

function getJakartaDateSeed() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

function hashString(value) {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return Math.abs(hash);
}

export function getDailyQuizQuestions(dateSeed = getJakartaDateSeed()) {
  return TAG_ORDER.map((tag, tagIndex) => {
    const pool = QUESTION_BANK[tag];
    const index = hashString(`${dateSeed}-${tag}-${tagIndex}`) % pool.length;
    return { tag, q: pool[index] };
  });
}

export function getTodaySeed() {
  return getJakartaDateSeed();
}

export function estimateStressFromAnswers(answers, questions) {
  if (!answers || answers.length === 0) return null;
  const weights = {
    'Pola Tidur': 20,
    'Tension Fisik': 25,
    'Cognitive Loop': 30,
    'Action Readiness': -10,
  };
  let score = 35;
  answers.forEach((answer, index) => {
    const tag = questions[index]?.tag;
    const weight = weights[tag] ?? 15;
    score += answer === 'yes' ? weight : -Math.round(weight / 2);
  });
  return Math.max(5, Math.min(100, Math.round(score)));
}

export function stressLevelLabel(score) {
  if (score === null || score === undefined) return { label: 'Belum bisa diukur', color: 'text-on-tertiary-container' };
  if (score >= 70) return { label: 'Tinggi', color: 'text-red-700' };
  if (score >= 40) return { label: 'Sedang', color: 'text-amber-700' };
  return { label: 'Ringan', color: 'text-emerald-700' };
}
