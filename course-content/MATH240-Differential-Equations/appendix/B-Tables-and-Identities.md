---
title: "Appendix B — Tables and Identities"
tags: [math240, appendix, tables, laplace-table, integrals, identities]
prev: "../README.md"
---

# Appendix B — Tables and Identities

> A single-stop reference. Print this and keep it next to your textbook.
> Every entry was used in at least one chapter of MATH240.

---

## B.1  Trigonometric identities

**Pythagorean.** $\sin^{2} x + \cos^{2} x = 1$,
$1 + \tan^{2} x = \sec^{2} x$, $1 + \cot^{2} x = \csc^{2} x$.

**Double angle.**
$\sin 2x = 2 \sin x \cos x$,
$\cos 2x = \cos^{2} x - \sin^{2} x = 2 \cos^{2} x - 1 = 1 - 2 \sin^{2} x$,
$\tan 2x = \dfrac{2 \tan x}{1 - \tan^{2} x}$.

**Sum / product.**
$\sin a + \sin b = 2 \sin\!\frac{a+b}{2} \cos\!\frac{a-b}{2}$,
$\cos a + \cos b = 2 \cos\!\frac{a+b}{2} \cos\!\frac{a-b}{2}$,
$\sin a \sin b = \tfrac{1}{2}\bigl[\cos(a - b) - \cos(a + b)\bigr]$,
$\cos a \cos b = \tfrac{1}{2}\bigl[\cos(a - b) + \cos(a + b)\bigr]$,
$\sin a \cos b = \tfrac{1}{2}\bigl[\sin(a + b) + \sin(a - b)\bigr]$.

**Hyperbolic.**
$\cosh^{2} x - \sinh^{2} x = 1$,
$\sinh' x = \cosh x$, $\cosh' x = \sinh x$,
$\tanh x = \dfrac{\sinh x}{\cosh x}$.

**Phase-amplitude form.**
$A \cos \omega t + B \sin \omega t = R \cos(\omega t - \phi)$ where
$R = \sqrt{A^{2} + B^{2}}$ and $\tan \phi = B / A$.

---

## B.2  Useful integrals

$\int \dfrac{dx}{x} = \ln |x| + C$,
$\int \dfrac{dx}{x^{2} + a^{2}} = \dfrac{1}{a}\,\arctan(x/a) + C$,
$\int \dfrac{dx}{x^{2} - a^{2}} = \dfrac{1}{2 a}\,\ln\!\left|\dfrac{x - a}{x +
a}\right| + C$,
$\int \dfrac{dx}{\sqrt{a^{2} - x^{2}}} = \arcsin(x / a) + C$,
$\int \dfrac{dx}{\sqrt{x^{2} + a^{2}}} = \ln\!\bigl|x + \sqrt{x^{2} + a^{2}}\bigr|
+ C$,
$\int \tan x\,dx = -\ln |\cos x| + C$,
$\int \sec x\,dx = \ln |\sec x + \tan x| + C$,
$\int x e^{a x}\,dx = \dfrac{e^{a x}}{a^{2}}\,(a x - 1) + C$,
$\int e^{a x} \sin b x\,dx = \dfrac{e^{a x}\,(a \sin b x - b \cos b x)}{a^{2}
+ b^{2}} + C$,
$\int e^{a x} \cos b x\,dx = \dfrac{e^{a x}\,(a \cos b x + b \sin b x)}{a^{2}
+ b^{2}} + C$.

**Integration by parts.** $\int u\,dv = uv - \int v\,du$.

**Partial fractions skeleton (proper rational).** For each linear factor
$(x - a)^{k}$ include $\sum_{j=1}^{k} \dfrac{A_{j}}{(x - a)^{j}}$. For each
irreducible quadratic $(x^{2} + p x + q)^{k}$ include
$\sum_{j=1}^{k} \dfrac{B_{j} x + C_{j}}{(x^{2} + p x + q)^{j}}$.

---

## B.3  Laplace-transform table

Throughout: $a, b > 0$, $n \in \mathbb{N}_{\ge 0}$, and $u(t)$ denotes the
unit step function. All transforms are valid in their region of
convergence (typically $s$ greater than the maximum of any exponent
involved).

