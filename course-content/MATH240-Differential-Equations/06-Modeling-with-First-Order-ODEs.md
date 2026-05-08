---
chapter: 6
week: 6
title: "Modeling with First-Order ODEs"
zill_sections: ["3.1", "3.2", "3.3"]
course_objectives: [CO5]
tags: [math240, week6, modeling, applications, growth-decay, mixing, circuits]
prev: "05-Numerical-Approximations.md"
next: "07-Second-Order-Homogeneous-ODEs.md"
---

# Chapter 6 — Modeling with First-Order ODEs

> Differential equations are used extensively throughout engineering and
> the sciences. ODEs power the design of cars, airplanes, circuit boards,
> drug delivery, and population biology. Modeling is where the mathematics
> meets reality.

---

## 6.0  Why this chapter

You now have every tool you need to *solve* first-order ODEs:

- Direction fields and qualitative analysis (Chapter 2)
- Separable, linear, exact, and substitution methods (Chapters 2–4)
- Euler / Heun / RK4 numerical methods (Chapter 5)

This week we put them to work. We translate physical, biological, and
financial situations into ODEs, solve them, and *interpret* the solutions in
the original language of the problem.

A note from Zill that bears repeating: *read the textbook with pencil in
hand*. Modeling problems are dense; you must work alongside.

---

## 6.1  Learning objectives

After completing Chapter 6, you should be able to:

1. Translate a physical statement into an IVP, identifying state variables,
   parameters, units, and boundary conditions.
2. Solve and interpret **growth/decay** models $y' = k y$.
3. Set up and solve **mixing problems** (one tank, constant volume).
4. Set up and solve **Newton's law of cooling** problems.
5. Set up and solve **single-loop RC and RL circuit** problems.
6. Recognize and analyze **logistic** (saturating) and other nonlinear
   first-order models, including bifurcation behavior.
7. Set up small **systems** of first-order ODEs (predator–prey, two-tank
   mixing) — a preview of Chapter 14.

---

## 6.2  Lecture notes

### 6.2.1  Modeling discipline

Every model in this course follows the same five-step recipe:

1. **Identify the state variables.** What quantity (or quantities) changes
   over time? Use letters that name the physical thing — $P$ for
   population, $T$ for temperature, $A$ for amount of salt.
2. **Identify the parameters.** Constants in the system: rate constants,
   ambient temperatures, inflow concentrations. Track *units* — they catch
   most setup errors.
3. **Write a rate balance.** Rate of change = (rate in) − (rate out), or
   $\dot{x} = (\text{drivers})$.
4. **Specify initial conditions.** What does the system look like at
   $t = 0$?
5. **Solve, interpret, sanity-check.** Take the limit $t \to \infty$. Plug
   in $t = 0$. Check sign and magnitude. *If the answer makes no physical
   sense, the model or the algebra is wrong.*

### 6.2.2  Linear growth and decay

> **Model.** $\dfrac{dy}{dt} = k y,\quad y(0) = y_{0}.$
> Solution: $y(t) = y_{0}\,e^{k t}$.

Same equation describes:

- **Population growth** (Malthus): $k > 0$.
- **Radioactive decay**: $k < 0$. Half-life $T_{1/2} = \dfrac{\ln 2}{|k|}$.
- **Continuously compounded interest**: $k$ = nominal rate.

> **Worked example 6.A — carbon dating.** A sample contains 73% of its
> initial $\,^{14}\mathrm{C}$. Estimate its age. Half-life of $\,^{14}\mathrm{C}$
> is 5,730 yr.
>
> $k = -\ln 2 / 5730$. Solve $0.73 = e^{k t}$:
> $t = \ln 0.73 / k = -\ln 0.73 \cdot 5730 / \ln 2 \approx 2{,}603$ yr.

### 6.2.3  Newton's law of cooling

> **Model.** $\dfrac{dT}{dt} = -k\,(T - T_{m}),\quad T(0) = T_{0}.$
> Solution: $T(t) = T_{m} + (T_{0} - T_{m})\,e^{-k t}$.

The body asymptotically equilibrates to the ambient $T_{m}$.

### 6.2.4  Mixing problems (single tank, constant volume)

A tank of constant volume $V$ has brine entering at flow rate $r_{in}$ with
concentration $c_{in}$ and leaving (well-mixed) at $r_{out} = r_{in}$. Let
$A(t)$ be the mass of dissolved solute.

> **Model.** $\dfrac{dA}{dt} = r_{in} c_{in} - \dfrac{A}{V}\,r_{out},\
> A(0) = A_{0}.$

This is **first-order linear**; integrating-factor solution applies.

> **Worked example 6.B.** $V = 50$ gal, $r_{in} = r_{out} = 2$ gal/min,
> $c_{in} = 0.25$ lb/gal, $A(0) = 0$.
>
> $\dot{A} = 0.5 - A/25$. Linear with $\mu = e^{t/25}$. Solve:
> $A(t) = 12.5\bigl(1 - e^{-t/25}\bigr)$.
> As $t \to \infty$, $A \to 12.5$ lb — exactly the steady-state where
> in-rate equals out-rate.

