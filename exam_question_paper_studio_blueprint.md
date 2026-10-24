# Project Specification: Smart Exam Question Paper & Answer-Key Studio

**Project Level:** Mid-Semester Individual Project  
**Tech Stack:** HTML5, CSS3, Tailwind CSS (via CDN), Vanilla JavaScript (ES6+)  
**Estimated Code Size:** ~180–220 Lines of Clean JavaScript  

---

## 1. Project Overview
The **Smart Exam Question Paper & Answer-Key Studio** is a split-screen academic productivity web application. It allows teachers, tutors, and students to dynamically create, organize, balance, and print university-standard exam papers and solution keys in real time. 

Instead of wrestling with word processor formatting, users input or import questions in a sleek studio control panel on the left and watch a live, crisp A4 exam sheet format itself automatically on the right.

---

## 2. Clean & Beautiful UI/UX Design System

A core requirement of this project is a **clean, modern, and visually striking interface** that feels like a polished SaaS product. 

### 2.1 Color Palette & Contrast Strategy
We use a **"Dark/Slate Studio vs. Crisp White Paper"** contrast model so the user's eye naturally focuses on the live exam sheet:
* **App Background (Workspace):** Soft Slate (`bg-slate-100`) with subtle radial dot styling.
* **Top Navigation & Diagnostic Bar:** Deep Slate (`bg-slate-900 text-white`) with subtle glassmorphism (`backdrop-blur-md bg-slate-900/95`).
* **Left Builder Cards:** Clean White (`bg-white`) with soft borders (`border border-slate-200/80`) and subtle elevation (`shadow-sm`).
* **Primary Accent Color:** Indigo (`indigo-600` for primary buttons, `hover:bg-indigo-500`, `focus:ring-2 focus:ring-indigo-500/20`).
* **Status & Diagnostic Colors:**
  * **Easy / Matched Target:** Emerald (`emerald-500` / `bg-emerald-50 text-emerald-700`)
  * **Medium / Warning:** Amber (`amber-500` / `bg-amber-50 text-amber-700`)
  * **Hard / Over-Target Alert:** Rose (`rose-500` / `bg-rose-50 text-rose-700`)

### 2.2 Dual-Typography System
Using two distinct font families via Google Fonts immediately elevates the visual quality:
1. **UI & Controls Font (`Inter` or `Plus Jakarta Sans`):** Clean, geometric sans-serif for forms, badges, stats, and buttons.
2. **Exam Paper Preview Font (`Merriweather`, `Lora`, or `Crimson Pro`):** Classic academic serif font exclusively inside the A4 paper preview container so it looks like a real printed university question paper.

### 2.3 Visual Polish & Micro-Interactions
* **A4 Paper Realism:** The right-side preview container uses `bg-white shadow-2xl rounded-sm border border-slate-200 px-10 py-12 min-h-[842px]` to mimic the exact proportions and depth of a physical sheet of paper.
* **Hover Action Reveal:** Delete (`🗑️`) and Move Up/Down (`↑` `↓`) buttons on individual questions remain invisible (`opacity-0 group-hover:opacity-100 transition-opacity`) until the user hovers over a question block on the paper.
* **Tactile Buttons:** All interactive buttons use `transition-all duration-150 active:scale-95` for smooth click feedback.

---

## 3. Layout Architecture (12-Column Responsive Grid)

```text
+-----------------------------------------------------------------------------------+
| TOP BAR: Logo | Marks Progress (25/30) | Est. Time | Answer Key Toggle | Print PDF|
+-----------------------------------+-----------------------------------------------+
| LEFT STUDIO PANEL (5 Cols)        | RIGHT LIVE A4 PAPER PREVIEW (7 Cols)          |
|                                   |                                               |
| [1. Exam Header Config Card]      |   =========================================   |
|  - Institute Name & Course Title  |          UNIVERSITY / INSTITUTE NAME          |
|  - Target Marks & Set Code (A/B)  |      Course: Physics (CT-01) | Set: A         |
|                                   |      Time: 45 Mins           | Marks: 25/30   |
| [2. Add Question Form Card]       |   -----------------------------------------   |
|  - Type: MCQ / Short / Broad      |   PART A: OBJECTIVE (MCQ)                     |
|  - Difficulty: Easy / Med / Hard  |   1. Question text here...              [2]   |
|  - Marks Input & Question Text    |      (a) Opt 1          (b) Opt 2             |
|  - Dynamic 4-Option Grid (if MCQ) |      (c) Opt 3          (d) Opt 4             |
|  - Solution / Answer Note         |                                               |
|  - [+ Add Question to Paper]      |   PART B: WRITTEN / ANALYTICAL                |
|                                   |   2. Derive the expression for...       [5]   |
| [3. Quick Actions & Bank]         |      [Ans Key: Use Vy = u*sin(theta) - gt]    |
|  - [Shuffle Set A <-> Set B]      |   =========================================   |
|  - [Load Demo Question Set]       |                                               |
+-----------------------------------+-----------------------------------------------+
```

---

## 4. Core Functional Features (Mid-Term Scope)

