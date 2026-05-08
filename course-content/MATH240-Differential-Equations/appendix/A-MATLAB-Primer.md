---
title: "Appendix A — MATLAB Primer for ODEs"
tags: [math240, appendix, matlab, numerical, primer]
prev: "../README.md"
---

# Appendix A — MATLAB Primer for ODEs

> This appendix is the standalone MATLAB onboarding referenced from
> Chapters 2, 5, and 15. Complete it by the end of Week 2. If you cannot
> install MATLAB, the same exercises run in Octave (almost identical
> syntax) or, as a last resort, MS Excel for the numerical examples.

---

## Why MATLAB

MATLAB stands for **MATrix LABoratory**. It treats *arrays* — vectors and
matrices — as first-class citizens, which makes it ideal for numerical ODE
work. It is the de facto industry standard in much of engineering and is
worth the modest student cost (~\$49) for the experience alone.

If you genuinely cannot afford the license: **Octave** is a free, open-
source, near-drop-in replacement (almost every line in this primer works
unchanged). **Excel** is acceptable but limits you to small problems and
makes slope fields impractical.

---

## Section 0 — A Few Basics

### Entering vectors and vector operations

Start a MATLAB session.

```matlab
>> x = [1 -2 3]
x =
     1    -2     3
>> y = [3 2 -1];     % semicolon suppresses echo
>> x + y
ans =
     4     0     2
>> 2*x
ans =
     2    -4     6
```

Two essentials:

1. A semicolon `;` at the end of a line **suppresses** echo. Use it to
   keep your output readable when working with large arrays.
2. If you don't name a result, MATLAB stores it in `ans`.

```matlab
>> 2*x + 4*y - 3*z
ans =
    11     4    -1
>> w = 2*x + 4*y - 3*z;   % named for later use
```

Column vectors use semicolons between entries:

```matlab
>> s = [4; -5; 6]
s =
     4
    -5
     6
```

A row vector and column vector cannot be added — you'll get an error
(`Matrix dimensions must agree`).

### Entering matrices

Rows separated by semicolons (or by line returns):

```matlab
>> A = [1 2 3; 4 5 6; 7 8 9]
A =
     1     2     3
     4     5     6
     7     8     9

>> A(3, 2)        % single element
ans = 8

>> A(:, 3)        % third column
ans =
     3
     6
     9

>> A(2, :)        % second row
ans = 4   5   6

>> A(1:2, 2:3)    % top-right 2x2 sub-matrix
ans =
     2     3
     5     6
```

Replacement is just assignment:

```matlab
>> A(3, 1) = 8;
>> A(1:2, 2:3) = [0 1; 1 0];
```

### Number formats

```matlab
>> format shortg;  sqrt(2)/(100*pi)
>> format longg;   sqrt(2)/(100*pi)
>> format rat;     sqrt(2)/(100*pi)   % rational approximation
```

Type `help format` for the full list.

### Help command

`help <function>` prints documentation. Use it whenever you forget the
syntax of a built-in function.

### Exercises §0

1. Use the `:` operator to build the integer vector $[1, 2, \ldots, 100]$.
2. Use `:` to build a vector of integers in $[-10, 10]$.
3. Enter a 3×3 matrix of your choice. Replace its (2, 2) entry with 0 and
   its (1, 3) entry with 99.

---

## Section 1 — Built-in Functions and Scripts

`clear x y` removes specific variables; `clear all` removes everything.

### Element-wise vs. linear-algebra operations

By default `*`, `^`, and `/` are *linear-algebra* operations. To apply them
*element-wise*, prefix with a dot:

```matlab
>> t = linspace(0, 10, 11);
>> y = t^2          % ERROR — interprets as t*t
>> y = t.^2         % element-wise square
y =
     0     1     4     9    16    25    36    49    64    81   100

>> w = t.*cos(3*t)  % element-wise t * cos(3t)
```

Whenever an expression should be applied to every element of a vector
independently, use the dot.

### Inline functions

```matlab
>> f = @(t) t.^2 .* cos(t) ./ (3*t - 5)
>> f(0)
ans = 0
>> f(2)
ans = -1.66458734618857
```

