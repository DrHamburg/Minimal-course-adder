const $ = (id) => document.getElementById(id);

function updateCount() {
  const raw = $('lines').value;
  const count = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean).length;
  $('count').textContent = `${count} ${count === 1 ? 'line' : 'lines'}`;
}

async function load() {
  const { mca_lines } = await chrome.storage.sync.get(['mca_lines']);
  if (mca_lines) $('lines').value = mca_lines.join('\n');
  updateCount();
}

$('lines').addEventListener('input', updateCount);

// chips to quickly insert examples
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const v = $('lines').value.trim();
    const ex = chip.dataset.example;
    $('lines').value = (v ? v + '\n' : '') + ex;
    updateCount();
  });
});

$('save').addEventListener('click', async () => {
  const lines = $('lines').value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  await chrome.storage.sync.set({ mca_lines: lines });
  toast('Saved ✓');
});

$('run').addEventListener('click', async () => {
  const lines = $('lines').value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  await chrome.storage.sync.set({ mca_lines: lines });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: 'MCA_RUN', lines });
  toast('Running…');
});

// shortcuts
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); $('save').click(); }
  if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); $('run').click(); }
});

// tiny toast via status line
let toastTimer = null;
function toast(msg) {
  const el = $('status');
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.textContent = ''; }, 1800);
}

load();
