---
chapter: 9
week: 9
title: "Cauchy-Euler and Nonlinear Higher-Order ODEs"
zill_sections: ["4.2", "4.7", "4.10"]
course_objectives: [CO1, CO2]
tags: [math240, week9, cauchy-euler, reduction-of-order, nonlinear, equidimensional]
prev: "08-Second-Order-Nonhomogeneous-ODEs.md"
next: "10-Modeling-with-Higher-Order-ODEs.md"
---

# Chapter 9 — Cauchy-Euler and Nonlinear Higher-Order ODEs

> Constant-coefficient theory covers most engineering applications, but
> classical problems with circular or spherical symmetry — Laplace's
> equation in polar coordinates, for example — naturally yield equations
> with non-constant, *equidimensional* coefficients. The Cauchy-Euler
> equation is the model case.

---

## 9.0  Why this chapter

This week we bridge two gaps in our higher-order linear theory:

1. **Non-constant coefficients.** The **Cauchy-Euler equation**
   $a_{n} x^{n} y^{(n)} + \cdots + a_{0} y = 0$ has variable coefficients
   but reduces to constant coefficients via the change of variable
   $x = e^{t}$ — or equivalently, by trying $y = x^{m}$.
2. **Reduction of order, revisited.** When you can find one solution by
   inspection of a second-order equation, the order reduces by one. This
   is also how we get a second linearly-independent solution in the
   repeated-root Cauchy-Euler case.

We also touch the **nonlinear** higher-order case briefly. Closed-form
solutions are rare; numerical methods (Chapter 5, extended) and qualitative
analysis are the working tools.

---

## 9.1  Learning objectives

After completing Chapter 9, you should be able to:

1. Recognize a **Cauchy-Euler equation** of any order.
2. Solve a homogeneous Cauchy-Euler equation by substituting $y = x^{m}$
   and reading off the **indicial (characteristic) equation**.
3. Handle the three cases — distinct real, repeated real, complex roots —
   and write the general solution.
4. Solve **nonhomogeneous Cauchy-Euler** equations using either variation
   of parameters or the substitution $x = e^{t}$ (which converts to a
   constant-coefficient equation).
5. Recognize standard **nonlinear** higher-order ODEs and apply the
   reductions $y' = u(y),\ y' = u(x)$, or other ad hoc tricks.

---

## 9.2  Lecture notes

### 9.2.1  Cauchy-Euler equations

> **Definition.** A linear ODE of the form
> $$
> a_{n} x^{n} y^{(n)} + a_{n-1} x^{n-1} y^{(n-1)} + \cdots + a_{1} x y' + a_{0} y = g(x)
> $$
> is a **Cauchy-Euler** (also "equidimensional" or "Euler") equation. The
> coefficients are powers of $x$ matched to the order of the derivative.

The defining feature: each term has the same *dimensional weight*. If you
let $D = d/dx$, the operator $x^{k} D^{k}$ is dimensionless under
$x \to \lambda x$.

### 9.2.2  Solving the homogeneous case via $y = x^{m}$

For $a x^{2} y'' + b x y' + c y = 0$ on $x > 0$, try $y = x^{m}$:
$y' = m x^{m-1},\ y'' = m(m-1) x^{m-2}$. Substitute:
$$
a m(m-1) + b m + c = 0,
$$
the **indicial equation**. Solve for $m$.

**Three cases.**

- **Distinct real roots $m_{1} \ne m_{2}$:**
  $y = c_{1} x^{m_{1}} + c_{2} x^{m_{2}}$.
- **Repeated real root $m_{1}$:** reduction of order gives
  $y = (c_{1} + c_{2} \ln x)\,x^{m_{1}}$.
- **Complex conjugate roots $\alpha \pm i \beta$:**
  $y = x^{\alpha}\bigl[c_{1} \cos(\beta \ln x) + c_{2} \sin(\beta \ln x)\bigr]$.

(For $x < 0$ replace $x$ with $|x|$ everywhere.)

> **Worked example 9.A.** Solve $x^{2} y'' - 2 x y' + 2 y = 0$ on $x > 0$.
>
> Indicial: $m(m-1) - 2 m + 2 = m^{2} - 3 m + 2 = 0 \Rightarrow m = 1, 2$.
> $y = c_{1} x + c_{2} x^{2}$.

> **Worked example 9.B — repeated root.** Solve $x^{2} y'' + 5 x y' + 4 y = 0$.
>
> Indicial: $m(m-1) + 5 m + 4 = (m + 2)^{2} = 0 \Rightarrow m = -2$ (double).
> $y = (c_{1} + c_{2} \ln x)\,x^{-2}$.

> **Worked example 9.C — complex roots.** Solve $x^{2} y'' + x y' + y = 0$.
>
> Indicial: $m(m-1) + m + 1 = m^{2} + 1 = 0 \Rightarrow m = \pm i$.
> $y = c_{1} \cos(\ln x) + c_{2} \sin(\ln x)$.

### 9.2.3  The substitution $x = e^{t}$

If you prefer not to memorize the rules above, set $x = e^{t}$ (so $t = \ln x$).
Then
$$
x \frac{dy}{dx} = \frac{dy}{dt},\qquad
x^{2} \frac{d^{2} y}{dx^{2}} = \frac{d^{2} y}{dt^{2}} - \frac{dy}{dt}.
$$
Substitute and the equation becomes a **constant-coefficient** ODE in $t$,
to which Chapter 7 applies. Then convert back via $t = \ln x$.

