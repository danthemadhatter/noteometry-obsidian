---
chapter: 3
week: 3
title: "First-Order ODEs — Separable, Linear, and Exact"
zill_sections: ["2.2", "2.3", "2.4"]
course_objectives: [CO1, CO3]
tags: [math240, week3, separable, linear, exact, existence-uniqueness]
prev: "02-Modeling-and-Direction-Fields.md"
next: "04-Substitution-Methods-and-Eulers-Method.md"
---

# Chapter 3 — First-Order ODEs · Separable, Linear, and Exact

> Solutions to ODEs are functions, not values. So when we solve an ODE, we
> seek a function — or, if no closed form exists, an approximation of one.
> Before reaching for any technique, we ask: *does* a solution exist?
> *Is* it unique?

---

## 3.0  Why this chapter

This week deepens last week's two techniques and adds a third: **exact
equations**. Along the way we make rigorous the questions a working
mathematician asks before writing any algebra:

1. When does a solution exist for an ODE?
2. Is the solution unique, or just one of many?
3. If a solution exists, can we always solve the ODE explicitly?
4. If not, can we approximate the solution?

Question (4) is the bridge to numerical methods (Chapters 4–5).
Questions (1)–(3) underlie everything that follows.

---

## 3.1  Learning objectives

After completing Chapter 3, you should be able to:

1. State the **Picard existence-uniqueness theorem** for first-order ODEs
   and apply it to specific IVPs.
2. Solve separable equations including IVPs and detect the largest interval
   on which the solution is valid.
3. Solve first-order linear equations with integrating factors, including
   discontinuous coefficients.
4. Recognize and solve **exact** equations $M(x, y) + N(x, y)\,y' = 0$,
   producing the implicit solution $F(x, y) = C$.
5. Find an **integrating factor** that converts a non-exact equation into
   an exact one in standard cases.

---

## 3.2  Lecture notes

### 3.2.1  Existence and uniqueness

> **Theorem (Picard).** Suppose $f$ and $\partial f / \partial y$ are
> continuous on a rectangle $R$ containing the point $(x_{0}, y_{0})$.
> Then the IVP
> $$
> y' = f(x, y),\qquad y(x_{0}) = y_{0}
> $$
> has a unique solution on some open interval containing $x_{0}$.

The hypotheses are *sufficient*, not necessary — solutions can exist with
weaker continuity, but uniqueness can fail when $\partial f / \partial y$
is unbounded near the initial point.

> **Worked example 3.A — failure of uniqueness.** The IVP
> $y' = \sqrt{|y|},\ y(0) = 0$ has at least two solutions: $y_{1}(x) = 0$
> for all $x$, and $y_{2}(x) = \tfrac{1}{4}x^{2}$ for $x \ge 0$. The
> derivative $\partial f / \partial y = \tfrac{1}{2 \sqrt{|y|}}$ blows up
> at $y = 0$, so Picard does not apply.

> **Worked example 3.B — solution interval.** $y' = \dfrac{1}{x(x-1)}$ has
> $f$ undefined at $x = 0$ and $x = 1$. Any solution lives on one of the
> open intervals $(-\infty, 0)$, $(0, 1)$, or $(1, \infty)$ — the initial
> point determines which.

### 3.2.2  Separable equations — pitfalls

Recall the method from Chapter 2. Two common mistakes:

- **Forgetting equilibrium solutions.** Whenever you divide by $h(y)$, the
  zeros of $h$ are constant solutions you may have lost. Always check.
- **Restricting domains.** After solving for $y$ explicitly, identify the
  largest interval containing $x_{0}$ on which the explicit form is real
  and continuous.

> **Worked example 3.C.** $\dfrac{dy}{dx} = y^{2} - 4,\ y(0) = 1$.
> Equilibria $y = \pm 2$. Separate:
> $\dfrac{dy}{y^{2} - 4} = dx$, partial fractions give
> $\tfrac{1}{4}\ln\bigl|\tfrac{y - 2}{y + 2}\bigr| = x + C$. Apply IC:
> $\bigl|\tfrac{y - 2}{y + 2}\bigr| = \tfrac{1}{3}\,e^{4x}$. The solution
> stays in the strip $-2 < y < 2$ and asymptotically approaches the stable
> equilibrium $y = -2$ as $x \to \infty$ — a fact you can verify from the
> direction field.

### 3.2.3  Linear equations with discontinuous coefficients

The integrating-factor method still applies, but the **interval of
validity** is bounded by discontinuities of $P(x)$ or $Q(x)$.

> **Worked example 3.D.** Solve $x\,y' + y = \cos x,\ y(\pi/2) = 0$ on
> $(0, \infty)$.
>
> Standard form: $y' + \tfrac{1}{x}\,y = \tfrac{\cos x}{x}$. Integrating
> factor $\mu = x$. Then $(xy)' = \cos x$, so $xy = \sin x + C$. Apply IC:
> $0 = 1 + C \Rightarrow C = -1$. Solution: $y(x) = \dfrac{\sin x - 1}{x}$,
> valid on $(0, \infty)$.

### 3.2.4  Exact equations

