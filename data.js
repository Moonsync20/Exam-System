/**
 * Default sample data and templates for Smart Exam Question Paper Studio
 */

const DEFAULT_CONFIG = {
  institute: "Department of Computer Science & Engineering",
  subInstitute: "Faculty of Electrical & Computer Engineering",
  courseTitle: "CSE-204: Database Management Systems & Architecture",
  examTitle: "Mid-Semester Examination — Spring 2026",
  targetMarks: 30,
  setCode: "Set A",
  academicYear: "2025–2026",
  instructions: "Answer all questions from PART A and any TWO questions from PART B. Figures in the right-hand margin indicate full marks. Programmable calculators are not permitted.",
  showAnswerKey: false,
  showAnswerLines: false,
  answerSpaceFormat: "box"
};

const DEFAULT_QUESTIONS = [
  // PART A: MCQs (Objective)
  {
    id: "q_101",
    type: "mcq",
    difficulty: "easy",
    marks: 2,
    text: "Which relational algebra operator is used to select tuples from a relation that satisfy a given predicate?",
    options: [
      "Projection (π)",
      "Selection (σ)",
      "Cartesian Product (⨯)",
      "Join (⨝)"
    ],
    answer: "Selection (σ)",
    solution: "Selection (denoted by sigma 'σ') filters rows based on a boolean predicate condition, whereas Projection (π) selects specific attributes (columns)."
  },
  {
    id: "q_102",
    type: "mcq",
    difficulty: "medium",
    marks: 2,
    text: "In B+ Tree index structures of order m, what is the maximum number of keys that an internal node can hold?",
    options: [
      "m",
      "m - 1",
      "⌈m / 2⌉",
      "2m + 1"
    ],
    answer: "m - 1",
    solution: "An internal node in a B+ Tree of order m can possess at most m children pointers, which bounds its maximum number of search keys to m - 1."
  },
  {
    id: "q_103",
    type: "mcq",
    difficulty: "easy",
    marks: 2,
    text: "Which normal form strictly eliminates transitive functional dependencies for non-prime attributes?",
    options: [
      "First Normal Form (1NF)",
      "Second Normal Form (2NF)",
      "Third Normal Form (3NF)",
      "Boyce-Codd Normal Form (BCNF)"
    ],
    answer: "Third Normal Form (3NF)",
    solution: "3NF requires a relation to be in 2NF and mandates that no non-prime attribute is transitively dependent on any candidate key."
  },
  {
    id: "q_104",
    type: "mcq",
    difficulty: "hard",
    marks: 4,
    text: "Under the Strict Two-Phase Locking (Strict 2PL) protocol, when are exclusive (write) locks acquired by a transaction released?",
    options: [
      "Immediately after the specific data item write completes",
      "At the beginning of the shrinking phase",
      "Only after the transaction commits or aborts",
      "When the lock manager detects a potential deadlock cycle"
    ],
    answer: "Only after the transaction commits or aborts",
    solution: "Strict 2PL requires that all exclusive locks held by a transaction remain active until the transaction terminates (Commit or Abort) to guarantee strict recoverability and prevent cascading rollbacks."
  },

  // PART B: Written / Analytical
  {
    id: "q_201",
    type: "written",
    difficulty: "medium",
    marks: 5,
    text: "Transaction processing in relational database management systems:",
    subQuestions: [
      { prefix: "(a)", text: "Briefly explain the ACID properties of a database transaction.", marks: 3 },
      { prefix: "(b)", text: "Provide a concrete scenario demonstrating how the 'Atomicity' property prevents financial discrepancy during an inter-bank fund transfer.", marks: 2 }
    ],
    options: [],
    answer: "",
    solution: "(a) Atomicity (all-or-nothing), Consistency (state integrity), Isolation (concurrency control), Durability (persisted commits).\n(b) In bank transfer: Debit Acc A ($500) and Credit Acc B ($500). If system crashes after debiting Acc A but before crediting Acc B, Atomicity mandates rollback so Acc A balance is restored."
  },
  {
    id: "q_202",
    type: "written",
    difficulty: "hard",
    marks: 8,
    text: "Consider a relation $R(A, B, C, D, E)$ with Functional Dependencies $F = \\{ A \\to BC, CD \\to E, B \\to D, E \\to A \\}$:",
    subQuestions: [
      { prefix: "(a)", text: "Determine all candidate keys of relation $R$ with formal attribute closure derivations.", marks: 4 },
      { prefix: "(b)", text: "Identify the highest normal form of $R$ with formal mathematical justification.", marks: 4 }
    ],
    options: [],
    answer: "",
    solution: "(a) Candidate keys: {A}, {E}, {CD}, {BC} (derived from closures A+, E+, CD+, BC+ = {A,B,C,D,E}).\n(b) Highest Normal Form: 3NF. In B -> D, B is not a superkey, but D is a prime attribute (part of key CD). Hence it satisfies 3NF but violates BCNF."
  },
  {
    id: "q_203",
    type: "written",
    difficulty: "medium",
    marks: 7,
    text: "Storage engine architecture and physical index structures:",
    subQuestions: [
      { prefix: "(a)", text: "Contrast Clustered Indexing with Unclustered (Secondary) Indexing.", marks: 4 },
      { prefix: "(b)", text: "Why can a relational table have at most one clustered index on disk?", marks: 3 }
    ],
    options: [],
    answer: "",
    solution: "(a) A clustered index defines the physical sequential arrangement of records on disk blocks. Secondary indexes store search keys pointing to record addresses.\n(b) Because data rows can physically exist in only one sorted order on disk, only one clustered index is physically possible per table."
  }
];
