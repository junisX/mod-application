const QUESTIONS = [
  {
    id: 'age',
    text: 'Wie alt bist du?',
    options: [
      { value: 'under_13', label: 'Unter 13' },
      { value: '13_15', label: '13–15' },
      { value: '16_17', label: '16–17' },
      { value: '18_plus', label: '18+' },
    ],
  },
  {
    id: 'platform',
    text: 'Wo möchtest du moderieren?',
    options: [
      { value: 'twitch', label: 'Twitch' },
      { value: 'discord', label: 'Discord' },
      { value: 'both', label: 'Beides' },
    ],
  },
  {
    id: 'moderation',
    text: 'Hast du schon einmal moderiert?',
    options: [
      { value: 'yes', label: 'Ja' },
      { value: 'no', label: 'Nein' },
    ],
  },
  {
    id: 'activity',
    text: 'Wie lange bist du ungefähr in Online-Communities aktiv?',
    options: [
      { value: 'under_1', label: 'Unter 1 Jahr' },
      { value: '1_2', label: '1–2 Jahre' },
      { value: '2_4', label: '2–4 Jahre' },
      { value: '4_plus', label: '4+ Jahre' },
    ],
  },
  {
    id: 'online',
    text: 'Wie oft bist du normalerweise online?',
    options: [
      { value: 'daily', label: 'Jeden Tag' },
      { value: 'almost_daily', label: 'Fast jeden Tag' },
      { value: 'several_times', label: 'Mehrmals pro Woche' },
      { value: 'rarely', label: 'Eher selten' },
    ],
  },
  {
    id: 'character',
    text: 'Wie würdest du dich selbst beschreiben?',
    options: [
      { value: 'calm', label: 'Ruhig' },
      { value: 'friendly', label: 'Freundlich' },
      { value: 'relaxed', label: 'Locker' },
      { value: 'direct', label: 'Direkt' },
      { value: 'assertive', label: 'Durchsetzungsfähig' },
    ],
  },
  {
    id: 'spam',
    text: 'Jemand macht ständig Spam. Was machst du?',
    options: [
      { value: 'point_out', label: 'Erst darauf hinweisen' },
      { value: 'remove_timeout', label: 'Nachricht löschen / Timeout geben' },
      { value: 'ask_mod', label: 'Bei einem anderen Mod nachfragen' },
      { value: 'situational', label: 'Kommt auf die Situation an' },
    ],
  },
  {
    id: 'insults',
    text: 'Zwei Leute beleidigen sich gegenseitig zum Spaß. Was machst du?',
    options: [
      { value: 'observe', label: 'Erstmal beobachten' },
      { value: 'check_consent', label: 'Prüfen, ob beide damit einverstanden sind' },
      { value: 'step_in', label: 'Eingreifen, wenn es wirklich ausartet' },
      { value: 'ask_mod', label: 'Anderen Mod fragen' },
    ],
  },
  {
    id: 'skills',
    text: 'Wie gut kennst du die Moderationsfunktionen?',
    options: [
      { value: 'very_good', label: 'Sehr gut' },
      { value: 'good', label: 'Gut' },
      { value: 'basic', label: 'Ein bisschen' },
      { value: 'none', label: 'Noch gar nicht' },
    ],
  },
  {
    id: 'motivation',
    text: 'Warum möchtest du Moderator werden?',
    options: [
      { value: 'community', label: 'Ich bin gerne in der Community' },
      { value: 'support', label: 'Ich möchte die Community unterstützen' },
      { value: 'experience', label: 'Ich möchte neue Erfahrungen sammeln' },
      { value: 'responsibility', label: 'Ich möchte mehr Verantwortung übernehmen' },
    ],
  },
];

const DEFAULT_ERROR = 'Deine Bewerbung konnte gerade nicht gesendet werden. Bitte versuche es erneut.';

const views = Object.fromEntries(
  [...document.querySelectorAll('.view')].map((view) => [view.id.replace('view-', ''), view]),
);

const ui = {
  start: document.getElementById('start-button'),
  platform: document.getElementById('platform'),
  step: document.getElementById('step-label'),
  meter: document.getElementById('meter'),
  body: document.getElementById('step-body'),
  question: document.getElementById('question-label'),
  options: document.getElementById('options'),
  website: document.getElementById('website'),
  back: document.getElementById('back-button'),
  next: document.getElementById('next-button'),
  restart: document.getElementById('restart-button'),
  retry: document.getElementById('retry-button'),
  review: document.getElementById('review-button'),
  failedText: document.getElementById('failed-text'),
};

