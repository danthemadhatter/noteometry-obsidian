---
chapter: 16
week: 16
title: "Final Examination and Course Review"
zill_sections: ["all"]
course_objectives: [CO1, CO2, CO3, CO4, CO5, CO6]
tags: [math240, week16, final-exam, review, end-of-course]
prev: "15-Nonhomogeneous-Systems-of-Linear-ODEs.md"
next: null
---

# Chapter 16 — Final Examination and Course Review

> The course closes with a comprehensive final exam emphasizing the second
> half of the course. This chapter is your **review companion**: a single
> document that connects every technique you have learned, organized so
> you can self-assess and patch gaps efficiently.

---

## 16.0  Why this chapter

You have spent fifteen weeks accumulating tools. The final exam will ask
you to *select* the right tool for an unfamiliar problem and apply it
under time pressure. The single skill that distinguishes a strong final
performance is **classification** — five seconds of diagnosis up front
saves five minutes of dead-end algebra.

This review chapter is organized around the **decision tree** you should
mentally run for any ODE you encounter, plus a curated set of full-course
self-assessment questions.

---

## 16.1  Course objectives revisited

Before reviewing techniques, confirm you can articulate the six course
objectives in your own words:

- **CO1** — Solve ordinary differential equations using techniques such as
  reduction of order, method of undetermined coefficients, variation of
  parameters, power series, and Laplace transforms.
- **CO2** — Solve elementary applied science and engineering problems.
- **CO3** — Compute solutions to linear, separable, exact, and Cauchy-Euler
  differential equations.
- **CO4** — Solve systems of linear differential equations.
- **CO5** — Solve linear differential equations of higher order.
- **CO6** — Solve applications of second-order linear differential equations.

If any of these doesn't match a chapter and a technique you can produce
on demand, that's a gap to close *before* the exam.

---

## 16.2  The decision tree

```
Given:    a y'' + b y' + c y = g(t)   (or similar)
                  │
                  ▼
        ┌──────────────────────┐
        │  How many variables? │
        └──────────────────────┘
            │              │
       single             system
       (chs 1-13)        (chs 14-15)
            │              │
            ▼              ▼
       ┌────────┐     ┌────────────┐
       │ Order? │     │ Solve via  │
       └────────┘     │ eigenvalues│
        1st  │  2nd+   │ + variation│
        │    │         │ of params  │
        ▼    ▼         └────────────┘
   ┌───────┐ ┌─────────────────────┐
   │Linear?│ │Constant coefficients?│
   └───────┘ └─────────────────────┘
   yes  no    yes    no (Cauchy-Euler)
   │    │     │        │
   │    ▼     ▼        ▼
   │  Sub-  Charac-  Try y = x^m
   │  stitu- teris-   (ch 9)
   │  tion   tic
   │  (ch 4) eqn,
   │         then
   ▼         UC or
 Inte-       VoP
 grating     (ch 8)
 factor    │
 OR exact  ▼
 OR sep.    Forced?
 (chs 2-3)
            yes  no
            │    │
            ▼    ▼
          UC or  Done
          VoP    (homogeneous,
          OR     ch 7)
        Laplace
        (chs 11-13)
```

Roughly: **classify by order, linearity, coefficient type, and forcing**;
that quartet selects the technique.

---

## 16.3  Comprehensive technique inventory

| Class                               | Technique                          | Chapter |
| ----------------------------------- | ---------------------------------- | ------- |
| 1st-order separable                 | Direct integration                 | 2, 3    |
| 1st-order linear                    | Integrating factor $\mu = e^{\int P}$ | 2, 3 |
| 1st-order exact                     | Find $F$ with $F_{x} = M, F_{y} = N$ | 3     |
| 1st-order non-exact                 | Integrating factor $\mu(x)$ or $\mu(y)$ | 3   |
| 1st-order homogeneous coefficients  | $y = u\,x$ substitution           | 4       |
| 1st-order Bernoulli                 | $w = y^{1-n}$ substitution         | 4       |
| 1st-order numerical                 | Euler / Heun / RK4                 | 4, 5    |
| Higher-order constant-coef. homog.  | Characteristic equation            | 7       |
| Higher-order constant-coef. forced  | Undetermined coefficients          | 8       |
| Higher-order, general linear        | Variation of parameters            | 8       |
| Higher-order Cauchy-Euler           | $y = x^{m}$ or $x = e^{t}$         | 9       |
| Higher-order, one solution known    | Reduction of order                 | 9       |
| Modeling problems                   | (any of the above)                 | 6, 10   |
| BVP                                 | (specific case, no general method) | 10      |
| IVP with discontinuous forcing      | Laplace transform + step functions | 11–13   |
| Impulse response                    | Laplace + Dirac delta              | 13      |
| Periodic forcing                    | Laplace + periodic-function formula| 13      |
| Linear systems, homogeneous         | Eigenvalues / eigenvectors         | 14      |
| Linear systems, nonhomogeneous      | UC vector form / VoP / Laplace     | 15      |
| Nonlinear / no closed form          | Numerics (RK4 vector form)         | 5, 15   |

If a class on this list is unfamiliar, return to the indicated chapter and
re-do the worked examples from scratch.

---

## 16.4  Comprehensive self-assessment (mock exam)

Set a 90-minute timer and try these without the textbook. Solutions are
not provided — verify by direct substitution and consistency with chapter
worked examples.

