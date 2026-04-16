/**
 * Lightweight math expression evaluator — replaces the full mathjs library
 * (~700 KB) with a tiny recursive-descent parser that handles exactly the
 * subset the Graph Plotter needs.
 *
 * Supported:
 *   Operators : + - * / ^ %  (with standard precedence)
 *   Comparison: >= > <= < == !=   (return 1 or 0)
 *   Ternary  : cond ? a : b
 *   Functions : sin cos tan asin acos atan exp log log2 log10
 *               sqrt abs ceil floor round sign min max pow
 *   Constants : pi e Inf
 *   Variable  : x (or any name supplied via the scope)
 *   Implicit multiplication: 2x  2pi  2sin(x)  (x)(x)
 */

// ── Tokenizer ──────────────────────────────────────────────────────────

type Token =
  | { type: "num"; value: number }
  | { type: "id"; value: string }
  | { type: "op"; value: string }
  | { type: "(" }
  | { type: ")" }
  | { type: "," }
  | { type: "?" }
  | { type: ":" }
  | { type: "eof" };

const FUNCS = new Set([
  "sin", "cos", "tan", "asin", "acos", "atan",
  "exp", "log", "log2", "log10",
  "sqrt", "abs", "ceil", "floor", "round", "sign",
  "min", "max", "pow",
]);

const CONSTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
  Inf: Infinity,
};

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < src.length) {
    const ch = src[i]!;

    // Whitespace
    if (ch === " " || ch === "\t") { i++; continue; }

    // Number literal (including leading dot like .5)
    if (ch >= "0" && ch <= "9" || (ch === "." && i + 1 < src.length && src[i + 1]! >= "0" && src[i + 1]! <= "9")) {
      let num = "";
      while (i < src.length && ((src[i]! >= "0" && src[i]! <= "9") || src[i] === ".")) {
        num += src[i]!;
        i++;
      }
      // Handle scientific notation e.g. 2.5e-3
      if (i < src.length && (src[i] === "e" || src[i] === "E")) {
        // Lookahead: must be followed by digit or +/- digit
        const next = src[i + 1];
        if (next && (next >= "0" && next <= "9" || next === "+" || next === "-")) {
          num += src[i]!; i++;
          if (src[i] === "+" || src[i] === "-") { num += src[i]!; i++; }
          while (i < src.length && src[i]! >= "0" && src[i]! <= "9") { num += src[i]!; i++; }
        }
      }
      tokens.push({ type: "num", value: parseFloat(num) });
      continue;
    }

    // Identifier (function name, constant, or variable)
    if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_") {
      let id = "";
      while (i < src.length && ((src[i]! >= "a" && src[i]! <= "z") || (src[i]! >= "A" && src[i]! <= "Z") || (src[i]! >= "0" && src[i]! <= "9") || src[i] === "_")) {
        id += src[i]!;
        i++;
      }
      tokens.push({ type: "id", value: id });
      continue;
    }

    // Two-character operators
    if (i + 1 < src.length) {
      const two = ch + src[i + 1];
      if (two === ">=" || two === "<=" || two === "==" || two === "!=") {
        tokens.push({ type: "op", value: two });
        i += 2;
        continue;
      }
    }

    // Single-character tokens
    if (ch === "(") { tokens.push({ type: "(" }); i++; continue; }
    if (ch === ")") { tokens.push({ type: ")" }); i++; continue; }
    if (ch === ",") { tokens.push({ type: "," }); i++; continue; }
    if (ch === "?") { tokens.push({ type: "?" }); i++; continue; }
    if (ch === ":") { tokens.push({ type: ":" }); i++; continue; }

    // Operators
    if ("+-*/%^><".includes(ch)) {
      tokens.push({ type: "op", value: ch });
      i++;
      continue;
    }

    // Unknown character — skip
    i++;
  }

  tokens.push({ type: "eof" });
  return tokens;
}

// ── Parser / Evaluator ─────────────────────────────────────────────────
// Precedence (low → high):
//   ternary  ?:
//   comparison  >= > <= < == !=
//   add/sub  + -
//   mul/div/mod  * / %
//   unary  + -
//   power  ^            (right-associative)
//   implicit mul        2x  2sin(x)
//   atom               number | id | func(…) | (expr)

type Scope = Record<string, number>;

class Parser {
  private tokens: Token[];
  private pos = 0;
  private scope: Scope;

  constructor(tokens: Token[], scope: Scope) {
    this.tokens = tokens;
    this.scope = scope;
  }

  private peek(): Token { return this.tokens[this.pos]!; }
  private advance(): Token { return this.tokens[this.pos++]!; }

  private eat(type: Token["type"]): Token {
    const t = this.peek();
    if (t.type !== type) throw new Error(`Expected ${type}, got ${t.type}`);
    return this.advance();
  }

  parse(): number {
    const val = this.parseTernary();
    if (this.peek().type !== "eof") throw new Error("Unexpected token after expression");
    return val;
  }

  // ternary: comparison ('?' ternary ':' ternary)?
  private parseTernary(): number {
    const cond = this.parseComparison();
    if (this.peek().type === "?") {
      this.advance();
      const ifTrue = this.parseTernary();
      this.eat(":");
      const ifFalse = this.parseTernary();
      return cond !== 0 ? ifTrue : ifFalse;
    }
    return cond;
  }

