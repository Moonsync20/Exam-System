/**
 * Smart Exam Question Paper & Answer-Key Studio
 * Application logic (Vanilla ES6+)
 *
 * Core functions (see blueprint §5):
 *   initApp()            – load state, bind events, first render
 *   handleAddQuestion()  – validate the form and append a question
 *   deleteQuestion()     – remove a question (with Undo)
 *   moveQuestion()       – reorder a question within its part
 *   shufflePaperSet()    – shuffle each part and flip Set A ↔ Set B
 *   updateDiagnostics()  – marks, time and difficulty stats via .reduce()
 *   renderPaperPreview() – build Part A / Part B on the A4 sheet
 */

// ---------------------------------------------------------------------------
// Constants & state
// ---------------------------------------------------------------------------
const STORAGE_KEY = 'examStudio_state_v2';
const RING_CIRCUMFERENCE = 2 * Math.PI * 42;           // matches r="42" in the SVG ring
const ZOOM_LEVELS = [0.75, 0.9, 1, 1.1, 1.25];
const LETTERS = ['a', 'b', 'c', 'd'];
const DEFAULT_MARKS = { mcq: 2, written: 5 };
const MINUTES_PER_MARK = { mcq: 1.5, written: 2.5 };

const svg = (paths, size = 14) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

const ICON = {
  up: svg('<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>'),
  down: svg('<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>'),
  trash: svg('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>'),
  check: svg('<path d="M20 6 9 17l-5-5"/>', 15),
  plus: svg('<path d="M12 5v14"/><path d="M5 12h14"/>', 13),
  minus: svg('<path d="M5 12h14"/>', 13)
};

let state = loadState();
let zoomIndex = ZOOM_LEVELS.indexOf(1);
let lastAddedId = null;
let lastTextField = null;     // last focused text field in the question form (target for equations)

const $ = (id) => document.getElementById(id);
const form = $('addQuestionForm');

// ---------------------------------------------------------------------------
// 1. Init & persistence
// ---------------------------------------------------------------------------
function initApp() {
  fillConfigForm();
  bindEvents();
  initSubQuestionBuilder();
  initMultiSets();
  setView(!!state.config.showAnswerKey, { silent: true });
  render();
}

function freshState() {
  const qs = JSON.parse(JSON.stringify(DEFAULT_QUESTIONS));
  return {
    config: { ...DEFAULT_CONFIG },
    questions: qs,
    sets: [
      { id: 'set_a', setCode: DEFAULT_CONFIG.setCode || 'Set A', questions: qs }
    ],
    activeSetIndex: 0
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.config && Array.isArray(saved.questions)) {
      // Migrate any legacy 'short' or 'broad' questions to 'written', and populate subQuestions on default items
      saved.questions.forEach((q) => {
        if (q.type === 'short' || q.type === 'broad') q.type = 'written';
        const defQ = DEFAULT_QUESTIONS.find((def) => def.id === q.id);
        if (defQ && defQ.subQuestions && (!q.subQuestions || q.subQuestions.length === 0)) {
          q.subQuestions = JSON.parse(JSON.stringify(defQ.subQuestions));
          q.text = defQ.text;
          q.solution = defQ.solution;
        }
      });

      let sets = Array.isArray(saved.sets) && saved.sets.length > 0 ? saved.sets : [
        { id: 'set_a', setCode: saved.config.setCode || 'Set A', questions: saved.questions }
      ];

      sets.forEach((set) => {
        if (Array.isArray(set.questions)) {
          set.questions.forEach((q) => {
            if (q.type === 'short' || q.type === 'broad') q.type = 'written';
          });
        }
      });

      const activeSetIndex = typeof saved.activeSetIndex === 'number' && saved.activeSetIndex < sets.length
        ? saved.activeSetIndex
        : 0;

      return {
        config: { ...DEFAULT_CONFIG, ...saved.config },
        questions: saved.questions,
        sets,
        activeSetIndex
      };
    }
  } catch (err) {
    console.warn('Saved state unreadable, loading demo paper.', err);
  }
  return freshState();
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Could not save to localStorage.', err);
  }
}

function fillConfigForm() {
  document.querySelectorAll('[data-key]').forEach((el) => {
    if (el.type === 'checkbox' || el.dataset.bool) {
      el.checked = !!state.config[el.dataset.key];
    } else {
      el.value = state.config[el.dataset.key] ?? '';
    }
  });
  syncAnswerLinesUI();
}

function syncAnswerLinesUI() {
  const active = !!state.config.showAnswerLines;
  const btn = $('btnToggleLines');
  if (btn) {
    btn.classList.toggle('btn-toggle-active', active);
    btn.setAttribute('aria-pressed', String(active));
  }
  const cycleBtn = $('btnCycleFormat');
  if (cycleBtn) {
    cycleBtn.style.display = active ? 'inline-flex' : 'none';
    const fmt = state.config.answerSpaceFormat || 'box';
    const label = fmt === 'box' ? 'Box' : (fmt === 'underline' ? 'Open' : 'Dotted');
    $('lblFormatName').textContent = label;
  }
  const formatSelect = $('cfgAnswerFormat');
  if (formatSelect) {
    formatSelect.value = state.config.answerSpaceFormat || 'box';
  }
}

// ---------------------------------------------------------------------------
// 2. Events
// ---------------------------------------------------------------------------
function bindEvents() {
  // Tabs
  document.querySelectorAll('.tab').forEach((tab) =>
    tab.addEventListener('click', () => switchTab(tab.dataset.tab))
  );

  // Question type → show/hide MCQ options, show/hide subQuestionsBlock, and suggest sensible marks
  form.querySelectorAll('input[name="qType"]').forEach((radio) =>
    radio.addEventListener('change', () => {
      const isMcq = radio.value === 'mcq';
      $('mcqOptionsBlock').classList.toggle('is-collapsed', !isMcq);
      $('subQuestionsBlock').classList.toggle('is-collapsed', isMcq);
      $('inputMarks').value = DEFAULT_MARKS[radio.value] || 5;
    })
  );

  // Marks stepper
  $('marksDec').addEventListener('click', () => stepMarks(-1));
  $('marksInc').addEventListener('click', () => stepMarks(1));

  // Character counter + live Bangla/math preview + sub-marks auto detection
  $('inputQuestionText').addEventListener('input', (e) => {
    $('qCharCount').textContent = `${e.target.value.length} chars`;
    const extracted = extractSubQuestions(e.target.value);
    if (extracted && extracted.subQuestions.length >= 2) {
      const sum = extracted.subQuestions.reduce((acc, s) => acc + (Number(s.marks) || 0), 0);
      if (sum > 0) {
        $('inputMarks').value = sum;
      }
    }
    updateQuestionPreview();
  });

  // Equation editor targets whichever text field was focused last (button or Ctrl+M)
  form.addEventListener('focusin', (e) => {
    if (e.target.matches('textarea, input[type="text"]')) lastTextField = e.target;
  });
  initEquationEditor();

  // Submit + Ctrl/Cmd+Enter shortcut
  form.addEventListener('submit', handleAddQuestion);
  form.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleAddQuestion(e);
  });
  form.addEventListener('input', (e) => e.target.classList.remove('is-invalid'));

  // Live header binding (every keystroke / toggle)
  document.querySelectorAll('[data-key]').forEach((el) => {
    const updateHandler = () => {
      state.config[el.dataset.key] = (el.type === 'checkbox' || el.dataset.bool)
        ? el.checked
        : (el.dataset.number ? Number(el.value) : el.value);
      if (el.dataset.key === 'showAnswerLines') syncAnswerLinesUI();
      saveState();
      render();
    };
    el.addEventListener('input', updateHandler);
    if (el.type === 'checkbox') el.addEventListener('change', updateHandler);
  });

  // Answer space toggle button (Unruled Class Test / Quiz Mode)
  const btnToggleLines = $('btnToggleLines');
  if (btnToggleLines) {
    btnToggleLines.addEventListener('click', () => {
      state.config.showAnswerLines = !state.config.showAnswerLines;
      const chk = $('cfgAnswerLines');
      if (chk) chk.checked = state.config.showAnswerLines;
      syncAnswerLinesUI();
      saveState();
      render();
      showToast(
        state.config.showAnswerLines
          ? 'Unruled answer space enabled (Class Test / Quiz mode)'
          : 'Answer space hidden (Standard exam paper)',
        state.config.showAnswerLines ? 'success' : 'info'
      );
    });
  }

  // Quick Format Cycle Button (Box ➔ Underline ➔ Dotted)
  const btnCycleFormat = $('btnCycleFormat');
  if (btnCycleFormat) {
    btnCycleFormat.addEventListener('click', () => {
      const formats = ['box', 'underline', 'dotted'];
      const cur = state.config.answerSpaceFormat || 'box';
      const next = formats[(formats.indexOf(cur) + 1) % formats.length];
      state.config.answerSpaceFormat = next;
      state.questions.forEach((q) => { delete q.answerSpaceFormat; });
      if ($('cfgAnswerFormat')) $('cfgAnswerFormat').value = next;
      syncAnswerLinesUI();
      saveState();
      render();
      const labels = { box: 'Clean Border Box', underline: 'Open Whitespace (Underline)', dotted: 'Dotted Frame' };
      showToast(`Answer space format: ${labels[next] || next}`, 'info');
    });
  }

  // Reset all custom question spaces back to auto height
  const btnResetAllSpace = $('btnResetAllSpace');
  if (btnResetAllSpace) {
    btnResetAllSpace.addEventListener('click', () => {
      state.questions.forEach((q) => {
        delete q.answerSpace;
        delete q.answerSpaceFormat;
      });
      saveState();
      render();
      showToast('All custom answer spaces reset to auto heights', 'info');
    });
  }

  // View mode, shuffle, print, multi-sets
  $('viewStudentBtn').addEventListener('click', () => setView(false));
  $('viewKeyBtn').addEventListener('click', () => setView(true));
  $('btnShuffleSet').addEventListener('click', shufflePaperSet);
  $('btnPrint').addEventListener('click', () => {
    const c = state.config;
    const safeCourse = (c.courseTitle || 'Exam').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    const safeSet = (c.setCode || 'Set').replace(/[^a-zA-Z0-9_-]/g, '_');
    const origTitle = document.title;
    document.title = `${safeCourse}_${safeSet}`;
    window.print();
    setTimeout(() => { document.title = origTitle; }, 1000);
  });

  const btnMultiSets = $('btnMultiSets');
  if (btnMultiSets) btnMultiSets.addEventListener('click', openMultiSetsModal);

  const btnQuickManageSets = $('btnQuickManageSets');
  if (btnQuickManageSets) btnQuickManageSets.addEventListener('click', openMultiSetsModal);

  const modalClose = $('modalMultiSetsClose');
  if (modalClose) modalClose.addEventListener('click', closeMultiSetsModal);

  const modalDone = $('modalMultiSetsDone');
  if (modalDone) modalDone.addEventListener('click', closeMultiSetsModal);

  const modalMultiSets = $('modalMultiSets');
  if (modalMultiSets) {
    modalMultiSets.addEventListener('click', (e) => {
      if (e.target === modalMultiSets) closeMultiSetsModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMultiSetsModal();
    }
  });

  // Presets (with Undo instead of blocking confirm dialogs)
  $('btnLoadDemo').addEventListener('click', loadDemo);
  $('btnClearAll').addEventListener('click', clearAll);

  // Zoom
  $('btnZoomIn').addEventListener('click', () => setZoom(zoomIndex + 1));
  $('btnZoomOut').addEventListener('click', () => setZoom(zoomIndex - 1));

  // Question actions (paper hover toolbar + outline + answer space stepper) via event delegation
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id, val } = btn.dataset;
    if (action === 'up' || action === 'down') moveQuestion(id, action);
    if (action === 'delete') deleteQuestion(id);
    if (action === 'space-inc') adjustQuestionSpace(id, 25);
    if (action === 'space-dec') adjustQuestionSpace(id, -25);
    if (action === 'space-preset') setQuestionSpace(id, Number(val));
    if (action === 'space-auto') resetQuestionSpace(id);
    if (action === 'space-format') cycleQuestionFormat(id);
    if (action === 'sub-space-inc') adjustSubQuestionSpace(id, parseInt(btn.dataset.subIdx, 10), 20);
    if (action === 'sub-space-dec') adjustSubQuestionSpace(id, parseInt(btn.dataset.subIdx, 10), -20);
  });
}

