/**
 * Demo tools for function-calling models.
 * These are demo implementations that run client-side — no API calls.
 */

import { capIcon } from "./capabilities.js";

/** Demo tools definition (OpenAI schema format). */
export const DEMO_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_current_time",
      description: "Get the current date and time on the user's device.",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "calculate",
      description: "Evaluate a basic arithmetic expression.",
      parameters: {
        type: "object",
        properties: {
          expression: { type: "string", description: "e.g. (12+8)*3" }
        },
        required: ["expression"]
      }
    }
  }
];

/**
 * Safe arithmetic evaluator — replaces eval/Function.
 * Only allows digits, + - * / % ( ) and decimals.
 */
export function safeEvaluate(expr) {
  if (typeof expr !== "string" || expr.trim() === "") throw new Error("Empty expression");
  const cleaned = expr.replace(/\s+/g, "");
  if (!/^[\d+\-*/%().]+$/.test(cleaned)) throw new Error("Invalid expression");

  let pos = 0;
  function peek() { return cleaned[pos]; }
  function parseExpression() {
    let value = parseTerm();
    while (pos < cleaned.length && (peek() === "+" || peek() === "-")) {
      const op = peek(); pos++;
      const rhs = parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }
  function parseTerm() {
    let value = parseFactor();
    while (pos < cleaned.length && (peek() === "*" || peek() === "/" || peek() === "%")) {
      const op = peek(); pos++;
      const rhs = parseFactor();
      if (op === "*") value = value * rhs;
      else if (op === "/") value = value / rhs;
      else value = value % rhs;
    }
    return value;
  }
  function parseFactor() {
    if (peek() === "(") { pos++; const v = parseExpression(); if (peek() !== ")") throw new Error("Mismatched parens"); pos++; return v; }
    if (peek() === "-") { pos++; return -parseFactor(); }
    if (peek() === "+") { pos++; return parseFactor(); }
    const start = pos;
    while (pos < cleaned.length && /[\d.]/.test(peek())) pos++;
    const num = cleaned.slice(start, pos);
    if (!num) throw new Error("Expected number");
    const val = Number(num);
    if (!Number.isFinite(val)) throw new Error("Invalid number");
    return val;
  }
  const result = parseExpression();
  if (pos !== cleaned.length) throw new Error("Unexpected characters");
  return result;
}

/**
 * Run a demo tool by name. Returns the tool result object.
 */
export function runDemoTool(name, argsJson) {
  let args = {};
  try { args = JSON.parse(argsJson || "{}"); } catch (e) {}
  if (name === "get_current_time") return { now: new Date().toString() };
  if (name === "calculate") {
    try {
      const val = safeEvaluate(args.expression);
      return { result: val };
    } catch (e) {
      return { error: "Could not evaluate expression." };
    }
  }
  return { error: "Unknown tool" };
}

/** Convenience: get a display label for a model. */
export function getModelLabel(m) {
  if (m && m.name) return m.name;
  const id = (m && (m.id || m.name)) || "";
  return id.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

/** Convenience: get the accent color for a model/provider. */
export function getModelColor(m, provider, PROVIDER_COLORS) {
  const id = (m && m.provider) || provider;
  return PROVIDER_COLORS[id] || "#FF7000";
}
