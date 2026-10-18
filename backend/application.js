const WEBHOOK_TIMEOUT_MS = 8000;
const EMBED_COLOR = 0x8b5cf6;

export const QUESTIONS = [
  {
    id: 'age',
    label: 'Alter',
    options: {
      under_13: 'Unter 13',
      '13_15': '13–15',
      '16_17': '16–17',
      '18_plus': '18+',
    },
  },
  {
    id: 'platform',
    label: 'Plattform',
    options: {
      twitch: 'Twitch',
      discord: 'Discord',
      both: 'Twitch + Discord',
    },
  },
  {
    id: 'moderation',
    label: 'Moderationserfahrung',
    options: {
      yes: 'Ja',
      no: 'Nein',
    },
  },
  {
    id: 'activity',
    label: 'Community-Erfahrung',
    options: {
      under_1: 'Unter 1 Jahr',
      '1_2': '1–2 Jahre',
      '2_4': '2–4 Jahre',
      '4_plus': '4+ Jahre',
    },
  },
  {
    id: 'online',
    label: 'Online',
    options: {
      daily: 'Täglich',
      almost_daily: 'Fast jeden Tag',
      several_times: 'Mehrmals pro Woche',
      rarely: 'Eher selten',
    },
  },
  {
    id: 'character',
    label: 'Beschreibung',
    options: {
      calm: 'Ruhig',
      friendly: 'Freundlich',
      relaxed: 'Locker',
      direct: 'Direkt',
      assertive: 'Durchsetzungsfähig',
    },
  },
  {
    id: 'spam',
    label: 'Spam',
    options: {
      point_out: 'Erst darauf hinweisen',
      remove_timeout: 'Nachricht löschen / Timeout geben',
      ask_mod: 'Bei einem anderen Mod nachfragen',
      situational: 'Kommt auf die Situation an',
    },
  },
  {
    id: 'insults',
    label: 'Beleidigungen',
    options: {
      observe: 'Erstmal beobachten',
      check_consent: 'Prüfen, ob beide damit einverstanden sind',
      step_in: 'Eingreifen, wenn es wirklich ausartet',
      ask_mod: 'Anderen Mod fragen',
    },
  },
  {
    id: 'skills',
    label: 'Moderationskenntnisse',
    options: {
      very_good: 'Sehr gut',
      good: 'Gut',
      basic: 'Ein bisschen',
      none: 'Noch gar nicht',
    },
  },
  {
    id: 'motivation',
    label: 'Motivation',
    options: {
      community: 'Ich bin gerne in der Community',
      support: 'Ich möchte die Community unterstützen',
      experience: 'Ich möchte neue Erfahrungen sammeln',
      responsibility: 'Ich möchte mehr Verantwortung übernehmen',
    },
  },
];

const PLATFORM_QUESTION = QUESTIONS[1];

function invalid(status, error) {
  return { ok: false, status, error };
}

export function validateApplication(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return invalid(400, 'Ungültige Anfrage.');
  }

  const answers = input.answers;

  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return invalid(400, 'Bitte beantworte alle Fragen.');
  }

  const clean = {};

  for (const question of QUESTIONS) {
    const value = answers[question.id];

    if (typeof value !== 'string' || !Object.hasOwn(question.options, value)) {
      return invalid(400, 'Bitte beantworte alle Fragen.');
    }

    clean[question.id] = value;
  }

  if (clean.age === 'under_13') {
    return invalid(422, 'Bewerbungen sind erst ab 13 Jahren möglich.');
  }

  let platform = null;

  if (input.platform !== undefined && input.platform !== null && input.platform !== '') {
    if (typeof input.platform !== 'string' || !Object.hasOwn(PLATFORM_QUESTION.options, input.platform)) {
      return invalid(400, 'Ungültige Anfrage.');
    }

    platform = input.platform;
  }

  return { ok: true, answers: clean, platform };
}

export function buildEmbed(answers, platform) {
  const fields = QUESTIONS.map((question) => ({
    name: question.label,
    value: question.options[answers[question.id]],
  }));

  if (platform && platform !== answers.platform) {
    fields.push({ name: 'Startauswahl', value: PLATFORM_QUESTION.options[platform] });
  }

  return {
    title: 'Neue Mod-Bewerbung',
    color: EMBED_COLOR,
    fields,
    timestamp: new Date().toISOString(),
  };
}

export async function sendApplication(webhookUrl, embed) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }),
    signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
  });

  if (!response.ok) {
    const error = new Error(`Discord antwortet mit Status ${response.status}`);
    error.status = response.status;
    throw error;
  }
}