function calcDefaultAnswerSpace(marks) {
  return Math.min(360, Math.max(70, Math.round((Number(marks) || 1) * 22)));
}

function adjustQuestionSpace(id, delta) {
  const q = state.questions.find((item) => item.id === id);
  if (!q) return;
  const current = q.answerSpace ? Number(q.answerSpace) : calcDefaultAnswerSpace(q.marks);
  q.answerSpace = clamp(current + delta, 50, 650);
  saveState();
  render();
  showToast(`Answer space set to ${q.answerSpace}px`, 'info');
}

function setQuestionSpace(id, height) {
  const q = state.questions.find((item) => item.id === id);
  if (!q) return;
  q.answerSpace = clamp(height, 50, 650);
  saveState();
  render();
  showToast(`Answer space set to ${q.answerSpace}px`, 'info');
}

function resetQuestionSpace(id) {
  const q = state.questions.find((item) => item.id === id);
  if (!q) return;
  delete q.answerSpace;
  delete q.answerSpaceFormat;
  saveState();
  render();
  showToast('Reset to auto proportional height', 'info');
}

function cycleQuestionFormat(id) {
  const q = state.questions.find((item) => item.id === id);
  if (!q) return;
  const formats = ['box', 'underline', 'dotted'];
  const cur = q.answerSpaceFormat || state.config.answerSpaceFormat || 'box';
  const next = formats[(formats.indexOf(cur) + 1) % formats.length];
  q.answerSpaceFormat = next;
  saveState();
  render();
  showToast(`Question format: ${next}`, 'info');
}

// ---------------------------------------------------------------------------
// Sub-question builder & smart parser (Feature 4)
// ---------------------------------------------------------------------------
let subQuestionRows = []; // array of { id, prefix, text, marks }

function initSubQuestionBuilder() {
  const chk = $('chkEnableSubQ');
  const container = $('subQContainer');
  const addBtn = $('btnAddSubQRow');
  const tmplBtn = $('btnInsertTemplate');

  if (chk) {
    chk.addEventListener('change', () => {
      container.classList.toggle('is-hidden', !chk.checked);
      if (chk.checked && subQuestionRows.length === 0) {
        addSubQuestionRow('(a)', '', 3);
        addSubQuestionRow('(b)', '', 2);
      }
      syncSubMarksSum();
    });
  }

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const prefixes = ['(a)', '(b)', '(c)', '(d)', '(e)', '(f)'];
      const nextPrefix = prefixes[subQuestionRows.length] || `(${String.fromCharCode(97 + subQuestionRows.length)})`;
      addSubQuestionRow(nextPrefix, '', 2);
    });
  }

  if (tmplBtn) {
    tmplBtn.addEventListener('click', () => {
      const sample = "\n(a) Define the core concepts with formal terminology. [3]\n(b) Illustrate with a concrete diagram or mathematical derivation. [2]";
      insertAtCursor($('inputQuestionText'), sample);
      showToast('Inserted sub-question template into question statement', 'info');
    });
  }
}

function addSubQuestionRow(prefix = '(a)', text = '', marks = 2) {
  const id = 'sub_' + Math.random().toString(36).slice(2, 8);
  subQuestionRows.push({ id, prefix, text, marks });
  renderSubQuestionRows();
  syncSubMarksSum();
}

function removeSubQuestionRow(id) {
  subQuestionRows = subQuestionRows.filter((r) => r.id !== id);
  const prefixes = ['(a)', '(b)', '(c)', '(d)', '(e)', '(f)'];
  subQuestionRows.forEach((r, idx) => {
    r.prefix = prefixes[idx] || `(${String.fromCharCode(97 + idx)})`;
  });
  renderSubQuestionRows();
  syncSubMarksSum();
}

function renderSubQuestionRows() {
  const rowsEl = $('subQRows');
  if (!rowsEl) return;
  rowsEl.innerHTML = subQuestionRows.map((r) => `
    <div class="sub-q-row" data-sub-id="${r.id}">
      <span class="sub-q-row-prefix">${r.prefix}</span>
      <input class="input sub-q-row-input" type="text" placeholder="Sub-question prompt" value="${escapeHtml(r.text)}" data-sub-field="text">
      <div class="sub-q-row-stepper">
        <button type="button" data-sub-action="dec" title="Decrease sub-marks">−</button>
        <input type="number" min="1" max="50" value="${r.marks}" data-sub-field="marks">
        <button type="button" data-sub-action="inc" title="Increase sub-marks">+</button>
      </div>
      <button type="button" class="sub-q-del-btn" data-sub-action="del" title="Remove sub-part">
        ${ICON.trash}
      </button>
    </div>
  `).join('');

  rowsEl.querySelectorAll('.sub-q-row').forEach((rowEl) => {
    const id = rowEl.dataset.subId;
    const rowObj = subQuestionRows.find((r) => r.id === id);
    if (!rowObj) return;

    const textInput = rowEl.querySelector('[data-sub-field="text"]');
    textInput.addEventListener('focus', () => { lastTextField = textInput; });
    textInput.addEventListener('input', (e) => { rowObj.text = e.target.value; });

    const marksInput = rowEl.querySelector('[data-sub-field="marks"]');
    marksInput.addEventListener('input', (e) => {
      rowObj.marks = clamp(parseInt(e.target.value, 10) || 1, 1, 50);
      syncSubMarksSum();
    });

    rowEl.querySelector('[data-sub-action="dec"]').addEventListener('click', () => {
      rowObj.marks = clamp(rowObj.marks - 1, 1, 50);
      marksInput.value = rowObj.marks;
      syncSubMarksSum();
    });

    rowEl.querySelector('[data-sub-action="inc"]').addEventListener('click', () => {
      rowObj.marks = clamp(rowObj.marks + 1, 1, 50);
      marksInput.value = rowObj.marks;
      syncSubMarksSum();
    });

    rowEl.querySelector('[data-sub-action="del"]').addEventListener('click', () => {
      removeSubQuestionRow(id);
    });
  });
}

function syncSubMarksSum() {
  const chk = $('chkEnableSubQ');
  if (!chk || !chk.checked) return;
  const sum = subQuestionRows.reduce((acc, r) => acc + (Number(r.marks) || 0), 0);
  if ($('subMarksSum')) $('subMarksSum').textContent = sum;
  if (sum > 0) $('inputMarks').value = sum;
}