### B.3.1  Elementary functions

| $f(t)$              | $F(s) = \mathcal{L}\{f(t)\}$            |
| ------------------- | --------------------------------------- |
| $1$                 | $\dfrac{1}{s}$                          |
| $t$                 | $\dfrac{1}{s^{2}}$                      |
| $t^{n}$             | $\dfrac{n!}{s^{n+1}}$                   |
| $e^{a t}$           | $\dfrac{1}{s - a}$                      |
| $t^{n} e^{a t}$     | $\dfrac{n!}{(s - a)^{n+1}}$             |
| $\cos(b t)$         | $\dfrac{s}{s^{2} + b^{2}}$              |
| $\sin(b t)$         | $\dfrac{b}{s^{2} + b^{2}}$              |
| $\cosh(b t)$        | $\dfrac{s}{s^{2} - b^{2}}$              |
| $\sinh(b t)$        | $\dfrac{b}{s^{2} - b^{2}}$              |
| $e^{a t} \cos(b t)$ | $\dfrac{s - a}{(s - a)^{2} + b^{2}}$    |
| $e^{a t} \sin(b t)$ | $\dfrac{b}{(s - a)^{2} + b^{2}}$        |
| $t \sin(b t)$       | $\dfrac{2 b s}{(s^{2} + b^{2})^{2}}$    |
| $t \cos(b t)$       | $\dfrac{s^{2} - b^{2}}{(s^{2} + b^{2})^{2}}$ |
| $u(t - a)$          | $\dfrac{e^{-a s}}{s}$                   |
| $\delta(t - a)$     | $e^{-a s}$ ($a \ge 0$)                  |

### B.3.2  Operational properties

| Property                       | Formula                                                                |
| ------------------------------ | ---------------------------------------------------------------------- |
| Linearity                      | $\mathcal{L}\{\alpha f + \beta g\} = \alpha F + \beta G$               |
| First translation (in $s$)     | $\mathcal{L}\{e^{a t} f(t)\} = F(s - a)$                               |
| Second translation (in $t$)    | $\mathcal{L}\{f(t - a) u(t - a)\} = e^{-a s} F(s)$                     |
| Differentiation in $t$         | $\mathcal{L}\{f^{(n)}\} = s^{n} F - s^{n-1} f(0) - \cdots - f^{(n-1)}(0)$ |
| Differentiation in $s$         | $\mathcal{L}\{t^{n} f(t)\} = (-1)^{n} F^{(n)}(s)$                      |
| Integration in $t$             | $\mathcal{L}\{\int_{0}^{t} f(\tau)\,d\tau\} = F(s)/s$                  |
| Convolution                    | $\mathcal{L}\{f \ast g\} = F(s)\,G(s)$                                 |
| Periodic ($f$ has period $T$)  | $F(s) = \dfrac{1}{1 - e^{-s T}}\,\int_{0}^{T} e^{-s t} f(t)\,dt$       |
| Initial-value theorem          | $\lim_{s \to \infty} s F(s) = f(0^{+})$                                |
| Final-value theorem            | $\lim_{s \to 0^{+}} s F(s) = \lim_{t \to \infty} f(t)$ (if RHS exists) |

---

## B.4  Linear-algebra identities

$\det \begin{pmatrix} a & b \\ c & d \end{pmatrix} = a d - b c$.

For a $2 \times 2$ matrix $A = \begin{pmatrix} a & b \\ c & d \end{pmatrix}$:

- **Characteristic polynomial:** $\lambda^{2} - (\operatorname{tr} A)\,\lambda
  + \det A$.
- **Trace:** $\operatorname{tr} A = a + d$.
- **Determinant:** $\det A = a d - b c$.
- **Eigenvalues:** $\lambda = \dfrac{\operatorname{tr} A \pm \sqrt{(\operatorname{tr} A)^{2}
  - 4 \det A}}{2}$.

**Discriminant phase-portrait map** ($\Delta = (\operatorname{tr} A)^{2} - 4 \det
A$):

- $\Delta > 0$ — distinct real eigenvalues (nodes / saddles).
- $\Delta = 0$ — repeated eigenvalue (improper / star nodes).
- $\Delta < 0$ — complex conjugate eigenvalues (spirals / centers).

