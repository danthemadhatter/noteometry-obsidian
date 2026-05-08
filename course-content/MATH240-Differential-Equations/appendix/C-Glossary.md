---
title: "Appendix C — Glossary (A–Z)"
tags: [math240, appendix, glossary, vocabulary]
prev: "../README.md"
---

# Appendix C — Consolidated Glossary

> Every term defined in Chapters 1–15, alphabetized. Cross-references
> point to the chapter where each term is introduced.

---

## A

- **Abel's theorem.** For solutions of a homogeneous linear ODE, the
  Wronskian is either identically zero or never zero on the interval of
  validity. (Chapter 7)
- **Asymptotic stability.** Solutions starting near an equilibrium return
  to it as $t \to \infty$. (Chapter 14)
- **Autonomous ODE.** Right-hand side has no explicit dependence on the
  independent variable: $y' = f(y)$. (Chapter 2)

## B

- **Bernoulli equation.** $y' + P(x) y = Q(x) y^{n}$, linearized by
  $w = y^{1-n}$. (Chapter 4)
- **Boundary-value problem (BVP).** Conditions specified at two or more
  points; uniqueness *not* guaranteed. (Chapter 10)

## C

- **Carrying capacity.** Equilibrium population in a logistic model;
  long-run limit. (Chapter 6)
- **Cauchy-Euler equation.** Linear ODE with coefficients $a_{k} x^{k}$
  matched to derivatives of order $k$; equidimensional. (Chapter 9)
- **Center.** Equilibrium of a linear system with pure-imaginary
  eigenvalues; trajectories are closed orbits. (Chapter 14)
- **Characteristic equation.** Polynomial obtained by substituting $y =
  e^{m x}$ (for constant-coefficient ODEs) or $y = x^{m}$ (for Cauchy-
  Euler). (Chapters 7, 9)
- **Classical RK4.** Fourth-order Runge-Kutta method; four stages, global
  error $O(h^{4})$. (Chapter 5)
- **Complementary solution $y_{c}$.** General solution of the associated
  homogeneous ODE. (Chapter 8)
- **Convolution.** $(f \ast g)(t) = \int_{0}^{t} f(\tau) g(t - \tau)\,
  d\tau$. (Chapter 13)
- **Convolution theorem.** $\mathcal{L}\{f \ast g\} = F(s)\,G(s)$.
  (Chapter 13)
- **Critical point.** Synonym for *equilibrium*. (Chapter 2)
- **Critically damped.** $\zeta = 1$; fastest decay without oscillation.
  (Chapter 10)

## D

- **Damping ratio $\zeta$.** $c / (2 \sqrt{m k})$. (Chapter 10)
- **Defective matrix.** Has fewer linearly independent eigenvectors than
  the algebraic multiplicity of an eigenvalue. (Chapter 14)
- **Dependent variable / function.** The unknown function we seek. The
  course emphasizes thinking of it as a *function* rather than just a
  variable. (Chapter 1)
- **Derivative of a transform theorem.** $\mathcal{L}\{t^{n} f(t)\} =
  (-1)^{n} F^{(n)}(s)$. (Chapter 13)
- **Differential equation.** Equation involving derivatives of an unknown
  function. (Chapter 1)
- **Dirac delta $\delta(t - a)$.** Distribution with $\int \delta(t - a)
  \phi\,dt = \phi(a)$ and $\mathcal{L}\{\delta(t - a)\} = e^{-a s}$.
  (Chapter 13)
- **Direction (slope) field.** Plot of short tangent segments at
  $(x, y)$ with slope $f(x, y)$. (Chapter 2)
- **Distinguished example: Lotka–Volterra.** $\dot{x} = \alpha x - \beta
  x y,\ \dot{y} = -\gamma y + \delta x y$. (Chapter 15)

## E

- **Eigenvalue $\lambda$.** Scalar with $A \mathbf{v} = \lambda \mathbf{v}$
  for some non-zero $\mathbf{v}$. (Chapter 14)
- **Eigenvector $\mathbf{v}$.** Non-zero vector satisfying $A \mathbf{v} =
  \lambda \mathbf{v}$. (Chapter 14)
- **Equidimensional equation.** Cauchy-Euler equation. (Chapter 9)
- **Equilibrium.** Constant solution $y \equiv c$ where $f(c) = 0$.
  (Chapter 2)
- **Euler's method.** $y_{n+1} = y_{n} + h\,f(x_{n}, y_{n})$. (Chapter 4)
- **Exact equation.** $M\,dx + N\,dy = 0$ with $M_{y} = N_{x}$ on a
  simply connected region. (Chapter 3)
- **Exponential order.** $|f(t)| \le M e^{c t}$ for large $t$. (Chapter 11)

