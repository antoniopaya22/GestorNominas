/**
 * Small recursive-descent arithmetic evaluator for the "Assigned" cell.
 * Supports + - * / and parentheses, with ',' or '.' as decimal separator.
 * If the expression starts with an operator (+50, -20, *2, /2) it is
 * evaluated relative to `current`; otherwise it's an absolute expression.
 */
function tokenize(input: string): string[] {
  const cleaned = input.replace(/,/g, ".").replace(/\s+/g, "");
  const tokens: string[] = [];
  let i = 0;
  while (i < cleaned.length) {
    const ch = cleaned[i];
    if ("+-*/()".includes(ch)) {
      tokens.push(ch);
      i++;
    } else if (/[0-9.]/.test(ch)) {
      let num = ch;
      i++;
      while (i < cleaned.length && /[0-9.]/.test(cleaned[i])) {
        num += cleaned[i];
        i++;
      }
      tokens.push(num);
    } else {
      return [];
    }
  }
  return tokens;
}

class Parser {
  private pos = 0;
  constructor(private tokens: string[]) {}

  private peek() {
    return this.tokens[this.pos];
  }

  private next() {
    return this.tokens[this.pos++];
  }

  parseExpression(): number | null {
    let value = this.parseTerm();
    if (value == null) return null;
    while (this.peek() === "+" || this.peek() === "-") {
      const op = this.next();
      const rhs = this.parseTerm();
      if (rhs == null) return null;
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }

  private parseTerm(): number | null {
    let value = this.parseFactor();
    if (value == null) return null;
    while (this.peek() === "*" || this.peek() === "/") {
      const op = this.next();
      const rhs = this.parseFactor();
      if (rhs == null) return null;
      if (op === "/" && rhs === 0) return null;
      value = op === "*" ? value * rhs : value / rhs;
    }
    return value;
  }

  private parseFactor(): number | null {
    const tok = this.peek();
    if (tok === "-") {
      this.next();
      const value = this.parseFactor();
      return value == null ? null : -value;
    }
    if (tok === "+") {
      this.next();
      return this.parseFactor();
    }
    if (tok === "(") {
      this.next();
      const value = this.parseExpression();
      if (this.peek() !== ")") return null;
      this.next();
      return value;
    }
    if (tok != null && /^[0-9.]+$/.test(tok)) {
      this.next();
      const num = Number(tok);
      return Number.isFinite(num) ? num : null;
    }
    return null;
  }

  isAtEnd() {
    return this.pos >= this.tokens.length;
  }
}

function evalExpression(input: string): number | null {
  const tokens = tokenize(input);
  if (tokens.length === 0) return null;
  const parser = new Parser(tokens);
  const result = parser.parseExpression();
  if (result == null || !parser.isAtEnd()) return null;
  return result;
}

export function evalAssignedExpression(current: number, input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;

  if (/^[+\-*/]/.test(trimmed)) {
    const rest = evalExpression(trimmed.slice(1));
    if (rest == null) return null;
    switch (trimmed[0]) {
      case "+":
        return current + rest;
      case "-":
        return current - rest;
      case "*":
        return current * rest;
      case "/":
        return rest === 0 ? null : current / rest;
      default:
        return null;
    }
  }

  return evalExpression(trimmed);
}