function adjustSubQuestionSpace(id, subIdx, delta) {
  const q = state.questions.find((item) => item.id === id);
  if (!q) return;
  if (!q.subAnswerSpaces) q.subAnswerSpaces = {};
  const current = q.subAnswerSpaces[subIdx] ? Number(q.subAnswerSpaces[subIdx]) : 70;
  q.subAnswerSpaces[subIdx] = clamp(current + delta, 40, 500);
  saveState();
  render();
  showToast(`Sub-question space set to ${q.subAnswerSpaces[subIdx]}px`, 'info');
}

function extractSubQuestions(text) {
  if (!text) return null;
  const lines = text.split('\n');
  const subList = [];
  const mainLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^\(([a-zA-Z0-9ivxlcdmIVXLCDM\u0985-\u09FA]+)\)\s*(.*?)(?:\s*\[(\d+)\])?$/);
    if (match) {
      subList.push({
        prefix: `(${match[1]})`,
        text: match[2].trim(),
        marks: match[3] ? parseInt(match[3], 10) : null
      });
    } else {
      if (subList.length === 0) {
        mainLines.push(line);
      } else {
        subList[subList.length - 1].text += ' ' + trimmed;
      }
    }
  }

  if (subList.length >= 2) {
    return {
      mainText: mainLines.join('\n').trim(),
      subQuestions: subList
    };
  }

  // Inline pattern e.g. "Consider ... (a) Determine ... [4]. (b) Identify ... [4]."
  const inlineRegex = /\(([a-zA-Z0-9\u0985-\u09FA]+)\)\s*([^(\[]+?)(?:\s*\[(\d+)\])?(?=\s*\([a-zA-Z0-9\u0985-\u09FA]+\)|$)/g;
  const inlineMatches = [];
  let im;
  while ((im = inlineRegex.exec(text)) !== null) {
    inlineMatches.push({
      prefix: `(${im[1]})`,
      text: im[2].trim().replace(/\.$/, ''),
      marks: im[3] ? parseInt(im[3], 10) : null
    });
  }
  if (inlineMatches.length >= 2) {
    const firstPos = text.indexOf(inlineMatches[0].prefix);
    const mainText = text.slice(0, firstPos).trim();
    return { mainText, subQuestions: inlineMatches };
  }

  return null;
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', active);
    $(tab.getAttribute('aria-controls')).classList.toggle('is-hidden', !active);
  });
}

function stepMarks(delta) {
  const input = $('inputMarks');
  input.value = clamp((parseInt(input.value, 10) || 0) + delta, 1, 50);
}

function setView(isKey, { silent = false } = {}) {
  state.config.showAnswerKey = isKey;
  document.body.dataset.view = isKey ? 'key' : 'student';
  $('viewStudentBtn').classList.toggle('is-active', !isKey);
  $('viewKeyBtn').classList.toggle('is-active', isKey);
  $('viewStudentBtn').setAttribute('aria-pressed', !isKey);
  $('viewKeyBtn').setAttribute('aria-pressed', isKey);
  $('modeChip').textContent = isKey ? 'Teacher answer key' : 'Student paper';
  if (silent) return;
  saveState();
  render();
  showToast(isKey ? 'Answer key on: correct options and solutions are visible' : 'Student view: clean paper', isKey ? 'success' : 'info');
}

function setZoom(index) {
  zoomIndex = clamp(index, 0, ZOOM_LEVELS.length - 1);
  $('examPaper').style.setProperty('--paper-zoom', ZOOM_LEVELS[zoomIndex]);
  $('zoomLevel').textContent = `${Math.round(ZOOM_LEVELS[zoomIndex] * 100)}%`;
  $('btnZoomOut').disabled = zoomIndex === 0;
  $('btnZoomIn').disabled = zoomIndex === ZOOM_LEVELS.length - 1;
}

