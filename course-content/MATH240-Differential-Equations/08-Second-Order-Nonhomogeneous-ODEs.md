---
chapter: 8
week: 8
title: "Second-Order Nonhomogeneous Linear ODEs"
zill_sections: ["4.4", "4.6"]
course_objectives: [CO5]
tags: [math240, week8, nonhomogeneous, undetermined-coefficients, variation-of-parameters, midterm]
prev: "07-Second-Order-Homogeneous-ODEs.md"
next: "09-Cauchy-Euler-and-Nonlinear-ODEs.md"
---

# Chapter 8 — Second-Order Nonhomogeneous Linear ODEs

> The general solution of a *nonhomogeneous* linear ODE equals the general
> solution of the *homogeneous* equation plus *one* particular solution of
> the nonhomogeneous one. The homework, then, is to find that one
> particular solution.

---

## 8.0  Why this chapter

Last week we built the homogeneous solution $y_{c}$ ("complementary"). This
week we add a particular solution $y_{p}$:
$$
y(x) = y_{c}(x) + y_{p}(x).
$$

We learn two systematic ways to find $y_{p}$:

- **Method of undetermined coefficients (superposition approach)** — fast,
  works when $g(x)$ is a polynomial, exponential, sine/cosine, or finite
  product/sum thereof.
- **Variation of parameters** — universal, works for *any* continuous
  forcing, including the cases where undetermined coefficients fail.

The midterm exam, covering Chapters 1–4, is also due this week. Plan time
accordingly.

---

## 8.1  Learning objectives

After completing Chapter 8, you should be able to:

1. State the **superposition principle** for linear ODEs.
2. Apply **undetermined coefficients** to find a particular solution when
   $g(x)$ is a polynomial × exponential × $\sin / \cos$.
3. Recognize the **resonance** case (forcing matches a homogeneous mode)
   and apply the multiplication-by-$x$ rule.
4. Apply **variation of parameters** to solve general second-order
   nonhomogeneous ODEs, including those with non-elementary $g(x)$.
5. Combine techniques: solve $a y'' + b y' + c y = g(x)$ end-to-end and
   verify your answer by direct substitution.

---

## 8.2  Lecture notes

### 8.2.1  Structure theorem

> **Theorem.** Let $L$ be a linear differential operator and let $y_{p}$ be
> any particular solution of $L[y] = g$. Then the general solution of
> $L[y] = g$ on $I$ is
> $$
> y(x) = y_{c}(x) + y_{p}(x),
> $$
> where $y_{c}$ is the general solution of the associated homogeneous
> equation $L[y] = 0$.

This decomposition is the **golden rule** of linear ODE theory. Master it
and the rest of this chapter is bookkeeping.

### 8.2.2  Superposition for forcing

If $L[y] = g_{1}(x)$ has particular solution $y_{p,1}$ and $L[y] = g_{2}(x)$
has particular solution $y_{p,2}$, then $L[y] = g_{1} + g_{2}$ has
particular solution $y_{p,1} + y_{p,2}$. So you may split a complicated
forcing into pieces, solve each, and add.

### 8.2.3  Undetermined coefficients (superposition approach)

For *constant-coefficient* equations $a y'' + b y' + c y = g(x)$ with $g$ a
linear combination of:

- polynomials $p(x)$ of degree $n$,
- exponentials $e^{\alpha x}$,
- $\sin \beta x$ and $\cos \beta x$,
- products of the above,

guess a $y_{p}$ of the same form with **undetermined coefficients**. Examples:

| $g(x)$                  | Trial $y_{p}$                                  |
| ----------------------- | ---------------------------------------------- |
| $5$                     | $A$                                            |
| $3x + 1$                | $A x + B$                                      |
| $e^{2x}$                | $A e^{2x}$                                     |
| $\sin 3x$               | $A \cos 3x + B \sin 3x$                        |
| $x^{2} e^{-x}$          | $(A x^{2} + B x + C) e^{-x}$                   |
| $e^{x}\cos 2x$          | $e^{x}(A \cos 2x + B \sin 2x)$                 |

Substitute into the ODE and match coefficients to solve for the unknowns.

> **Resonance rule.** If your trial $y_{p}$ already appears in $y_{c}$,
> multiply by the lowest power of $x$ that removes the conflict. (For a
> double root in $y_{c}$, you may need $x^{2}$.)

> **Worked example 8.A.** Solve $y'' - 3 y' + 2 y = 4 x + 5$.
>
> Homogeneous: $m^{2} - 3 m + 2 = 0 \Rightarrow m = 1, 2$. So
> $y_{c} = c_{1} e^{x} + c_{2} e^{2x}$.
> Trial $y_{p} = A x + B$: $0 - 3 A + 2(A x + B) = 4 x + 5 \Rightarrow
> 2 A = 4,\ -3 A + 2 B = 5 \Rightarrow A = 2,\ B = 11/2$.
> General: $y(x) = c_{1} e^{x} + c_{2} e^{2x} + 2 x + \tfrac{11}{2}$.

