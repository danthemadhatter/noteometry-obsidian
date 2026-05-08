---
chapter: 13
week: 13
title: "Continuing with Laplace Transforms — Operational Properties II"
zill_sections: ["7.4", "7.5", "7.6"]
course_objectives: [CO1, CO2, CO4, CO5, CO6]
tags: [math240, week13, laplace-transform, dirac-delta, periodic-functions, integro-differential]
prev: "12-Solving-ODEs-with-Laplace-Transforms.md"
next: "14-Systems-of-Linear-First-Order-ODEs.md"
---

# Chapter 13 — Continuing with Laplace Transforms · Operational Properties II

> Last week we transformed *forcing* in time. This week we transform
> *operations*: derivatives of $F(s)$, transforms of integrals, periodic
> functions, the Dirac delta, and systems of ODEs. By the end you will be
> able to solve almost any constant-coefficient IVP in engineering practice.

---

## 13.0  Why this chapter

Three operational tools complete the working set:

1. **Derivatives of a transform.** $\mathcal{L}\{t^{n} f(t)\} = (-1)^{n}
   F^{(n)}(s)$. Useful when $f$ has powers of $t$ multiplying the usual
   table entries.
2. **Transform of an integral and convolution.** $\mathcal{L}\{\int_{0}^{t}
   f(\tau)\,d\tau\} = F(s)/s$ and the convolution theorem $\mathcal{L}\{f
   \ast g\} = F(s) G(s)$.
3. **Periodic functions.** A clean closed form for $F(s)$ when $f$ is
   periodic.

We also cover:

- **The Dirac delta function $\delta(t - a)$** — the idealized impulse;
  $\mathcal{L}\{\delta(t - a)\} = e^{-a s}$.
- **Systems of linear ODEs via Laplace** — preview of Chapters 14–15.

---

## 13.1  Learning objectives

After completing Chapter 13, you should be able to:

1. Compute Laplace transforms of products $t^{n} f(t)$ via the
   derivative-of-transform theorem.
2. Apply the **convolution theorem** to solve integro-differential
   equations.
3. Compute the Laplace transform of a **periodic function** using the
   one-period formula.
4. Use the **Dirac delta** to model impulsive forcing and compute the
   resulting system response (the *impulse response*).
5. Solve a **system** of two coupled linear ODEs by transforming both
   equations and solving algebraically for $X(s), Y(s)$.

---

## 13.2  Lecture notes

### 13.2.1  Derivatives of a transform

> **Theorem.** $\mathcal{L}\{t^{n} f(t)\} = (-1)^{n}\,\dfrac{d^{n} F(s)}{
> d s^{n}}$, $n = 1, 2, 3, \ldots$.

The proof is differentiation under the integral sign:
$\dfrac{d}{ds}\!\int_{0}^{\infty}\! e^{-s t} f(t)\,dt = -\int_{0}^{\infty}\!
t e^{-s t} f(t)\,dt = -\mathcal{L}\{t f(t)\}$.

> **Worked example 13.A.** $\mathcal{L}\{t \sin a t\} = -\dfrac{d}{ds}\!
> \left(\dfrac{a}{s^{2} + a^{2}}\right) = \dfrac{2 a s}{(s^{2} + a^{2})^{2}}$.

### 13.2.2  Transforms of integrals

> **Theorem.** $\mathcal{L}\!\left\{\int_{0}^{t} f(\tau)\,d\tau\right\} =
> \dfrac{F(s)}{s}$.

Equivalently, division by $s$ in the $s$-domain corresponds to integration
from $0$ to $t$ in the time domain — a perfect dual to multiplication by
$s$ for differentiation.

### 13.2.3  Convolution and the convolution theorem

> **Definition.** $(f \ast g)(t) = \int_{0}^{t} f(\tau) g(t - \tau)\,d\tau$.

Convolution is **commutative**, **associative**, and **bilinear**.

> **Theorem (Convolution).** $\mathcal{L}\{f \ast g\} = F(s)\,G(s)$.