### 6.2.5  Single-loop RC and RL circuits

**RC circuit.** Resistor $R$ in series with capacitor $C$ and EMF $E(t)$.
Charge $q(t)$ obeys
$$
R\,\dot{q} + \dfrac{q}{C} = E(t).
$$
Linear, integrating factor $\mu = e^{t/(RC)}$.

**RL circuit.** Resistor $R$ in series with inductor $L$ and EMF $E(t)$.
Current $i(t)$ obeys
$$
L\,\dot{i} + R\,i = E(t).
$$
Linear, integrating factor $\mu = e^{R t / L}$.

> **Worked example 6.C — RL with constant EMF.** $L = 0.5$ H, $R = 10\,
> \Omega$, $E = 12$ V, $i(0) = 0$.
>
> $\dot{i} + 20 i = 24$. $\mu = e^{20 t}$. Solution:
> $i(t) = 1.2\bigl(1 - e^{-20 t}\bigr)$ A.
> Steady state $i_{\infty} = 1.2$ A; time constant $\tau = L / R = 0.05$ s.

### 6.2.6  Logistic and other nonlinear models

> **Logistic model.** $\dfrac{dP}{dt} = r P\bigl(1 - P/K\bigr)$,
> with carrying capacity $K$.
> Closed form: $P(t) = \dfrac{K}{1 + ((K - P_{0})/P_{0})\,e^{-r t}}$.

For $0 < P_{0} < K$, $P(t) \to K$ as $t \to \infty$. For $P_{0} > K$,
population decays to $K$.

> **Modified logistic with harvesting.** $\dot{P} = r P(1 - P/K) - h$.
> A bifurcation occurs at $h = r K / 4$: above this harvest rate the
> population goes extinct in finite time.

### 6.2.7  Two-tank mixing (preview of systems)

Two tanks of volume $V_{1}$ and $V_{2}$ exchange brine at known flow rates.
Let $A_{i}(t)$ be the solute in tank $i$. The model is a coupled pair:
$$
\begin{aligned}
\dot{A}_{1} &= (\text{external in}) + \alpha A_{2} - \beta A_{1}, \\
\dot{A}_{2} &= \beta A_{1} - \gamma A_{2},
\end{aligned}
$$
where $\alpha, \beta, \gamma$ depend on flow rates and volumes. We will
return to this **system** in Chapter 14.

---

## 6.3  Reading assignment

Read Zill, **§3.1, §3.2, §3.3**. Work *every* in-text example with paper
and pencil, then check.

---

## 6.4  Practice problems (homework)

Submit as an attachment to the Week 6 Forum.

- **§3.1** — 1, 3, 5, 9, 11, 15, 19, 21, 27, 29, 39, 45
- **§3.2** — 1, 9, 11, 13
- **§3.3** — 1, 5, 9, 13

For modeling problems, always state your variables and parameters with units
*before* writing the ODE.

---

## 6.5  Discussion prompt — *W6: Modeling with 1st-order ODEs*

Choose any modeling problem from §3.1–3.3 (not yet claimed) that connects
to your major or interests. Describe the system in plain language, state
your model with units, explain why a first-order ODE is appropriate, and
predict qualitatively what the solution will do. The mechanics are
secondary; the *modeling discipline* is the focus.

---

## 6.6  Self-assessment

1. A drug is administered intravenously at rate $r$ mg/min and eliminated
   at a rate proportional to the amount in the bloodstream, with constant
   $k$. Set up the ODE for the amount $A(t)$ and find the steady-state
   level.
2. An object at $80\,^{\circ}\mathrm{F}$ is placed in a $30\,^{\circ}\mathrm{F}$
   environment. After 10 min it is $60\,^{\circ}\mathrm{F}$. Find $T(t)$.
3. Show that the logistic equation can be solved by separation of variables.
4. An RC circuit with $R = 1\,\mathrm{k}\Omega$, $C = 100\,\mu\mathrm{F}$ is
   driven by $E(t) = 5 \cos(120 \pi t)$ V. Find the steady-state current.
5. Design a problem of your own: pick a real-world phenomenon, identify
   variables and parameters, write the ODE, and discuss qualitative
   behavior.

---

## 6.7  Glossary

- **State variable.** The unknown function whose evolution the ODE
  describes.
- **Parameter.** Constant in the model that does not depend on time.
- **Carrying capacity.** Long-run equilibrium of a logistic model.
- **Time constant ($\tau$).** $1/k$ for first-order linear systems; the
  $1/e$ time of the transient.
- **Steady state.** $\lim_{t \to \infty} y(t)$ when it exists.

---

## 6.8  Connections

- **Builds on:** Chapters 2–5 (every solution method).
- **Sets up:** Chapter 10 (modeling with second-order ODEs), Chapter 14
  (modeling with systems).
- **Cross-cutting theme:** *Solutions are functions, not numbers — and
  every function in this chapter has a physical meaning. Always interpret.*
