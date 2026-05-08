---
chapter: 14
week: 14
title: "Systems of Linear First-Order ODEs"
zill_sections: ["8.1", "8.2"]
course_objectives: [CO1, CO2, CO4, CO5, CO6]
tags: [math240, week14, systems, eigenvalues, eigenvectors, phase-plane]
prev: "13-Continuing-with-Laplace-Transforms.md"
next: "15-Nonhomogeneous-Systems-of-Linear-ODEs.md"
---

# Chapter 14 — Systems of Linear First-Order ODEs

> The new concept this week is **multiple dependent variables** — all
> functions of the same independent variable. Two coupled tanks, two
> populations interacting, a circuit with two loops: each is naturally
> a system, not a single equation.

---

## 14.0  Why this chapter

A linear first-order **system** has the form
$$
\dot{\mathbf{x}}(t) = A\,\mathbf{x}(t) + \mathbf{f}(t),
$$
where $A$ is an $n \times n$ matrix of constants (or functions of $t$) and
$\mathbf{x}(t) = (x_{1}(t), \ldots, x_{n}(t))^{\mathsf{T}}$.

Two reasons systems matter:

1. **Real applications are systems.** Multi-tank mixing, RLC networks with
   multiple loops, predator–prey, and population age-structure models all
   produce systems naturally.
2. **Higher-order = first-order systems.** A second-order ODE
   $a y'' + b y' + c y = g$ is equivalent to a 2-D first-order system via
   $x_{1} = y, x_{2} = y'$. So everything we learn about systems applies
   to higher-order single equations.

This week we focus on the **homogeneous** constant-coefficient case
$\dot{\mathbf{x}} = A\,\mathbf{x}$. The eigenvalue method is the
analog of the characteristic-equation method from Chapter 7.

---

## 14.1  Learning objectives

After completing Chapter 14, you should be able to:

1. Convert a higher-order linear ODE into a first-order system.
2. State the **existence-uniqueness** theorem for linear systems.
3. Compute **eigenvalues** and **eigenvectors** of small matrices and use
   them to write the general solution of $\dot{\mathbf{x}} = A
   \mathbf{x}$.
4. Handle the three eigenvalue cases — distinct real, complex conjugate,
   and repeated — including generalized eigenvectors.
5. Sketch a **phase portrait** in the plane and classify equilibria as
   nodes, saddles, spirals, or centers.

---

## 14.2  Lecture notes

### 14.2.1  Higher order to first order

Given $y'' + p(t) y' + q(t) y = g(t)$, set $x_{1} = y$ and $x_{2} = y'$.
Then
$$
\dot{x}_{1} = x_{2},\qquad \dot{x}_{2} = -q\,x_{1} - p\,x_{2} + g.
$$
In matrix form:
$$
\dot{\mathbf{x}} = \begin{pmatrix} 0 & 1 \\ -q & -p \end{pmatrix} \mathbf{x}
+ \begin{pmatrix} 0 \\ g \end{pmatrix}.
$$
General order-$n$ ODEs convert to $n$-D systems analogously (the
*companion matrix* form).

### 14.2.2  Existence-uniqueness

> **Theorem.** Suppose $A(t)$ and $\mathbf{f}(t)$ are continuous on an
> interval $I$. For any $t_{0} \in I$ and any $\mathbf{x}_{0} \in
> \mathbb{R}^{n}$, the IVP
> $$
> \dot{\mathbf{x}} = A(t)\,\mathbf{x} + \mathbf{f}(t),\quad
> \mathbf{x}(t_{0}) = \mathbf{x}_{0}
> $$
> has a unique solution on all of $I$.

This is much cleaner than the scalar case — no nonlinear failure modes,
solutions exist on the full coefficient interval.

### 14.2.3  Solving the homogeneous system $\dot{\mathbf{x}} = A \mathbf{x}$

Try $\mathbf{x}(t) = e^{\lambda t}\,\mathbf{v}$. Substitute:
$\lambda e^{\lambda t}\,\mathbf{v} = A\,e^{\lambda t}\,\mathbf{v}
\Rightarrow A\,\mathbf{v} = \lambda\,\mathbf{v}$.

So $\lambda$ must be an **eigenvalue** of $A$ and $\mathbf{v}$ a
corresponding **eigenvector**. We solve $\det(A - \lambda I) = 0$ for
the eigenvalues, then $(A - \lambda I)\,\mathbf{v} = \mathbf{0}$ for each
eigenvector.

**Three cases.**

#### Case 1 — distinct real eigenvalues

