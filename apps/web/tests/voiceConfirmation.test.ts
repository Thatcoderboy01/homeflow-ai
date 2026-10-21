import { describe, expect, it } from "vitest";
import { classifyVoiceConfirmation } from "../src/features/voiceConfirmation";

describe("classifyVoiceConfirmation", () => {
  it.each([
    ["yes", "approve"],
    ["Haan, kar do", "approve"],
    ["go ahead and do it", "approve"],
  ])("classifies %s as approval", (text, expected) => {
    expect(classifyVoiceConfirmation(text)).toBe(expected);
  });

  it.each([
    ["no, cancel it", "reject"],
    ["nahi", "reject"],
    ["don't do it", "reject"],
  ])("classifies %s as rejection", (text, expected) => {
    expect(classifyVoiceConfirmation(text)).toBe(expected);
  });

  it.each([
    ["wait, let me check", "defer"],
    ["not now", "defer"],
    ["baad mein", "defer"],
  ])("keeps %s pending", (text, expected) => {
    expect(classifyVoiceConfirmation(text)).toBe(expected);
  });

  it("does not classify an unrelated request as a confirmation", () => {
    expect(classifyVoiceConfirmation("What tasks are pending?")).toBe("none");
  });
});
