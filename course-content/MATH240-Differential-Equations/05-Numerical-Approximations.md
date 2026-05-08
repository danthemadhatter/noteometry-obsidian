---
chapter: 5
week: 5
title: "Numerical Approximations to ODEs"
zill_sections: ["9.1", "9.2", "9.4"]
course_objectives: [CO2]
tags: [math240, week5, numerical-methods, euler, runge-kutta, error-analysis]
prev: "04-Substitution-Methods-and-Eulers-Method.md"
next: "06-Modeling-with-First-Order-ODEs.md"
---

# Chapter 5 — Numerical Approximations to ODEs

> Numerics build intuition *and* approximate solutions to intractable ODEs.
> Even when a closed form exists, a quick numerical sweep often shows the
> qualitative answer faster than algebra.

---

## 5.0  Why this chapter

Most ODEs that arise in engineering practice cannot be solved in closed form,
or have closed forms that are unwieldy. Numerical methods take a pragmatic
view: pick a step size $h$, march from the initial condition, and produce a
sequence of approximations $\{y_{n}\}$ to $\{y(x_{n})\}$.

This week introduces the three numerical methods you will use for the rest of
the course:

1. **Euler's method** — first order (already met in Chapter 4).
2. **Improved Euler (Heun's method)** — second order.
3. **Classical Runge–Kutta (RK4)** — fourth order, the workhorse.

You'll also learn how to *measure* the error and decide which method is fit
for purpose.

---

## 5.1  Learning objectives

After completing Chapter 5, you should be able to:

1. Derive Euler's, Heun's, and RK4 update rules from local Taylor expansions.
2. Identify the **order of accuracy** of a one-step method and predict how
   error scales with $h$.
3. Implement each method in MATLAB and Excel.
4. Diagnose **stability** issues (when does halving $h$ *help*; when do small
   $h$ produce roundoff problems?).
5. Choose an appropriate method given an accuracy budget.

---

## 5.2  Lecture notes

### 5.2.1  General one-step methods

A one-step method for $y' = f(x, y),\ y(x_{0}) = y_{0}$ takes the form
$$
y_{n+1} = y_{n} + h\,\Phi(x_{n}, y_{n}; h, f),
$$
where $\Phi$ is the *increment function*. Different choices of $\Phi$ give
different methods.

> **Definition (Order $p$).** A method has *order* $p$ if its local
> truncation error is $O(h^{p+1})$ — equivalently, its global error is
> $O(h^{p})$ on a bounded interval.

| Method                  | $\Phi$                                         | Order |
| ----------------------- | ---------------------------------------------- | ----- |
| Euler                   | $f(x_{n}, y_{n})$                              | 1     |
| Improved Euler (Heun)   | $\tfrac{1}{2}(k_{1} + k_{2})$                  | 2     |
| Classical RK4           | $\tfrac{1}{6}(k_{1} + 2k_{2} + 2k_{3} + k_{4})$| 4     |

### 5.2.2  Improved Euler (Heun's method)

Take an Euler "predictor" step, then average the two slopes:
$$
\begin{aligned}
k_{1} &= f(x_{n}, y_{n}), \\
k_{2} &= f(x_{n} + h, y_{n} + h k_{1}), \\
y_{n+1} &= y_{n} + \tfrac{h}{2}(k_{1} + k_{2}).
\end{aligned}
$$

Geometrically: Euler walks at the slope of the *left endpoint*; Heun walks
at the *average* of the left-endpoint slope and the slope at the predicted
right endpoint. This trapezoidal averaging gives second-order accuracy.

> **Worked example 5.A.** Apply Heun with $h = 0.1$ to $y' = x + y,\ y(0)
> = 1$ to estimate $y(0.1)$.
>
> $k_{1} = 0 + 1 = 1.0$. Predictor: $\tilde{y} = 1 + 0.1(1) = 1.1$.
> $k_{2} = 0.1 + 1.1 = 1.2$.
> $y_{1} = 1 + 0.05(1.0 + 1.2) = 1.110$.
>
> Euler (Chapter 4) gave $1.100$; the exact value is $\approx 1.1103$.
> Heun reduced the error by an order of magnitude.

### 5.2.3  Classical fourth-order Runge–Kutta (RK4)

$$
\begin{aligned}
k_{1} &= f(x_{n}, y_{n}), \\
k_{2} &= f\!\left(x_{n} + \tfrac{h}{2}, y_{n} + \tfrac{h}{2}\,k_{1}\right), \\
k_{3} &= f\!\left(x_{n} + \tfrac{h}{2}, y_{n} + \tfrac{h}{2}\,k_{2}\right), \\
k_{4} &= f\!\left(x_{n} + h, y_{n} + h\,k_{3}\right), \\
y_{n+1} &= y_{n} + \tfrac{h}{6}\bigl(k_{1} + 2 k_{2} + 2 k_{3} + k_{4}\bigr).
\end{aligned}
$$

RK4 is the de facto standard one-step method for non-stiff ODEs because
its global error is $O(h^{4})$ at the cost of only four function evaluations
per step.

### 5.2.4  Error and step-size choice

Take a method of order $p$. To halve global error you must halve $h$ for
Euler ($p = 1$); for RK4 ($p = 4$) you only need $h \to h \cdot 2^{-1/4}
\approx 0.84 h$. So higher-order methods are dramatically cheaper for tight
accuracy budgets.

But: **roundoff** sets a floor. As $h \to 0$ the number of steps grows, and
floating-point cancellation eventually dominates truncation. There is an
optimal $h^{\ast}$ per method; on double-precision hardware this is around
$10^{-8}$ for Euler and around $10^{-3}$ for RK4 in typical regimes.

### 5.2.5  Stiffness — a preview

Equations like $y' = -1000(y - \cos x) - \sin x$ have transient components
that decay on a much faster timescale than the dynamics of interest. They
are **stiff**. Explicit methods (Euler, Heun, RK4) require step sizes set
by the *transient*, not the *solution*. Implicit methods (backward Euler,
implicit RK) handle stiffness gracefully. We will not solve stiff problems
in this course, but you should know the term.

### 5.2.6  Excel template (Euler)

```
       A         B               C                  D                E
1      x        y_n            f(x,y)             h*f             y_{n+1}
2      0         1            =A2*sin(B2)        =1/16*C2         =B2+D2
3   =A2+1/16   =E2          =A3*sin(B3)        =1/16*C3         =B3+D3
4   =A3+1/16   =E3          =A4*sin(B4)        =1/16*C4         =B4+D4
...
```

Drag down. Substitute the new $f$ for any other ODE.

---

## 5.3  Reading assignment

Read Zill, **§9.1, §9.2, §9.4**. §9.4 covers the classical RK4 derivation
in detail.

---

## 5.4  Practice problems (homework)

Submit as an attachment to the Week 5 Forum.

- **§9.1** — 11, 12
- **§9.2** — 1, 3, 7, 10, 11
- **§9.4** — 1, then *Improved Euler* on 3, 6, 7, 11

For each numerical exercise, also produce a table comparing Euler, Improved
Euler, and (where instructions allow) RK4 at the same $h$.

---

## 5.5  Discussion prompt — *W5: Numerical Solutions to ODEs*

From §9.2: 20, identify a problem and discuss conceptually. Address what
"order of accuracy" means for that problem and how you would choose a step
size if asked for three correct decimal places.

---

## 5.6  Quiz 2 (Wks 3–4) — due this week

- **Coverage:** Chapters 3 and 4 (separable, linear, exact, substitutions,
  introductory Euler).
- **Format:** open book, open notes, no proctor.
- **Weight:** 6%.

---

## 5.7  Self-assessment

1. Implement Heun's method in MATLAB and use it to solve $y' = -2 x y,\
   y(0) = 1$ on $[0, 1]$ with $h = 0.1$. Compare to the exact $e^{-x^{2}}$.
2. For an order-$p$ method, derive the rule "halving $h$ multiplies global
   error by $1/2^{p}$."
3. Why does RK4 require four function evaluations per step? Could two well-
   chosen evaluations suffice for fourth-order accuracy?
4. Explain in two sentences why explicit Euler is unstable on
   $y' = -100 y$ at $h = 0.1$.
5. Sketch the absolute error vs. $h$ on log-log axes for Euler and RK4 over
   several orders of magnitude. Where does roundoff dominate?

---

## 5.8  Glossary

- **One-step method.** A scheme that advances $y_{n} \to y_{n+1}$ using only
  the current state.
- **Order $p$.** Global error scales as $h^{p}$.
- **Heun's method (Improved Euler).** Trapezoidal predictor-corrector,
  order 2.
- **Runge–Kutta (RK4).** Classical four-stage method, order 4.
- **Stiffness.** Disparity of timescales that forces explicit methods to
  use very small $h$.
- **Roundoff floor.** Lower limit on achievable error set by floating-point
  precision.

---

## 5.9  Connections

- **Builds on:** Euler's method (Chapter 4), direction fields (Chapter 2).
- **Sets up:** Chapter 9 (numerical solutions to nonlinear higher-order
  ODEs), Chapter 15 (numerical solutions to systems).
- **Cross-cutting theme:** *When closed forms fail, approximate.*
