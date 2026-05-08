---
chapter: 15
week: 15
title: "Nonhomogeneous Systems of Linear First-Order ODEs"
zill_sections: ["8.2", "8.3"]
course_objectives: [CO1, CO2, CO4, CO5, CO6]
tags: [math240, week15, systems, nonhomogeneous, undetermined-coefficients, variation-of-parameters, numerical-systems]
prev: "14-Systems-of-Linear-First-Order-ODEs.md"
next: "16-Final-Examination-and-Course-Review.md"
---

# Chapter 15 — Nonhomogeneous Systems of Linear First-Order ODEs

> Add a forcing vector $\mathbf{f}(t)$ to a homogeneous system and the
> structure theorem from Chapter 8 reappears: general nonhomogeneous =
> homogeneous + particular. The mechanics for finding $\mathbf{x}_{p}$
> mirror the scalar case — undetermined coefficients (when $\mathbf{f}$ is
> nice) and variation of parameters (always).

---

## 15.0  Why this chapter

Consider $\dot{\mathbf{x}} = A\,\mathbf{x} + \mathbf{f}(t)$.

The *complementary* solution $\mathbf{x}_{c}(t)$ — solution of
$\dot{\mathbf{x}} = A\,\mathbf{x}$ — is what we built last week. The
*particular* solution $\mathbf{x}_{p}(t)$ comes from one of three methods:

1. **Undetermined coefficients** — vector ansatz; works when $\mathbf{f}$
   is polynomial × exponential × trig.
2. **Variation of parameters** — universal; uses the fundamental matrix
   $\Phi(t)$ formed from the columns $\mathbf{x}_{c}^{(i)}(t)$.
3. **Laplace transform** — covered in Chapter 13; convert system to
   algebra in $s$.

We close the course's analytical toolkit and add a brief look at
**numerical methods for systems** so you can simulate any system not
soluble in closed form.

---

## 15.1  Learning objectives

After completing Chapter 15, you should be able to:

1. State the structure theorem for nonhomogeneous linear systems.
2. Apply **undetermined coefficients** in vector form (with appropriate
   resonance handling).
3. Construct a **fundamental matrix** $\Phi(t)$ from the homogeneous
   solutions and use it for **variation of parameters**:
   $$
   \mathbf{x}_{p}(t) = \Phi(t)\,\int \Phi(t)^{-1}\,\mathbf{f}(t)\,dt.
   $$
4. Solve a system via **Laplace transform** as an alternate route.
5. Implement **RK4 for systems** in MATLAB / Excel and use it to solve
   nonlinear problems numerically.

---

## 15.2  Lecture notes

### 15.2.1  Structure theorem for systems

> **Theorem.** The general solution of $\dot{\mathbf{x}} = A\,\mathbf{x} +
> \mathbf{f}(t)$ on an interval $I$ is
> $$
> \mathbf{x}(t) = \mathbf{x}_{c}(t) + \mathbf{x}_{p}(t),
> $$
> where $\mathbf{x}_{c}$ is the general homogeneous solution and
> $\mathbf{x}_{p}$ is any particular solution.

### 15.2.2  Undetermined coefficients (vector form)

For constant-coefficient systems with "nice" $\mathbf{f}$, propose a vector
ansatz of the same form as $\mathbf{f}$ with **vector unknowns**.

| $\mathbf{f}(t)$              | Trial $\mathbf{x}_{p}(t)$                |
| ---------------------------- | ---------------------------------------- |
| constant $\mathbf{b}$        | $\mathbf{a}$                             |
| polynomial of degree $n$     | polynomial of degree $n$ in vector form  |
| $e^{\alpha t}\,\mathbf{b}$   | $e^{\alpha t}\,\mathbf{a}$               |
| $\cos(\beta t)\,\mathbf{b}$  | $\cos(\beta t)\,\mathbf{a} + \sin(\beta t)\,\mathbf{c}$ |

Substitute into the system and solve a linear system for the components.

> **Resonance.** If $\alpha$ matches an eigenvalue of $A$, multiply the
> ansatz by $t$ (and add a lower-order *constant* vector). The fix is
> identical in spirit to the scalar resonance rule of Chapter 8.

