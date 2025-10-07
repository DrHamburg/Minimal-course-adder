// Minimal Course Adder – FINAL tolerant matcher for preprereg.eniamza.com
// Handles: "CSE221: Sec-09B", "cse221 sec-09", "CSE 221: 9B", etc.

// ---------- SELECTORS ----------
const SELECTORS = {
  // left search input (auto-filters as you type)
  searchInput: 'input[placeholder*="Search Course Code" i]:first-of-type',

  // visible items on the left list (available courses)
  resultRows: '.dual-listbox__available .dual-listbox__item, .dual-listbox__item',

  // the three central buttons between lists: >, >>, <<<
  centralButtons: '.dual-listbox__buttons .dual-listbox__button'
};

// ---------- HELPERS ----------
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const $  = (s, r=document) => r.querySelector(s);

function isVisible(el) {
  if (!el) return false;
  const cs = getComputedStyle(el);
  return cs.display !== 'none' && cs.visibility !== 'hidden' && el.offsetParent !== null;
}

function waitFor(predicate, {timeout=12000, interval=50}={}) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const id = setInterval(() => {
      try {
        if (predicate()) { clearInterval(id); resolve(true); }
        else if (Date.now() - start > timeout) { clearInterval(id); reject(new Error('timeout')); }
      } catch (e) { clearInterval(id); reject(e); }
    }, interval);
  });
}

function getAddButton() {
  const btns = $$(SELECTORS.centralButtons).filter(isVisible);
  // Prefer >> then > (based on your UI)
  return btns.find(b => (b.textContent || '').trim() === '>>')
      || btns.find(b => (b.textContent || '').trim() === '>')
      || btns[0] || null;
}

// ---------- INPUT PARSING (tolerant) ----------
function normalizeToken(s) {
  return (s || "").toUpperCase().replace(/\s+/g, " ").trim();
}
function stripNonWord(s) {
  return (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Accepts any of:
 *  "CSE221"
 *  "CSE 221"
 *  "CSE221: Sec-09B"
 *  "cse221 sec-09"
 *  "CSE221: 9B"
 *  "CSE 221 9"
 */
function parseTarget(line) {
  const raw = normalizeToken(line);

  // Course: letters+digits with optional space (e.g., CSE221 or CSE 221)
  const mCourse = raw.match(/([A-Z]{2,}\s*\d{2,3})/i);
  if (!mCourse) return null;
  const course = stripNonWord(mCourse[1]); // "CSE221"

  // Try to capture an optional section token (e.g., 09B, 09, 9B)
  const after = raw.slice(mCourse.index + mCourse[0].length);
  const mSec =
    after.match(/(?:SEC(?:TION)?[\s:-]*)?([0-9]{1,3}[A-Z]?)/i) ||
    raw.match(/(?:SEC(?:TION)?[\s:-]*)?([0-9]{1,3}[A-Z]?)/i);

  let section = null;
  if (mSec && mSec[1]) {
    const tok = mSec[1].toUpperCase();           // "9B" or "09B" or "9"
    const mNumLet = tok.match(/^(\d{1,3})([A-Z]?)$/);
    if (mNumLet) {
      // Pad to 2 digits if <=2 digits, keep 3 if already 3-digit
      const digits = mNumLet[1];
      const padLen = digits.length > 2 ? digits.length : 2;
      section = digits.padStart(padLen, "0") + (mNumLet[2] || "");
    }
  }

  return { course, section }; // e.g., course="CSE221", section="09B" or "09" or null
}

// ---------- SEARCH ----------
async function searchCourse(course) {
  const input = $(SELECTORS.searchInput);
  if (!input) throw new Error('Search input not found');

  input.focus();
  input.value = '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.value = course; // just the course token (e.g., "CSE221")
  input.dispatchEvent(new Event('input', { bubbles: true }));

  // Some UIs also react to Enter; harmless if not needed
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keyup',   { key: 'Enter', bubbles: true }));

  await waitFor(() => $$(SELECTORS.resultRows).some(isVisible), { timeout: 12000 });
  await new Promise(r => setTimeout(r, 150)); // settle
  return $$(SELECTORS.resultRows).filter(isVisible);
}

// ---------- MATCH & SCORE ----------
function rowMatches(row, { course, section }) {
  const text = (row.innerText || "").toUpperCase();
  const tight = text.replace(/[^A-Z0-9]/g, ""); // remove spaces/punct

  // course must appear (tolerant to spacing/punct)
  if (!tight.includes(course)) return false;

  if (!section) return true; // no section specified -> accept first visible course

  // Accept "SEC-09B", "Sec 09b", ": 09B", or bare "09B"
  const s = section; // normalized like "09" or "09B"
  const patterns = [
    new RegExp(`\\bSEC(?:TION)?\\s*[:\\-]*\\s*0?${s}\\b`, "i"),
    new RegExp(`[:\\-\\s]\\s*0?${s}\\b`, "i"),
    new RegExp(`\\b0?${s}\\b`, "i")
  ];
  return patterns.some(re => re.test(text));
}

function scoreRow(row, target) {
  const t = (row.innerText || "").toUpperCase();
  let score = 0;
  if (t.replace(/[^A-Z0-9]/g, "").includes(target.course)) score += 10;
  if (target.section) {
    if (new RegExp(`\\bSEC(?:TION)?\\s*[:\\-]*\\s*0?${target.section}\\b`, "i").test(t)) score += 5;
    else if (new RegExp(`\\b0?${target.section}\\b`, "i").test(t)) score += 3;
  }
  return score;
}

// ---------- CLICK TO ADD ----------
async function addFromRows(rows, target) {
  const addBtn = getAddButton();
  if (!addBtn) throw new Error('Central Add button not found');

  // Prefer best-scoring match first if multiple visible
  rows.sort((a, b) => scoreRow(b, target) - scoreRow(a, target));

  for (const row of rows) {
    if (!rowMatches(row, target)) continue;

    row.click();   // select the left item
    addBtn.click(); // click > or >>
    await new Promise(r => setTimeout(r, 400));
    return true;
  }
  return false;
}

// ---------- MAIN ----------
async function runAddSequence(lines) {
  for (const line of lines) {
    const target = parseTarget(line);
    if (!target) { console.warn('[MCA] skipped invalid line:', line); continue; }

    try {
      console.log('[MCA] Searching', target);
      const rows = await searchCourse(target.course);
      const ok = await addFromRows(rows, target);
      console.log('[MCA] Added', target, ok ? '✓' : 'not found');
    } catch (e) {
      console.warn('[MCA] Error for', line, e.message);
    }

    // tiny delay between courses
    await new Promise(r => setTimeout(r, 300));
  }
}

// Listen for popup trigger
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'MCA_RUN' && Array.isArray(msg.lines)) {
    runAddSequence(msg.lines);
  }
});