// ---------------------------------------------------------------------------
// 3. Question CRUD
// ---------------------------------------------------------------------------
function handleAddQuestion(event) {
  if (event) event.preventDefault();

  const type = form.querySelector('input[name="qType"]:checked').value;
  const difficulty = form.querySelector('input[name="difficulty"]:checked').value;
  const marks = clamp(parseInt($('inputMarks').value, 10) || 1, 1, 50);
  const text = $('inputQuestionText').value.trim();
  const solution = $('inputSolution').value.trim();

  if (!text) return flagInvalid($('inputQuestionText'), 'Write the question first.');

  let options = [];
  let answer = '';
  let subQuestions = [];

  const chkSubQ = $('chkEnableSubQ');
  if (type === 'written' && chkSubQ && chkSubQ.checked) {
    const validSubs = subQuestionRows.filter((r) => r.text.trim());
    if (validSubs.length < 1) {
      return flagInvalid($('subQRows'), 'Add at least one sub-question prompt, or uncheck sub-questions.');
    }
    subQuestions = validSubs.map((r) => ({
      prefix: r.prefix,
      text: r.text.trim(),
      marks: Number(r.marks) || 1
    }));
  } else if (type === 'written') {
    // If not using the visual builder, automatically extract sub-questions from prompt text
    const extracted = extractSubQuestions(text);
    if (extracted && extracted.subQuestions.length >= 2) {
      subQuestions = extracted.subQuestions;
    }
  }

  if (type === 'mcq') {
    const inputs = [0, 1, 2, 3].map((i) => $(`opt${i}`));
    const values = inputs.map((el) => el.value.trim());
    const filled = values.filter(Boolean);
    const correctIndex = Number(form.querySelector('input[name="correctOption"]:checked').value);

    if (filled.length < 2) {
      return flagInvalid(inputs[values[0] ? 1 : 0], 'An MCQ needs at least two options.');
    }
    if (!values[correctIndex]) {
      return flagInvalid(inputs[correctIndex], `Option (${LETTERS[correctIndex]}) is marked correct but is empty.`);
    }
    options = filled;
    answer = values[correctIndex];
  }

  const subMarksSum = subQuestions.reduce((sum, s) => sum + (Number(s.marks) || 0), 0);
  const finalMarks = subMarksSum > 0 ? subMarksSum : marks;

  const question = {
    id: 'q_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type, difficulty, marks: finalMarks, text, options, answer, solution
  };

  if (subQuestions.length > 0) {
    question.subQuestions = subQuestions;
  }

  state.questions.push(question);
  lastAddedId = question.id;
  saveState();
  render();

  // Reset the text fields, keep type/difficulty for fast entry
  ['inputQuestionText', 'inputSolution', 'opt0', 'opt1', 'opt2', 'opt3'].forEach((id) => ($(id).value = ''));
  subQuestionRows = [];
  if (chkSubQ) chkSubQ.checked = false;
  if ($('subQContainer')) $('subQContainer').classList.add('is-hidden');
  renderSubQuestionRows();
  $('qCharCount').textContent = '0 chars';
  updateQuestionPreview();
  $('inputQuestionText').focus();

  document.querySelector(`.q-item[data-id="${question.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  showToast(`Added to Part ${type === 'mcq' ? 'A' : 'B'} · ${finalMarks} mark${finalMarks > 1 ? 's' : ''}`, 'success');
  setTimeout(() => (lastAddedId = null), 1900);
}

function deleteQuestion(id) {
  const index = state.questions.findIndex((q) => q.id === id);
  if (index === -1) return;
  const removed = state.questions[index];

  // Animate out, then remove from state
  document.querySelectorAll(`[data-id="${id}"]`).forEach((el) => el.classList.add('is-removing'));
  setTimeout(() => {
    state.questions = state.questions.filter((q) => q.id !== id);
    saveState();
    render();
    showToast('Question removed', 'info', {
      label: 'Undo',
      onClick: () => {
        state.questions.splice(index, 0, removed);
        lastAddedId = removed.id;
        saveState();
        render();
        setTimeout(() => (lastAddedId = null), 1900);
      }
    });
  }, 180);
}

function moveQuestion(id, direction) {
  const index = state.questions.findIndex((q) => q.id === id);
  if (index === -1) return;

  // Only swap with neighbours from the same part (A = MCQ, B = written)
  const isMcq = state.questions[index].type === 'mcq';
  const groupIndices = state.questions
    .map((q, i) => ((q.type === 'mcq') === isMcq ? i : -1))
    .filter((i) => i !== -1);

  const pos = groupIndices.indexOf(index);
  const swapIndex = groupIndices[direction === 'up' ? pos - 1 : pos + 1];
  if (swapIndex === undefined) return;

  [state.questions[index], state.questions[swapIndex]] = [state.questions[swapIndex], state.questions[index]];
  saveState();
  render();
}

function shufflePaperSet() {
  if (state.questions.length < 2) return showToast('Add at least two questions to shuffle.', 'warning');

  const partA = shuffleList(state.questions.filter((q) => q.type === 'mcq'));
  const partB = shuffleList(state.questions.filter((q) => q.type !== 'mcq'));
  state.questions = [...partA, ...partB];

  if (!state.sets || state.sets.length <= 1) {
    const code = (state.config.setCode || 'Set A').trim();
    state.config.setCode = /A$/i.test(code) ? code.replace(/A$/i, 'B')
                         : /B$/i.test(code) ? code.replace(/B$/i, 'A')
                         : 'Set B';
    if ($('cfgSetCode')) $('cfgSetCode').value = state.config.setCode;
    if (state.sets && state.sets[0]) {
      state.sets[0].setCode = state.config.setCode;
      state.sets[0].questions = state.questions;
    }
  } else {
    if (state.sets[state.activeSetIndex]) {
      state.sets[state.activeSetIndex].questions = state.questions;
    }
  }

  saveState();
  render();

  // Replay the staggered entrance animation
  const paper = $('examPaper');
  paper.classList.remove('is-shuffling');
  void paper.offsetWidth;
  paper.classList.add('is-shuffling');
  setTimeout(() => paper.classList.remove('is-shuffling'), 1200);

  showToast(`Shuffled. Active set: ${state.config.setCode}`, 'success');
}

function loadDemo() {
  const backup = JSON.parse(JSON.stringify(state));
  const keepView = state.config.showAnswerKey;
  state = freshState();
  state.config.showAnswerKey = keepView;
  afterBulkChange('Sample DBMS paper loaded', backup);
}

function clearAll() {
  if (!state.questions.length) return showToast('The paper is already empty.', 'info');
  const backup = JSON.parse(JSON.stringify(state));
  state.questions = [];
  state.sets = [{ id: 'set_a', setCode: state.config.setCode || 'Set A', questions: [] }];
  state.activeSetIndex = 0;
  afterBulkChange('All questions cleared', backup, 'warning');
}

function afterBulkChange(message, backup, type = 'success') {
  saveState();
  fillConfigForm();
  render();
  showToast(message, type, {
    label: 'Undo',
    onClick: () => {
      state = backup;
      saveState();
      fillConfigForm();
      setView(!!state.config.showAnswerKey, { silent: true });
      render();
    }
  });
}

function getEffectiveMarks(q) {
  let subs = (Array.isArray(q.subQuestions) && q.subQuestions.length > 0) ? q.subQuestions : null;
  if (!subs && q.type !== 'mcq') {
    const extracted = extractSubQuestions(q.text);
    if (extracted && extracted.subQuestions.length >= 2) {
      subs = extracted.subQuestions;
    }
  }
  if (subs && subs.length > 0) {
    const sum = subs.reduce((acc, s) => acc + (Number(s.marks) || 0), 0);
    if (sum > 0) return sum;
  }
  return Number(q.marks) || 1;
}

// ---------------------------------------------------------------------------
// 4. Diagnostics
// ---------------------------------------------------------------------------
function updateDiagnostics() {
  const qs = state.questions;
  // Auto-sync marks for questions with sub-parts so sum(sub-marks) = question total
  qs.forEach((q) => {
    const eff = getEffectiveMarks(q);
    if (q.marks !== eff) {
      q.marks = eff;
    }
  });

  const target = Math.max(1, Number(state.config.targetMarks) || 1);
  const total = qs.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
  const minutes = Math.ceil(qs.reduce(
    (sum, q) => sum + q.marks * (q.type === 'mcq' ? MINUTES_PER_MARK.mcq : MINUTES_PER_MARK.written), 0
  ));

  const partA = qs.filter((q) => q.type === 'mcq');
  const partB = qs.filter((q) => q.type !== 'mcq');
  const marksOf = (list) => list.reduce((sum, q) => sum + q.marks, 0);

  // Difficulty share (%) = marks in tier / total marks × 100
  const tiers = qs.reduce((acc, q) => ((acc[q.difficulty] = (acc[q.difficulty] || 0) + q.marks), acc),
    { easy: 0, medium: 0, hard: 0 });
  const pct = Object.fromEntries(
    Object.entries(tiers).map(([k, v]) => [k, total ? Math.round((v / total) * 100) : 0])
  );

  const status = total < target ? 'under' : total === target ? 'ready' : 'over';
  const stats = { total, target, minutes, partA, partB, partAMarks: marksOf(partA), partBMarks: marksOf(partB), pct, status };

  // --- Top bar
  document.body.dataset.marks = status;
  $('topMarks').textContent = total;
  $('topTarget').textContent = target;
  $('topProgressBar').style.width = `${Math.min(100, (total / target) * 100)}%`;
  $('topTime').textContent = formatMinutes(minutes);
  $('topStatusChip').textContent =
    status === 'under' ? `${target - total} to go` : status === 'ready' ? 'Ready ✓' : `+${total - target} over`;
  $('topSetChip').textContent = (state.config.setCode || 'A').replace(/^set\s*/i, '') || 'A';

  // --- Health card
  $('ringFill').style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - Math.min(1, total / target));
  $('ringValue').textContent = total;
  $('ringTarget').textContent = target;
  $('healthHeadline').textContent =
    status === 'under' ? `${target - total} marks to go`
    : status === 'ready' ? 'Ready to print'
    : `${total - target} marks over target`;
  $('statQuestions').textContent = qs.length;
  $('statTime').textContent = formatMinutes(minutes);
  $('statSplit').textContent = `${stats.partAMarks}/${stats.partBMarks}`;

  // --- Difficulty bar
  ['easy', 'medium', 'hard'].forEach((tier) => {
    const key = tier[0].toUpperCase() + tier.slice(1);
    $(`bar${key}`).style.flexGrow = total ? tiers[tier] : 1;
    $(`bar${key}`).style.opacity = total ? 1 : 0.2;
    $(`pct${key}`).textContent = `${pct[tier]}%`;
  });
  const verdict = balanceVerdict(total, pct);
  $('balanceVerdict').textContent = verdict.text;
  $('balanceVerdict').className = `verdict ${verdict.tone}`;

  return stats;
}

function balanceVerdict(total, pct) {
  if (!total) return { text: 'No questions', tone: 'muted' };
  if (pct.hard > 50) return { text: 'Too hard', tone: 'warn' };
  if (pct.easy > 60) return { text: 'Too easy', tone: 'warn' };
  const missing = ['easy', 'medium', 'hard'].find((t) => pct[t] === 0);
  if (missing) return { text: `No ${missing} questions`, tone: 'warn' };
  return { text: 'Well balanced', tone: 'ok' };
}

// ---------------------------------------------------------------------------
// 5. Rendering
// ---------------------------------------------------------------------------
function render() {
  if (state.sets && state.sets[state.activeSetIndex]) {
    state.sets[state.activeSetIndex].questions = state.questions;
  }
  const stats = updateDiagnostics();
  renderPaperPreview(stats);
  renderOutline(stats);
  renderSetSwitcher();
}

function renderPaperPreview(stats) {
  syncAnswerLinesUI();
  const c = state.config;
  const isKey = !!c.showAnswerKey;

  $('paperInstitute').textContent = c.institute || 'Institution Name';
  $('paperSubInstitute').textContent = c.subInstitute || '';
  $('paperSubInstitute').hidden = !c.subInstitute;
  $('paperCourseTitle').textContent = c.courseTitle || 'Course Code: Course Title';
  $('paperExamTitle').textContent = c.examTitle || '';
  $('paperTime').textContent = formatPaperTime(stats.minutes);
  $('paperFullMarks').textContent = stats.total;
  $('paperSetCode').textContent = c.setCode || 'Set A';
  $('paperInstructions').textContent = c.instructions || '';
  $('paperInstructionsBox').hidden = !c.instructions;

  $('partAMarks').textContent = `[${stats.partAMarks} Marks]`;
  $('partBMarks').textContent = `[${stats.partBMarks} Marks]`;

  $('partAList').innerHTML = stats.partA.length
    ? stats.partA.map((q, i) => questionHTML(q, i + 1, i, stats.partA.length, isKey)).join('')
    : `<div class="paper-empty">No multiple-choice questions yet. Add one from the studio panel.</div>`;

  $('partBList').innerHTML = stats.partB.length
    ? stats.partB.map((q, i) => questionHTML(q, stats.partA.length + i + 1, i, stats.partB.length, isKey)).join('')
    : `<div class="paper-empty">No written questions yet. Choose “Written” to add one.</div>`;

  const courseCode = (c.courseTitle || '').split(':')[0].trim();
  $('paperFootLeft').textContent = [courseCode, c.setCode, c.academicYear && `Session ${c.academicYear}`]
    .filter(Boolean).join('  ·  ');
  $('paperFootRight').textContent = isKey ? '— End of Answer Key —' : '— End of Question Paper —';
}

function questionHTML(q, number, posInPart, partLength, isKey) {
  const isMcq = q.type === 'mcq';
  const longOptions = isMcq && q.options.some((o) => o.length > 38);

  const options = isMcq ? `
    <div class="mcq-grid${longOptions ? ' one-col' : ''}">
      ${q.options.map((opt, i) => `
        <div class="mcq-opt${opt === q.answer ? ' is-correct' : ''}">
          <span class="mcq-letter">(${LETTERS[i]})</span><span>${richText(opt)}</span>
          <span class="mcq-check">${ICON.check}</span>
        </div>`).join('')}
    </div>` : '';

  const solution = q.solution ? `
    <div class="solution${isMcq ? '' : ' written'}">
      <span class="solution-label">${isMcq ? 'Explanation' : 'Model answer / marking guide'}</span>
      <div class="pre">${richText(q.solution)}</div>
    </div>` : '';

  // Check for sub-questions breakdown
  let subs = (Array.isArray(q.subQuestions) && q.subQuestions.length > 0) ? q.subQuestions : null;
  let mainText = q.text;

  if (!isMcq && !subs) {
    const extracted = extractSubQuestions(q.text);
    if (extracted && extracted.subQuestions.length >= 2) {
      subs = extracted.subQuestions;
      mainText = extracted.mainText || '';
    }
  }

  // Ensure total question mark matches sum of sub-marks (e.g. 3 + 3 = 6)
  let displayMarks = Number(q.marks) || 1;
  if (subs && subs.length > 0) {
    const subSum = subs.reduce((acc, s) => acc + (Number(s.marks) || 0), 0);
    if (subSum > 0) {
      displayMarks = subSum;
      if (q.marks !== subSum) q.marks = subSum;
    }
  }

  const showSpace = !isMcq && !isKey && !!state.config.showAnswerLines;
  const currentFormat = q.answerSpaceFormat || state.config.answerSpaceFormat || 'box';

  let subQuestionsHTML = '';
  let answerSpaceHTML = '';

  if (subs && subs.length > 0) {
    subs.forEach((sub) => {
      if (!sub.marks) sub.marks = Math.max(1, Math.round(q.marks / subs.length));
    });

    subQuestionsHTML = `
      <div class="sub-q-list">
        ${subs.map((sub, sIdx) => {
          const subHeight = q.subAnswerSpaces && q.subAnswerSpaces[sIdx]
            ? Number(q.subAnswerSpaces[sIdx])
            : calcDefaultAnswerSpace(sub.marks);

          const subAnswerSpace = showSpace ? `
            <div class="answer-space is-sub format-${currentFormat}" style="--space-h:${subHeight}px;" aria-label="Student unruled sub-answer space">
              <div class="answer-space-head">
                <span class="answer-cue">${sub.prefix} Answer:</span>
              </div>
              <div class="answer-space-body"></div>
              <div class="answer-space-controls screen-only">
                <button type="button" class="space-btn" data-action="sub-space-dec" data-id="${q.id}" data-sub-idx="${sIdx}" title="Reduce space (−20px)">
                  ${ICON.minus}
                </button>
                <span class="space-height-tag">${subHeight}px</span>
                <button type="button" class="space-btn plus" data-action="sub-space-inc" data-id="${q.id}" data-sub-idx="${sIdx}" title="Add space (+20px)">
                  ${ICON.plus} <span>Space</span>
                </button>
              </div>
            </div>` : '';

          return `
            <div class="sub-q-item">
              <span class="sub-q-prefix">${sub.prefix}</span>
              <div class="sub-q-body">
                <div class="sub-q-content">
                  <span class="sub-q-text">${richText(sub.text)}</span>
                  <span class="sub-q-marks">[${sub.marks}]</span>
                </div>
                ${subAnswerSpace}
              </div>
            </div>`;
        }).join('')}
      </div>`;
  } else {
    const currentHeight = q.answerSpace ? Number(q.answerSpace) : calcDefaultAnswerSpace(q.marks);
    answerSpaceHTML = showSpace ? `
      <div class="answer-space format-${currentFormat}" style="--space-h:${currentHeight}px;" aria-label="Student unruled answer space">
        <div class="answer-space-head">
          <span class="answer-cue">Answer:</span>
        </div>
        <div class="answer-space-body"></div>
        <div class="answer-space-controls screen-only">
          <button type="button" class="space-btn" data-action="space-dec" data-id="${q.id}" title="Reduce space (−25px)">
            ${ICON.minus}
          </button>
          <span class="space-height-tag">${currentHeight}px</span>
          <button type="button" class="space-btn plus" data-action="space-inc" data-id="${q.id}" title="Add more space (+25px)">
            ${ICON.plus} <span>Space</span>
          </button>
          <div class="space-divider"></div>
          <button type="button" class="space-btn" data-action="space-format" data-id="${q.id}" title="Cycle formatting: Box ➔ Underline ➔ Dotted">
            ${currentFormat}
          </button>
        </div>
      </div>` : '';
  }

  return `
    <div class="q-item${q.id === lastAddedId ? ' is-new' : ''}" data-id="${q.id}" style="--i:${posInPart}">
      ${toolsHTML(q.id, posInPart, partLength, 'q-tools', !isMcq)}
      <span class="q-num">${number}.</span>
      <div>
        <div class="q-text">${richText(mainText)}<span class="tag tag-${q.difficulty}">${q.difficulty}</span></div>
        ${options}
        ${subQuestionsHTML}
        ${isKey ? solution : answerSpaceHTML}
      </div>
      <span class="q-marks">[${displayMarks}]</span>
    </div>`;
}

function toolsHTML(id, pos, length, className, isWritten = false) {
  const spaceButton = isWritten && state.config.showAnswerLines ? `
    <button class="icon-btn" type="button" data-action="space-inc" data-id="${id}" title="Add space (+25px)">${ICON.plus}</button>` : '';

  return `
    <div class="${className}">
      ${spaceButton}
      <button class="icon-btn" type="button" data-action="up" data-id="${id}" title="Move up" ${pos === 0 ? 'disabled' : ''}>${ICON.up}</button>
      <button class="icon-btn" type="button" data-action="down" data-id="${id}" title="Move down" ${pos === length - 1 ? 'disabled' : ''}>${ICON.down}</button>
      <button class="icon-btn danger" type="button" data-action="delete" data-id="${id}" title="Delete">${ICON.trash}</button>
    </div>`;
}

function renderOutline(stats) {
  $('outlineCount').textContent = state.questions.length;

  if (!state.questions.length) {
    $('outlineList').innerHTML = `<div class="empty-state">Your paper is empty. Add a question to get started.</div>`;
    return;
  }

  const group = (title, list, offset, marks) => !list.length ? '' : `
    <div class="outline-group">
      <div class="outline-group-title">
        <span class="eyebrow">${title}</span>
        <span class="field-hint">${list.length} question${list.length > 1 ? 's' : ''} · ${marks} marks</span>
      </div>
      <div class="outline-items">
        ${list.map((q, i) => `
          <div class="outline-item" data-id="${q.id}">
            <span class="outline-num">${offset + i + 1}</span>
            <i class="dot bg-${q.difficulty}" title="${q.difficulty}"></i>
            <span class="outline-text" title="${escapeHtml(q.text)}">${escapeHtml(q.text)}</span>
            ${q.type !== 'mcq' ? `<span class="tag tag-type">Written</span>` : ''}
            <span class="outline-marks">${q.marks}</span>
            ${toolsHTML(q.id, i, list.length, 'outline-actions')}
          </div>`).join('')}
      </div>
    </div>`;

  $('outlineList').innerHTML =
    group('Part A · Multiple choice', stats.partA, 0, stats.partAMarks) +
    group('Part B · Written', stats.partB, stats.partA.length, stats.partBMarks);
}

// ---------------------------------------------------------------------------
// 6. Multi-Set Generator & Batch Export (Anti-Cheating)
// ---------------------------------------------------------------------------
const SET_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function shuffleList(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateMultipleSets(count, { shuffleOptions = true, keepSetAOriginal = true } = {}) {
  const num = clamp(parseInt(count, 10) || 4, 2, 8);
  if (state.questions.length < 2) {
    showToast('Add at least two questions before generating sets.', 'warning');
    return;
  }

  // Current questions as master base
  const masterQuestions = JSON.parse(JSON.stringify(state.questions));
  const newSets = [];

  for (let i = 0; i < num; i++) {
    const letter = SET_LETTERS[i];
    const isOriginalMaster = (i === 0 && keepSetAOriginal);

    let setQuestions = JSON.parse(JSON.stringify(masterQuestions));

    if (!isOriginalMaster) {
      // Split MCQ and Written
      const mcqs = setQuestions.filter((q) => q.type === 'mcq');
      const written = setQuestions.filter((q) => q.type !== 'mcq');

      // Shuffle MCQ questions and Written questions independently
      const shuffledMcqs = shuffleList(mcqs);
      const shuffledWritten = shuffleList(written);

      // If shuffleOptions is requested, shuffle options for each MCQ while preserving q.answer
      if (shuffleOptions) {
        shuffledMcqs.forEach((q) => {
          if (Array.isArray(q.options) && q.options.length > 1) {
            q.options = shuffleList(q.options);
          }
        });
      }

      setQuestions = [...shuffledMcqs, ...shuffledWritten];
    }

    newSets.push({
      id: `set_${letter.toLowerCase()}`,
      setCode: `Set ${letter}`,
      label: `Set ${letter}`,
      questions: setQuestions
    });
  }

  state.sets = newSets;
  state.activeSetIndex = 0;
  state.questions = newSets[0].questions;
  state.config.setCode = newSets[0].setCode;
  if ($('cfgSetCode')) $('cfgSetCode').value = newSets[0].setCode;

  saveState();
  render();
  renderGeneratedSetsList();

  const generatedSection = $('generatedSetsSection');
  if (generatedSection) {
    generatedSection.style.display = 'flex';
    generatedSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  showToast(`Successfully created ${num} randomized sets (Set A to Set ${SET_LETTERS[num - 1]})!`, 'success');
}

function selectSet(index, { silent = false } = {}) {
  const sets = state.sets || [];
  if (index < 0 || index >= sets.length) return;

  if (state.sets[state.activeSetIndex]) {
    state.sets[state.activeSetIndex].questions = state.questions;
  }

  state.activeSetIndex = index;
  state.questions = sets[index].questions;
  state.config.setCode = sets[index].setCode;
  if ($('cfgSetCode')) $('cfgSetCode').value = sets[index].setCode;

  saveState();
  render();
  renderGeneratedSetsList();

  if (!silent) {
    showToast(`Switched paper view to ${sets[index].setCode}`, 'info');
  }
}

function renderSetSwitcher() {
  const switcherBar = $('setSwitcherBar');
  const pillsContainer = $('setPillsContainer');
  const countBadge = $('topMultiSetChip');

  if (!switcherBar || !pillsContainer) return;

  const sets = state.sets || [];
  if (sets.length <= 1) {
    switcherBar.style.display = 'none';
    if (countBadge) countBadge.style.display = 'none';
    return;
  }

  switcherBar.style.display = 'flex';
  if (countBadge) {
    countBadge.style.display = 'inline-flex';
    countBadge.textContent = `${sets.length} Sets`;
  }

  pillsContainer.innerHTML = sets.map((s, idx) => `
    <button type="button" class="set-pill${idx === state.activeSetIndex ? ' is-active' : ''}" data-set-idx="${idx}" title="Switch paper view to ${s.setCode}">
      <span>${s.setCode}</span>
    </button>
  `).join('');

  pillsContainer.querySelectorAll('.set-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.setIdx);
      selectSet(idx);
    });
  });
}

function renderGeneratedSetsList() {
  const container = $('setsGridContainer');
  const summaryEl = $('generatedSetsSummary');
  if (!container) return;

  const sets = state.sets || [];
  if (sets.length === 0) return;

  if (summaryEl) {
    summaryEl.textContent = `Generated ${sets.length} Exam Sets (${sets.map((s) => s.setCode).join(', ')})`;
  }

  container.innerHTML = sets.map((set, idx) => {
    const mcqs = set.questions.filter((q) => q.type === 'mcq');
    const written = set.questions.filter((q) => q.type !== 'mcq');
    const totalMarks = set.questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
    const firstQText = set.questions[0]?.text || 'Empty';
    const isActive = idx === state.activeSetIndex;

    return `
      <div class="set-card${isActive ? ' is-active-card' : ''}" data-card-set-idx="${idx}">
        <div>
          <div class="set-card-head">
            <span class="set-badge">${set.setCode}</span>
            <span class="set-stat-tag">${totalMarks} Marks · ${set.questions.length} Qs</span>
          </div>
          <div class="text-xs text-slate-500 mb-2 font-medium">
            Part A: ${mcqs.length} MCQs · Part B: ${written.length} Written
          </div>
          <div class="set-preview-snippet" title="First question in this set">
            <strong>Q1:</strong> ${escapeHtml(firstQText)}
          </div>
        </div>

        <div class="set-card-actions">
          <button type="button" class="btn-print-set" data-action="print-set" data-set-idx="${idx}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>
            <span>Print / Save ${set.setCode} PDF</span>
          </button>
          <div class="set-card-sub-actions">
            <button type="button" class="btn btn-light btn-sm" data-action="download-html" data-set-idx="${idx}" title="Download standalone offline HTML file">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>Download HTML</span>
            </button>
            <button type="button" class="btn btn-light btn-sm" data-action="view-canvas" data-set-idx="${idx}" title="Display on Live Canvas">
              <span>${isActive ? 'Active on Paper' : 'Preview'}</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function printSingleSet(index) {
  selectSet(index, { silent: true });
  const c = state.config;
  const setObj = state.sets[index];
  const safeCourse = (c.courseTitle || 'Exam').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const safeSet = (setObj.setCode || 'Set').replace(/[^a-zA-Z0-9_-]/g, '_');
  const origTitle = document.title;
  document.title = `${safeCourse}_${safeSet}`;

  closeMultiSetsModal();

  window.print();

  setTimeout(() => {
    document.title = origTitle;
  }, 1000);
}

function printAllSets() {
  const sets = state.sets || [];
  if (sets.length === 0) return;

  const isKey = !!state.config.showAnswerKey;
  const container = $('batchPrintContainer');
  if (!container) return;

  container.innerHTML = sets.map((s) => generateSinglePaperHtml(s, isKey)).join('');

  document.body.dataset.printMode = 'batch';
  const c = state.config;
  const safeCourse = (c.courseTitle || 'Exam').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const origTitle = document.title;
  document.title = `${safeCourse}_All_${sets.length}_Sets_Booklet`;

  closeMultiSetsModal();

  window.print();

  const cleanup = () => {
    delete document.body.dataset.printMode;
    container.innerHTML = '';
    document.title = origTitle;
  };

  window.addEventListener('afterprint', cleanup, { once: true });
  setTimeout(cleanup, 2500);
}

function generateSinglePaperHtml(setObj, isKey = false) {
  const c = state.config;
  const qs = setObj.questions || [];
  const partA = qs.filter((q) => q.type === 'mcq');
  const partB = qs.filter((q) => q.type !== 'mcq');
  const marksOf = (list) => list.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
  const partAMarks = marksOf(partA);
  const partBMarks = marksOf(partB);
  const total = partAMarks + partBMarks;
  const minutes = Math.ceil(qs.reduce(
    (sum, q) => sum + (Number(q.marks) || 0) * (q.type === 'mcq' ? MINUTES_PER_MARK.mcq : MINUTES_PER_MARK.written), 0
  ));

  const courseCode = (c.courseTitle || '').split(':')[0].trim();
  const footLeft = [courseCode, setObj.setCode, c.academicYear && `Session ${c.academicYear}`].filter(Boolean).join('  ·  ');
  const footRight = isKey ? '— End of Answer Key —' : '— End of Question Paper —';

  const partAHtml = partA.length
    ? partA.map((q, i) => questionHTML(q, i + 1, i, partA.length, isKey)).join('')
    : `<div class="paper-empty">No multiple-choice questions yet.</div>`;

  const partBHtml = partB.length
    ? partB.map((q, i) => questionHTML(q, partA.length + i + 1, i, partB.length, isKey)).join('')
    : `<div class="paper-empty">No written questions yet.</div>`;

  return `
    <article class="paper batch-set-paper">
      <div class="paper-watermark" aria-hidden="true">ANSWER KEY</div>
      <div class="paper-body">
        ${isKey ? `
        <div class="key-stamp-wrap">
          <span class="confidential-stamp">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Answer Key · Confidential
          </span>
        </div>` : ''}

        <header class="paper-head">
          <svg class="paper-emblem" viewBox="0 0 48 48" fill="none" stroke="currentColor" aria-hidden="true">
            <circle cx="24" cy="24" r="22.5" stroke-width="1.2"/>
            <circle cx="24" cy="24" r="19" stroke-width="0.7"/>
            <g transform="translate(12 12)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>
            </g>
          </svg>
          <h2 class="paper-institute">${escapeHtml(c.institute || 'Institution Name')}</h2>
          ${c.subInstitute ? `<p class="paper-sub">${escapeHtml(c.subInstitute)}</p>` : ''}
          <div class="paper-ornament" aria-hidden="true">◆</div>
          <h3 class="paper-course">${escapeHtml(c.courseTitle || 'Course Code: Course Title')}</h3>
          ${c.examTitle ? `<p class="paper-exam">${escapeHtml(c.examTitle)}</p>` : ''}

          <div class="paper-meta">
            <div>Time: <b>${formatPaperTime(minutes)}</b></div>
            <span class="set-box">${escapeHtml(setObj.setCode || 'Set A')}</span>
            <div class="right">Full Marks: <b>${total}</b></div>
          </div>

          ${!isKey ? `
          <div class="candidate-box">
            <div class="candidate-field">Name <i></i></div>
            <div class="candidate-field">Student ID <i></i></div>
            <div class="candidate-field">Section <i></i></div>
          </div>` : ''}
        </header>

        ${c.instructions ? `
        <div class="paper-instructions">
          <b>Instructions:</b> <span>${escapeHtml(c.instructions)}</span>
        </div>` : ''}

        <section class="paper-section">
          <div class="section-head">
            <span class="section-tag">Part A</span>
            <h4 class="section-title">Multiple Choice Questions</h4>
            <span class="section-marks">[${partAMarks} Marks]</span>
          </div>
          <div class="q-list">${partAHtml}</div>
        </section>

        <section class="paper-section">
          <div class="section-head">
            <span class="section-tag">Part B</span>
            <h4 class="section-title">Written &amp; Analytical Questions</h4>
            <span class="section-marks">[${partBMarks} Marks]</span>
          </div>
          <div class="q-list">${partBHtml}</div>
        </section>
      </div>

      <footer class="paper-foot">
        <span>${escapeHtml(footLeft)}</span>
        <span class="end">${footRight}</span>
      </footer>
    </article>
  `;
}

function generateStandaloneHtml(setObj) {
  const isKey = !!state.config.showAnswerKey;
  const paperHtml = generateSinglePaperHtml(setObj, isKey);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(state.config.courseTitle || 'Exam')} - ${escapeHtml(setObj.setCode)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;0,700;1,400&family=Noto+Serif+Bengali:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <link rel="stylesheet" href="style.css">
  <style>
    body { background: #eef1f6; margin: 0; padding: 24px 12px; display: flex; justify-content: center; font-family: var(--font-paper); }
    .print-bar { position: fixed; top: 12px; right: 12px; z-index: 100; display: flex; gap: 8px; }
    .print-btn { background: #4f46e5; color: #fff; border: 0; padding: 8px 16px; border-radius: 8px; font-weight: 700; font-family: sans-serif; cursor: pointer; box-shadow: 0 4px 12px rgba(79,70,229,0.4); }
    @media print {
      body { background: #fff; padding: 0; }
      .print-bar { display: none !important; }
      .paper { box-shadow: none !important; }
    }
  </style>
</head>
<body data-view="${isKey ? 'key' : 'student'}">
  <div class="print-bar">
    <button class="print-btn" onclick="window.print()">🖨️ Print / Save PDF (${escapeHtml(setObj.setCode)})</button>
  </div>
  ${paperHtml}
</body>
</html>`;
}

function downloadSetHtml(index) {
  const sets = state.sets || [];
  if (!sets[index]) return;
  const setObj = sets[index];
  const html = generateStandaloneHtml(setObj);
  const c = state.config;
  const safeCourse = (c.courseTitle || 'Exam').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const safeSet = (setObj.setCode || 'Set').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeCourse}_${safeSet}.html`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`Downloaded ${setObj.setCode} HTML file`, 'success');
}

function downloadAllSetsHtml() {
  const sets = state.sets || [];
  if (sets.length === 0) return;

  showToast(`Downloading all ${sets.length} sets...`, 'info');
  sets.forEach((set, i) => {
    setTimeout(() => {
      downloadSetHtml(i);
    }, i * 350);
  });
}

function openMultiSetsModal() {
  const modal = $('modalMultiSets');
  if (!modal) return;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');

  if (state.sets && state.sets.length > 1) {
    const section = $('generatedSetsSection');
    if (section) section.style.display = 'flex';
    renderGeneratedSetsList();
    if ($('numSetsInput')) $('numSetsInput').value = state.sets.length;
    document.querySelectorAll('.set-count-chip').forEach((chip) => {
      chip.classList.toggle('is-active', Number(chip.dataset.count) === state.sets.length);
    });
  }
}

function closeMultiSetsModal() {
  const modal = $('modalMultiSets');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
}

function initMultiSets() {
  const numInput = $('numSetsInput');
  const quickChips = document.querySelectorAll('.set-count-chip');

  quickChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      quickChips.forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      if (numInput) numInput.value = chip.dataset.count;
    });
  });

  if (numInput) {
    numInput.addEventListener('input', () => {
      const val = Number(numInput.value);
      quickChips.forEach((c) => {
        c.classList.toggle('is-active', Number(c.dataset.count) === val);
      });
    });
  }

  const btnDoGenerate = $('btnDoGenerateSets');
  if (btnDoGenerate) {
    btnDoGenerate.addEventListener('click', () => {
      const count = clamp(parseInt($('numSetsInput')?.value, 10) || 4, 2, 8);
      const shuffleOptions = !!$('chkShuffleMcqOptions')?.checked;
      const keepSetAOriginal = !!$('chkKeepSetAOriginal')?.checked;
      generateMultipleSets(count, { shuffleOptions, keepSetAOriginal });
    });
  }

  const btnPrintAll = $('btnPrintAllSetsCombined');
  if (btnPrintAll) btnPrintAll.addEventListener('click', printAllSets);

  const btnDownloadAll = $('btnDownloadAllHtml');
  if (btnDownloadAll) btnDownloadAll.addEventListener('click', downloadAllSetsHtml);

  const setsGrid = $('setsGridContainer');
  if (setsGrid) {
    setsGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const idx = Number(btn.dataset.setIdx);

      if (action === 'print-set') {
        printSingleSet(idx);
      } else if (action === 'download-html') {
        downloadSetHtml(idx);
      } else if (action === 'view-canvas') {
        selectSet(idx);
        closeMultiSetsModal();
      }
    });
  }
}

