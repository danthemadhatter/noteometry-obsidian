---
chapter: 7
week: 7
title: "Second-Order Homogeneous Linear ODEs"
zill_sections: ["4.1", "4.3"]
course_objectives: [CO1, CO3, CO5]
tags: [math240, week7, higher-order, homogeneous, characteristic-equation, wronskian]
prev: "06-Modeling-with-First-Order-ODEs.md"
next: "08-Second-Order-Nonhomogeneous-ODEs.md"
---

# Chapter 7 — Second-Order Homogeneous Linear ODEs

> The next four weeks are about *higher-order linear* differential equations.
> The bulk of physics, vibration, control, and circuit analysis lives here.
> We start with the homogeneous case because nonhomogeneous solutions are
> built on top of homogeneous ones.

---

## 7.0  Why this chapter

A second-order linear ODE has the form
$$
a_{2}(x)\,y'' + a_{1}(x)\,y' + a_{0}(x)\,y = g(x).
$$

We split the analysis in two:

- **Homogeneous case** ($g \equiv 0$). The solution set is a 2-D vector
  space; finding two linearly independent solutions is the entire problem.
- **Nonhomogeneous case** (Chapter 8). The general solution is the
  homogeneous solution *plus* one particular solution.

Almost every physical system you will model later — springs, RLC circuits,
beam bending — is second-order linear. Master this chapter and you have
opened the door to engineering dynamics.

---

## 7.1  Learning objectives

After completing Chapter 7, you should be able to:

1. State the **existence-uniqueness theorem** for higher-order linear IVPs.
2. Define **linear independence** of functions and compute a **Wronskian**.
3. Identify a **fundamental set** of solutions and write the **general
   solution** as a linear combination.
4. Solve **homogeneous constant-coefficient** equations of order $n$ via
   the **characteristic equation**, including:
   - distinct real roots,
   - repeated real roots,
   - complex conjugate roots.
5. Recognize when **reduction of order** is needed and apply it.

---

## 7.2  Lecture notes

### 7.2.1  Existence-uniqueness for higher-order linear IVPs

> **Theorem.** Suppose $a_{n}, a_{n-1}, \ldots, a_{0}, g$ are continuous on
> an interval $I$ with $a_{n}(x) \ne 0$ on $I$. Then for any $x_{0} \in I$
> and any constants $y_{0}, y_{0}', \ldots, y_{0}^{(n-1)}$, the IVP
> $$
> a_{n}(x)\,y^{(n)} + \cdots + a_{0}(x)\,y = g(x),\quad
> y(x_{0}) = y_{0},\ \ldots,\ y^{(n-1)}(x_{0}) = y_{0}^{(n-1)}
> $$
> has a unique solution on $I$.

The hypotheses guarantee a unique solution on the *entire* interval where
the coefficients are continuous and the leading coefficient is non-zero.

### 7.2.2  Initial-value problems vs. boundary-value problems

An IVP specifies all $n$ conditions at a single point. A **boundary-value
problem (BVP)** specifies them at two or more points: e.g.
$y'' + y = 0,\ y(0) = 0,\ y(\pi) = 0$. BVPs can have *no solution*, *one
solution*, or *infinitely many*. We meet BVPs in Chapter 10.

### 7.2.3  Linear independence and the Wronskian

> **Definition.** Functions $f_{1}, \ldots, f_{n}$ are *linearly dependent*
> on $I$ if there exist constants $c_{1}, \ldots, c_{n}$ — not all zero —
> with $c_{1} f_{1}(x) + \cdots + c_{n} f_{n}(x) = 0$ on all of $I$.
> Otherwise they are *linearly independent*.

> **Definition (Wronskian).**
> $$
> W(f_{1}, \ldots, f_{n})(x) = \det
> \begin{pmatrix}
> f_{1} & \cdots & f_{n} \\
> f_{1}' & \cdots & f_{n}' \\
> \vdots & \ddots & \vdots \\
> f_{1}^{(n-1)} & \cdots & f_{n}^{(n-1)}
> \end{pmatrix}.
> $$

> **Theorem (Abel).** If $y_{1}, \ldots, y_{n}$ are solutions of a
> *homogeneous* linear ODE $y^{(n)} + p_{n-1}(x) y^{(n-1)} + \cdots +
> p_{0}(x) y = 0$ on $I$, then either $W \equiv 0$ on $I$ (in which case
> the solutions are linearly dependent) or $W$ never vanishes on $I$
> (linearly independent).

So a single non-zero value of the Wronskian, computed at a convenient point,
proves linear independence of solutions.

### 7.2.4  Fundamental set and general solution

> **Definition.** A set $\{y_{1}, \ldots, y_{n}\}$ of $n$ linearly
> independent solutions of a homogeneous order-$n$ linear ODE is a
> *fundamental set of solutions*. The **general solution** is
> $$
> y(x) = c_{1} y_{1}(x) + \cdots + c_{n} y_{n}(x).
> $$

The solution space is an $n$-dimensional vector space; a fundamental set
is a basis.

### 7.2.5  Homogeneous constant-coefficient equations

For $a_{n} y^{(n)} + \cdots + a_{0} y = 0$ with constants $a_{i}$, try
$y = e^{m x}$. Substitute and divide by $e^{m x}$:
$$
a_{n} m^{n} + a_{n-1} m^{n-1} + \cdots + a_{0} = 0.
$$