### 9.2.4  Nonhomogeneous Cauchy-Euler

Two options:

- **Variation of parameters** directly on the original equation, using the
  Cauchy-Euler $y_{c}$ from §9.2.2.
- **Substitute $x = e^{t}$** to reach a constant-coefficient nonhomogeneous
  ODE, then use undetermined coefficients or variation of parameters in $t$.

Option 2 is often cleaner when $g(x)$ is itself a power of $x$.

> **Worked example 9.D.** Solve $x^{2} y'' - 3 x y' + 4 y = x^{2}$ on $x > 0$.
>
> Indicial: $m(m-1) - 3 m + 4 = (m - 2)^{2} = 0 \Rightarrow m = 2$ (double).
> $y_{c} = (c_{1} + c_{2} \ln x)\,x^{2}$.
> Resonance: $g = x^{2}$ matches $y_{c}$ twice. Try $y_{p} = A x^{2}(\ln x)^{2}$.
> Substitute and solve: $A = 1/2$.
> General: $y = (c_{1} + c_{2} \ln x)\,x^{2} + \tfrac{1}{2} x^{2} (\ln x)^{2}$.

### 9.2.5  Reduction of order — the formula

For a second-order homogeneous linear ODE
$y'' + p(x) y' + q(x) y = 0$ with one known solution $y_{1}$, a second
linearly-independent solution is
$$
y_{2}(x) = y_{1}(x) \int \frac{e^{-\int p(x)\,dx}}{\bigl(y_{1}(x)\bigr)^{2}}\,dx.
$$
This is the source of the $\ln x$ in the repeated-root Cauchy-Euler case.

### 9.2.6  Nonlinear higher-order — selected reductions

For autonomous second-order equations $F(y, y', y'') = 0$, set
$v = y'$ and treat $v$ as a function of $y$:
$$
y'' = \frac{dv}{dx} = \frac{dv}{dy} \frac{dy}{dx} = v\,\frac{dv}{dy}.
$$
The ODE in $(y, v)$ is first order; solve, integrate again, recover $y(x)$.

Useful for problems like $y'' = f(y)$ — Newton's equation for a particle in
a 1-D potential.

> **Worked example 9.E.** Solve $y\,y'' + (y')^{2} = 0,\ y(0) = 1,\ y'(0)
> = 1$.
>
> Note $\dfrac{d}{dx}(y\,y') = (y')^{2} + y\,y''$ — exactly the LHS.
> So $(y\,y')' = 0 \Rightarrow y\,y' = C$. ICs: $C = 1$.
> Then $y\,dy = dx \Rightarrow y^{2} = 2 x + D$. ICs: $D = 1$.
> $y(x) = \sqrt{2 x + 1}$.

---

## 9.3  Reading assignment

Read Zill, **§4.7** (Cauchy-Euler) and **§4.10** (nonlinear higher-order).
For numerical work on nonlinear problems, refer back to Chapter 5.

---

## 9.4  Practice problems (homework)

Submit as an attachment to the Week 9 Forum.

- **§4.7** — 1, 3, 5, 10, 19, 20
- **§4.10** — 3, 8, 17, 18; numerical 19

For problem 19 use RK4 (your method of choice from Chapter 5).

---

## 9.5  Discussion prompt — *W9: Cauchy-Euler and Nonlinear ODEs*

Pick a Cauchy-Euler problem and discuss why $x^{m}$ is a *natural* ansatz —
what feature of the equation makes the substitution work? Or, pick a
nonlinear higher-order problem and discuss the reduction strategy.

---

## 9.6  Quiz 3 (Wks 5–7) — due this week

- **Coverage:** Chapters 5–7 (numerical methods, modeling, homogeneous
  higher-order linear ODEs).
- **Format:** open book, open notes.
- **Weight:** 6%.

---

## 9.7  Self-assessment

1. Solve $x^{2} y'' + 7 x y' + 9 y = 0$.
2. Solve $x^{2} y'' - x y' + y = \ln x$.
3. Use the $x = e^{t}$ substitution to solve $x^{2} y'' - 3 x y' + 13 y =
   x^{2}$.
4. Apply the reduction $v = y'$ to $y'' = -2 y\,(y')^{3}$ and reduce to a
   first-order ODE.
5. Why doesn't $y = x^{m}$ work as an ansatz for $y'' - 2 x y' + 4 y = 0$?
   What feature of Cauchy-Euler makes it special?

---

## 9.8  Glossary

- **Cauchy-Euler equation.** $\sum_{k} a_{k} x^{k} y^{(k)} = g(x)$.
- **Equidimensional / scale-invariant.** Equations whose coefficients
  match each derivative's "dimension."
- **Indicial equation.** Polynomial in $m$ from substituting $y = x^{m}$.
- **Reduction of order.** Use one known solution to lower the order by one.
- **Energy integral.** First integral of a conservative second-order ODE
  $y'' = f(y)$, found via $v = y'$ and $y'' = v\,dv/dy$.

---

## 9.9  Connections

- **Builds on:** Chapters 7–8 (linear theory, undetermined coefficients,
  variation of parameters).
- **Sets up:** Chapter 11 (Laplace transforms convert constant-coefficient
  ODEs to algebra; Cauchy-Euler resists this neatly, but power-series
  methods would handle both — outside the scope of this course).
- **Cross-cutting theme:** *Symmetry guides ansatz.* The scale invariance
  of Cauchy-Euler is exactly what makes $x^{m}$ work.