Sign of $\det A$ then $\operatorname{tr} A$ refines the classification (see
Chapter 14).

---

## B.5  Common ODE patterns and their solution forms

| Equation                                                       | Solution form                                                              |
| -------------------------------------------------------------- | -------------------------------------------------------------------------- |
| $y' = k y$                                                     | $y = C e^{k t}$                                                            |
| $y' + P(x) y = Q(x)$                                           | $y = \mu^{-1} \int \mu Q\,dx + C \mu^{-1}$ where $\mu = e^{\int P\,dx}$    |
| $a y'' + b y' + c y = 0$, char. roots $r_{1, 2}$ distinct real | $y = c_{1} e^{r_{1} t} + c_{2} e^{r_{2} t}$                                |
| Same, repeated $r$                                             | $y = (c_{1} + c_{2} t) e^{r t}$                                            |
| Same, $r = \alpha \pm i \beta$                                 | $y = e^{\alpha t}(c_{1} \cos \beta t + c_{2} \sin \beta t)$                |
| Cauchy-Euler $a x^{2} y'' + b x y' + c y = 0$, distinct $m_{1, 2}$ | $y = c_{1} x^{m_{1}} + c_{2} x^{m_{2}}$                                |
| Same, repeated $m$                                             | $y = (c_{1} + c_{2} \ln x) x^{m}$                                          |
| Same, $m = \alpha \pm i \beta$                                 | $y = x^{\alpha}(c_{1} \cos(\beta \ln x) + c_{2} \sin(\beta \ln x))$        |
| $\dot{\mathbf{x}} = A \mathbf{x}$, distinct real $\lambda_{i}$ | $\mathbf{x} = \sum c_{i} e^{\lambda_{i} t} \mathbf{v}_{i}$                 |
| Same, complex pair $\alpha \pm i \beta$                        | $e^{\alpha t}(\mathbf{a} \cos \beta t \mp \mathbf{b} \sin \beta t)$        |
| Same, defective (repeated $\lambda$)                           | $c_{1} e^{\lambda t} \mathbf{v} + c_{2} e^{\lambda t}(t \mathbf{v} + \mathbf{w})$ |

---

## B.6  Resonance and damping summary

For $m \ddot{x} + c \dot{x} + k x = F_{0} \cos \omega t$, define
$\omega_{0} = \sqrt{k/m}$ and $\zeta = c / (2 \sqrt{m k})$.

| Quantity                            | Expression                                                                  |
| ----------------------------------- | --------------------------------------------------------------------------- |
| Damped natural frequency            | $\omega_{d} = \omega_{0}\sqrt{1 - \zeta^{2}}$ (when $\zeta < 1$)            |
| Steady-state amplitude              | $X(\omega) = \dfrac{F_{0}}{\sqrt{(k - m \omega^{2})^{2} + (c \omega)^{2}}}$ |
| Resonance peak frequency (lightly damped) | $\omega \approx \omega_{0}$                                            |
| Phase lag                           | $\phi = \arctan\!\dfrac{c \omega}{k - m \omega^{2}}$                        |
| Mechanical–electrical analog        | $m \leftrightarrow L,\ c \leftrightarrow R,\ k \leftrightarrow 1/C,\ F \leftrightarrow E$ |

---

## B.7  Method-selection cheat sheet

For an ODE you don't recognize, ask in this order:

1. **Order?** ($n \ge 1$.)
2. **Linear?** Yes → Chapters 7–8 (constant), 9 (Cauchy-Euler), 14–15
   (systems). No → substitutions (Chapter 4), or numerical (Chapter 5).
3. **Constant coefficients?** Yes → characteristic equation. No → try
   Cauchy-Euler ($x^{m}$), reduction of order, or Laplace if applicable.
4. **Homogeneous?** Yes → just $y_{c}$. No → $y_{c}$ + $y_{p}$;
   undetermined coefficients (nice $g$) or variation of parameters
   (general $g$).
5. **Discontinuous / impulsive forcing?** Use Laplace + step / delta.
6. **Closed form intractable?** Use RK4 (Chapter 5 / 15).

If no analytical method applies, fall back to the numerical methods in
Chapter 5 — they always work.