This is the **characteristic (auxiliary) equation**. Its $n$ roots determine
the fundamental set.

**Three cases for second-order $a y'' + b y' + c y = 0$.**

- **Distinct real roots $m_{1}, m_{2}$:**
  $y = c_{1} e^{m_{1} x} + c_{2} e^{m_{2} x}$.
- **Repeated real root $m_{1}$:** $y = (c_{1} + c_{2} x)\,e^{m_{1} x}$.
- **Complex conjugate roots $\alpha \pm i\beta$:**
  $y = e^{\alpha x}\bigl(c_{1} \cos\beta x + c_{2} \sin\beta x\bigr)$.

For order $n > 2$, repeat the rules above for each root multiplicity.

> **Worked example 7.A.** Solve $y'' - 5 y' + 6 y = 0,\ y(0) = 1,\ y'(0) = 0$.
>
> Characteristic equation: $m^{2} - 5m + 6 = 0 \Rightarrow m = 2, 3$.
> General: $y = c_{1} e^{2x} + c_{2} e^{3x}$.
> ICs: $c_{1} + c_{2} = 1$ and $2 c_{1} + 3 c_{2} = 0$.
> Solve: $c_{1} = 3,\ c_{2} = -2$. Particular: $y(x) = 3 e^{2x} - 2 e^{3x}$.

> **Worked example 7.B.** Solve $y'' + 4 y' + 4 y = 0$.
>
> Characteristic: $(m + 2)^{2} = 0 \Rightarrow m = -2$ (double).
> General: $y = (c_{1} + c_{2} x)\,e^{-2x}$.

> **Worked example 7.C.** Solve $y'' + 2 y' + 5 y = 0$.
>
> Characteristic: $m^{2} + 2 m + 5 = 0 \Rightarrow m = -1 \pm 2 i$.
> General: $y = e^{-x}\bigl(c_{1} \cos 2x + c_{2} \sin 2x\bigr)$.

### 7.2.6  Reduction of order

If you know one non-trivial solution $y_{1}(x)$ of a homogeneous linear
ODE, you can find a second linearly-independent solution via the ansatz
$y_{2}(x) = u(x)\,y_{1}(x)$. Substituting reduces the order by one,
yielding a first-order ODE for $u'$. For the second-order case
$y'' + p(x) y' + q(x) y = 0$, the result is the famous formula
$$
y_{2}(x) = y_{1}(x) \int \frac{e^{-\int p(x)\,dx}}{y_{1}(x)^{2}}\,dx.
$$

This is essential when coefficients are non-constant (Cauchy–Euler in
Chapter 9, for instance).

---

## 7.3  Reading assignment

Read Zill, **§4.1** (theory) and **§4.3** (constant-coefficient mechanics).

---

## 7.4  Practice problems (homework)

Submit as an attachment to the Week 7 Forum.

- **§4.1** — 1, 3, 5, 6, 13, 15, 17, 21, 23, 24, 31
- **§4.3** — 3, 6, 9, 12, 15, 30, 31, 35, 43–48

The 43–48 problems in §4.3 are higher-order; practice the rules for repeated
and complex roots until you can read them off the characteristic equation
without thinking.

---

## 7.5  Discussion prompt — *W7: Homogeneous 2nd-order ODEs*

Pick a problem from §4.1 or §4.3 (not yet claimed) that highlights a
conceptual subtlety: linear independence, the Wronskian, the role of the
fundamental set, or the meaning of complex roots. Discuss the *why*.

---

## 7.6  Self-assessment

1. State Abel's theorem on the Wronskian.
2. Solve $y''' - 4 y'' + 5 y' - 2 y = 0$.
3. Solve $y'' + 6 y' + 13 y = 0,\ y(0) = 0,\ y'(0) = 1$ and sketch the
   solution.
4. Show that $\{x, x \ln x\}$ are linearly independent on $(0, \infty)$ by
   computing the Wronskian.
5. Given $y_{1}(x) = x$ is a solution of $x^{2} y'' - 3 x y' + 4 y = 0$ on
   $(0, \infty)$, find a second linearly-independent solution by reduction
   of order.

---

## 7.7  Glossary

- **Fundamental set.** $n$ linearly-independent solutions of a homogeneous
  order-$n$ linear ODE.
- **Wronskian $W$.** Determinant of the matrix of solutions and their
  derivatives.
- **Characteristic / auxiliary equation.** Polynomial $\sum a_{i} m^{i} = 0$
  for constant-coefficient homogeneous ODEs.
- **Reduction of order.** Method of finding $y_{2}$ from a known $y_{1}$ via
  $y_{2} = u(x) y_{1}(x)$.
- **Boundary-value problem.** Conditions specified at two or more points.

---

## 7.8  Connections

- **Builds on:** Chapter 1 (definitions, IVPs); linear algebra (linear
  independence, basis, span).
- **Sets up:** Chapter 8 (nonhomogeneous = homogeneous + particular);
  Chapters 9, 10 (Cauchy–Euler, applications).
- **Cross-cutting theme:** *The solution set of a homogeneous linear ODE is
  a vector space — the geometry of linear algebra is everywhere.*