## F

- **Family of solutions.** One-parameter (or multi-parameter) collection
  of solutions to an ODE. (Chapter 1)
- **Final-value theorem.** $\lim_{s \to 0^{+}} s F(s) = \lim_{t \to
  \infty} f(t)$, when the latter exists. (Appendix B)
- **First translation theorem.** $\mathcal{L}\{e^{a t} f(t)\} = F(s - a)$.
  (Chapter 11)
- **Forward Euler method.** Synonym for *Euler's method*. (Chapter 4)
- **Fundamental matrix $\Phi(t)$.** Matrix whose columns form a
  fundamental set of solutions to a system. (Chapter 15)
- **Fundamental set of solutions.** $n$ linearly-independent solutions of
  a homogeneous order-$n$ linear ODE. (Chapter 7)

## G

- **General solution.** Family of solutions parameterized by arbitrary
  constants. (Chapter 1)
- **Generalized eigenvector.** $\mathbf{w}$ satisfying $(A - \lambda I)
  \mathbf{w} = \mathbf{v}$ for an eigenvector $\mathbf{v}$. (Chapter 14)
- **Global truncation error.** Cumulative error of a numerical method
  over a fixed interval. (Chapter 5)

## H

- **Heaviside function.** Synonym for *unit step function*. (Chapter 12)
- **Heun's method.** Synonym for *Improved Euler*. (Chapter 5)
- **Higher-order linear ODE.** Order $\ge 2$, dependent variable and its
  derivatives appear linearly. (Chapter 7)
- **Homogeneous (linear sense).** Right-hand side is zero; equivalently,
  $y \equiv 0$ is a solution. (Chapter 4)
- **Homogeneous coefficients.** $M(tx, ty) = t^{n} M(x, y)$ and same for
  $N$; first-order ODE form $M\,dx + N\,dy = 0$. (Chapter 4)

## I

- **Implicit solution.** Solution given by $G(x, y) = 0$ rather than
  $y = \phi(x)$. (Chapter 1)
- **Improved Euler / Heun.** Two-stage second-order method. (Chapter 5)
- **Impulse response $h(t)$.** Inverse Laplace of $1 / \text{characteristic
  polynomial}$. (Chapter 13)
- **Indicial equation.** Polynomial in $m$ from $y = x^{m}$ in
  Cauchy-Euler. (Chapter 9)
- **Initial condition.** Specification of $y(x_{0})$ (and possibly
  derivatives) at a single point. (Chapter 1)
- **Initial-value problem (IVP).** ODE plus initial conditions. (Chapter 1)
- **Integrating factor.** $\mu$ that converts a non-exact form into an
  exact one, or that converts $y' + P y = Q$ into $(\mu y)' = \mu Q$.
  (Chapters 2, 3)
- **Integro-differential equation.** ODE with an integral term, soluble
  by Laplace + convolution. (Chapter 13)
- **Interval of validity.** Largest open interval containing the initial
  point on which the solution is continuously differentiable. (Chapter 3)
- **Inverse Laplace transform $\mathcal{L}^{-1}$.** Recovers $f(t)$ from
  $F(s)$. (Chapter 11)
- **Isocline.** Level set of $f(x, y)$; along an isocline the slope of
  solutions is constant. (Chapter 2)

## L

- **Laplace transform.** $\int_{0}^{\infty} e^{-s t} f(t)\,dt$. (Chapter 11)
- **Linear independence.** No non-trivial linear combination is
  identically zero. (Chapter 7)
- **Linear ODE.** Dependent variable and derivatives appear to the first
  power, with coefficients depending on the independent variable. (Chapter 4)
- **Linearization.** Replace nonlinear terms by their first-order Taylor
  approximation, e.g. $\sin \theta \approx \theta$. (Chapter 10)
- **Local truncation error.** Per-step error of a numerical method.
  (Chapter 5)
- **Logistic equation.** $\dot{P} = r P (1 - P / K)$. (Chapter 6)

## M

- **Mathematical model.** ODE (or system) describing a real-world
  phenomenon. (Chapter 1)
- **Matrix exponential $e^{A t}$.** $\sum (A t)^{k} / k!$; gives
  $\mathbf{x}(t) = e^{A t} \mathbf{x}(0)$ for the homogeneous system.
  (Chapter 14)
- **Method of undetermined coefficients.** Polynomial / exponential / trig
  ansatz with unknown coefficients. (Chapter 8)
- **Mixing problem.** Tank of constant volume with brine in/out flows.
  (Chapter 6)

## N

- **Natural frequency $\omega_{0}$.** $\sqrt{k / m}$. (Chapter 10)
- **Newton's law of cooling.** $\dot{T} = -k(T - T_{m})$. (Chapter 6)
- **Nonhomogeneous linear ODE.** Right-hand side $g \not\equiv 0$.
  (Chapter 4)