// ---------------------------------------------------------------------------
// 7. Equation editor  (MathLive visual editor ⇄ LaTeX code → KaTeX preview)
// ---------------------------------------------------------------------------
// Templates use #? for an empty box the user fills in (MathLive placeholder syntax).
const EQ_PALETTE = {
  Basic: [
    '#?^{#?}', '#?_{#?}', '\\frac{#?}{#?}', '\\sqrt{#?}', '\\sqrt[#?]{#?}', '\\left(#?\\right)',
    '\\left|#?\\right|', '\\overline{#?}', '\\vec{#?}', '#?^{\\circ}', '\\pm', '\\times',
    '\\div', '\\cdot', '\\infty', '\\%'
  ],
  Calculus: [
    '\\int #?\\,dx', '\\int_{#?}^{#?} #?\\,dx', '\\iint #?\\,dA', '\\oint #?', '\\frac{d}{dx}\\left(#?\\right)',
    '\\frac{d#?}{d#?}', '\\frac{\\partial #?}{\\partial #?}', '\\lim_{#? \\to #?} #?', '\\sum_{#?}^{#?} #?',
    '\\prod_{#?}^{#?} #?', "#?'", '\\log_{#?} #?', '\\ln #?', '\\sin #?', '\\cos #?', '\\tan #?', 'e^{#?}'
  ],
  Greek: [
    '\\alpha', '\\beta', '\\gamma', '\\delta', '\\epsilon', '\\theta', '\\lambda', '\\mu', '\\pi', '\\rho',
    '\\sigma', '\\tau', '\\phi', '\\omega', '\\Gamma', '\\Delta', '\\Theta', '\\Lambda', '\\Sigma', '\\Phi', '\\Omega'
  ],
  Symbols: [
    '\\leq', '\\geq', '\\neq', '\\approx', '\\equiv', '\\propto', '\\in', '\\notin', '\\subset', '\\subseteq',
    '\\cup', '\\cap', '\\emptyset', '\\forall', '\\exists', '\\rightarrow', '\\Rightarrow', '\\Leftrightarrow',
    '\\therefore', '\\because', '\\angle', '\\perp', '\\parallel', '\\triangle'
  ],
  Matrices: [
    '\\begin{pmatrix} #? & #? \\\\ #? & #? \\end{pmatrix}',
    '\\begin{pmatrix} #? & #? & #? \\\\ #? & #? & #? \\\\ #? & #? & #? \\end{pmatrix}',
    '\\begin{vmatrix} #? & #? \\\\ #? & #? \\end{vmatrix}',
    '\\begin{bmatrix} #? \\\\ #? \\end{bmatrix}',
    '\\begin{cases} #? & #? \\\\ #? & #? \\end{cases}',
    '\\binom{#?}{#?}'
  ],
  Formulas: [
    'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}', 'a^2 + b^2 = c^2', '(a + b)^2 = a^2 + 2ab + b^2',
    '\\sin^2\\theta + \\cos^2\\theta = 1', 'A = \\pi r^2', 'e^{i\\pi} + 1 = 0',
    'F = ma', 'E = mc^2', 's = ut + \\frac{1}{2}at^2'
  ]
};