### Feature 1: Live Marks Target & Auto-Time Estimator
* Users set a **Target Marks** goal (e.g., `30 Marks`).
* Every added or deleted question triggers `calculateDiagnostics()` using `.reduce()`.
* **Visual Progress Bar:**
  * Under target: Indigo bar (`20 / 30 Marks — Need 10 more`).
  * Exact match: Emerald bar (`30 / 30 Marks — Ready to Print!`).
  * Exceeded target: Rose bar (`35 / 30 Marks — Over by 5 Marks!`).
* **Smart Time Calculator:** Automatically estimates exam duration (`1.5 min` per MCQ mark, `2.5 mins` per Written mark).

### Feature 2: One-Click "Teacher Answer Key" Mode
* A clean toggle switch in the navbar flips `paperConfig.showAnswerKey`.
* **Student View (OFF):** Renders a clean exam sheet ready for students.
* **Teacher Key View (ON):** Stamps a red `"ANSWER KEY / CONFIDENTIAL"` badge in the paper header, highlights correct MCQ options in soft green, and displays solution boxes under written questions.

### Feature 3: Automatic Section Grouping (Part A & Part B)
* Regardless of the order in which questions are added, JavaScript `.filter()` automatically sorts and renders:
  * **Section A — Multiple Choice Questions:** Displayed with compact 2-column option grids `(a), (b), (c), (d)`.
  * **Section B — Short & Broad Written Questions:** Displayed with formal numbering, right-aligned mark brackets `[5]`, and optional answer-space lines.

### Feature 4: Difficulty Balance Meter
* Calculates the percentage of marks allocated to `Easy`, `Medium`, and `Hard` questions:
  $$\text{Difficulty Share (\%)} = \left( \frac{\text{Marks in Difficulty Tier}}{\text{Total Paper Marks}} \right) \times 100$$
* Displays a 3-segment color bar (Emerald / Amber / Rose) so the teacher can verify at a glance if the exam is fair and balanced.

### Feature 5: Anti-Cheating Set Shuffler & Demo Preset Loader
* **Shuffle Exam Set:** One click randomizes the order of questions inside each section and toggles the paper header between `Set Code: A` and `Set Code: B`.
* **Pre-Loaded Demo Data:** Initializes with 6 realistic sample questions in `localStorage` so the application looks full and ready for immediate evaluation.

### Feature 6: Native Print-to-PDF Export
* Uses Tailwind's `print:` utilities (`print:hidden` on the left panel and navbar; `print:w-full print:shadow-none print:m-0` on the A4 sheet).
* Clicking **"Print / Save PDF"** calls `window.print()`, producing a crisp, margin-perfect PDF of either the Student Question Paper or the Teacher Answer Key.

---

## 5. JavaScript State & Architecture

Keep the codebase clean and modular inside a single script or 3-file setup (`index.html`, `data.js`, `app.js`):

```javascript
// 1. Application State (Saved to localStorage)
const state = {
  config: {
    institute: "Department of Computer Science & Engineering",
    courseTitle: "CSE-204: Database Management Systems (Mid-Term)",
    targetMarks: 25,
    setCode: "Set A",
    showAnswerKey: false
  },
  questions: [
    {
      id: "q_101",
      type: "mcq",          // "mcq" | "short" | "broad"
      difficulty: "easy",   // "easy" | "medium" | "hard"
      marks: 2,
      text: "Which SQL keyword is used to eliminate duplicate rows in a query result?",
      options: ["UNIQUE", "DISTINCT", "GROUP BY", "DIFFERENT"],
      answer: "DISTINCT"
    }
  ]
};
```

### Core Functions Breakdown (For Viva Defense)
1. `initApp()` — Loads saved state from `localStorage` (or falls back to default demo questions) and triggers initial render.
2. `handleAddQuestion(event)` — Reads form fields, validates input, appends a new question object to `state.questions`, saves to `localStorage`, and refreshes the UI.
3. `deleteQuestion(id)` & `moveQuestion(id, direction)` — Removes an item using `.filter()` or swaps adjacent array indices to reorder questions.
4. `shufflePaperSet()` — Randomizes question sequence and flips `Set A` $\leftrightarrow$ `Set B`.
5. `updateDiagnostics()` — Uses `.reduce()` to compute current marks, estimated duration, and difficulty distribution percentages.
6. `renderPaperPreview()` — Dynamically builds the HTML for Section A and Section B and injects it into the A4 sheet DOM container.

---

## 6. Viva / Evaluation Presentation Checklist
When demonstrating this project to your instructor:
1. **First Impression:** Show the pre-loaded exam paper on the right and point out the dual-font academic styling.
2. **Live Binding:** Change the *Institute Name* or *Target Marks* on the left and show it updating keystroke-by-keystroke on the A4 sheet.
3. **Dynamic Form Toggle:** Switch Question Type between `MCQ` and `Broad Question` to show the 4-option input fields smoothly appearing/disappearing.
4. **Teacher Key & Shuffle:** Click **"Answer Key Mode"** to reveal green solutions, then click **"Shuffle Set"** to generate `Set B`.
5. **Print Preview:** Click **"Print / Save PDF"** (`window.print()`) to show how all studio controls vanish, leaving only the clean A4 exam paper.