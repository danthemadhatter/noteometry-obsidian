---
chapter: 11
week: 11
title: "Introduction to Laplace Transforms"
zill_sections: ["7.1", "7.2"]
course_objectives: [CO1, CO2]
tags: [math240, week11, laplace-transform, inverse-transform, transforms-of-derivatives]
prev: "10-Modeling-with-Higher-Order-ODEs.md"
next: "12-Solving-ODEs-with-Laplace-Transforms.md"
---

# Chapter 11 — Introduction to Laplace Transforms

> The Laplace transform is the engineering math student's best friend. It
> turns differentiation into multiplication and ODEs into algebra. Whatever
> intuition you've built about the time domain $t$, the transform gives
> you a parallel intuition in the frequency-like domain $s$.

---

## 11.0  Why this chapter

Engineering and physics problems often come with **forcing** that is not a
nice elementary function: step inputs, impulses, periodic switches. The
Laplace transform handles all of these gracefully. Three big payoffs:

1. **Differentiation becomes multiplication.** $\mathcal{L}\{y'\} = s Y -
   y(0)$, so an ODE in $t$ turns into an algebraic equation in $s$.
2. **Initial conditions are baked in.** No separate step to "apply ICs"
   after solving.
3. **Discontinuous and impulsive forcing is easy.** Step functions
   $u(t - a)$ and the Dirac delta $\delta(t - a)$ have clean transforms.

This week we define the transform, build a working table of forward
transforms, and learn how to invert (compute $\mathcal{L}^{-1}$) by
recognition and partial fractions.

---

## 11.1  Learning objectives

After completing Chapter 11, you should be able to:

1. State the **definition** of the Laplace transform and the conditions for
   its existence (piecewise continuity and exponential order).
2. Compute the Laplace transform of basic elementary functions ($1, t^{n},
   e^{at}, \sin bt, \cos bt$) directly from the definition.
3. Use the **linearity** and **first translation** ($e^{at}$ multiplier)
   theorems to extend the table.
4. Compute **inverse Laplace transforms** by recognition and **partial
   fractions**.
5. Apply the **transform of derivatives** rule, ready for Chapter 12.

---

## 11.2  Lecture notes

### 11.2.1  Definition

> **Definition.** Let $f(t)$ be defined for $t \ge 0$. The **Laplace
> transform** of $f$ is
> $$
> F(s) = \mathcal{L}\{f(t)\} = \int_{0}^{\infty} e^{-s t}\,f(t)\,dt,
> $$
> for those values of $s$ for which the integral converges.

The transform $F(s)$ is a function of a (typically real) variable $s$. We
will not need complex $s$ in MATH240.

> **Theorem (Existence).** If $f$ is **piecewise continuous** on $[0,
> \infty)$ and is of **exponential order $c$** — meaning there exist
> $M, T > 0$ with $|f(t)| \le M e^{c t}$ for $t \ge T$ — then $F(s)$
> exists for $s > c$.

In practice this covers every function you will encounter.

### 11.2.2  Linearity

For constants $\alpha, \beta$:
$$
\mathcal{L}\{\alpha f + \beta g\} = \alpha\,\mathcal{L}\{f\} + \beta\,\mathcal{L}\{g\}.
$$

The same holds for $\mathcal{L}^{-1}$.

### 11.2.3  Building the basic table

| $f(t)$         | $F(s)$                       | Domain      |
| -------------- | ---------------------------- | ----------- |
| $1$            | $\dfrac{1}{s}$               | $s > 0$     |
| $t^{n}$ ($n\in\mathbb{N}_{\ge 0}$) | $\dfrac{n!}{s^{n+1}}$  | $s > 0$     |
| $e^{a t}$      | $\dfrac{1}{s - a}$           | $s > a$     |
| $\cos b t$     | $\dfrac{s}{s^{2} + b^{2}}$   | $s > 0$     |
| $\sin b t$     | $\dfrac{b}{s^{2} + b^{2}}$   | $s > 0$     |
| $\cosh b t$    | $\dfrac{s}{s^{2} - b^{2}}$   | $s > |b|$   |
| $\sinh b t$    | $\dfrac{b}{s^{2} - b^{2}}$   | $s > |b|$   |

> **Worked example 11.A — derivation from definition.**
> $\mathcal{L}\{e^{a t}\} = \int_{0}^{\infty} e^{-(s - a) t}\,dt =
> \dfrac{1}{s - a}$ for $s > a$. ✓

### 11.2.4  First translation theorem (multiplication by $e^{a t}$)

> **Theorem.** If $\mathcal{L}\{f(t)\} = F(s)$, then
> $$
> \mathcal{L}\{e^{a t}\,f(t)\} = F(s - a).
> $$

So multiplying $f$ by $e^{a t}$ in the time domain *shifts* its transform
by $a$ in the $s$-domain.

> **Worked example 11.B.** $\mathcal{L}\{e^{-2 t} \cos 3 t\} =
> \dfrac{s + 2}{(s + 2)^{2} + 9}$.

### 11.2.5  Transform of derivatives

> **Theorem.** If $f$ is continuous on $[0, \infty)$ with $f'$ piecewise
> continuous and both of exponential order, then
> $$
> \mathcal{L}\{f'(t)\} = s F(s) - f(0).
> $$
> By induction,
> $$
> \mathcal{L}\{f^{(n)}(t)\} = s^{n} F(s) - s^{n - 1} f(0) - s^{n - 2}
> f'(0) - \cdots - f^{(n - 1)}(0).
> $$

This is the **engine** of the Laplace approach to ODEs: differentiation in
$t$ becomes polynomial multiplication in $s$.

### 11.2.6  Inverse Laplace transform

The inverse $\mathcal{L}^{-1}$ undoes $\mathcal{L}$. In MATH240 we compute
inverses by:

- **Recognition** — read the table backwards.
- **Linearity** — split sums and pull out constants.
- **First translation** — recognize $F(s - a)$ as $e^{a t}\,f(t)$.
- **Partial fractions** — for rational $F(s)$, decompose into known forms.

> **Worked example 11.C.** Find $\mathcal{L}^{-1}\!\left\{\dfrac{2 s + 5}{s^{2}
> + 4 s + 13}\right\}$.
>
> Complete the square: $s^{2} + 4 s + 13 = (s + 2)^{2} + 9$.
> Rewrite numerator: $2 s + 5 = 2(s + 2) + 1$.
> Split: $\dfrac{2(s + 2)}{(s + 2)^{2} + 9} + \dfrac{1}{(s + 2)^{2} + 9}$.
> Inverse: $2 e^{-2 t} \cos 3 t + \tfrac{1}{3} e^{-2 t} \sin 3 t$.

### 11.2.7  Partial fractions for inverse transforms

For $F(s) = \dfrac{P(s)}{Q(s)}$ with $\deg P < \deg Q$:

1. Factor $Q(s)$ over the reals.
2. Write the partial-fraction decomposition. Linear factor $(s - a)$
   contributes $\dfrac{A}{s - a}$; repeated linear factor $(s - a)^{k}$
   contributes $\sum_{j=1}^{k} \dfrac{A_{j}}{(s - a)^{j}}$; irreducible
   quadratic $s^{2} + p s + q$ contributes $\dfrac{B s + C}{s^{2} + p s + q}$.
3. Solve for the unknown constants by clearing denominators or by the
   *cover-up method*.
4. Invert each piece using the table and translations.

> **Worked example 11.D.** $F(s) = \dfrac{1}{s\,(s + 1)\,(s + 2)}$.
>
> Cover-up: $A = \tfrac{1}{1 \cdot 2} = \tfrac{1}{2}$,
> $B = \tfrac{1}{(-1)(1)} = -1$, $C = \tfrac{1}{(-2)(-1)} = \tfrac{1}{2}$.
> So $F(s) = \dfrac{1/2}{s} - \dfrac{1}{s + 1} + \dfrac{1/2}{s + 2}$ and
> $f(t) = \tfrac{1}{2} - e^{-t} + \tfrac{1}{2}\,e^{-2 t}$.

---

## 11.3  Reading assignment

Read Zill, **§7.1** (definition and basic table) and **§7.2**
(operational properties — derivatives, inverse, basic translation).

---

## 11.4  Practice problems (homework)

Submit as an attachment to the Week 11 Forum.

- **§7.1** — 1, 3, 5, 8, 19, 24, 27, 29, 31, 34
- **§7.2** — 1, 3, 5, 8, 11, 12, 15, 19, 20, 35, 37, 38, 39

Build a *personal* table of transforms as you work; you will use it for the
next three weeks.

---

## 11.5  Discussion prompt — *W11: Introduction to Laplace Transforms*

Pick a problem (not yet claimed) and discuss why the Laplace transform
makes it tractable in a way that direct integration would not. Or, pick a
function whose transform requires a specific table entry and derive that
entry from the definition.

---

## 11.6  Quiz 4 (Wks 8–10) — due this week

- **Coverage:** Chapters 8–10 (nonhomogeneous, Cauchy-Euler, modeling
  with second-order).
- **Format:** open book, open notes.
- **Weight:** 6%.

---

## 11.7  Self-assessment

1. Compute $\mathcal{L}\{t^{2} e^{3 t}\}$ two ways: from the definition,
   and using the first translation theorem.
2. Compute $\mathcal{L}^{-1}\!\left\{\dfrac{1}{(s - 2)^{3}}\right\}$.
3. Use partial fractions to find $\mathcal{L}^{-1}\!\left\{\dfrac{2 s + 1}{
   (s - 1)(s^{2} + 4)}\right\}$.
4. Verify by direct calculation that $\mathcal{L}\{f'\} = s F(s) - f(0)$ for
   $f(t) = e^{2 t}$.
5. Why does exponential order matter for existence of the transform? Give
   an example of a function that fails the condition.

---

## 11.8  Glossary

- **Laplace transform $\mathcal{L}\{f\}(s)$.** $\int_{0}^{\infty} e^{-s t}
  f(t)\,dt$.
- **Piecewise continuous.** Continuous except at finitely many jumps in any
  finite interval.
- **Exponential order.** $|f(t)| \le M e^{c t}$ for large $t$.
- **First translation theorem.** $\mathcal{L}\{e^{a t} f(t)\} = F(s - a)$.
- **Inverse Laplace transform.** Operator $\mathcal{L}^{-1}$ taking $F(s)
  \to f(t)$; computed by recognition and partial fractions.

---

## 11.9  Connections

- **Builds on:** improper integrals (MATH227), partial fractions (algebra).
- **Sets up:** Chapter 12 (using the transform to solve IVPs algebraically).
- **Cross-cutting theme:** *Differentiation in $t$ ↔ multiplication by $s$.*
