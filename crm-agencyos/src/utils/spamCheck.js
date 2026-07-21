// Lightweight spam-trigger scan for the composer — a heuristic warning, not
// a hard block (spam filters are opaque and this list is necessarily
// incomplete). Flags the most common patterns that push cold/bulk email
// into spam folders.
const SPAM_PHRASES = [
  'free', 'act now', 'buy now', 'click here', 'click below', 'limited time', 'no obligation',
  'winner', 'congratulations', 'guarantee', 'guaranteed', 'risk-free', 'risk free', 'cash bonus',
  '100% free', 'earn money', 'work from home', 'lowest price', 'no credit check', "don't delete",
  'as seen on', 'special promotion', 'act immediately', 'apply now', 'once in lifetime',
  'cancel at any time', 'no purchase necessary', 'urgent', 'this isn\'t spam', 'not spam',
];

export function checkSpamContent(subject, bodyHtml) {
  const plainBody = String(bodyHtml || '').replace(/<[^>]+>/g, ' ');
  const combined = `${subject || ''} ${plainBody}`.toLowerCase();

  const matchedPhrases = SPAM_PHRASES.filter((p) => combined.includes(p));
  const exclamations = (combined.match(/!/g) || []).length;
  const subjectCapsWords = (String(subject || '').match(/\b[A-Z]{3,}\b/g) || []).length;

  const warnings = [];
  if (matchedPhrases.length) {
    warnings.push(`Contains spam-trigger phrase${matchedPhrases.length > 1 ? 's' : ''}: "${matchedPhrases.join('", "')}"`);
  }
  if (exclamations > 2) warnings.push(`${exclamations} exclamation marks — spam filters weight these heavily, consider trimming`);
  if (subjectCapsWords > 0) warnings.push('ALL-CAPS word(s) in the subject line — a common spam signal');
  if ((subject || '').length > 70) warnings.push('Subject line is long — likely to get truncated in the inbox and reads less personal');
  if ((subject || '').trim().length === 0) warnings.push('No subject line');

  return { warnings, matchedPhrases };
}