> **Worked example 8.B — resonance.** Solve $y'' - y = e^{x}$.
>
> $y_{c} = c_{1} e^{x} + c_{2} e^{-x}$. Trial $A e^{x}$ duplicates $y_{c}$,
> so use $y_{p} = A x e^{x}$. Substitute: $A x e^{x} + 2 A e^{x} - A x e^{x}
> = e^{x} \Rightarrow A = 1/2$.
> General: $y = c_{1} e^{x} + c_{2} e^{-x} + \tfrac{1}{2} x e^{x}$.

### 8.2.4  Variation of parameters

For $y'' + p(x) y' + q(x) y = g(x)$ with known fundamental set $\{y_{1}, y_{2}\}$,
seek $y_{p}(x) = u_{1}(x) y_{1}(x) + u_{2}(x) y_{2}(x)$ subject to
$u_{1}' y_{1} + u_{2}' y_{2} = 0$ (a convenient extra constraint). The result is
$$
u_{1}'(x) = -\frac{y_{2}(x)\,g(x)}{W(x)},\qquad
u_{2}'(x) = \frac{y_{1}(x)\,g(x)}{W(x)},
$$
where $W$ is the Wronskian of $y_{1}, y_{2}$. Integrate to get $u_{1}, u_{2}$;
no extra constants needed (they fold into $y_{c}$).

> **Worked example 8.C.** Solve $y'' + y = \sec x$ on $(-\pi/2, \pi/2)$.
>
> $y_{c} = c_{1} \cos x + c_{2} \sin x$, $W = 1$.
> $u_{1}' = -\sin x \sec x = -\tan x \Rightarrow u_{1} = \ln|\cos x|$.
> $u_{2}' = \cos x \sec x = 1 \Rightarrow u_{2} = x$.
> $y_{p} = \cos x \cdot \ln|\cos x| + x \sin x$.
> General: $y = c_{1} \cos x + c_{2} \sin x + \cos x \ln|\cos x| + x \sin x$.

> **When undetermined coefficients fail.** If $g(x)$ is $\sec x, \tan x,
> 1/x, \ln x$, or any function that is not a finite linear combination of
> polynomials, exponentials, and trig — variation of parameters is the
> only general-purpose option.

### 8.2.5  An algorithmic checklist

1. Solve the homogeneous equation and write $y_{c}$.
2. Identify the form of $g(x)$.
3. If $g$ is "nice" (poly × exp × trig), try **undetermined coefficients**;
   apply the resonance rule.
4. Otherwise, use **variation of parameters**.
5. Verify by substituting $y = y_{c} + y_{p}$ back into the ODE.

---

## 8.3  Reading assignment

Read Zill, **§4.4** (undetermined coefficients) and **§4.6** (variation of
parameters).

---

## 8.4  Practice problems (homework)

Submit as an attachment to the Week 8 Forum.

- **§4.4** — 3, 5, 8, 12, 19, 21, 29, 34
- **§4.6** — 1, 3, 5, 7, 11, 19

---

## 8.5  Discussion prompt — *W8: Nonhomogeneous 2nd-order ODEs*

Pick a problem (not yet claimed) that exhibits the **resonance** case or
that *requires* variation of parameters. Discuss why undetermined
coefficients alone cannot solve it.

---

## 8.6  Midterm exam — due this week

- **Coverage:** Chapters 1–4 (everything from definitions through Euler's
  method, including substitution and exact equations).
- **Format:** open book, open notes, no proctor; similar to a quiz but
  longer.
- **Weight:** 11% (per the syllabus).

Submit by 11:55 p.m. ET on Sunday of Week 8.

---

## 8.7  Self-assessment

1. State the structure theorem: general nonhomogeneous = $y_{c}$ + $y_{p}$.
2. Solve $y'' + 4 y = 3 \sin 2 x$ (note resonance).
3. Solve $y'' + 4 y = 3 \sin 3 x$ (no resonance).
4. Use variation of parameters to solve $y'' - y = \dfrac{1}{1 + e^{x}}$.
5. Why does the constraint $u_{1}' y_{1} + u_{2}' y_{2} = 0$ make the
   variation-of-parameters algebra clean? What happens without it?

---

## 8.8  Glossary

- **Complementary solution $y_{c}$.** Solution of associated homogeneous
  ODE.
- **Particular solution $y_{p}$.** Any one solution of the nonhomogeneous
  ODE.
- **Method of undetermined coefficients.** Polynomial / exponential / trig
  ansatz with unknown coefficients.
- **Variation of parameters.** Replace constants in $y_{c}$ with functions;
  add the convenient constraint and integrate.
- **Resonance.** Forcing matches a homogeneous mode; ansatz must be
  multiplied by $x$ (or $x^{2}$ for double roots).

---

## 8.9  Connections

- **Builds on:** Chapter 7 (homogeneous theory).
- **Sets up:** Chapter 9 (Cauchy-Euler — non-constant coefficients but the
  same superposition story); Chapter 10 (forced spring-mass and RLC are
  exactly the equations in this chapter).
- **Cross-cutting theme:** *Linearity = superposition.*