  // comparison: addSub (('>' | '<' | '>=' | '<=' | '==' | '!=') addSub)*
  private parseComparison(): number {
    let left = this.parseAddSub();
    while (true) {
      const t = this.peek();
      if (t.type === "op" && (t.value === ">" || t.value === "<" || t.value === ">=" || t.value === "<=" || t.value === "==" || t.value === "!=")) {
        const op = (this.advance() as { type: "op"; value: string }).value;
        const right = this.parseAddSub();
        switch (op) {
          case ">": left = left > right ? 1 : 0; break;
          case "<": left = left < right ? 1 : 0; break;
          case ">=": left = left >= right ? 1 : 0; break;
          case "<=": left = left <= right ? 1 : 0; break;
          case "==": left = left === right ? 1 : 0; break;
          case "!=": left = left !== right ? 1 : 0; break;
        }
      } else break;
    }
    return left;
  }

  // addSub: mulDiv (('+' | '-') mulDiv)*
  private parseAddSub(): number {
    let left = this.parseMulDiv();
    while (true) {
      const t = this.peek();
      if (t.type === "op" && (t.value === "+" || t.value === "-")) {
        const op = (this.advance() as { type: "op"; value: string }).value;
        const right = this.parseMulDiv();
        left = op === "+" ? left + right : left - right;
      } else break;
    }
    return left;
  }

  // mulDiv: unary (('*' | '/' | '%') unary)*
  private parseMulDiv(): number {
    let left = this.parseUnary();
    while (true) {
      const t = this.peek();
      if (t.type === "op" && (t.value === "*" || t.value === "/" || t.value === "%")) {
        const op = (this.advance() as { type: "op"; value: string }).value;
        const right = this.parseUnary();
        if (op === "*") left = left * right;
        else if (op === "/") left = left / right;
        else left = left % right;
      } else break;
    }
    return left;
  }

  // unary: ('+' | '-') unary | power
  private parseUnary(): number {
    const t = this.peek();
    if (t.type === "op" && t.value === "-") {
      this.advance();
      return -this.parseUnary();
    }
    if (t.type === "op" && t.value === "+") {
      this.advance();
      return this.parseUnary();
    }
    return this.parsePower();
  }

  // power: implicitMul ('^' unary)?   [right-associative]
  private parsePower(): number {
    const base = this.parseImplicitMul();
    if (this.peek().type === "op" && (this.peek() as { type: "op"; value: string }).value === "^") {
      this.advance();
      const exp = this.parseUnary(); // right-assoc via unary
      return Math.pow(base, exp);
    }
    return base;
  }

  // Implicit multiplication: 2x, 2pi, 2sin(x), (expr)(expr), x(expr)
  private parseImplicitMul(): number {
    let left = this.parseAtom();
    while (true) {
      const t = this.peek();
      // Implicit mul if next token is num, id, or '(' and there's no operator
      if (t.type === "num" || t.type === "id" || t.type === "(") {
        const right = this.parseAtom();
        left = left * right;
      } else break;
    }
    return left;
  }

  // atom: number | id | func(args) | '(' expr ')'
  private parseAtom(): number {
    const t = this.peek();

    // Number literal
    if (t.type === "num") {
      this.advance();
      return t.value;
    }

    // Parenthesized expression
    if (t.type === "(") {
      this.advance();
      const val = this.parseTernary();
      this.eat(")");
      return val;
    }

    // Identifier: function call, constant, or variable
    if (t.type === "id") {
      const name = t.value;
      this.advance();

      // Function call
      if (FUNCS.has(name) && this.peek().type === "(") {
        this.advance(); // eat '('
        const args: number[] = [this.parseTernary()];
        while (this.peek().type === ",") {
          this.advance();
          args.push(this.parseTernary());
        }
        this.eat(")");
        return this.callFunc(name, args);
      }

      // Constant
      if (name in CONSTS) return CONSTS[name]!;

      // Scope variable
      if (name in this.scope) return this.scope[name]!;

      throw new Error(`Unknown identifier: ${name}`);
    }

    throw new Error(`Unexpected token: ${JSON.stringify(t)}`);
  }

  private callFunc(name: string, args: number[]): number {
    switch (name) {
      case "sin": return Math.sin(args[0]!);
      case "cos": return Math.cos(args[0]!);
      case "tan": return Math.tan(args[0]!);
      case "asin": return Math.asin(args[0]!);
      case "acos": return Math.acos(args[0]!);
      case "atan": return Math.atan(args[0]!);
      case "exp": return Math.exp(args[0]!);
      case "log": return Math.log(args[0]!);
      case "log2": return Math.log2(args[0]!);
      case "log10": return Math.log10(args[0]!);
      case "sqrt": return Math.sqrt(args[0]!);
      case "abs": return Math.abs(args[0]!);
      case "ceil": return Math.ceil(args[0]!);
      case "floor": return Math.floor(args[0]!);
      case "round": return Math.round(args[0]!);
      case "sign": return Math.sign(args[0]!);
      case "min": return Math.min(...args);
      case "max": return Math.max(...args);
      case "pow": return Math.pow(args[0]!, args[1]!);
      default: throw new Error(`Unknown function: ${name}`);
    }
  }
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Evaluate a math expression with the given variable scope.
 * Returns the numeric result, or `null` if the expression is invalid
 * or produces a non-finite value.
 */
export function evaluate(expr: string, scope: Scope = {}): number | null {
  try {
    const tokens = tokenize(expr);
    const parser = new Parser(tokens, scope);
    const result = parser.parse();
    if (typeof result === "number" && isFinite(result)) return result;
    return null;
  } catch {
    return null;
  }
}
