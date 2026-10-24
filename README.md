# Smart Exam Question Paper & Answer-Key Studio

A split-screen academic productivity web application designed to dynamically compose, balance, format, and print university-standard examination question papers and solution keys in real time.

## 🌟 Key Features

1. **Dual-Typography & Realistic A4 Simulation**:
   - Modern UI sans-serif (`Plus Jakarta Sans`) for studio controls.
   - Academic serif typography (`Crimson Pro` & `Noto Serif Bengali`) for the printable A4 paper.
   - Clean UI font stack (`Plus Jakarta Sans` & `Hind Siliguri`) for controls.
   - A4 sheet with institution crest, double-rule meta row, candidate Name/ID/Section fields, and an answer-key watermark.
   - Paper-health dashboard: marks progress ring, duration, Part A/B split, and a difficulty-balance verdict.
   - Undo for delete / clear / demo reset, inline form validation, and smooth micro-animations.

2. **Visual Interactive Equation Editor & Math Support**:
   - **Visual Math Input**: Powered by MathLive and KaTeX.
   - **Clickable Palette**: Fast insertion templates for Fractions, Powers, Radicals, Integrals, Limits, Greek letters, Symbols, Matrices, and Standard Formulas.
   - **Dual Editing**: Visual WYSIWYG editing or raw LaTeX editing with two-way synchronization.
   - **Inline (`$...$`) and Block (`$$...$$`) Modes**: Choose whether equations flow with text or display centered on their own line.
   - **Keyboard Shortcut**: Press `Ctrl + M` anywhere in the question, option, or solution fields to launch the editor.
   - **Live Math & Bangla Preview**: Real-time rendering right below the question textarea before adding to the paper.

3. **Full Bengali (বাংলা) & Multilingual Support**:
   - Native Bangla rendering across the exam sheet, question statements, options, rubrics, and header fields.
   - Automatic font fallback ensures English and Bengali characters look balanced and crisp together.

4. **Live Marks Target & Auto-Time Estimator**:
   - Real-time `.reduce()` calculation tracking current marks vs. target marks.
   - Dynamic progress bar with visual status cues:
     - Under target: Indigo status (`Need X more`).
     - Exact target: Emerald status (`Ready to Print ✓`).
     - Over target: Rose status (`Over by X!`).
   - Automated exam time estimation (1.5 min per MCQ mark, 2.5 min per Written mark).

5. **Difficulty Balance Distribution**:
   - 3-segment color-coded distribution bar (🟢 Easy, 🟡 Medium, 🔴 Hard) showing fair exam difficulty share.

6. **Unruled Handwriting Answer Space (Class Test / Quiz Mode)**:
   - One-click toggle in the preview toolbar and Exam Details settings.
   - Automatically renders clean, unruled handwriting space beneath written questions (no ruled lines, ideal for free-form answers, math derivations, and diagrams).
   - **Interactive Plus/Minus Sizing (`+` / `−`)**: Floating controls right on each question let the teacher dynamically expand (+25px) or reduce space to fit expected answer length.
   - **Formatting Styles**: Choose between **Clean Border Box** (enclosed response zone), **Open Whitespace** (minimalist underline), or **Dotted Frame**.
   - Preserved with crisp high-contrast boundaries in print/photocopy mode, and automatically replaced by model solutions when switching to Teacher Answer Key view.

7. **Sub-Question Mark Breakdown (e.g., `(a) [3] + (b) [2] = [5]`)**:
   - Split written questions into academic sub-parts `(a)`, `(b)`, `(c)` with individual sub-marks.
   - **Guided Builder**: Dynamic sub-question rows with auto-sum synchronization (`Sum(sub-marks) = Total marks`).
   - **Smart Text Extractor**: Automatically detects and parses `(a) ... [3]` and `(b) ... [2]` typed directly into the prompt box.
   - **University Exam Layout**: Indented sub-question rows with right-aligned sub-marks brackets `[3]`, `[2]`.
   - **Integrated Unruled Answer Spaces**: When Answer Space mode is active, each sub-part features its own designated unruled box with independent `+` and `−` size steppers.

8. **One-Click Teacher Answer Key Mode**:
   - Toggle instantly adds a red `OFFICIAL TEACHER ANSWER KEY & MARKING SCHEME` watermark stamp.
   - Correct MCQ options are highlighted in soft green with `✓` checkmarks.
   - Model solutions, derivations, and evaluation rubrics appear in dedicated callout boxes.

9. **Section Grouping (Part A & Part B)**:
   - **Part A:** Multiple Choice Questions with 2-column options `(a)`, `(b)`, `(c)`, `(d)` and right-aligned mark brackets `[2]`.
   - **Part B:** Written & Analytical questions with right-aligned mark brackets (e.g. `[5]`, `[10]`).

10. **Multi-Set Generator & Anti-Cheating Shuffler**:
   - **Custom Set Count (2 to 8 Sets)**: Generates as many randomized sets as requested (e.g. Set A, Set B, Set C, Set D) with 1 click.
   - **Independent Section Shuffling**: Reshuffles questions in Part A (MCQ) and Part B (Written) independently via Fisher–Yates so neighbor students cannot cheat.
   - **MCQ Option Randomization**: Randomizes the order of answer choices `(a)`, `(b)`, `(c)`, `(d)` while strictly preserving correct answer key linkages.
   - **Individual PDF Downloads**: Print or save each generated set as an individual isolated vector PDF (e.g., `CSE-204_Set_A.pdf`, `CSE-204_Set_B.pdf`).
   - **Combined Multi-Set Booklet**: One-click "Print All Sets" button that generates a single, contiguous multi-page exam booklet with automatic page-breaks between sets.
   - **Standalone Offline HTML Files**: Export self-contained offline `.html` documents for every set with embedded typography and print triggers.
   - **Interactive Canvas Set Switcher**: Switch instantly between `[Set A]`, `[Set B]`, `[Set C]`, `[Set D]` pills on the preview canvas with auto-synced diagnostics.

11. **Live Two-Way Header Synchronization**:
   - Keystroke-by-keystroke live binding for institution name, course title, exam session, instructions, and marks.

12. **Native Print-to-PDF Export**:
   - One-click `window.print()` with `@media print` rules that hide studio UI and export a margin-perfect A4 exam paper.

13. **Local Persistence**:
   - Automatically saves and restores draft states from `localStorage`.
   - Includes preset buttons to reload default DBMS sample questions or clear the canvas.

## 🚀 How to Run Locally

You can run this project with any local server or simply open `index.html` in your browser.

Using Node.js:
```bash
node server.js
```
Then navigate to: **http://localhost:3000**
