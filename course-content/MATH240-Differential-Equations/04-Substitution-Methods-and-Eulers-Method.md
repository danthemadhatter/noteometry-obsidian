---
chapter: 4
week: 4
title: "Substitution Methods and Euler's Numerical Method"
zill_sections: ["2.5", "2.6", "9.1"]
course_objectives: [CO2, CO4]
tags: [math240, week4, substitution, homogeneous, bernoulli, euler-method, classification]
prev: "03-First-Order-ODEs-Separable-and-Linear.md"
next: "05-Numerical-Approximations.md"
---

# Chapter 4 — Substitution Methods and Euler's Numerical Method

> Each technique we learn applies only to a *certain class* of equations.
> Classification — by order, linearity, homogeneity, and autonomy — is
> what tells us which tool to reach for.

---

## 4.0  Why this chapter

We extend our toolkit in two directions:

1. **Substitution.** A clever change of variables can turn an equation that
   looks unsolvable into a separable or linear one we already know how to
   handle. The two most common templates are **homogeneous-coefficient**
   equations and **Bernoulli** equations.
2. **Euler's method.** Our first **numerical** approximation. When closed
   forms fail, we trade exactness for a step-by-step march along the
   direction field.

We also formalize the four-axis classification of ODEs we have been using
implicitly.

---

## 4.1  Learning objectives

After completing Chapter 4, you should be able to:

1. Classify an ODE by **order, linearity, homogeneity, and autonomy** and
   explain the consequences of each label.
2. Solve an ODE with **homogeneous coefficients** using the substitution
   $y = u\,x$ (or $x = v\,y$).
3. Solve a **Bernoulli equation** $y' + P(x)\,y = Q(x)\,y^{n}$ via
   $w = y^{1-n}$.
4. Implement **Euler's method** by hand and in MATLAB/Excel and estimate
   its local and global truncation error.
5. Decide when a numerical solution is appropriate (the equation is
   intractable in closed form, or only specific trajectories are needed).

---

## 4.2  Lecture notes

### 4.2.1  Classification of ODEs

We classify along four independent axes.

**(a) Order.** Highest derivative.
$y' = y$ is order 1; $y''' + x^{2}y' + y = 4x$ is order 3.

**(b) Linearity.** An ODE is **linear** if the dependent variable and its
derivatives appear only to the first power, with coefficients depending on
the independent variable. Equivalently, the operator
$L[y] = a_{n}(x)y^{(n)} + \dots + a_{0}(x)y$ is a linear map.

| Equation                              | Linear? |
| ------------------------------------- | ------- |
| $y''' + x^{2} y' + y = 4x$            | Yes     |
| $y'' - 6y = x \sin x$                 | Yes     |
| $y'' - y^{3} = 0$                     | No (cubic in $y$) |
| $y \, y' = x + 4$                     | No ($y\,y'$ quadratic) |
| $y'' + 3xy' + \ln y = \ln x + 4$      | No ($\ln y$) |
| $y'' + 3xy' = \ln x + 4$              | Yes     |

**(c) Homogeneity.** A linear ODE is **homogeneous** if the right-hand side
(the "non-$y$" part) is identically zero — equivalently, if $y \equiv 0$ is a
solution. Otherwise it is **nonhomogeneous**.

| Equation                              | Homogeneous? |
| ------------------------------------- | ------------ |
| $y' = y$                              | Yes          |
| $y'' - y^{3} = 0$                     | Yes (zero function works) |
| $y'' - 6y = x \sin x$                 | No (RHS $\ne 0$) |
| $y''' + x^{2}y' + y = 4x$             | No (RHS $\ne 0$) |

> **Note.** In §4.2.2 we use a *different* meaning of "homogeneous" — the
> *coefficient* sense for first-order ODEs. The two usages are standard but
> unrelated; context disambiguates.