Write a first-order ODE in **differential form**:
$$
M(x, y)\,dx + N(x, y)\,dy = 0.
$$

> **Definition (Exact).** This form is *exact* on a simply connected region
> $R$ if there exists a function $F(x, y)$ with $F_{x} = M$ and $F_{y} = N$.
> In that case the ODE reduces to $dF = 0$, with implicit solution
> $F(x, y) = C$.

> **Theorem (Test for exactness).** If $M, N$ and their partial derivatives
> are continuous on $R$, then the form is exact iff
> $$
> \frac{\partial M}{\partial y} = \frac{\partial N}{\partial x}\quad
> \text{on } R.
> $$

**Method.**
1. Verify $M_{y} = N_{x}$.
2. Integrate $M$ with respect to $x$: $F = \int M\,dx + g(y)$.
3. Differentiate with respect to $y$ and equate to $N$ to find $g(y)$.
4. Write the implicit solution $F(x, y) = C$.

> **Worked example 3.E.** Solve $(2xy - \sec^{2}x)\,dx + (x^{2} + 2y)\,dy = 0$.
>
> $M_{y} = 2x = N_{x}$ ✓ exact.
> Integrate $M$: $F = x^{2} y - \tan x + g(y)$.
> $F_{y} = x^{2} + g'(y) = N = x^{2} + 2y$, so $g'(y) = 2y$ and $g = y^{2}$.
> Solution: $\boxed{\ x^{2} y - \tan x + y^{2} = C.\ }$

### 3.2.5  Integrating factors for non-exact equations

If $M_{y} \ne N_{x}$, sometimes a function $\mu(x, y)$ multiplied through
makes the form exact. Two classic cases:

- $\dfrac{M_{y} - N_{x}}{N}$ depends only on $x$ → $\mu(x) = \exp\!\Bigl(\int
  \dfrac{M_{y} - N_{x}}{N}\,dx\Bigr)$.
- $\dfrac{N_{x} - M_{y}}{M}$ depends only on $y$ → $\mu(y) = \exp\!\Bigl(\int
  \dfrac{N_{x} - M_{y}}{M}\,dy\Bigr)$.

This is exactly the integrating factor of §2.2.4 in differential-form
clothing.

---

## 3.3  Reading assignment

Read Zill, **§2.2, §2.3, §2.4**. Pay special attention to §2.4's worked
examples — exactness has more bookkeeping than the previous methods, but the
mechanics are mechanical.

---

## 3.4  Practice problems (homework)

Submit as an attachment to the Week 3 Forum.

- **§2.2** — 5, 6, 7, 18, 23, 26, 39, 40
- **§2.3** — 3, 5, 7, 10, 22, 29, 30

Also strongly recommended (preview of Week 4): **§2.4** — 1, 3, 5, 7, 9, 15,
21, 23, 25, 31.

---

## 3.5  Discussion prompt — *W3: Separable and Linear 1st-order ODEs*

From the discussion problems

- §2.2: 51–56
- §2.3: 49–56

select **one** that has not yet been claimed. Address at least one section
in conceptual depth. The focus, as always, is *why* the technique works —
not just the mechanics.

Reply to ≥ 2 classmates. Submit your homework set with your initial post.

---

## 3.6  Quiz 1 (Wks 1–2) — due this week

- **Coverage:** Chapters 1 and 2 (definitions, IVPs, direction fields,
  autonomous equations, separable, linear).
- **Format:** open book, open notes, no proctor.
- **Weight:** 5%.

---

## 3.7  Self-assessment

1. State Picard's theorem and explain in one sentence what each hypothesis
   is preventing.
2. Solve $y' = (1 + y^{2})\cos x$ with $y(0) = 0$.
3. Solve $\bigl(2x e^{y} + e^{x}\bigr)\,dx + \bigl(x^{2} e^{y} - 1\bigr)\,dy
   = 0$.
4. The equation $y\,dx + (3x - y^{3})\,dy = 0$ is not exact. Find an
   integrating factor depending only on $y$ and solve.
5. For what initial conditions $(x_{0}, y_{0})$ does the IVP $y' = \sqrt[3]{y}$,
   $y(x_{0}) = y_{0}$ have a guaranteed unique solution near $x_{0}$?

---

## 3.8  Glossary

- **Picard's theorem.** Existence-uniqueness for $y' = f(x, y)$ given
  continuity of $f$ and $f_{y}$.
- **Differential form.** $M\,dx + N\,dy = 0$.
- **Exact equation.** $M\,dx + N\,dy = 0$ with $M_{y} = N_{x}$ on a simply
  connected region; equivalent to $dF = 0$.
- **Integrating factor.** Function $\mu(x, y)$ that, multiplied through,
  makes the form exact.
- **Interval of validity.** Largest open interval containing the initial
  point on which the solution is continuously differentiable.

---

## 3.9  Connections

- **Builds on:** Chapter 2 (separable, linear).
- **Sets up:** Chapter 4 (substitutions reduce other forms to separable or
  linear); Chapter 5 (when no closed-form solution exists, we approximate
  numerically).
- **Cross-cutting theme:** *Existence and uniqueness come first.*
