// Comment sentiment for the client report. Zernio returns the raw comments; the analysis is ours.
// scoreComment() is the ONE place a comment gets a label, so a language model can replace the
// word-list scorer later without touching anything else.
import Sentiment from 'sentiment';

const scorer = new Sentiment();

// -> 'positive' | 'neutral' | 'negative'
export function scoreComment(text) {
  const { score } = scorer.analyze(String(text || ''));
  return score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
}

// Words too common to say anything (English + Spanish, the languages these accounts see most).
const STOP = new Set(`
a about above after again against all also am an and any are aren as at be because been before being below
between both but by can cannot could did didn do does doesn doing don down during each few for from further
get got had has have having he her here hers herself him himself his how i if in into is isn it its itself
just let me more most my myself no nor not now of off on once only or other our ours ourselves out over own
really same she should so some such than that the their theirs them themselves then there these they this
those through to too under until up very was wasn we were what when where which while who whom why will
with would you your yours yourself yourselves im ive dont cant thats its youre theyre still even much many
one two get got like just yes yeah okay ok please thanks thank
de la que el en y a los se del las un por con no una su para es al lo como mas pero sus le ya o este si porque
esta entre cuando muy sin sobre tambien me hasta hay donde quien desde todo nos durante todos uno les ni
contra otros ese eso ante ellos e esto mi antes algunos que unos yo otro otras otra el tanto esa estos mucho
quienes nada muchos cual poco ella estar estas algunas algo nosotros tu te ti tus ellas son ser fue era
hola gracias favor
`.split(/\s+/).filter(Boolean));

// "Worth a look": the most frequent words across NEGATIVE comments only. Privacy rules:
//  - no @handles, links, numbers or emails;
//  - no word that is part of any commenter's display name (names never reach the report);
//  - no word that ever appears capitalised mid-sentence (proper nouns: people, places, brands).
export function worthALook(negativeTexts, nameTokens = new Set(), top = 3) {
  const proper = new Set();
  const counts = new Map();
  for (const raw of negativeTexts) {
    const text = String(raw || '')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/\S+@\S+/g, ' ')
      .replace(/[@#]\S+/g, ' ');
    // Proper-noun detection on the original casing.
    const words = text.split(/[^\p{L}']+/u).filter(Boolean);
    words.forEach((w, i) => {
      if (i > 0 && /^\p{Lu}/u.test(w)) proper.add(w.toLowerCase());
    });
    const seen = new Set();
    for (const w of words.map((x) => x.toLowerCase().replace(/^'+|'+$/g, ''))) {
      if (w.length < 4 || STOP.has(w) || seen.has(w)) continue;
      seen.add(w); // count each word once per comment: frequency across comments, not repetition
      counts.set(w, (counts.get(w) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([w]) => !nameTokens.has(w) && !proper.has(w))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, top)
    .map(([word, count]) => ({ word, count }));
}

// Lower-cased tokens of display names, used only to keep names out of "worth a look".
export const nameTokensOf = (names) => {
  const out = new Set();
  for (const n of names) for (const t of String(n || '').toLowerCase().split(/[^\p{L}']+/u)) if (t) out.add(t);
  return out;
};
