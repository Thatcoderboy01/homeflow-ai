import { describe, expect, it } from "vitest";
import { actionSchema, canonicalJson, createTaskInputSchema, normalizeName, planSchema, updateGroceryInputSchema } from "../src/index.js";

describe("shared schemas", () => {
  it("normalises grocery names", () => {
    expect(normalizeName("  Whole   MILK ")).toBe("whole milk");
  });
  it("applies defaults and trims task input", () => {
    const r = createTaskInputSchema.parse({ title: "  Clean  " });
    expect(r).toEqual({ title: "Clean", status: "TODO" });
  });
  it("rejects invalid task input", () => {
    expect(createTaskInputSchema.safeParse({ title: "" }).success).toBe(false);
    expect(createTaskInputSchema.safeParse({ title: "x".repeat(201) }).success).toBe(false);
    expect(createTaskInputSchema.safeParse({ title: "ok", dueDate: "tomorrow" }).success).toBe(false);
    expect(createTaskInputSchema.safeParse({ title: "ok", status: "WHATEVER" }).success).toBe(false);
  });
  it("limits grocery quantity", () => {
    expect(updateGroceryInputSchema.safeParse({ name: "Milk", quantity: 0 }).success).toBe(false);
    expect(updateGroceryInputSchema.safeParse({ name: "Milk", quantity: 1000 }).success).toBe(false);
    expect(updateGroceryInputSchema.safeParse({ name: "Milk", quantity: 2.5 }).success).toBe(false);
  });
  it("only accepts known action types", () => {
    expect(actionSchema.safeParse({ type: "delete_everything" }).success).toBe(false);
    expect(actionSchema.safeParse({ type: "create_task", title: "a" }).success).toBe(true);
  });
  it("caps plan size", () => {
    const actions = Array.from({ length: 26 }, (_, i) => ({ type: "create_task", title: `t${i}` }));
    expect(planSchema.safeParse({ summary: "s", actions }).success).toBe(false);
    expect(planSchema.safeParse({ summary: "s", actions: [] }).success).toBe(false);
  });
  it("canonicalJson ignores key order and undefined", () => {
    expect(canonicalJson({ b: 1, a: undefined, c: { y: 1, x: 2 } })).toBe(canonicalJson({ c: { x: 2, y: 1 }, b: 1 }));
  });
});