1. Solve $\dfrac{dy}{dx} = \dfrac{x \sin x}{y}$ with $y(0) = -1$.
2. Solve $y' + (\tan x)\,y = \sin 2 x$ on $(-\pi/2, \pi/2)$ with
   $y(0) = 1$.
3. Solve the Bernoulli equation $y' = y - x y^{2},\ y(0) = 1$.
4. Implement RK4 with $h = 0.1$ to estimate $y(0.5)$ for $y' = y - x^{2}\,
   y^{2},\ y(0) = 1$.
5. Solve $y'' + 6 y' + 13 y = 0$ with $y(0) = 1, y'(0) = 0$.
6. Solve $y'' - 4 y' + 4 y = e^{2 t} t$.
7. Solve $x^{2} y'' - x y' + y = \ln x,\ x > 0$.
8. Mass $m = 2$ kg, spring $k = 50$ N/m, damper $c = 10$ N·s/m, no forcing.
   Find $\omega_{0}, \zeta$, classify, and write the free response with
   $x(0) = 0.1, \dot{x}(0) = 0$.
9. Same system, drive with $F(t) = 20 \cos 5 t$ N. Find the steady-state
   amplitude.
10. Solve $\ddot{q} + 2 \dot{q} + 5 q = u(t - 1),\ q(0) = \dot{q}(0) = 0$
    via Laplace.
11. Solve $\dot{x} = -x + y,\ \dot{y} = -2 x - 3 y,\ x(0) = 1, y(0) = 0$
    via eigenvalues.
12. Solve $\dot{\mathbf{x}} = \begin{pmatrix} 1 & 2 \\ 3 & 2
    \end{pmatrix}\,\mathbf{x} + \begin{pmatrix} 0 \\ -8 t \end{pmatrix}$
    via variation of parameters.

When you finish, score yourself: full credit only if your method matches
the problem class and your answer is verifiable. Anything less is a study
target.

---

## 16.5  Final exam — due this week

- **Coverage:** comprehensive (Weeks 1–14), with **emphasis** on material
  after the midterm: higher-order linear, modeling, Laplace transforms,
  and systems.
- **Format:** **2-hour, online**, open book, open notes; calculators and
  computers permitted.
- **Weight:** 30%.

Submit by 11:55 p.m. ET on Sunday of Week 16.

**Final-exam hygiene checklist.**

- [ ] Have your personal Laplace table on hand (built up through Weeks 11–13).
- [ ] Have MATLAB / Excel ready for any numerical question.
- [ ] Read each problem fully before starting; classify before reaching for
      a method.
- [ ] Track units and signs religiously in modeling problems.
- [ ] Verify by substitution when time permits — Laplace inversions are
      especially error-prone.

---

## 16.6  Discussion prompt — *W16: End of Course Feedback*

The Week 16 discussion is a **course retrospective**. Required posts:

1. **What did you learn** — pick the *one* technique or concept that most
   changed how you think about engineering and explain why.
2. **What was hardest** — describe the topic that took you longest to
   master and what unblocked you.
3. **What would you change** — give one specific, actionable suggestion
   for the course (a topic to expand, a problem to drop, a tool to use,
   etc.).

Reply to ≥ 2 classmates. The instructor uses these posts to refine the
course for future cohorts; your honesty helps.

---

## 16.7  Where to go next

ODEs are the foundation. Likely next steps for an EE / engineering
trajectory:

- **Partial differential equations (MATH320 or equivalent).** Wave, heat,
  Laplace equations; separation of variables; Fourier series. Almost
  every PDE technique reduces a PDE to a family of ODEs.
- **Linear algebra (deeper).** Jordan form, singular value decomposition,
  numerical linear algebra. Necessary for control theory and signal
  processing.
- **Control theory.** State-space methods, transfer functions, stability,
  controllability, observability. Lives entirely on the foundation of
  Chapters 11–15.
- **Signal processing.** Fourier and $\mathcal{Z}$-transforms; cousin of
  the Laplace transform. The convolution theorem you learned is the same
  convolution that defines linear filters.
- **Nonlinear dynamics and chaos.** Phase portraits in higher dimensions,
  bifurcations, attractors. Builds directly on Chapter 14.

A note from the instructor (paraphrased from Zill): *learning how to learn
is the most important commodity gleaned from a university education.*
ODEs are an excellent training ground because they are mechanical enough
to be tractable and rich enough to contain real intellectual depth.

---

## 16.8  End-of-course glossary cheat sheet

See [`appendix/C-Glossary.md`](./appendix/C-Glossary.md) for the
consolidated A–Z glossary; it pulls together every term defined in
Chapters 1–15.

---

## 16.9  Connections back

- **Builds on:** every prior chapter.
- **Cross-cutting themes (revisited):**
  - *Solutions are functions, not numbers.* (Chapter 1)
  - *Existence and uniqueness come first.* (Chapter 3)
  - *Classify before you solve.* (Chapters 2, 4)
  - *Linearity = superposition.* (Chapter 8)
  - *Differentiation in $t$ ↔ multiplication by $s$.* (Chapter 11)
  - *Linearity = convolution.* (Chapter 13)
  - *Same equation, many systems.* (Chapter 10, 14)

Internalize these and you have absorbed the content of MATH240 — not just
recited it.