This makes some inversions easy. If $H(s) = F(s) G(s)$, then $h(t) = (f \ast
g)(t)$.

> **Worked example 13.B.** Find $\mathcal{L}^{-1}\!\left\{\dfrac{1}{s^{2}\,
> (s^{2} + 1)}\right\}$.
>
> Recognize as $\mathcal{L}\{t\}\,\mathcal{L}\{\sin t\}$. Convolve:
> $(t) \ast (\sin t) = \int_{0}^{t} \tau \sin(t - \tau)\,d\tau = t - \sin t$.

### 13.2.4  Periodic functions

> **Theorem.** If $f(t)$ has period $T$ for $t \ge 0$, then
> $$
> F(s) = \frac{1}{1 - e^{-s T}}\,\int_{0}^{T} e^{-s t}\,f(t)\,dt.
> $$

You only need to compute the integral over **one period**.

> **Worked example 13.C.** Square wave $f(t) = \begin{cases} 1, & 0 \le t <
> 1 \\ -1, & 1 \le t < 2 \end{cases}$, period 2.
>
> $\int_{0}^{2} e^{-s t} f(t)\,dt = \int_{0}^{1} e^{-s t}\,dt -
> \int_{1}^{2} e^{-s t}\,dt = \dfrac{(1 - e^{-s})^{2}}{s}$.
> So $F(s) = \dfrac{(1 - e^{-s})^{2}}{s\,(1 - e^{-2 s})} = \dfrac{1 - e^{-s}}
> {s\,(1 + e^{-s})}$.

### 13.2.5  The Dirac delta function

The **Dirac delta** $\delta(t - a)$ is the idealized limit of an infinitely
narrow, infinitely tall pulse centered at $t = a$ with unit area:
$$
\int_{-\infty}^{\infty} \delta(t - a)\,dt = 1,\quad
\int_{-\infty}^{\infty} \delta(t - a)\,\phi(t)\,dt = \phi(a).
$$

It is not a function in the classical sense — it is a *distribution* — but
it behaves correctly under integration and under the Laplace transform:
$$
\mathcal{L}\{\delta(t - a)\} = e^{-a s}\quad\text{for } a \ge 0.
$$
In particular, $\mathcal{L}\{\delta(t)\} = 1$.

The response of a linear system to a unit impulse — the **impulse response**
$h(t)$ — has transform $H(s) = 1/(\text{characteristic polynomial})$.
By the convolution theorem, the response to *any* forcing $g(t)$ is
$y_{p}(t) = (h \ast g)(t)$. This is the entire foundation of linear system
theory.

> **Worked example 13.D.** Find the impulse response of $\ddot{x} + 2 \dot{x}
> + 5 x = \delta(t)$ with $x(0) = 0,\ \dot{x}(0) = 0$.
>
> Transform: $(s^{2} + 2 s + 5) X = 1 \Rightarrow X(s) = \dfrac{1}{(s + 1)^{2}
> + 4}$.
> Invert: $h(t) = \tfrac{1}{2}\,e^{-t} \sin 2 t$, valid for $t \ge 0$.

### 13.2.6  Systems of linear ODEs via Laplace

For two coupled equations
$$
\begin{aligned}
\dot{x} &= a_{11} x + a_{12} y + g_{1}(t), \\
\dot{y} &= a_{21} x + a_{22} y + g_{2}(t),
\end{aligned}
$$
with $x(0), y(0)$ given, transform both:
$$
\begin{aligned}
s X - x(0) &= a_{11} X + a_{12} Y + G_{1}, \\
s Y - y(0) &= a_{21} X + a_{22} Y + G_{2}.
\end{aligned}
$$
A $2 \times 2$ algebraic system; solve for $X(s), Y(s)$ and invert. We will
use this systematically in Chapter 14.