The `@(t)` syntax creates an anonymous function. Always use element-wise
operators inside (`.^, .*`./`) so the function works on vectors.

### Plotting

```matlab
>> t = linspace(0, 4*pi, 1001);
>> y = cos(t);
>> plot(t, y)
>> xlabel('t'); ylabel('cos(t)'); title('t vs. cos(t)');
```

### Always use scripts

A `.m` script holds several lines of MATLAB code and is the basic unit of
reusable work. From the **Home** tab → **New** → **Script**:

```matlab
% scriptTest.m
clear all
t = linspace(0, 4*pi, 1001);
y = cos(t);
figure(1);
plot(t, y);
xlabel('t'); ylabel('cos(t)'); title('t vs. cos(t)');
```

Save and run with `>> scriptTest`. Comments start with `%`.

### Exercises §1

1. Use `sqrt`, `abs`, `cosh`, `exp` on a vector and plot the result.
2. Plot 1000 uniformly-distributed random numbers (`rand`) as blue dots.
3. Plot 1000 normally-distributed random numbers (`randn`) as red dots.
4. Build $f(t) = \dfrac{t^{2} \cos t}{3 t - 5}$ as an inline function and
   plot it on $[-1, 1]$.

---

## Section 2 — Looping

### `while` loops

```matlab
clear all
iter = 1;
itSum = 0;
while iter < 101
    itSum = itSum + iter;
    iter = iter + 1;
end
itSum   % => 5050
```

### `for` loops

When the iteration count is known, prefer `for`:

```matlab
clear all
itSum = 0;
for iter = 1:100
    itSum = itSum + iter;
end
itSum   % => 5050
```

### Avoiding runaways with `break`

```matlab
while itSum < stopCrit
    itSum = itSum + 1/iter;
    iter = iter + 1;
    if iter > 1e8, break, end
end
```

`Ctrl + C` cancels a runaway interactively.

### Exercises §2

1. Estimate $\sum_{n=1}^{\infty} 1/n^{2}$ to 10 significant figures.
2. Find the smallest integer $N$ such that $\sum_{n=1}^{N} 1/\sqrt{n} >
   1000$.

---

## Section 3 — Decisions

`if`/`elseif`/`else`/`end`:

```matlab
k = 10*rand(1);
if k <= 5
    disp('k <= 5');
else
    disp('k >  5');
end
```

Combined with a loop:

```matlab
clear all
totLo = 0; totMid = 0; totHi = 0;
itMax = 100;
for ii = 1:itMax
    k = 10*rand(1);
    if k <= 1
        totLo = totLo + 1;
    elseif k >= 9
        totHi = totHi + 1;
    else
        totMid = totMid + 1;
    end
end
percentLo = totLo/itMax
percentMid = totMid/itMax
percentHi = totHi/itMax
```

> **Note.** A `while` loop is just a `for` loop with a built-in `if/break`.
> Use whichever expresses your intent most naturally.

### Exercises §3

1. Count how many integers $n \in [1, 10^{6}]$ satisfy $\sin(n) > 0.99$.
2. Bin the integers from 1 to $10^{6}$ by $\cos(n)$ into four intervals
   $[-1, -0.5)$, $[-0.5, 0)$, $[0, 0.5)$, $[0.5, 1]$. Report the counts.

---

## Implementing Euler, Heun, and RK4 in MATLAB

These are the three numerical schemes used in Chapters 4, 5, and 15.

### Euler's method

```matlab
function [t, y] = my_euler(f, tspan, y0, h)
    t = tspan(1):h:tspan(2);
    y = zeros(length(y0), length(t));
    y(:, 1) = y0;
    for n = 1:length(t)-1
        y(:, n+1) = y(:, n) + h * f(t(n), y(:, n));
    end
end
```

### Heun (Improved Euler)

```matlab
function [t, y] = my_heun(f, tspan, y0, h)
    t = tspan(1):h:tspan(2);
    y = zeros(length(y0), length(t));
    y(:, 1) = y0;
    for n = 1:length(t)-1
        k1 = f(t(n), y(:, n));
        k2 = f(t(n)+h, y(:, n) + h*k1);
        y(:, n+1) = y(:, n) + h/2 * (k1 + k2);
    end
end
```

### Classical RK4

```matlab
function [t, y] = my_rk4(f, tspan, y0, h)
    t = tspan(1):h:tspan(2);
    y = zeros(length(y0), length(t));
    y(:, 1) = y0;
    for n = 1:length(t)-1
        k1 = f(t(n), y(:, n));
        k2 = f(t(n)+h/2, y(:, n) + h/2*k1);
        k3 = f(t(n)+h/2, y(:, n) + h/2*k2);
        k4 = f(t(n)+h,   y(:, n) + h*k3);
        y(:, n+1) = y(:, n) + h/6 * (k1 + 2*k2 + 2*k3 + k4);
    end
end
```

All three functions accept **scalar or vector** `y0`, so they work for
single equations and systems alike. To use them:

```matlab
f = @(t, y) y - t.^2 + 1;            % scalar
[t, y] = my_rk4(f, [0 2], 0.5, 0.1);
plot(t, y);
```

```matlab
F = @(t, x) [x(1) - 2*x(1)*x(2);
             -x(2) + x(1)*x(2)];     % Lotka-Volterra
[t, X] = my_rk4(F, [0 30], [1; 0.5], 0.01);
plot(X(1, :), X(2, :));               % phase portrait
```

For production work, use MATLAB's built-in `ode45` (adaptive RK4/5) and
`ode23` instead of these hand-rolled functions.

```matlab
[t, X] = ode45(F, [0 30], [1; 0.5]);
```

---

## Direction-field plotting

`quiver` and `meshgrid` make slope fields easy:

```matlab
[X, Y] = meshgrid(-2:0.25:2, -2:0.25:2);
F = X - Y;          % slope dY/dX = X - Y
U = ones(size(X));
V = F;
L = sqrt(U.^2 + V.^2);
quiver(X, Y, U./L, V./L, 0.5);
axis tight; xlabel x; ylabel y;
title('Direction field of dy/dx = x - y');
```

The normalization (`U./L, V./L`) makes all arrows the same length, so the
plot communicates *direction* more clearly than magnitude.

---

## Excel alternative for Euler's method

If MATLAB is unavailable, set up columns in Excel:

| A    | B    | C            | D       | E         |
| ---- | ---- | ------------ | ------- | --------- |
| `x`  | `y_n`| `f(x, y)`    | `h*f`   | `y_{n+1}` |
| 0    | 1    | `=A2*SIN(B2)`| `=$F$1*C2` | `=B2+D2` |
| `=A2+$F$1` | `=E2` | ... | ... | ... |

Where cell `F1` holds your step size `h`. Drag down to extend.

For higher-order methods (Heun, RK4), each "stage" $k_{i}$ takes its own
column. RK4 requires four stages × per-stage columns, which is workable
for short runs but tedious — yet another reason to use MATLAB.

---

## Where to go for more

- MATLAB's built-in **Examples** browser (Help menu → MATLAB → Examples).
- **MathWorks Onramp** — a free 2-hour tutorial.
- The book *MATLAB Primer* by Davis (any edition).
- For ODE-specific MATLAB depth, see the documentation for `ode45`,
  `ode15s`, `ode23s`, and `bvp4c`.