$n$ distinct eigenvalues $\lambda_{1}, \ldots, \lambda_{n}$ give $n$
independent solutions $e^{\lambda_{i} t}\,\mathbf{v}_{i}$, and the general
solution is
$$
\mathbf{x}(t) = c_{1} e^{\lambda_{1} t}\,\mathbf{v}_{1} + \cdots +
c_{n} e^{\lambda_{n} t}\,\mathbf{v}_{n}.
$$

> **Worked example 14.A.** $A = \begin{pmatrix} 1 & 2 \\ 3 & 2 \end{pmatrix}$.
>
> Characteristic: $\det(A - \lambda I) = (1 - \lambda)(2 - \lambda) - 6 =
> \lambda^{2} - 3 \lambda - 4 = (\lambda - 4)(\lambda + 1) = 0$. So
> $\lambda = 4, -1$.
>
> $\lambda = 4$: $\begin{pmatrix} -3 & 2 \\ 3 & -2 \end{pmatrix}\mathbf{v}
> = 0 \Rightarrow \mathbf{v}_{1} = (2, 3)^{\mathsf{T}}$.
> $\lambda = -1$: $\mathbf{v}_{2} = (1, -1)^{\mathsf{T}}$.
> $$
> \mathbf{x}(t) = c_{1} e^{4 t}\,\binom{2}{3} + c_{2} e^{-t}\,\binom{1}{-1}.
> $$

#### Case 2 — complex conjugate eigenvalues

If $A$ is real and $\lambda = \alpha + i \beta$ is an eigenvalue with
eigenvector $\mathbf{v} = \mathbf{a} + i \mathbf{b}$, then so is $\bar{\lambda}
= \alpha - i \beta$ with eigenvector $\bar{\mathbf{v}} = \mathbf{a} - i
\mathbf{b}$. Two real solutions:
$$
\mathbf{x}_{1}(t) = e^{\alpha t}\bigl(\mathbf{a} \cos \beta t - \mathbf{b}
\sin \beta t\bigr),
\quad
\mathbf{x}_{2}(t) = e^{\alpha t}\bigl(\mathbf{a} \sin \beta t + \mathbf{b}
\cos \beta t\bigr).
$$

#### Case 3 — repeated eigenvalues (defective case)

If $\lambda$ is a repeated eigenvalue but $A$ has *fewer* eigenvectors than
its multiplicity, $A$ is **defective**. Use **generalized eigenvectors**:
solve $(A - \lambda I)\,\mathbf{w} = \mathbf{v}$ for $\mathbf{w}$, then the
second independent solution is
$$
\mathbf{x}_{2}(t) = e^{\lambda t}\bigl(t\,\mathbf{v} + \mathbf{w}\bigr).
$$
The $t$ factor is the analog of the $\ln x$ term in the repeated-root
Cauchy-Euler case — and of the $x e^{m x}$ in repeated-root constant-
coefficient ODEs.

> **Worked example 14.B — defective.** $A = \begin{pmatrix} 3 & 1 \\ -1 & 1
> \end{pmatrix}$ has $\det(A - \lambda I) = (\lambda - 2)^{2} = 0$, so
> $\lambda = 2$ (double).
>
> Eigenvector: $(A - 2 I)\,\mathbf{v} = 0 \Rightarrow \mathbf{v} = (1,
> -1)^{\mathsf{T}}$. Only one — defective.
> Generalized: $(A - 2 I)\,\mathbf{w} = \mathbf{v} \Rightarrow
> \mathbf{w} = (1, 0)^{\mathsf{T}}$ works.
> $$
> \mathbf{x}(t) = c_{1} e^{2 t} \binom{1}{-1} + c_{2} e^{2 t}\!\left[t
> \binom{1}{-1} + \binom{1}{0}\right].
> $$

### 14.2.4  Phase portraits in the plane

For 2-D systems, plot trajectories in the $(x_{1}, x_{2})$-plane.
Equilibria are at $A \mathbf{x} = 0$ — for invertible $A$, only the origin.

Classification by eigenvalues:

| Eigenvalues                              | Equilibrium type | Stability      |
| ---------------------------------------- | ---------------- | -------------- |
| Real, both negative                      | **Stable node**  | Asymp. stable  |
| Real, both positive                      | **Unstable node**| Unstable       |
| Real, opposite signs                     | **Saddle**       | Unstable       |
| Complex, $\Re \lambda < 0$               | **Stable spiral**| Asymp. stable  |
| Complex, $\Re \lambda > 0$               | **Unstable spiral**| Unstable     |
| Pure imaginary ($\Re \lambda = 0$)       | **Center**       | Stable (not asymp.) |
| Repeated, both negative (non-defective)  | **Stable star**  | Asymp. stable  |

