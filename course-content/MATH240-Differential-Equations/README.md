---
course: MATH240
title: Differential Equations
length_weeks: 16
credit_hours: 3
prerequisite: MATH227 (Calculus II) or equivalent
textbook: "Zill, *A First Course in Differential Equations with Modeling Applications*, 12th ed."
software: MATLAB (recommended) or MS Excel
tags: [course, math240, differential-equations, ode, syllabus]
---

# MATH240 — Differential Equations

A 16-week, first-class undergraduate course in **Ordinary Differential Equations
(ODEs)**: from first definitions through systems, modeling, numerical methods,
and the Laplace transform. Source material distilled from the
[D2L master document](../../docs/) into a structured set of weekly chapters
designed to be read like a textbook, worked like a workbook, and cross-linked
like an Obsidian vault.

---

## How this folder is organized

```
MATH240-Differential-Equations/
  README.md                           <- this file (start here)
  00-Syllabus.md                      <- formal syllabus, grading, policies
  01-Introduction-to-Differential-Equations.md
  02-Modeling-and-Direction-Fields.md
  03-First-Order-ODEs-Separable-and-Linear.md
  04-Substitution-Methods-and-Eulers-Method.md
  05-Numerical-Approximations.md
  06-Modeling-with-First-Order-ODEs.md
  07-Second-Order-Homogeneous-ODEs.md
  08-Second-Order-Nonhomogeneous-ODEs.md
  09-Cauchy-Euler-and-Nonlinear-ODEs.md
  10-Modeling-with-Higher-Order-ODEs.md
  11-Introduction-to-Laplace-Transforms.md
  12-Solving-ODEs-with-Laplace-Transforms.md
  13-Continuing-with-Laplace-Transforms.md
  14-Systems-of-Linear-First-Order-ODEs.md
  15-Nonhomogeneous-Systems-of-Linear-ODEs.md
  16-Final-Examination-and-Course-Review.md
  appendix/
    A-MATLAB-Primer.md
    B-Tables-and-Identities.md
    C-Glossary.md
```

Every chapter file follows the same template:

1. **Front matter** — week number, course objectives addressed, Zill sections
2. **Why this chapter** — one paragraph framing
3. **Learning Objectives** — measurable outcomes specific to the chapter
4. **Lecture Notes** — concept narrative, with formal definitions/theorems
5. **Worked Examples** — fully-solved canonical problems
6. **Practice Problems** — assigned homework set (Zill problem numbers)
7. **Discussion Prompts** — what to post in the weekly forum
8. **Self-Assessment** — 3–5 questions you should be able to answer cold
9. **Glossary / Key Terms** — vocabulary added in this chapter
10. **Connections** — backlinks to prior chapters, forward links to next

LaTeX is rendered inline (`$...$`) and display (`$$...$$`) — Obsidian's MathJax
handles both.

---

## Course Objectives (CO)

After completing the course, you should be able to:

- **CO1** — Solve ordinary differential equations using techniques such as
  reduction of order, method of undetermined coefficients, variation of
  parameters, power series, and Laplace transforms.
- **CO2** — Solve elementary applied science and engineering problems.
- **CO3** — Compute solutions to linear, separable, exact, and Cauchy-Euler
  differential equations.
- **CO4** — Solve systems of linear differential equations.
- **CO5** — Solve linear differential equations of higher order.
- **CO6** — Solve applications of second-order linear differential equations.

The matrix below shows where each CO is exercised:

| CO  | Chapters                                             |
| --- | ---------------------------------------------------- |
| CO1 | 02, 03, 04, 07, 09, 11, 12, 13, 14, 15               |
| CO2 | 01, 04, 05, 06, 09, 10, 11, 12, 13, 14, 15           |
| CO3 | 02, 03, 07                                           |
| CO4 | 04, 13, 14, 15                                       |
| CO5 | 06, 07, 08, 09, 13, 14, 15                           |
| CO6 | 10, 13, 14, 15                                       |

---

## Pacing

