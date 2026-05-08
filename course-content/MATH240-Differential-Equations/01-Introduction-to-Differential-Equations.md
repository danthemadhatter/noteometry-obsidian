---
chapter: 1
week: 1
title: "Introduction to Differential Equations"
zill_sections: ["1.1", "1.2", "1.3"]
course_objectives: [CO2]
tags: [math240, week1, ode, definitions, ivp, modeling]
prev: "00-Syllabus.md"
next: "02-Modeling-and-Direction-Fields.md"
---

# Chapter 1 — Introduction to Differential Equations

> *Mathematics is a language. As with the study of any language, mathematics
> requires us to focus on vocabulary, grammar, and syntax. In that vein, we
> begin with the vocabulary of ordinary differential equations.*

---

## 1.0  Why this chapter

Calculus gave you machinery for **derivatives** — local rates of change of one
quantity with respect to another. A *differential equation* (DE) flips the
question: given a relationship that a derivative must satisfy, can we recover
the underlying function?

Algebra asks **what value** of $x$ solves $2x - y = 15$. A differential
equation asks **what function** $y(x)$ solves $\dfrac{dy}{dx} = 2y$. Note the
shift: solutions of DEs are **functions**, not numbers, and there are usually
infinitely many of them — a *family*.

This chapter establishes the vocabulary you will use for the next 15 weeks:
order, dependent vs. independent variables, ordinary vs. partial, solution,
initial condition, mathematical model.

---

## 1.1  Learning objectives

After completing Chapter 1, you should be able to:

1. State the definition of an ordinary differential equation (ODE) and
   distinguish it from a partial differential equation (PDE).
2. Identify the **order** and **degree** of a given ODE.
3. Verify by direct substitution that a candidate function is a solution
   on a stated interval.
4. Write down an **initial-value problem (IVP)** and describe what it means
   geometrically.
5. Translate a simple physical statement (population, Newton's law of
   cooling, falling body) into an ODE.

---

## 1.2  Lecture notes

### 1.2.1  What is a differential equation?

> **Definition (Differential Equation).** An equation containing the
> derivatives of one or more dependent variables with respect to one or more
> independent variables is a *differential equation*.

If the dependent variable depends on a **single** independent variable (so
all derivatives are ordinary), the equation is an **ordinary differential
equation (ODE)**. Examples:
$$
\frac{dy}{dx} = 2,\qquad y'' + 3xy' + y = 4x,\qquad y' = 2y.
$$

If multiple independent variables are present (and the derivatives are
partial), the equation is a **partial differential equation (PDE)**. The
classical wave equation is one:
$$
\frac{\partial^2 y}{\partial t^2} = k\,\frac{\partial^2 y}{\partial x^2}.
$$

In MATH240 we study **ODEs** exclusively. Almost every PDE technique is
built on top of ODE techniques, which is why we start here.

### 1.2.2  Order

> **Definition (Order).** The *order* of a differential equation is the
> order of the highest derivative appearing in the equation.