- **Nonlinear ODE.** Dependent variable / derivatives appear nonlinearly.
  (Chapter 4)

## O

- **Order.** Highest derivative in an ODE. (Chapter 1)
- **Ordinary differential equation (ODE).** ODE with a single independent
  variable. (Chapter 1)
- **Overdamped.** $\zeta > 1$; both characteristic roots are real and
  negative. (Chapter 10)

## P

- **Partial differential equation (PDE).** Multiple independent variables.
  (Chapter 1)
- **Partial fractions.** Rational-function decomposition used to invert
  Laplace transforms. (Chapter 11)
- **Particular solution $y_{p}$.** Any one solution of the nonhomogeneous
  ODE. (Chapter 8)
- **Periodic-function formula.** $F(s) = \dfrac{1}{1 - e^{-s T}}\,
  \int_{0}^{T} e^{-s t} f(t)\,dt$. (Chapter 13)
- **Phase line.** 1-D representation of an autonomous ODE's flow.
  (Chapter 2)
- **Phase portrait.** Plot of trajectories in state space. (Chapter 14)
- **Picard's theorem.** Existence-uniqueness for $y' = f(x, y)$ given
  continuity of $f$ and $\partial f / \partial y$. (Chapter 3)
- **Piecewise continuous.** Continuous except at finitely many jumps in
  any finite interval. (Chapter 11)

## R

- **Reduction of order.** Method to find a second linearly-independent
  solution from one known solution. (Chapter 9)
- **Resolvent.** $(s I - A)^{-1}$; Laplace transform of $e^{A t}$.
  (Chapter 15)
- **Resonance.** Forcing matches a homogeneous mode; in undamped
  systems amplitude grows linearly with $t$. (Chapters 8, 10)
- **Riccati equation.** $y' = a + b y + c y^{2}$. (Chapter 4)
- **Roundoff floor.** Lower bound on achievable error set by floating-
  point precision. (Chapter 5)

## S

- **Saddle.** Linear-system equilibrium with eigenvalues of opposite sign;
  unstable. (Chapter 14)
- **Second translation theorem.** $\mathcal{L}\{f(t - a) u(t - a)\} =
  e^{-a s} F(s)$. (Chapter 12)
- **Semi-stable equilibrium.** $f$ has the same sign on both sides.
  (Chapter 2)
- **Separable equation.** $y' = g(x) h(y)$. (Chapter 2)
- **Spiral (stable / unstable).** Linear-system equilibrium with complex
  eigenvalues. (Chapter 14)
- **Stable equilibrium.** Trajectories near it remain near (and, if
  asymptotically stable, return to it). (Chapters 2, 14)
- **Star node.** Repeated eigenvalue with full eigenspace; trajectories
  are radial lines. (Chapter 14)
- **State variable.** The unknown function whose evolution the ODE
  describes. (Chapter 6)
- **Steady-state response.** $\lim_{t \to \infty} y_{p}(t)$ for a forced
  linear system, when it exists. (Chapter 10)
- **Stiffness.** Disparity of timescales that forces explicit methods to
  use very small $h$. (Chapter 5)
- **Substitution method.** Change of variables to reduce one equation
  class to another (e.g. Bernoulli to linear). (Chapter 4)
- **Superposition principle.** Linear ODEs admit linear combinations of
  solutions. (Chapter 8)

## T

- **Time constant $\tau$.** $1 / k$ for first-order linear systems. (Chapter 6)
- **Transient response.** Decaying part of the forced solution.
  (Chapter 10)
- **Transform of derivative.** $\mathcal{L}\{f^{(n)}\} = s^{n} F - s^{n-1}
  f(0) - \cdots - f^{(n-1)}(0)$. (Chapter 11)

## U

- **Undamped.** $\zeta = 0$; pure oscillation at $\omega_{0}$. (Chapter 10)
- **Underdamped.** $0 < \zeta < 1$; decaying oscillation at $\omega_{d}$.
  (Chapter 10)
- **Unit step (Heaviside) function.** $u(t - a)$, jumps from 0 to 1 at
  $t = a$. (Chapter 12)
- **Unstable equilibrium.** Trajectories starting nearby leave any
  neighborhood. (Chapters 2, 14)

## V

- **Variation of parameters.** Replace constants in $y_{c}$ with functions
  $u_{i}(x)$; integrate to find $y_{p}$. (Chapter 8, 15)

## W

- **Wronskian.** Determinant of the matrix of solutions and their
  derivatives; tests linear independence of solutions of homogeneous
  linear ODEs. (Chapter 7)