> **Worked example 15.A.** Solve $\dot{\mathbf{x}} = \begin{pmatrix} 1 & 2 \\
> 3 & 2 \end{pmatrix}\,\mathbf{x} + \begin{pmatrix} 0 \\ -8 t \end{pmatrix}$.
>
> $\mathbf{x}_{c}$ from §14.2.3 (Worked example 14.A): eigenvalues $4, -1$.
> Trial $\mathbf{x}_{p} = \mathbf{a}_{0} + t\,\mathbf{a}_{1}$.
> Substitute: $\mathbf{a}_{1} = A\,(\mathbf{a}_{0} + t\,\mathbf{a}_{1}) +
> \begin{pmatrix} 0 \\ -8 t \end{pmatrix}$.
> Match coefficients in $t$: $A\,\mathbf{a}_{1} = \begin{pmatrix} 0 \\ 8
> \end{pmatrix}$ — gives $\mathbf{a}_{1}$.
> Match constants: $\mathbf{a}_{1} = A\,\mathbf{a}_{0}$ — gives
> $\mathbf{a}_{0}$. Combine.

### 15.2.3  Fundamental matrix and variation of parameters

> **Definition.** A **fundamental matrix** $\Phi(t)$ for $\dot{\mathbf{x}} =
> A(t)\,\mathbf{x}$ is an $n \times n$ matrix whose columns form a
> fundamental set of solutions. Equivalently, $\dot{\Phi} = A \Phi$ and
> $\det \Phi(t) \ne 0$ on $I$.

The general homogeneous solution is $\mathbf{x}_{c}(t) = \Phi(t)\,\mathbf{c}$.

> **Variation of parameters.** Try $\mathbf{x}_{p}(t) = \Phi(t)\,
> \mathbf{u}(t)$. Substituting into $\dot{\mathbf{x}} = A \mathbf{x} +
> \mathbf{f}$ gives
> $$
> \dot{\Phi}\,\mathbf{u} + \Phi\,\dot{\mathbf{u}} = A\,\Phi\,\mathbf{u} +
> \mathbf{f}
> \quad\Longrightarrow\quad
> \Phi\,\dot{\mathbf{u}} = \mathbf{f}
> \quad\Longrightarrow\quad
> \dot{\mathbf{u}}(t) = \Phi(t)^{-1}\,\mathbf{f}(t).
> $$
> Therefore
> $$
> \boxed{\ \mathbf{x}_{p}(t) = \Phi(t)\,\int \Phi(t)^{-1}\,\mathbf{f}(t)\,dt.\ }
> $$

For the IVP with $\mathbf{x}(t_{0}) = \mathbf{x}_{0}$:
$$
\mathbf{x}(t) = \Phi(t)\,\Phi(t_{0})^{-1}\,\mathbf{x}_{0} + \Phi(t)\,
\int_{t_{0}}^{t} \Phi(\tau)^{-1}\,\mathbf{f}(\tau)\,d\tau.
$$

> **Worked example 15.B.** Solve $\dot{\mathbf{x}} = \begin{pmatrix} 0 & 1
> \\ -1 & 0 \end{pmatrix}\,\mathbf{x} + \begin{pmatrix} 0 \\ \sec t
> \end{pmatrix}$ with $\mathbf{x}(0) = (0, 0)^{\mathsf{T}}$.
>
> Eigenvalues $\pm i$. Fundamental matrix $\Phi(t) = \begin{pmatrix} \cos t
> & \sin t \\ -\sin t & \cos t \end{pmatrix}$. $\Phi^{-1}(t) =
> \Phi(t)^{\mathsf{T}}$ since $\Phi$ is orthogonal.
> $\Phi^{-1}\,\mathbf{f} = \begin{pmatrix} -\sin t \sec t \\ \cos t \sec t
> \end{pmatrix} = \begin{pmatrix} -\tan t \\ 1 \end{pmatrix}$.
> Integrate: $\mathbf{u}(t) = \begin{pmatrix} \ln |\cos t| \\ t
> \end{pmatrix}$.
> $\mathbf{x}_{p}(t) = \Phi(t)\,\mathbf{u}(t) = \begin{pmatrix} \cos t \ln
> |\cos t| + t \sin t \\ -\sin t \ln |\cos t| + t \cos t \end{pmatrix}$.
> ICs: this is already $\mathbf{0}$ at $t = 0$, so the IVP solution is
> $\mathbf{x}(t) = \mathbf{x}_{p}(t)$.

### 15.2.4  Solving systems via Laplace

For constant-coefficient systems with simple $\mathbf{f}(t)$, the Laplace
transform converts the system to algebra in $s$. Take $\mathcal{L}$
component-wise:
$$
s\,\mathbf{X}(s) - \mathbf{x}(0) = A\,\mathbf{X}(s) + \mathbf{F}(s)
\Longrightarrow
\mathbf{X}(s) = (s I - A)^{-1}\,\bigl[\mathbf{x}(0) + \mathbf{F}(s)\bigr].
$$
Invert each component. The matrix $(s I - A)^{-1}$ is the **resolvent**,
and $\mathcal{L}^{-1}\{(s I - A)^{-1}\}$ is exactly $e^{A t}$ — connecting
this chapter to the matrix-exponential view from Chapter 14.

