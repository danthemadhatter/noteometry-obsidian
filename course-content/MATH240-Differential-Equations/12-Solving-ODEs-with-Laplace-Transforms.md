---
chapter: 12
week: 12
title: "Solving ODEs with Laplace Transforms"
zill_sections: ["7.3", "7.4"]
course_objectives: [CO1, CO2]
tags: [math240, week12, laplace-transform, step-function, second-translation, project-2]
prev: "11-Introduction-to-Laplace-Transforms.md"
next: "13-Continuing-with-Laplace-Transforms.md"
---

# Chapter 12 — Solving ODEs with Laplace Transforms

> The transform turns a differential equation into an algebraic equation
> for $Y(s)$. Solve algebraically, invert, and you have a particular
> solution to the IVP — initial conditions baked in.

---

## 12.0  Why this chapter

This week we apply Chapter 11's machinery to solve IVPs. The recipe is
short:

1. Apply $\mathcal{L}$ to both sides of the ODE.
2. Use $\mathcal{L}\{y^{(n)}\}$ rules to insert the initial conditions.
3. Solve algebraically for $Y(s)$.
4. Invert: $y(t) = \mathcal{L}^{-1}\{Y(s)\}$.

We also extend the table with two indispensable engineering tools:

- **The unit step function $u(t - a)$**, which encodes "switch on at $t = a$."
- **The second translation theorem** for shifting in $t$.

These let us handle piecewise-defined forcing — the sort that real systems
actually experience.

---

## 12.1  Learning objectives

After completing Chapter 12, you should be able to:

1. Solve constant-coefficient IVPs (homogeneous and nonhomogeneous) with
   the Laplace transform.
2. Use the **unit step function** $u(t - a)$ (also written $\mathcal{U}(t -
   a)$ or $H(t - a)$, the Heaviside function) to express piecewise forcing.
3. Apply the **second translation theorem** to compute transforms of
   shifted functions and their inverses.
4. Translate Chapter 10's mechanical and electrical problems into Laplace,
   solve, and interpret.
5. Tackle Project 2 (mechanical / electrical system with piecewise input).

---

## 12.2  Lecture notes

### 12.2.1  The Laplace recipe for IVPs

**Procedure.** Given $a y'' + b y' + c y = g(t),\ y(0) = y_{0},\ y'(0) =
y_{0}'$:

1. Take $\mathcal{L}$ of both sides:
   $$
   a\bigl[s^{2} Y(s) - s\,y_{0} - y_{0}'\bigr] + b\bigl[s Y(s) - y_{0}\bigr]
   + c Y(s) = G(s).
   $$
2. Solve for $Y(s)$ algebraically:
   $$
   Y(s) = \frac{G(s) + a (s y_{0} + y_{0}') + b\,y_{0}}{a s^{2} + b s + c}.
   $$
3. Decompose into known forms (partial fractions, completing the square).
4. Invert term by term.

The denominator $a s^{2} + b s + c$ is exactly the **characteristic
polynomial** of Chapter 7 — Laplace gives a unified view of the homogeneous
and particular components.

> **Worked example 12.A.** Solve $y'' - 3 y' + 2 y = e^{4 t},\ y(0) = 1,\
> y'(0) = 5$.
>
> Transform: $(s^{2} Y - s - 5) - 3(s Y - 1) + 2 Y = \dfrac{1}{s - 4}$.
> Simplify: $(s^{2} - 3 s + 2) Y = s + 2 + \dfrac{1}{s - 4}$.
> $$
> Y = \frac{s + 2}{(s - 1)(s - 2)} + \frac{1}{(s - 1)(s - 2)(s - 4)}.
> $$
> Partial fractions yield $Y = \dfrac{-3}{s - 1} + \dfrac{4}{s - 2} +
> \dfrac{1/6}{s - 4}$.
> Invert: $y(t) = -3 e^{t} + 4 e^{2 t} + \tfrac{1}{6} e^{4 t}$.

### 12.2.2  Unit step (Heaviside) function

> **Definition.** $u(t - a) = \begin{cases} 0, & t < a \\ 1, & t \ge a
> \end{cases}$.

Useful identities:

- A pulse of duration $a$ to $b$: $u(t - a) - u(t - b)$.
- A piecewise function $f(t) = \begin{cases} g(t), & 0 \le t < a \\ h(t),
  & t \ge a \end{cases}$ can be written
  $f(t) = g(t) + \bigl[h(t) - g(t)\bigr]\,u(t - a)$.

> **Transform.** $\mathcal{L}\{u(t - a)\} = \dfrac{e^{-a s}}{s}$ for $a \ge 0$.

### 12.2.3  Second translation theorem

> **Theorem.** For $a \ge 0$,
> $$
> \mathcal{L}\{f(t - a)\,u(t - a)\} = e^{-a s}\,F(s).
> $$
> Equivalently, $\mathcal{L}^{-1}\{e^{-a s}\,F(s)\} = f(t - a)\,u(t - a)$.

Note the *both* shifts: the function is shifted by $a$ in time, and it is
zero before $t = a$.

> **Worked example 12.B.** Compute $\mathcal{L}\{(t - 1)^{2} u(t - 1)\}$.
>
> Let $f(t) = t^{2}$, so $F(s) = 2/s^{3}$. By the second translation
> theorem, $\mathcal{L}\{(t - 1)^{2} u(t - 1)\} = e^{-s}\,(2/s^{3})$.

> **Worked example 12.C — piecewise forcing.** Solve $y'' + y =
> u(t - \pi),\ y(0) = 0,\ y'(0) = 0$.
>
> Transform: $(s^{2} + 1) Y = \dfrac{e^{-\pi s}}{s}$, so
> $Y(s) = \dfrac{e^{-\pi s}}{s\,(s^{2} + 1)}$.
> Partial fractions: $\dfrac{1}{s(s^{2} + 1)} = \dfrac{1}{s} -
> \dfrac{s}{s^{2} + 1}$.
> So $Y = e^{-\pi s}\!\left[\dfrac{1}{s} - \dfrac{s}{s^{2} + 1}\right]$.
> Invert with the second translation theorem:
> $y(t) = u(t - \pi)\,\bigl[1 - \cos(t - \pi)\bigr] = u(t - \pi)\,
> \bigl[1 + \cos t\bigr]$.

This is *exactly* the kind of solution that would be unpleasant to obtain
without the transform.

### 12.2.4  Convolution and the convolution theorem (preview)

> **Definition.** $(f \ast g)(t) = \int_{0}^{t} f(\tau) g(t - \tau)\,d\tau$.

> **Theorem.** $\mathcal{L}\{f \ast g\} = F(s)\,G(s)$.

We will exploit this in Chapter 13 to solve integro-differential equations
and to invert products of transforms.

### 12.2.5  Putting it together — RLC under switching

Consider an RLC circuit ($L = 1, R = 2, C = 1/2$) initially at rest and
driven by a step EMF $E(t) = 10 u(t)$. The IVP is
$$
q'' + 2 q' + 2 q = 10 u(t),\quad q(0) = q'(0) = 0.
$$

Transform: $(s^{2} + 2 s + 2)\,Q = \dfrac{10}{s}$.

$Q(s) = \dfrac{10}{s\,(s^{2} + 2 s + 2)}$. Partial fractions give
$Q = \dfrac{5}{s} - \dfrac{5(s + 2)}{(s + 1)^{2} + 1}$, and inverting:
$$
q(t) = 5 - 5 e^{-t}\bigl(\cos t + \sin t\bigr).
$$
Steady state $q_{\infty} = 5$; transient $\propto e^{-t}$. ✓ matches
Chapter 10's analysis.

---

## 12.3  Reading assignment

Read Zill, **§7.3** (translation theorems and step functions) and **§7.4**
(derivatives of transforms and integrals — preview for next week).

---

## 12.4  Practice problems (homework)

Submit as an attachment to the Week 12 Forum.

- **§7.3** — 1, 3, 6, 7, 9, 13, 16, 17, 24, 25, 37, 39, 41, 43, 47, 57, 58
- **§7.4** — 1, 3, 5, 6, 9, 11

These are the most mechanically rich problems in the course; budget time.

---

## 12.5  Discussion prompt — *W12: Laplace Transform Operational Properties*

Pick a problem (not yet claimed) involving a step or shift and explain
which translation theorem applies. Articulate the difference between
the *first* (shift in $s$) and *second* (shift in $t$) translation
theorems — students often confuse them.

---

## 12.6  Project 2 — due this week

A multi-step Laplace-transform project applying the techniques above to a
complete engineering system (typically a switched RLC circuit or a
spring-mass system with impulsive forcing). See your D2L project page for
the specific prompt.

Outline of expected deliverables:

1. State the physical system and write the IVP with units.
2. Express any piecewise forcing using $u(t - a)$.
3. Solve via Laplace transform.
4. Plot the solution (MATLAB or Excel) and label transient vs. steady
   state.
5. Discuss the qualitative behavior in 1–2 paragraphs.

---

## 12.7  Self-assessment

1. Solve $y' + 3 y = e^{-t} u(t - 2),\ y(0) = 0$.
2. Compute $\mathcal{L}\{t \sin a t\}$ using the derivative-of-transform
   theorem (preview from §7.4).
3. Solve the RLC system above with $E(t) = 10\,[u(t) - u(t - 1)]$ — a unit
   pulse of duration 1 — and sketch $q(t)$.
4. Use convolution to express the solution of $y'' + y = g(t),\ y(0) =
   y'(0) = 0$ in integral form.
5. State the second translation theorem and explain in words what each
   factor in $f(t - a) u(t - a) \leftrightarrow e^{-a s} F(s)$ does.

---

## 12.8  Glossary

- **Unit step / Heaviside function $u(t - a)$.**
- **Second translation theorem.** $\mathcal{L}\{f(t - a) u(t - a)\} = e^{-a s}
  F(s)$.
- **Convolution.** $(f \ast g)(t) = \int_{0}^{t} f(\tau) g(t - \tau)\,
  d\tau$.
- **Convolution theorem.** $\mathcal{L}\{f \ast g\} = F(s) G(s)$.
- **Transient / steady-state response.** Decomposition into homogeneous
  (decaying) and particular (persistent) parts.

---

## 12.9  Connections

- **Builds on:** Chapter 11 (table, linearity, first translation).
- **Sets up:** Chapter 13 (operational properties II — derivatives of
  transforms, periodic functions, Dirac delta, systems via Laplace).
- **Cross-cutting theme:** *ODE in $t$ → algebra in $s$.*