| Week | Chapter | Theme                                                      | Zill §            |
| ---- | ------- | ---------------------------------------------------------- | ----------------- |
| 1    | 01      | Definitions, terminology, IVPs, ODEs as models             | 1.1 – 1.3         |
| 2    | 02      | Direction fields, autonomous equations, separable, linear  | 2.1 – 2.3         |
| 3    | 03      | Exact equations, integrating factors                       | 2.4 – 2.5         |
| 4    | 04      | Substitution methods; Euler's method (intro)               | 2.5 – 2.6, 9.1    |
| 5    | 05      | Numerical methods: Euler, Improved Euler, Runge–Kutta      | 9.1 – 9.4         |
| 6    | 06      | Modeling with first-order ODEs                             | 3.1 – 3.3         |
| 7    | 07      | Linear higher-order theory; homogeneous constant-coef.     | 4.1, 4.3          |
| 8    | 08      | Undetermined coefficients; variation of parameters         | 4.4, 4.6          |
| 9    | 09      | Cauchy-Euler; nonlinear higher-order; reduction of order   | 4.2, 4.7, 4.10    |
| 10   | 10      | Spring-mass, RLC circuits, BVPs                            | 5.1 – 5.3         |
| 11   | 11      | Laplace transform, inverse, derivatives                    | 7.1 – 7.2         |
| 12   | 12      | Operational properties I (translations)                    | 7.3 – 7.4         |
| 13   | 13      | Operational properties II; Dirac delta; systems via L      | 7.4 – 7.6         |
| 14   | 14      | Systems of linear first-order ODEs (homogeneous)           | 8.1 – 8.2         |
| 15   | 15      | Nonhomogeneous systems; numerical systems                  | 8.2 – 8.3         |
| 16   | 16      | Final exam, course review, end-of-course feedback          | all               |

---

## Assessment overview

| Component                  | Weight |
| -------------------------- | ------ |
| Weekly discussions (15)    | 23%    |
| Honor Pledge               | 1%     |
| Quizzes (6)                | 35%    |
| Midterm (Week 8)           | 11%    |
| Final exam (Week 16)       | 30%    |

Quizzes 1 and 4 are weighted 5%; quizzes 2, 3, 5, 6 are weighted 6%. The full
breakdown lives in [`00-Syllabus.md`](./00-Syllabus.md).

---

## Recommended workflow

1. **Sunday.** Skim the chapter's *Why this chapter*, *Learning Objectives*,
   and *Worked Examples*. Identify what you already know vs. what is new.
2. **Monday – Tuesday.** Read the corresponding Zill sections cover-to-cover
   with paper and pencil. Re-derive every example before reading the
   solution.
3. **Wednesday.** Post your initial discussion contribution. Pick a problem
   from the discussion set, work it conceptually, and explain *why* the
   technique works — not just how.
4. **Thursday – Saturday.** Complete the practice set. Use the
   [MATLAB primer](./appendix/A-MATLAB-Primer.md) for any numerical work.
   When stuck, re-read the chapter's *Lecture Notes* and *Glossary*.
5. **Sunday.** Submit homework, reply to two classmates, and run through the
   *Self-Assessment* questions cold. If any of them stump you, that's your
   study target for the next week.

---

## Cross-cutting themes

Mathematics is a language. Throughout the course, three threads recur:

- **Solutions are functions, not numbers.** An ODE asks "which function
  satisfies this rate-of-change relationship?" — never "what is the value
  of $x$?"
- **Existence and uniqueness come first.** Before solving, ask whether a
  solution exists, whether it's unique, and on what interval it is defined.
- **Classify before you solve.** Order, linearity, homogeneity, and
  autonomy together determine which technique applies. The classification
  table is built up over Chapters 1–4 and used through Chapter 15.

---

## License & attribution

Course design and weekly framing adapted from MATH240 at American Public
University System. Textbook references point to Zill, *A First Course in
Differential Equations with Modeling Applications*, 12th ed. (Brooks/Cole).
This chapter set is an instructional reorganization of the publicly-shared
D2L outline; problem numbers correspond to the 12th edition.