**(d) Autonomy.** Autonomous if the independent variable does not appear
explicitly on the right-hand side: $y' = f(y)$, $y'' = g(y, y')$, etc.

### 4.2.2  Homogeneous-coefficient first-order ODEs

> **Definition.** $M(x, y)\,dx + N(x, y)\,dy = 0$ has *homogeneous
> coefficients of degree $n$* if $M$ and $N$ satisfy
> $M(tx, ty) = t^{n}M(x, y)$ and $N(tx, ty) = t^{n}N(x, y)$.

The substitution $y = u x$ (so $dy = u\,dx + x\,du$) reduces such an equation
to a separable equation in $u$ and $x$.

> **Worked example 4.A.** Solve $(x^{2} + y^{2})\,dx + (x^{2} - xy)\,dy = 0$.
>
> Both coefficients are homogeneous of degree 2. Let $y = ux$.
> Substitute and simplify; the result is the separable equation
> $\dfrac{1 - u}{1 + u}\,du = -\dfrac{dx}{x}$, which integrates to
> $-2\ln|1 + u| - u = -\ln|x| + C$, i.e.
> $\ln\dfrac{x}{(1 + y/x)^{2}} = \dfrac{y}{x} + C$. Implicit form is fine.

### 4.2.3  Bernoulli equations

> **Definition.** $y' + P(x)\,y = Q(x)\,y^{n}$ with $n \ne 0, 1$.

Substitute $w = y^{1 - n}$. Then $w' = (1 - n) y^{-n} y'$, and after dividing
the original equation by $y^{n}$ we get a **linear** equation in $w$:
$$
w' + (1 - n)\,P(x)\,w = (1 - n)\,Q(x).
$$

> **Worked example 4.B.** Solve $y' + \dfrac{1}{x}\,y = x\,y^{2}$ on $(0,
> \infty)$.
>
> Here $n = 2$, so $w = y^{-1}$ gives $w' - \tfrac{1}{x} w = -x$. Integrating
> factor $\mu = 1/x$ leads to $\bigl(w/x\bigr)' = -1$, i.e.
> $w/x = -x + C$ and $w = -x^{2} + Cx$. Therefore
> $y(x) = \dfrac{1}{Cx - x^{2}}$.

### 4.2.4  Other useful substitutions

- For $y' = f(ax + by + c)$ try $u = ax + by + c$.
- For $y' = f(y/x)$ try $u = y/x$ (a special case of homogeneous coefficients).
- For $y' = a + by + cy^{2}$ (Riccati) — given a particular solution
  $y_{1}$, the substitution $y = y_{1} + 1/w$ linearizes the equation.

The art is recognition: if you see structure suggesting a clever variable,
try it.

### 4.2.5  Euler's method — first numerical scheme

If $y' = f(x, y),\ y(x_{0}) = y_{0}$ cannot be solved in closed form (or if
we just want a numerical answer), choose a step size $h$ and march:
$$
\begin{aligned}
x_{n+1} &= x_{n} + h, \\
y_{n+1} &= y_{n} + h\,f(x_{n}, y_{n}).
\end{aligned}
$$

This is the **forward (explicit) Euler method**. Geometrically: at
$(x_{n}, y_{n})$, follow the local slope $f(x_{n}, y_{n})$ for one step
of size $h$.