This single table summarizes 90% of the phase-plane analysis you'll do.

### 14.2.5  Compact form using the matrix exponential

The general solution can be written compactly as $\mathbf{x}(t) = e^{A t}\,
\mathbf{x}(0)$, where $e^{A t} = \sum_{k=0}^{\infty}\dfrac{(A t)^{k}}{k!}$.
Computing $e^{A t}$ is exactly equivalent to solving the system. We won't
use this notation heavily but you should know it exists — it is
foundational for control theory.

### 14.2.6  Application — coupled mixing tanks

Two tanks, each with volume $V$. Pure water enters Tank 1 at rate $r$, the
contents flow at rate $r$ to Tank 2, and Tank 2's outflow leaves the system
(also rate $r$). Let $A_{i}(t)$ be salt in tank $i$.
$$
\begin{aligned}
\dot{A}_{1} &= -\tfrac{r}{V}\,A_{1}, \\
\dot{A}_{2} &= \tfrac{r}{V}\,A_{1} - \tfrac{r}{V}\,A_{2}.
\end{aligned}
$$

The matrix is upper triangular; eigenvalues are the diagonal entries
$-r/V$ (repeated). Solve and you find the salt traveling from Tank 1 to
Tank 2 with a delayed peak — exactly the qualitative behavior physical
intuition predicts.

---

## 14.3  Reading assignment

Read Zill, **§8.1** (linear systems theory) and **§8.2** (homogeneous
linear systems with constant coefficients).

---

## 14.4  Practice problems (homework)

Submit as an attachment to the Week 14 Forum.

- **§8.1** — 1, 4, 5, 8, 9, 13, 18, 19, 23
- **§8.2** — 3, 6, 8, 9, 13, 14, 23, 24

For each problem with complex or repeated eigenvalues, **sketch the phase
portrait**.

---

## 14.5  Discussion prompt — *W14: Homogeneous Linear Systems of ODEs*

Pick a system (not yet claimed) and compute its phase portrait
qualitatively. Identify the equilibrium type from the eigenvalues and
sketch a few representative trajectories.

---

## 14.6  Quiz 6 (Wks 13–14) — due this week

- **Coverage:** Chapters 13–14 (Laplace operational II, Dirac delta,
  homogeneous systems).
- **Format:** open book, open notes.
- **Weight:** 6%.

---

## 14.7  Self-assessment

1. Convert $y''' + 2 y'' - y' + 3 y = 0$ to a first-order system.
2. Solve $\dot{\mathbf{x}} = \begin{pmatrix} 2 & 1 \\ -1 & 2 \end{pmatrix}\,
   \mathbf{x},\ \mathbf{x}(0) = (1, 0)^{\mathsf{T}}$.
3. Solve the defective system $\dot{\mathbf{x}} = \begin{pmatrix} 4 & -1
   \\ 1 & 2 \end{pmatrix}\,\mathbf{x}$.
4. Classify the equilibrium of $\dot{\mathbf{x}} = \begin{pmatrix} 1 & 2
   \\ 3 & 2 \end{pmatrix}\,\mathbf{x}$.
5. Verify by substitution that the matrix exponential
   $e^{A t}\,\mathbf{x}_{0}$ solves $\dot{\mathbf{x}} = A \mathbf{x},\
   \mathbf{x}(0) = \mathbf{x}_{0}$.

---

## 14.8  Glossary

- **System.** $\dot{\mathbf{x}} = A(t)\,\mathbf{x} + \mathbf{f}(t)$.
- **Eigenvalue / eigenvector.** $A \mathbf{v} = \lambda \mathbf{v}$.
- **Defective matrix.** Fewer linearly independent eigenvectors than the
  algebraic multiplicity of an eigenvalue.
- **Generalized eigenvector.** Solves $(A - \lambda I) \mathbf{w} =
  \mathbf{v}$.
- **Phase portrait.** Plot of trajectories in state space.
- **Equilibrium types.** Node, saddle, spiral, center, star.
- **Matrix exponential $e^{A t}$.** Power series; gives $\mathbf{x}(t) =
  e^{A t} \mathbf{x}(0)$ for the homogeneous system.

---

## 14.9  Connections

- **Builds on:** linear algebra (eigenvalues / eigenvectors); Chapters 7–9
  (linear scalar theory).
- **Sets up:** Chapter 15 (nonhomogeneous systems = systems analog of
  Chapter 8).
- **Cross-cutting theme:** *The companion form unifies higher-order ODEs
  and systems.*
