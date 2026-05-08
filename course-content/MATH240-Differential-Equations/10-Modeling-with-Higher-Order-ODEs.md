---
chapter: 10
week: 10
title: "Modeling with Higher-Order ODEs"
zill_sections: ["5.1", "5.2", "5.3"]
course_objectives: [CO1, CO2, CO6]
tags: [math240, week10, modeling, spring-mass, rlc, resonance, bvp]
prev: "09-Cauchy-Euler-and-Nonlinear-ODEs.md"
next: "11-Introduction-to-Laplace-Transforms.md"
---

# Chapter 10 — Modeling with Higher-Order ODEs

> Armed with the homogeneous and nonhomogeneous techniques of Chapters 7–9,
> we return to physical modeling. Spring-mass systems, RLC circuits, and
> beam deflection all live as second-order linear ODEs. *Damping*,
> *forcing*, and *resonance* are now physical phenomena, not just algebra.

---

## 10.0  Why this chapter

Three canonical second-order applications:

1. **Mechanical vibrations.** A spring-mass system with damping and an
   external driving force.
2. **Electrical circuits.** A series RLC circuit driven by an EMF.
3. **Boundary-value problems.** Beam bending, heat conduction in a rod —
   conditions at two endpoints rather than at one.

We will see how the **same** ODE
$$
m \ddot{x} + c \dot{x} + k x = F(t)
$$
describes a mass on a spring *and* the charge on a capacitor in an RLC
circuit. The mathematics doesn't care; the engineer reads it both ways.

---

## 10.1  Learning objectives

After completing Chapter 10, you should be able to:

1. Set up the **spring-mass** ODE for free undamped, free damped (under-,
   critically-, and overdamped), and driven motion.
2. Compute **natural frequency**, **damping ratio**, **transient** vs.
   **steady-state** responses, and the **amplitude** of the steady-state
   under sinusoidal forcing.
3. Identify and analyze **resonance**, including the unbounded growth in
   the undamped case.
4. Set up and solve a **series RLC** circuit and recognize its mechanical
   analog.
5. Set up a simple **boundary-value problem** (beam bending) and
   distinguish it from an IVP.
6. Recognize and analyze nonlinear models such as the **pendulum** and
   the **Duffing oscillator**, including the role of small-angle
   linearization.

---

## 10.2  Lecture notes

### 10.2.1  Spring-mass without forcing

Newton's second law for a mass $m$ on a spring with stiffness $k$ and
damping coefficient $c$ (linear damping, $-c \dot{x}$):
$$
m \ddot{x} + c \dot{x} + k x = 0,\quad x(0) = x_{0},\ \dot{x}(0) = v_{0}.
$$

Let $\omega_{0} = \sqrt{k/m}$ (the **natural frequency**) and
$\zeta = \dfrac{c}{2 \sqrt{m k}}$ (the **damping ratio**). The
characteristic equation $m s^{2} + c s + k = 0$ has roots
$$
s_{1, 2} = -\zeta \omega_{0} \pm \omega_{0} \sqrt{\zeta^{2} - 1}.
$$

| Damping            | Condition       | Solution form                                                               |
| ------------------ | --------------- | --------------------------------------------------------------------------- |
| **Underdamped**    | $0 < \zeta < 1$ | $e^{-\zeta \omega_{0} t}\bigl(A \cos \omega_{d} t + B \sin \omega_{d} t\bigr)$ |
| **Critical**       | $\zeta = 1$     | $(A + B t)\,e^{-\omega_{0} t}$                                              |
| **Overdamped**     | $\zeta > 1$     | $A e^{s_{1} t} + B e^{s_{2} t}$ (both $s_{i} < 0$)                          |
| **Undamped**       | $\zeta = 0$     | $A \cos \omega_{0} t + B \sin \omega_{0} t$                                 |

Here $\omega_{d} = \omega_{0} \sqrt{1 - \zeta^{2}}$ is the **damped natural
frequency**.

> **Worked example 10.A.** $m = 1,\ c = 2,\ k = 5$. So $\omega_{0} = \sqrt{5},\
> \zeta = 1/\sqrt{5} < 1$ — underdamped.
> Roots: $s = -1 \pm 2 i$. Free response with $x(0) = 1, \dot{x}(0) = 0$:
> $x(t) = e^{-t}\bigl(\cos 2 t + \tfrac{1}{2} \sin 2 t\bigr)$.

### 10.2.2  Spring-mass with sinusoidal forcing

$$
m \ddot{x} + c \dot{x} + k x = F_{0} \cos \omega t.
$$

The general solution splits into:

- **Transient** $x_{c}$: decays to zero (damped case) or persists undamped.
- **Steady state** $x_{p}$: same frequency $\omega$ as the forcing, with
  amplitude
  $$
  X(\omega) = \frac{F_{0}}{\sqrt{(k - m \omega^{2})^{2} + (c \omega)^{2}}}
  $$
  and a phase lag $\phi(\omega)$ that increases through $\pi$ as $\omega$
  passes the resonance frequency.

**Resonance.** $X(\omega)$ peaks near $\omega = \omega_{0}$. In the
**undamped** case ($c = 0$) and exactly $\omega = \omega_{0}$, the
particular solution is $x_{p} = \dfrac{F_{0}}{2 m \omega_{0}}\,t \sin
\omega_{0} t$ — amplitude grows linearly with $t$, the classic *resonance
catastrophe*.