const state = {
  step: 0,
  answers: {},
  platform: null,
  busy: false,
};

function show(name) {
  for (const [key, view] of Object.entries(views)) view.hidden = key !== name;
  window.scrollTo(0, 0);
}

function syncNavigation() {
  const question = QUESTIONS[state.step];

  ui.back.disabled = state.step === 0 || state.busy;
  ui.next.disabled = state.busy || !state.answers[question.id];
  ui.next.textContent = state.busy ? 'Wird gesendet …' : state.step === QUESTIONS.length - 1 ? 'Absenden' : 'Weiter';
}

function createOption(question, option) {
  const button = document.createElement('button');

  button.type = 'button';
  button.className = 'option';
  button.dataset.value = option.value;
  button.setAttribute('aria-pressed', String(state.answers[question.id] === option.value));
  button.textContent = option.label;
  button.addEventListener('click', () => {
    state.answers[question.id] = option.value;

    for (const sibling of ui.options.children) {
      sibling.setAttribute('aria-pressed', String(sibling.dataset.value === option.value));
    }

    syncNavigation();
  });

  return button;
}

function renderStep() {
  const question = QUESTIONS[state.step];
  const progress = ((state.step + 1) / QUESTIONS.length) * 100;

  ui.step.textContent = `${state.step + 1} / ${QUESTIONS.length}`;
  ui.meter.style.width = `${progress}%`;
  ui.question.textContent = question.text;
  ui.options.replaceChildren(...question.options.map((option) => createOption(question, option)));

  ui.body.classList.remove('enter');
  void ui.body.offsetWidth;
  ui.body.classList.add('enter');

  syncNavigation();
}

function reset() {
  state.step = 0;
  state.answers = {};
  state.platform = null;
  state.busy = false;
  ui.website.value = '';

  for (const segment of ui.platform.querySelectorAll('.segment')) {
    segment.setAttribute('aria-pressed', 'false');
  }
}

function fail(message) {
  ui.failedText.textContent = message || DEFAULT_ERROR;
  show('failed');
}

async function submit() {
  if (state.busy) return;

  const unanswered = QUESTIONS.findIndex((question) => !state.answers[question.id]);

  if (unanswered !== -1) {
    state.step = unanswered;
    renderStep();
    show('form');
    return;
  }

  state.busy = true;
  syncNavigation();

  try {
    const response = await fetch('/api/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answers: state.answers,
        platform: state.platform,
        website: ui.website.value,
      }),
    });

    const data = await response.json().catch(() => null);

    if (response.ok && data?.ok) {
      reset();
      show('sent');
      return;
    }

    fail(data?.error);
  } catch {
    fail();
  } finally {
    state.busy = false;
    syncNavigation();
  }
}

function goForward() {
  const question = QUESTIONS[state.step];

  if (!state.answers[question.id]) return;

  if (question.id === 'age' && state.answers.age === 'under_13') {
    show('blocked');
    return;
  }

  if (state.step === QUESTIONS.length - 1) {
    submit();
    return;
  }

  state.step += 1;
  renderStep();
}

ui.start.addEventListener('click', () => {
  renderStep();
  show('form');
});

ui.platform.addEventListener('click', (event) => {
  const segment = event.target.closest('.segment');

  if (!segment) return;

  const value = state.platform === segment.dataset.value ? null : segment.dataset.value;

  state.platform = value;

  for (const sibling of ui.platform.querySelectorAll('.segment')) {
    sibling.setAttribute('aria-pressed', String(sibling.dataset.value === value));
  }

  if (value) {
    state.answers.platform = value;
  } else {
    delete state.answers.platform;
  }
});

ui.back.addEventListener('click', () => {
  if (state.step === 0) return;

  state.step -= 1;
  renderStep();
});

ui.next.addEventListener('click', goForward);

ui.restart.addEventListener('click', () => {
  reset();
  show('start');
});

ui.retry.addEventListener('click', submit);

ui.review.addEventListener('click', () => {
  state.step = QUESTIONS.length - 1;
  renderStep();
  show('form');
});

renderStep();