| Equation                              | Order |
| ------------------------------------- | ----- |
| $y' = y$                              | 1     |
| $y'' + 3xy' + y = 4x$                 | 2     |
| $y''' + x^{2} y' + y = 4x$            | 3     |

### 1.2.3  Solutions and families of solutions

> **Definition (Solution on an interval $I$).** A function $\phi(x)$ is a
> *solution* of an ODE on $I$ if substituting $y = \phi(x)$ into the equation
> produces an identity for every $x \in I$.

The simplest example: $\dfrac{dy}{dx} = 2$. From calculus, *any* antiderivative
$y(x) = 2x + c$ — with $c$ any real constant — satisfies the equation. There
is not one solution but a **one-parameter family** $\{2x + c : c \in \mathbb{R}\}$.

The free constant $c$ is exactly what an *initial condition* will pin down
in §1.2.5.

> **Worked example 1.A.** Verify that $y(x) = e^{2x}$ is a solution of
> $y' = 2y$.
>
> *Solution.* Differentiate: $y' = 2e^{2x}$. Substitute $y = e^{2x}$ into
> the right-hand side: $2y = 2e^{2x}$. Since $y' = 2y = 2e^{2x}$ on
> $\mathbb{R}$, $y(x) = e^{2x}$ is a solution on $(-\infty, \infty)$.

### 1.2.4  Implicit vs. explicit solutions

A solution can be written either as an **explicit** function $y = \phi(x)$
or as an **implicit relation** $G(x, y) = 0$ that defines $y$ implicitly.
For instance, $x^{2} + y^{2} = 25$ implicitly defines $y(x)$ on $(-5, 5)$
and gives a solution to $y\,y' + x = 0$.

Implicit solutions are often easier to obtain than explicit ones and are
perfectly acceptable answers in this course.

### 1.2.5  Initial-value problems

> **Definition (Initial-Value Problem).** An *IVP* is an ODE together with
> conditions on the unknown function (and possibly its derivatives) at a
> single point. For a first-order ODE, an IVP has the form
> $$
> \frac{dy}{dx} = f(x, y),\qquad y(x_{0}) = y_{0}.
> $$

Geometrically, the family of solutions is a "swarm" of curves; the initial
condition $y(x_{0}) = y_{0}$ selects the **one** curve passing through the
point $(x_{0}, y_{0})$.

> **Worked example 1.B.** Solve $\dfrac{dy}{dx} = 2$ subject to $y(1) = 5$.
>
> *Solution.* The general solution is $y(x) = 2x + c$. Apply the initial
> condition: $5 = 2(1) + c \Rightarrow c = 3$. Therefore $y(x) = 2x + 3$.

### 1.2.6  Differential equations as mathematical models

Most "real" applications start as a **rate-of-change statement** translated
into mathematics. Three canonical examples:

- **Population growth.** "The rate of change of population is proportional to
  the current population": $\dfrac{dP}{dt} = kP$.
- **Newton's law of cooling.** "The rate of change of temperature of a body
  is proportional to the difference between the body and the ambient":
  $\dfrac{dT}{dt} = -k\,(T - T_{m})$.
- **Free fall with air resistance.** Newton's second law plus a drag term
  proportional to velocity: $m\,\dfrac{dv}{dt} = mg - cv$.

Each of these is a first-order ODE; we will revisit them in Chapter 6.

---

## 1.3  Worked examples (extended)

### 1.3.1  Example — verifying a candidate solution

Show that $\phi(x) = \sin x \cos x - \cos x$ satisfies the IVP
$y' + (\tan x)\, y = \cos^{2} x,\ y(0) = -1$ on $\bigl(-\frac{\pi}{2},
\frac{\pi}{2}\bigr)$.

1. Compute $\phi'(x)$ using the product rule:
   $$
   \phi'(x) = \cos^{2} x - \sin^{2} x + \sin x.
   $$
2. Compute $(\tan x)\,\phi(x)$:
   $$
   (\tan x)(\sin x \cos x - \cos x) = \sin^{2} x - \sin x.
   $$
3. Add: $\phi'(x) + (\tan x)\,\phi(x) = \cos^{2} x - \sin^{2} x + \sin x +
   \sin^{2} x - \sin x = \cos^{2} x.$ ✓
4. Check the initial condition: $\phi(0) = \sin 0 \cos 0 - \cos 0 = -1$. ✓

### 1.3.2  Example — translating words into an ODE

A 50-gallon tank of pure water has brine entering at 2 gal/min containing
$\tfrac{1}{4}$ lb of salt per gallon, and the well-mixed solution leaves at
2 gal/min. Write an ODE for the amount $A(t)$ of salt in the tank at time $t$.

- Volume is constant at 50 gal (in-rate equals out-rate).
- Salt enters at rate $\tfrac{1}{4} \cdot 2 = \tfrac{1}{2}$ lb/min.
- Salt leaves at rate $\dfrac{A}{50} \cdot 2 = \dfrac{A}{25}$ lb/min.

Therefore
$$
\boxed{\ \frac{dA}{dt} = \frac{1}{2} - \frac{A}{25},\quad A(0) = 0.\ }
$$

We will solve this equation in Chapter 6.

---

## 1.4  Reading assignment

Read Zill, **§1.1, §1.2, §1.3**. Work through each in-text example with
pencil and paper *before* reading the textbook's solution.

---

## 1.5  Practice problems (homework)

Submit as an attachment to the Week 1 Discussion.

- **§1.1** — 3, 7, 8, 13, 21, 31, 33
- **§1.2** — 5, 7, 13, 19, 21, 25, 27
- **§1.3** — 1, 2, 3

For deeper study (recommended but not graded): **§1.1** 1, 2, 9, 11, 23, 25, 35.

---

## 1.6  Discussion prompt — Welcome / Introduce yourself

Your initial post is your **official entry into the course** — students who
do not post by 11:55 p.m. ET on Sunday of Week 1 are dropped. Aim for ≥ 250
words and respond to ≥ 2 classmates (≥ 100 words each).

Suggested structure:

1. Who you are and how you would like to be addressed.
2. Your academic major or program of study.
3. Your current status in the program.
4. Your goals — why MATH240, what you hope to achieve.
5. Anything else that helps classmates know you better.

You will also submit the **APUS Honor Pledge** this week. Grades cannot be
released until the pledge is on file.

---

## 1.7  Self-assessment

Try these without looking back:

1. Define *order* and *degree* of an ODE. Give an example of order 3.
2. Why is "$y(x) = 2x + c$" called a *family* of solutions rather than a
   single solution?
3. State an IVP that has $y(x) = 2x + 3$ as its unique solution and explain
   how the initial condition pins down the constant.
4. Translate the sentence "the rate of change of $y$ with respect to $t$ is
   inversely proportional to $y$" into an ODE.
5. Is $y \, y' = x$ linear? Justify.

---

## 1.8  Glossary

- **Differential equation.** An equation involving derivatives of an unknown
  function.
- **Ordinary (ODE).** Only one independent variable.
- **Partial (PDE).** Two or more independent variables.
- **Order.** The order of the highest derivative present.
- **Dependent variable / function.** The unknown function ($y$) we seek.
- **Independent variable.** The argument ($x$ or $t$) of the unknown function.
- **Solution on an interval $I$.** A function whose substitution turns the
  ODE into an identity on $I$.
- **General solution.** A family of solutions parameterized by arbitrary
  constants.
- **Particular solution.** A specific member of the family, typically obtained
  by imposing initial conditions.
- **Initial-value problem (IVP).** An ODE plus conditions at a single point.
- **Mathematical model.** An ODE (or system) whose solutions describe a
  real-world phenomenon.

---

## 1.9  Connections

- **Builds on:** differentiation rules from MATH227.
- **Sets up:** Chapter 2 (direction fields and the qualitative picture of
  solution families); Chapter 6 (modeling).
- **Cross-cutting theme:** *Solutions are functions, not numbers.*
