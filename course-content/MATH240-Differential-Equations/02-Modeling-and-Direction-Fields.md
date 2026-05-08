---
chapter: 2
week: 2
title: "Modeling and Direction Fields"
zill_sections: ["1.3", "2.1", "2.2", "2.3"]
course_objectives: [CO1, CO3]
tags: [math240, week2, direction-fields, autonomous, separable, linear]
prev: "01-Introduction-to-Differential-Equations.md"
next: "03-First-Order-ODEs-Separable-and-Linear.md"
---

# Chapter 2 — Modeling and Direction Fields

> Because ODEs focus on rates of change, we often find solutions that are
> accurate "up to a constant." This week we learn to *visualize* the entire
> family at once with direction fields, and we begin to *compute* members of
> that family with our first solution techniques.

---

## 2.0  Why this chapter

In Chapter 1 you learned to *recognize* and *verify* an ODE. This week's
goal is twofold:

1. **Qualitative.** Read the geometry of a first-order ODE
   $y' = f(x, y)$ off its **direction field** — without ever solving it.
2. **Quantitative.** Solve our two most fundamental classes of first-order
   ODEs: **separable** equations and **linear** equations (via integrating
   factors).

Direction fields are an essential intuition pump. Even when an equation
cannot be solved in closed form, a direction field sketch (or a slope field
plot in MATLAB) tells you whether solutions grow, decay, oscillate, or blow up.

---

## 2.1  Learning objectives

After completing Chapter 2, you should be able to:

1. Sketch a direction field for $y' = f(x, y)$ by hand for a small grid and
   read solution behavior off it.
2. Identify **autonomous** first-order ODEs and locate their **equilibria**;
   classify each as stable, unstable, or semi-stable.
3. Solve **separable** ODEs $\dfrac{dy}{dx} = g(x)\,h(y)$ by direct
   integration, including IVPs.
4. Solve **first-order linear** ODEs $y' + P(x)\,y = Q(x)$ using the
   integrating factor $\mu(x) = e^{\int P\,dx}$.
5. Use MATLAB or Excel to plot a direction field and overlay solution
   curves.

---

## 2.2  Lecture notes

### 2.2.1  Direction (slope) fields

For an explicit first-order ODE $y' = f(x, y)$, the right-hand side gives the
**slope** of the solution curve at any point $(x, y)$. Plotting a small line
segment with slope $f(x, y)$ at each grid point produces a *direction field*.
Trajectories are obtained by following the field.

**Reading a direction field.**
- Where the field is horizontal ($f = 0$), solutions have a horizontal
  tangent — a candidate **equilibrium** or *isocline of zero slope*.
- Where the field is steep, solutions change quickly.
- Solutions never cross (uniqueness), so a sketch of one curve constrains
  its neighbors.

### 2.2.2  Autonomous first-order ODEs

> **Definition (Autonomous).** A first-order ODE
> $y' = f(y)$ — right-hand side independent of $x$ — is *autonomous*.

Autonomous equations are special because the field along any horizontal line
$y = c$ has the same slope $f(c)$ everywhere. The full picture is
captured by a **phase line**, a 1-D plot of $y$ marked with arrows showing
where $y$ increases ($f > 0$) and decreases ($f < 0$).

> **Definition (Equilibrium).** A constant function $y(x) = c^{\ast}$ such
> that $f(c^{\ast}) = 0$ is an *equilibrium* (or *critical point*).

Classification by the sign of $f$ near $c^{\ast}$:

| Behavior of $f$ across $c^\ast$ | Classification                |
| ------------------------------- | ----------------------------- |
| $f > 0$ below, $f < 0$ above    | **Stable** (asymptotically)   |
| $f < 0$ below, $f > 0$ above    | **Unstable**                  |
| $f$ same sign on both sides     | **Semi-stable**               |

> **Worked example 2.A.** Classify the equilibria of $y' = y(1 - y)$.
>
> Equilibria solve $y(1 - y) = 0 \Rightarrow y = 0$ or $y = 1$.
> Sign chart: $y' > 0$ for $0 < y < 1$, $y' < 0$ for $y > 1$ or $y < 0$.
> Therefore $y = 0$ is **unstable** and $y = 1$ is **stable** (the famous
> *logistic* model).

### 2.2.3  Separable equations

> **Definition (Separable).** A first-order ODE is *separable* if it can be
> written
> $$
> \frac{dy}{dx} = g(x)\,h(y).
> $$

**Method.**
1. Separate variables: $\dfrac{dy}{h(y)} = g(x)\,dx$ (assuming $h(y) \ne 0$).
2. Integrate both sides.
3. Solve for $y$ explicitly if possible; otherwise leave as an implicit
   relation.
4. Don't forget any equilibrium solutions $h(y) = 0$ that you divided away.

> **Worked example 2.B.** Solve $\dfrac{dy}{dx} = \dfrac{x}{y},\ y(0) = 2$.
>
> Separate: $y\,dy = x\,dx$. Integrate:
> $\tfrac{1}{2}y^{2} = \tfrac{1}{2}x^{2} + C_{1}$, i.e. $y^{2} = x^{2} + C$.
> Apply IC: $4 = 0 + C \Rightarrow C = 4$. Solution (positive root):
> $y(x) = \sqrt{x^{2} + 4}$, valid on $\mathbb{R}$.

### 2.2.4  First-order linear equations

> **Definition (Linear).** An ODE in standard form
> $$
> y' + P(x)\,y = Q(x)
> $$
> is *first-order linear*. If $Q \equiv 0$ it is **homogeneous**.

