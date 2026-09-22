const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

export async function sliceTaskWithHybridFallback(content, tag, panicLevel) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 22000);

    const res = await fetch(`${API_BASE_URL}/slice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: content || 'Academic workload piling up',
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

  return getClientHeuristicSlice(content, tag, panicLevel);
}

function buildBreakdownLevels(action) {
  const withoutQuantity = action.replace(/\b\d+\b\s*/, '');
  const firstClauseMatch = withoutQuantity.split(/\s+and\s+|,|\./i)[0].trim();
  const base = firstClauseMatch || withoutQuantity.trim();
  return [
    { action: base, guidance: 'Focus only on the first sixty seconds. You don\'t need to think about what comes next yet.' },
    { action: `Even smaller: ${base}`, guidance: 'Even twenty seconds of this counts as a win. Just touch the task, nothing more.' },
    { action: `Smallest step: touch ${base}`, guidance: 'This is the smallest version possible. If you do only this, you\'ve already broken the freeze.' },
  ];
}

function withBreakdownLevels(tasks) {
  return tasks.map((task) => ({ ...task, breakdownLevels: buildBreakdownLevels(task.action) }));
}

function getClientHeuristicSlice(content = '', tag = 'Deadline', panicLevel = 3) {
  const text = content.toLowerCase();
  const category = tag.toLowerCase();

  let affirmation = 'Take a slow breath. You don\'t need to finish everything now, just complete the first tiny step.';
  if (panicLevel >= 4) {
    affirmation = 'Your heart rate is racing right now. Relax, this load can be broken down into very small pieces.';
  }

  let tasks;

  if (text.includes('thesis') || category.includes('thesis') || text.includes('chapter')) {
    tasks = [
      {
        id: 'task-1',
        action: 'Open your thesis document and write 1 free sentence without editing',
        duration: '2 minutes',
        guidance: 'Ignore grammar or formality for now. The key is getting the cursor to start typing.',
      },
      {
        id: 'task-2',
        action: 'Open 1 reference journal and highlight 2 key sentences',
        duration: '3 minutes',
        guidance: 'Find 1 piece of data or quote most relevant to the next paragraph.',
      },
      {
        id: 'task-3',
        action: 'Turn that quote into 2 lines in your own words',
        duration: '4 minutes',
        guidance: 'Save your document (Ctrl+S). You\'ve officially broken out of task paralysis!',
      },
    ];
  } else if (text.includes('exam') || category.includes('exam') || text.includes('quiz')) {
    tasks = [
      {
        id: 'task-1',
        action: 'Open the syllabus and pick 1 topic you like the most',
        duration: '2 minutes',
        guidance: 'Starting with a topic you know well triggers dopamine and eases anxiety.',
      },
      {
        id: 'task-2',
        action: 'Write 3 key concepts from that topic on scratch paper',
        duration: '3 minutes',
        guidance: 'Write it in your own casual style to make it easier to remember kinesthetically.',
      },
      {
        id: 'task-3',
        action: 'Read and understand the explanation for 1 practice question',
        duration: '4 minutes',
        guidance: 'Just 1 question is enough. Once you understand it, give yourself credit.',
      },
    ];
  } else if (text.includes('coding') || text.includes('code') || text.includes('bug')) {
    tasks = [
      {
        id: 'task-1',
        action: 'Open the code file and write a simple comment describing the problem',
        duration: '2 minutes',
        guidance: 'Use everyday language to define what\'s actually happening.',
      },
      {
        id: 'task-2',
        action: 'Add 1 console.log or debugger at the main variable input',
        duration: '3 minutes',
        guidance: 'Verify whether the data type and value match what you expect.',
      },
      {
        id: 'task-3',
        action: 'Try 1 small change and run the test once more',
        duration: '4 minutes',
        guidance: 'Whatever the result, you\'ve broken the mental deadlock with a real action.',
      },
    ];
  } else {
    tasks = [
      {
        id: 'task-1',
        action: 'Clear 2 distracting objects off your desk and take a sip of water',
        duration: '2 minutes',
        guidance: 'A refreshed body and a tidy space immediately lower stress hormone levels.',
      },
      {
        id: 'task-2',
        action: 'Open the task file/app and write down the single easiest step to start with',
        duration: '3 minutes',
        guidance: 'Focus on what\'s right in front of you for 3 minutes without opening other tabs.',
      },
      {
        id: 'task-3',
        action: 'Finish that micro action and check it off as done',
        duration: '4 minutes',
        guidance: 'The first step is done! Momentum has been built, you\'re in control.',
      },
    ];
  }

  return {
    source: 'client-heuristic-engine',
    affirmation,
    tag,
    tasks: withBreakdownLevels(tasks),
  };
}