### 15.2.5  Numerical methods for systems

Every one-step method from Chapter 5 generalizes by replacing scalars with
vectors. For RK4 on $\dot{\mathbf{x}} = \mathbf{F}(t, \mathbf{x})$:
$$
\begin{aligned}
\mathbf{k}_{1} &= \mathbf{F}(t_{n}, \mathbf{x}_{n}), \\
\mathbf{k}_{2} &= \mathbf{F}\!\left(t_{n} + \tfrac{h}{2}, \mathbf{x}_{n} +
\tfrac{h}{2}\,\mathbf{k}_{1}\right), \\
\mathbf{k}_{3} &= \mathbf{F}\!\left(t_{n} + \tfrac{h}{2}, \mathbf{x}_{n} +
\tfrac{h}{2}\,\mathbf{k}_{2}\right), \\
\mathbf{k}_{4} &= \mathbf{F}(t_{n} + h, \mathbf{x}_{n} + h\,\mathbf{k}_{3}), \\
\mathbf{x}_{n+1} &= \mathbf{x}_{n} + \tfrac{h}{6}\bigl(\mathbf{k}_{1} + 2
\mathbf{k}_{2} + 2 \mathbf{k}_{3} + \mathbf{k}_{4}\bigr).
\end{aligned}
$$

This is what MATLAB's `ode45` actually does (with adaptive step control).
Use it without hesitation for nonlinear systems with no closed form, e.g.
the **Lotka-Volterra predator-prey** model
$\dot{x} = \alpha x - \beta x y,\ \dot{y} = -\gamma y + \delta x y$.

**MATLAB.**
```matlab
F = @(t,x) [x(1) - 2*x(1)*x(2); -x(2) + x(1)*x(2)];
[t, X] = ode45(F, [0 30], [1; 0.5]);
plot(X(:,1), X(:,2)); xlabel x; ylabel y;
```

---

## 15.3  Reading assignment

Read Zill, **§8.2** (final material on homogeneous systems) and **§8.3**
(nonhomogeneous systems by undetermined coefficients and variation of
parameters).

---

## 15.4  Practice problems (homework)

Submit as an attachment to the Week 15 Forum.

- **§8.2** — 35, 36, 39, 40
- **§8.3** — 1, 3, 5, 6, 12; numerical 27 and 29

For 27 and 29, use RK4 (your favorite Chapter 5 method) and compare to the
analytical answer where one exists.

---

## 15.5  Discussion prompt — *W15: Nonhomogeneous Linear Systems of ODEs*

Pick a problem (not yet claimed) where **variation of parameters** is the
right tool. Discuss what makes undetermined coefficients fail.
Alternatively, pick a Lotka-Volterra-style nonlinear system and analyze it
qualitatively (phase portrait, equilibria, stability).

---

## 15.6  Self-assessment

1. State the structure theorem for nonhomogeneous systems.
2. Solve $\dot{\mathbf{x}} = \begin{pmatrix} 1 & 1 \\ 4 & -2 \end{pmatrix}\,
   \mathbf{x} + \begin{pmatrix} e^{-2 t} \\ 0 \end{pmatrix}$ via undetermined
   coefficients.
3. Solve the same system via variation of parameters and verify the answer
   matches.
4. Write the Laplace solution path for a 2-D system. Where does the
   resolvent $(s I - A)^{-1}$ appear?
5. Implement RK4 for the Van der Pol oscillator $\ddot{x} - \mu(1 - x^{2})
   \dot{x} + x = 0$ as a 2-D system. Plot the phase portrait for $\mu = 1$.

---

## 15.7  Glossary

- **Fundamental matrix $\Phi(t)$.** Matrix of homogeneous solutions; columns
  span the solution space.
- **Variation of parameters (vector form).** $\mathbf{x}_{p}(t) = \Phi(t)
  \int \Phi(t)^{-1}\,\mathbf{f}(t)\,dt$.
- **Resolvent.** $(s I - A)^{-1}$; Laplace transform of $e^{A t}$.
- **RK4 for systems.** Vector RK4; one-step fourth-order method.
- **Lotka-Volterra system.** Classical predator-prey model.

---

## 15.8  Connections

- **Builds on:** Chapter 14 (homogeneous systems); Chapters 8 and 13.
- **Sets up:** Chapter 16 (final exam — comprehensive).
- **Cross-cutting theme:** *Every analytical and numerical tool in MATH240
  generalizes from scalars to vectors. The mathematics is the same; the
  bookkeeping is matrices.*