> **Worked example 10.B — beats.** $m = 1, c = 0, k = 1$, drive at
> $\omega = 1.1$. Transient $x_{c}$ persists (undamped); particular
> $x_{p} = \dfrac{F_{0}}{1 - 1.21} \cos 1.1 t \approx -4.76\,F_{0}\,
> \cos 1.1 t$. Combined with the homogeneous response, you see a beat
> envelope at frequency $|1 - 1.1|/2 = 0.05$.

### 10.2.3  Series RLC circuit

Kirchhoff's voltage law for a series RLC with EMF $E(t)$ and capacitor
charge $q(t)$:
$$
L \ddot{q} + R \dot{q} + \frac{1}{C}\,q = E(t).
$$

This is *the same* ODE as the spring-mass system, with the dictionary

| Mechanical | Electrical                  |
| ---------- | --------------------------- |
| $m$        | $L$                         |
| $c$        | $R$                         |
| $k$        | $1/C$                       |
| $x$        | $q$                         |
| $\dot x$   | $i = \dot q$                |
| $F(t)$     | $E(t)$                      |

> **Worked example 10.C.** $L = 0.5,\ R = 10,\ 1/C = 100,\ E(t) = 0$,
> $q(0) = 1,\ i(0) = 0$. Roots: $s = -10 \pm 10 i$. Underdamped: $q(t) =
> e^{-10 t}(\cos 10 t + \sin 10 t)$.

### 10.2.4  Boundary-value problems

A second-order ODE $y'' + p(x) y' + q(x) y = g(x)$ on $[a, b]$ with
conditions
$y(a) = \alpha,\ y(b) = \beta$
is a **two-point BVP**. Unlike IVPs, BVPs may have *no solution*, *exactly
one*, or *infinitely many* — there is no general existence-uniqueness
theorem.

> **Worked example 10.D.** $y'' + y = 0$ on $[0, \pi]$ with $y(0) = 0,\
> y(\pi) = 0$.
> General: $y = c_{1} \cos x + c_{2} \sin x$.
> $y(0) = c_{1} = 0$. $y(\pi) = c_{2} \sin \pi = 0$ — automatically
> satisfied for *any* $c_{2}$. So the BVP has **infinitely many
> solutions** $y = c_{2} \sin x$.

This is the gateway to the theory of **eigenvalue problems** — beyond the
scope of MATH240 but worth knowing exists.

### 10.2.5  Nonlinear models — the simple pendulum

A pendulum of length $L$:
$$
L \ddot{\theta} + g \sin \theta = 0.
$$
The nonlinearity is $\sin \theta$. **Small-angle linearization** uses
$\sin \theta \approx \theta$ to recover an undamped harmonic oscillator with
period $T = 2 \pi \sqrt{L / g}$. For larger swings the period **increases**
with amplitude — a phenomenon you can see numerically (RK4) but cannot
capture from the linearized model.

The **Duffing oscillator** $\ddot{x} + \delta \dot{x} + \alpha x + \beta x^{3}
= F(t)$ is another classic; it exhibits hysteresis, multiple stable
states, and (for chaotic forcing) chaos.

---

## 10.3  Reading assignment

Read Zill, **§5.1** (free undamped, damped, driven), **§5.2** (BVPs), and
**§5.3** (nonlinear models).

---

## 10.4  Practice problems (homework)

Submit as an attachment to the Week 10 Forum.

- **§5.1** — 3, 6, 21–24, 29, 35, 49, 51, 53, 60
- **§5.2** — 9, 11, 12, 13, 21, 22
- **§5.3** — 2, 8, 11

For modeling problems, **always** state $\omega_{0}, \zeta$, and the
qualitative regime *before* solving.

---

## 10.5  Discussion prompt — *W10: Modeling with 2nd-order ODEs*

Pick a problem (not yet claimed) and connect it to a real engineering
phenomenon. For mechanical / electrical analogs, articulate the dictionary
explicitly. For BVPs, discuss why uniqueness is **not** guaranteed.

---

## 10.6  Self-assessment

1. For $\ddot{x} + 4 \dot{x} + 13 x = 0$, classify the damping and find the
   damped natural frequency.
2. Drive the same system with $F(t) = 50 \cos 3 t$. Find the steady-state
   amplitude and phase.
3. State and verify the mechanical-electrical analogy for the system
   $\ddot{q} + 4 \dot{q} + 13 q = 50 \cos 3 t$.
4. The BVP $y'' + 4 y = 0,\ y(0) = 0,\ y(\pi/2) = 1$ — find the unique
   solution. Explain why uniqueness *does* hold here.
5. For the simple pendulum, derive the small-angle period and explain the
   physical meaning of $\sqrt{g/L}$.

---

## 10.7  Glossary

- **Natural frequency $\omega_{0} = \sqrt{k/m}$.**
- **Damped natural frequency $\omega_{d} = \omega_{0}\sqrt{1 - \zeta^{2}}$.**
- **Damping ratio $\zeta = c / (2\sqrt{mk})$.**
- **Underdamped / critical / overdamped / undamped.** Regimes of the
  damping ratio.
- **Transient and steady-state response.** Decomposition of the forced
  solution into homogeneous + particular.
- **Resonance.** Amplification when forcing frequency matches a natural
  mode.
- **BVP.** Conditions specified at two points; uniqueness not guaranteed.

---

## 10.8  Connections

- **Builds on:** Chapters 7–9 (homogeneous and nonhomogeneous theory).
- **Sets up:** Chapter 11 (Laplace transforms make these problems
  algebraic — a huge productivity gain for engineering applications).
- **Cross-cutting theme:** *Same equation, many systems.* The mathematics
  abstracts away from physics; recognize the form, solve it once, apply
  it everywhere.