const FIELD_NAMES = {
  inputQuestionText: 'Question', inputSolution: 'Model solution',
  opt0: 'Option (a)', opt1: 'Option (b)', opt2: 'Option (c)', opt3: 'Option (d)'
};

const eq = { field: null, start: 0, end: 0, replacing: false, mode: 'inline', focus: 'visual', tab: 'Basic' };
const hasVisualEditor = () => !!window.customElements?.get('math-field');
const isEqOpen = () => $('eqOverlay').classList.contains('is-open');

function initEquationEditor() {
  const mf = $('eqField');

  // Quiet MathLive (no key-click sounds) once it has loaded
  window.customElements?.whenDefined('math-field').then(() => {
    const MFE = customElements.get('math-field');
    try { MFE.soundsDirectory = null; MFE.keypressSound = null; MFE.plonkSound = null; } catch (_) { /* older/newer API */ }
  });

  // Tabs + palette
  $('eqTabs').innerHTML = Object.keys(EQ_PALETTE)
    .map((name) => `<button type="button" class="eq-tab" role="tab" data-tab="${name}">${name}</button>`).join('');
  $('eqTabs').addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) renderEqPalette(tab.dataset.tab);
  });
  renderEqPalette(eq.tab);

  $('eqPalette').addEventListener('mousedown', (e) => e.preventDefault());   // keep the caret where it is
  $('eqPalette').addEventListener('click', (e) => {
    const key = e.target.closest('[data-i]');
    if (key) eqInsertTemplate(EQ_PALETTE[eq.tab][Number(key.dataset.i)]);
  });

  // Two-way sync: visual editor ⇄ LaTeX code
  mf.addEventListener('input', syncFromVisual);
  mf.addEventListener('focusin', () => (eq.focus = 'visual'));
  $('eqSource').addEventListener('input', syncFromSource);
  $('eqSource').addEventListener('focus', () => (eq.focus = 'source'));

  // Layout: inline vs own line
  document.querySelectorAll('.seg-light [data-mode]').forEach((btn) =>
    btn.addEventListener('click', () => setEqMode(btn.dataset.mode))
  );

  // Open / close / insert
  $('btnOpenEq').addEventListener('click', openEquationEditor);
  $('eqClose').addEventListener('click', closeEquationEditor);
  $('eqCancel').addEventListener('click', closeEquationEditor);
  $('eqInsert').addEventListener('click', insertEquation);
  $('eqOverlay').addEventListener('mousedown', (e) => {
    if (e.target === $('eqOverlay')) closeEquationEditor();
  });

  // Keyboard: Ctrl+M opens (from any form field); Esc / Ctrl+Enter inside the editor.
  // Capture phase so MathLive doesn't swallow the keys first.
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (isEqOpen()) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeEquationEditor(); }
      else if (mod && e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); insertEquation(); }
    } else if (mod && e.key.toLowerCase() === 'm' && e.target.closest?.('#addQuestionForm')) {
      e.preventDefault();
      openEquationEditor();
    }
  }, true);
}