**Errors.**
- *Local truncation error* per step: $O(h^{2})$ (from the Taylor expansion
  $y(x + h) = y(x) + h y'(x) + \tfrac{1}{2}h^{2} y''(x) + \dots$).
- *Global truncation error* over a fixed interval: $O(h)$ — the method is
  *first-order accurate*. Halving $h$ roughly halves the error.

> **Worked example 4.C.** Use Euler's method with $h = 0.1$ to approximate
> $y(0.3)$ for $y' = x + y,\ y(0) = 1$.
>
> | $n$ | $x_{n}$ | $y_{n}$ | $f(x_{n}, y_{n})$ | $h\,f$ | $y_{n+1}$ |
> | --- | ------- | ------- | ----------------- | ------ | --------- |
> | 0   | 0.0     | 1.000   | 1.000             | 0.100  | 1.100     |
> | 1   | 0.1     | 1.100   | 1.200             | 0.120  | 1.220     |
> | 2   | 0.2     | 1.220   | 1.420             | 0.142  | 1.362     |
>
> So $y(0.3) \approx 1.362$. Closed form: $y(x) = 2 e^{x} - x - 1$, giving
> $y(0.3) = 2 e^{0.3} - 1.3 \approx 1.3997$ — Euler's method underestimates,
> as expected for a convex solution.

### 4.2.6  Euler in MATLAB and Excel

**MATLAB.**
```matlab
f = @(x,y) x + y;
h = 0.1; x = 0:h:0.3; y = zeros(size(x));
y(1) = 1;
for n = 1:length(x)-1
    y(n+1) = y(n) + h*f(x(n), y(n));
end
disp([x', y'])
```

**Excel.** Set columns A–E for $x$, $y_{n}$, $f(x, y)$, $h\,f$, and $y_{n+1}$
respectively, then drag down. (See [MATLAB primer §
Excel comparison](./appendix/A-MATLAB-Primer.md) for layout.)

---

## 4.3  Reading assignment

Read Zill, **§2.5, §2.6, §9.1**. §9.1 is your formal introduction to
numerical methods; §2.5 covers substitutions, §2.6 the bridge from
analytic to numeric.

---

## 4.4  Practice problems (homework)

Submit as an attachment to the Week 4 Forum.

- **§2.5** — 19, 23, 29
- **§2.6** — 1, 3, 4, 8, 9, 11, 12
- **§9.1** — 1, 3, 4, 10

---

## 4.5  Discussion prompt — *W4: 1st-order ODEs and Euler's method*

From the discussion problems

- §2.5: 31–36
- §2.6: 13
- §9.1: 21
- Ch 2 Review: 1–17 and 39, 40

select one that has not yet been claimed. The focus is conceptual: when is
a substitution useful? what does Euler's geometric step *mean*?

---

## 4.6  Self-assessment

1. Classify $y'' + 3 x y' + \ln y = \ln x + 4$ along all four axes (order,
   linearity, homogeneity, autonomy). Justify every label.
2. Use the substitution $y = ux$ to solve $x y' = y + \sqrt{x^{2} + y^{2}}$
   on $x > 0$.
3. Solve the Bernoulli equation $y' = y - x y^{3}$.
4. Apply Euler's method with $h = 0.05$ to estimate $y(0.1)$ for
   $y' = -2 x y,\ y(0) = 1$. Compare to the exact answer
   $y(x) = e^{-x^{2}}$.
5. Why is Euler's method only first-order accurate? Sketch the geometric
   reason in terms of the secant approximation to a solution curve.

---

## 4.7  Glossary

- **Classification axes.** Order, linearity, homogeneity, autonomy.
- **Homogeneous coefficients.** $M, N$ scale by $t^{n}$ under
  $(x, y) \mapsto (tx, ty)$.
- **Bernoulli equation.** $y' + P(x) y = Q(x) y^{n}$, linearized by
  $w = y^{1-n}$.
- **Riccati equation.** $y' = a(x) + b(x) y + c(x) y^{2}$.
- **Euler's method.** $y_{n+1} = y_{n} + h\,f(x_{n}, y_{n})$; first-order
  accurate.
- **Local / global truncation error.** Single-step / cumulative discretization
  error.

---

## 4.8  Connections

- **Builds on:** Chapters 2–3 (separable and linear; we keep reducing to
  these).
- **Sets up:** Chapter 5 (Improved Euler and Runge–Kutta extend the
  numerical idea); Chapter 6 (modeling with first-order ODEs uses every
  technique in our toolbox so far).
- **Cross-cutting theme:** *Classify before you solve.*