> **Worked example 13.E.** $\dot{x} = x - y,\ \dot{y} = 2 x - y$, $x(0) = 1,\
> y(0) = 0$.
>
> Transform: $(s - 1) X + Y = 1$ and $-2 X + (s + 1) Y = 0$. Cramer:
> $X = \dfrac{s + 1}{s^{2} + 1}$, $Y = \dfrac{2}{s^{2} + 1}$.
> Invert: $x(t) = \cos t + \sin t$, $y(t) = 2 \sin t$.

### 13.2.7  Integro-differential equations

> **Worked example 13.F.** $y'(t) + 4 \int_{0}^{t} y(\tau)\,d\tau = 1,\
> y(0) = 0$.
>
> Transform: $s Y + 4\,\dfrac{Y}{s} = \dfrac{1}{s} \Rightarrow Y =
> \dfrac{1}{s^{2} + 4}$.
> Invert: $y(t) = \tfrac{1}{2} \sin 2 t$.

The convolution theorem combined with the integral rule absorbs the
integral effortlessly.

---

## 13.3  Reading assignment

Read Zill, **§7.4** (operational properties II), **§7.5** (Dirac delta),
and **§7.6** (systems via Laplace).

---

## 13.4  Practice problems (homework)

Submit as an attachment to the Week 13 Forum.

- **§7.4** — 27, 31, 32, 51, 52
- **§7.5** — 1, 3, 4, 6, 8

For §7.6 (systems via Laplace), problems 1, 7, 15 are recommended — these
double as warm-up for next week.

---

## 13.5  Discussion prompt — *W13: Solving ODEs with Laplace Transforms*

Pick a problem (not yet claimed) involving a $\delta$-function, a periodic
forcing, or a system. Discuss the *physical interpretation* of the
transform's structure: what does $1/\text{characteristic polynomial}$ mean
in time domain?

---

## 13.6  Quiz 5 (Wks 11–12) — due this week

- **Coverage:** Chapters 11–12 (Laplace transform definition, table,
  inversion, IVPs, step functions).
- **Format:** open book, open notes.
- **Weight:** 6%.

---

## 13.7  Self-assessment

1. Compute $\mathcal{L}\{t e^{-t} \cos t\}$.
2. Use the convolution theorem to find $\mathcal{L}^{-1}\!\left\{\dfrac{1}
   {(s^{2} + 1)^{2}}\right\}$.
3. Find the Laplace transform of the sawtooth $f(t) = t \mod 1$ (period 1).
4. A mass-spring-damper $\ddot{x} + 2 \dot{x} + 5 x = \delta(t - 1)$ with
   $x(0) = \dot{x}(0) = 0$. Find $x(t)$.
5. Solve the system $\dot{x} = -x + 2 y,\ \dot{y} = -2 x - y$ with
   $x(0) = 1, y(0) = 0$ via Laplace. Compare with the eigenvalue method
   you'll learn next week.

---

## 13.8  Glossary

- **Derivative-of-transform theorem.** $\mathcal{L}\{t^{n} f\} = (-1)^{n}
  F^{(n)}(s)$.
- **Transform of an integral.** $\mathcal{L}\{\int_{0}^{t} f(\tau)\,d\tau\}
  = F(s)/s$.
- **Convolution.** $(f \ast g)(t)$; $\mathcal{L}\{f \ast g\} = F(s) G(s)$.
- **Periodic-function formula.** $F(s) = \dfrac{1}{1 - e^{-s T}}\int_{0}^{T}
  e^{-s t} f(t)\,dt$.
- **Dirac delta $\delta(t - a)$.** Distribution with $\mathcal{L}\{\delta\}
  = e^{-a s}$; idealization of an instantaneous impulse.
- **Impulse response $h(t)$.** $\mathcal{L}^{-1}\{1/\text{char.\ poly.}\}$.
- **Integro-differential equation.** ODE with an integral term, soluble by
  Laplace + convolution.

---

## 13.9  Connections

- **Builds on:** Chapter 12 (Laplace mechanics).
- **Sets up:** Chapters 14–15 (systems by eigenvalue methods, with Laplace
  as an alternate path).
- **Cross-cutting theme:** *Linearity = convolution.* Every linear
  time-invariant system is fully characterized by its impulse response.