function renderEqPalette(tabName) {
  eq.tab = tabName;
  document.querySelectorAll('.eq-tab').forEach((t) => {
    t.classList.toggle('is-active', t.dataset.tab === tabName);
    t.setAttribute('aria-selected', t.dataset.tab === tabName);
  });

  const palette = $('eqPalette');
  palette.classList.toggle('is-wide', tabName === 'Formulas' || tabName === 'Matrices');
  palette.innerHTML = EQ_PALETTE[tabName].map((tpl, i) => {
    const label = window.katex
      ? katex.renderToString(tpl.replace(/#\?/g, '\\square'), { throwOnError: false })
      : escapeHtml(tpl);
    return `<button type="button" class="eq-key" data-i="${i}" title="${escapeHtml(tpl.replace(/#\?/g, '□'))}">${label}</button>`;
  }).join('');

  // Restart the fade-in animation
  palette.style.animation = 'none';
  void palette.offsetWidth;
  palette.style.animation = '';
}

function openEquationEditor() {
  let field = lastTextField && document.body.contains(lastTextField) ? lastTextField : $('inputQuestionText');
  if (field.closest('.collapsible.is-collapsed')) field = $('inputQuestionText');   // MCQ options hidden

  eq.field = field;
  eq.start = field.selectionStart ?? field.value.length;
  eq.end = field.selectionEnd ?? eq.start;
  eq.replacing = false;

  // If the cursor sits inside an existing $…$, load it for editing
  let latex = '';
  let mode = 'inline';
  for (const m of field.value.matchAll(MATH_RE)) {
    if (eq.start > m.index && eq.start < m.index + m[0].length) {
      latex = (m[1] ?? m[2]).trim();
      mode = m[1] !== undefined ? 'block' : 'inline';
      eq.start = m.index;
      eq.end = m.index + m[0].length;
      eq.replacing = true;
      break;
    }
  }

  $('eqTitle').textContent = eq.replacing ? 'Edit equation' : 'Insert equation';
  $('eqInsert').textContent = eq.replacing ? 'Update equation' : 'Insert equation';
  $('eqTarget').textContent = FIELD_NAMES[field.id] || 'Field';
  $('eqSource').value = latex;
  setEqMode(mode);

  const visual = hasVisualEditor();
  $('eqOverlay').classList.toggle('no-visual', !visual);
  if (visual) $('eqField').setValue(latex, { silenceNotifications: true });
  eq.focus = visual ? 'visual' : 'source';
  renderEqPreview();

  $('eqOverlay').classList.add('is-open');
  $('eqOverlay').setAttribute('aria-hidden', 'false');
  setTimeout(() => (visual ? $('eqField') : $('eqSource')).focus(), 60);
}

function closeEquationEditor() {
  $('eqOverlay').classList.remove('is-open');
  $('eqOverlay').setAttribute('aria-hidden', 'true');
  if (eq.field) {
    eq.field.focus();
    eq.field.setSelectionRange(eq.end, eq.end);
  }
}

function insertEquation() {
  const latex = $('eqSource').value.replace(/\s*\n\s*/g, ' ').trim();
  if (!latex) return flagInvalid(eq.focus === 'visual' && hasVisualEditor() ? $('eqField') : $('eqSource'), 'The equation is empty.');

  const code = eq.mode === 'block' ? `$$ ${latex} $$` : `$${latex}$`;
  const field = eq.field;
  const name = FIELD_NAMES[field.id] || 'field';

  field.focus();
  if (eq.replacing) {
    field.setRangeText(code, eq.start, eq.end, 'end');
    field.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    field.setSelectionRange(eq.start, eq.end);
    insertAtCursor(field, code + ' ');
  }
  eq.end = field.selectionEnd;

  closeEquationEditor();
  showToast(eq.replacing ? `Equation updated in ${name}` : `Equation inserted into ${name}`, 'success');
}

function eqInsertTemplate(tpl) {
  if (eq.focus === 'visual' && hasVisualEditor()) {
    const mf = $('eqField');
    mf.focus();
    mf.insert(tpl, { format: 'latex', selectionMode: 'placeholder' });
    syncFromVisual();
    return;
  }
  // Fallback: insert raw LaTeX into the code box, caret in the first empty slot
  const src = $('eqSource');
  const start = src.selectionStart;
  const first = tpl.indexOf('#?');
  const text = tpl.replace(/#\?/g, '');
  src.focus();
  src.setRangeText(text, start, src.selectionEnd, 'end');
  if (first >= 0) src.setSelectionRange(start + first, start + first);
  syncFromSource();
}

function syncFromVisual() {
  if (eq.syncing) return;
  $('eqSource').value = cleanLatex($('eqField').value);
  renderEqPreview();
}

function syncFromSource() {
  if (hasVisualEditor()) {
    eq.syncing = true;
    $('eqField').setValue($('eqSource').value, { silenceNotifications: true });
    eq.syncing = false;
  }
  renderEqPreview();
}

// MathLive marks empty boxes as \placeholder{}; KaTeX doesn't know that command
function cleanLatex(latex) {
  return String(latex || '').replace(/\\placeholder(\[[^\]]*\])?\{[^}]*\}/g, '').trim();
}

function setEqMode(mode) {
  eq.mode = mode;
  document.querySelectorAll('.seg-light [data-mode]').forEach((b) =>
    b.classList.toggle('is-active', b.dataset.mode === mode)
  );
  renderEqPreview();
}

function renderEqPreview() {
  const latex = $('eqSource').value.trim();
  $('eqInsert').disabled = !latex;
  if (!latex) {
    $('eqPreview').innerHTML = `<span class="empty">Your equation will appear here exactly as it prints.</span>`;
    return;
  }
  const math = window.katex
    ? katex.renderToString(latex, { displayMode: eq.mode === 'block', throwOnError: false })
    : escapeHtml(latex);
  $('eqPreview').innerHTML = eq.mode === 'block'
    ? math
    : `<span class="ctx">…question text&nbsp;</span>${math}<span class="ctx">&nbsp;more text…</span>`;
}

// ---------------------------------------------------------------------------
// 7. Helpers
// ---------------------------------------------------------------------------
function showToast(message, type = 'info', action = null) {
  const icons = { success: '✓', info: 'i', warning: '!', error: '×' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span class="toast-msg">${escapeHtml(message)}</span>
    ${action ? `<button class="toast-action" type="button">${escapeHtml(action.label)}</button>` : ''}`;

  const dismiss = () => {
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 250);
  };
  if (action) {
    toast.querySelector('.toast-action').addEventListener('click', () => {
      action.onClick();
      dismiss();
    });
  }

  const stack = $('toastStack');
  stack.appendChild(toast);
  while (stack.children.length > 3) stack.firstElementChild.remove();
  setTimeout(dismiss, action ? 5000 : 2600);
}

function flagInvalid(el, message) {
  el.classList.remove('is-invalid');
  void el.offsetWidth;                   // restart the shake animation
  el.classList.add('is-invalid');
  el.focus();
  showToast(message, 'error');
}

function formatMinutes(m) {
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ''}`.trim();
}

function formatPaperTime(m) {
  if (m < 60) return `${m} Minutes`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return `${h} Hour${h > 1 ? 's' : ''}${rest ? ` ${rest} Minutes` : ''}`;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Rich text: plain text (English / বাংলা) is HTML-escaped, LaTeX math is rendered by KaTeX.
 *   $ … $   → inline math        $$ … $$ → centered block math
 *   \$       → a literal dollar sign
 * Inline $ must not touch a space on the inside and must not be followed by a digit,
 * so ordinary text like "costs $500 and $300" is NOT treated as math.
 */
const MATH_RE = /\$\$([\s\S]+?)\$\$|\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/g;

function richText(str) {
  const src = String(str ?? '').replace(/\\\$/g, '\uE000');   // protect escaped \$
  if (!window.katex) return escapeHtml(src).replace(/\uE000/g, '$');

  let html = '';
  let last = 0;
  for (const m of src.matchAll(MATH_RE)) {
    html += escapeHtml(src.slice(last, m.index));
    const isBlock = m[1] !== undefined;
    html += katex.renderToString(isBlock ? m[1] : m[2], {
      displayMode: isBlock,
      throwOnError: false,          // a typo shows in red instead of breaking the paper
      output: 'html'
    });
    last = m.index + m[0].length;
  }
  html += escapeHtml(src.slice(last));
  return html.replace(/\uE000/g, '$');
}

function updateQuestionPreview() {
  const text = $('inputQuestionText').value;
  $('qPreview').classList.toggle('is-hidden', !text.trim());
  $('qPreviewBody').innerHTML = richText(text);
}

function insertAtCursor(field, snippet) {
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? start;
  const before = field.value.slice(0, start);
  const needsSpace = before && !/\s$/.test(before);
  const text = (needsSpace ? ' ' : '') + snippet;

  field.focus();
  field.setRangeText(text, start, end, 'end');
  field.dispatchEvent(new Event('input', { bubbles: true }));   // refresh counter + preview
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', initApp);
