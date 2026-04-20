// Detects user frustration in chat messages based on keywords, punctuation,
// caps usage, and repeated similar messages.

const PROFANITY = [
  'fuck', 'fucking', 'shit', 'damn', 'wtf', 'bullshit', 'crap', 'asshole',
  'stupid', 'dumb', 'garbage', 'trash', 'useless', 'idiot', 'moron',
];

const FRUSTRATION_PHRASES = [
  'not working', "doesn't work", 'doesnt work', "still broken", 'still not',
  'are you kidding', 'seriously', 'why is this', 'i told you', 'i already said',
  'you keep', 'stop doing', 'why did you', 'this is wrong', 'wrong again',
  'broken again', 'same error', 'still the same', 'fix it already',
  'come on', 'omg', 'ugh', 'frustrating', 'annoying', 'hate this',
  'giving up', "can't believe", 'cant believe', 'ridiculous',
];

export interface FrustrationSignal {
  isFrustrated: boolean;
  score: number;
  reasons: string[];
}

export function detectFrustration(
  message: string,
  recentUserMessages: string[] = [],
): FrustrationSignal {
  const reasons: string[] = [];
  let score = 0;
  const lower = message.toLowerCase().trim();
  if (!lower) return { isFrustrated: false, score: 0, reasons };

  // Profanity
  if (PROFANITY.some(w => new RegExp(`\\b${w}\\b`, 'i').test(lower))) {
    score += 3;
    reasons.push('strong language');
  }

  // Frustration phrases
  const phraseHit = FRUSTRATION_PHRASES.find(p => lower.includes(p));
  if (phraseHit) {
    score += 2;
    reasons.push(`phrase: "${phraseHit}"`);
  }

  // ALL CAPS (>=4 chars, mostly uppercase)
  const letters = message.replace(/[^a-zA-Z]/g, '');
  if (letters.length >= 4) {
    const upper = message.replace(/[^A-Z]/g, '').length;
    if (upper / letters.length > 0.7) {
      score += 2;
      reasons.push('shouting (caps)');
    }
  }

  // Repeated punctuation
  if (/[!?]{2,}/.test(message)) {
    score += 1;
    reasons.push('repeated punctuation');
  }

  // Repetition: similar message sent recently
  const similar = recentUserMessages.slice(-4).find(prev => {
    const a = prev.toLowerCase().trim();
    if (!a || a === lower) return false;
    const overlap = a.split(/\s+/).filter(w => w.length > 3 && lower.includes(w)).length;
    return overlap >= 3;
  });
  if (similar) {
    score += 2;
    reasons.push('repeating prior request');
  }

  return { isFrustrated: score >= 3, score, reasons };
}