**The integrating-factor method.** Multiply both sides by
$\mu(x) = e^{\int P(x)\,dx}$. The left side collapses to a perfect derivative:
$\bigl(\mu y\bigr)' = \mu Q$. Then integrate and divide by $\mu$:
$$
y(x) = \frac{1}{\mu(x)}\!\left[\,\int \mu(x)\,Q(x)\,dx + C\,\right].
$$

> **Worked example 2.C.** Solve $y' + 2y = e^{-x},\ y(0) = 1$.
>
> Here $P = 2$, so $\mu = e^{2x}$. Multiply: $\bigl(e^{2x} y\bigr)' = e^{x}$.
> Integrate: $e^{2x} y = e^{x} + C$. Therefore $y(x) = e^{-x} + C\,e^{-2x}$.
> Apply $y(0) = 1$: $1 = 1 + C \Rightarrow C = 0$. Solution:
> $y(x) = e^{-x}$.

### 2.2.5  Why these two methods cover so much ground

Separable equations capture the rate of change as a product of an "input
forcing" $g(x)$ and a "state response" $h(y)$. Linear first-order equations
capture the **superposition** principle for first-order systems: the response
to forcing $Q$ is the homogeneous response plus a particular response. Almost
every real-world first-order model is one of these two forms (or reducible
to one, as we will see in Chapter 4).

---

## 2.3  Worked example — direction field by hand

Sketch the direction field of $y' = x - y$ on the grid
$\{-2, -1, 0, 1, 2\} \times \{-2, -1, 0, 1, 2\}$.

| $x \backslash y$ | $-2$ | $-1$ | $0$ | $1$ | $2$ |
| ---------------- | ---- | ---- | --- | --- | --- |
| $-2$             | $0$  | $-1$ | $-2$| $-3$| $-4$|
| $-1$             | $1$  | $0$  | $-1$| $-2$| $-3$|
| $0$              | $2$  | $1$  | $0$ | $-1$| $-2$|
| $1$              | $3$  | $2$  | $1$ | $0$ | $-1$|
| $2$              | $4$  | $3$  | $2$ | $1$ | $0$ |

Notice the diagonal $y = x$ is the *isocline of zero slope*; solutions
asymptote to the line $y = x - 1$ (which you can verify is itself a solution).

---

## 2.4  Reading assignment

Read Zill, **§1.3, §2.1 (incl. 2.1.1 and 2.1.2), §2.2, §2.3**. In §2.1, focus
on direction fields and autonomous equations; in §2.2 and §2.3, focus on the
mechanics of the two solution methods.

---

## 2.5  Practice problems (homework)

Submit as an attachment to the Week 2 Forum.

- **§1.3** — 5, 7, 8, 9, 15, 16, 19
- **§2.1** — 5, 6, 7, 13, 19, 21, 23, 26 *(direction fields and equilibria)*

Also recommended: **§2.2** — 1, 3, 5, 7, 9, 11, 23, 25, 29, 37, 41 and
**§2.3** — 1, 3, 5, 7, 9, 11, 15, 19, 23, 25, 29, 33 (these will be the
core of next week's homework).

**MATLAB primer.** Complete Sections 0–3 of the
[MATLAB primer](./appendix/A-MATLAB-Primer.md) by the end of Week 2.

---

## 2.6  Discussion prompt — *W2: Solution curves for ODEs*

From the discussion problems

- §1.1: 43–62
- §1.2: 45–51
- §1.3: 30–39
- §2.1: 16–18 and 31–37
- Ch 1 Review: 15–22 and 39, 40

select **one** that has not yet been claimed. Spend serious time on the
*concept* — you do not need to solve the problem to completion. Address at
least one section of the problem in conceptual depth.

> **Focus.** Conceptual understanding, not mechanical solving. The goal is
> to articulate *why* a technique works on a given equation and *what
> behavior* the solution will exhibit.

Reply to ≥ 2 classmates. Do not attach anything other than your homework set.

---

## 2.7  Self-assessment

1. Sketch the direction field of $y' = -y$ near the origin and explain why
   every solution decays to 0 as $x \to \infty$.
2. For $y' = y^{2} - 4$, find the equilibria and classify each.
3. Solve $\dfrac{dy}{dx} = e^{x}\,(1 + y^{2})$.
4. Solve $y' + \dfrac{2}{x}\,y = x^{2}$ on $(0, \infty)$.
5. Why is $\mu(x) = e^{\int P\,dx}$ guaranteed to convert $y' + Py = Q$ into
   $(\mu y)' = \mu Q$?

---

## 2.8  Glossary

- **Direction (slope) field.** Plot of short segments with slope $f(x, y)$
  on a grid in the $xy$-plane.
- **Isocline.** A curve along which $f(x, y)$ is constant; the level sets of
  the right-hand side.
- **Autonomous ODE.** $y' = f(y)$, with no explicit dependence on $x$.
- **Equilibrium / critical point.** Constant solution where $f(y) = 0$.
- **Phase line.** 1-D representation of an autonomous ODE's flow.
- **Separable.** $y' = g(x)\,h(y)$.
- **First-order linear.** $y' + P(x)\,y = Q(x)$.
- **Integrating factor.** $\mu(x) = e^{\int P(x)\,dx}$.

---

## 2.9  Connections

- **Builds on:** Chapter 1 (definitions, IVPs).
- **Sets up:** Chapter 3 (more separable / linear plus exact equations);
  Chapter 5 (numerical methods built on slope-field intuition).
- **Cross-cutting theme:** *Classify before you solve* — recognize separable
  vs. linear before reaching for a method.
