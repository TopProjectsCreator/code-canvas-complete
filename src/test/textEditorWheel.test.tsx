import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextEditor } from "@/components/ide/TextEditor";

const longContent = Array.from({ length: 80 }, (_, index) => `line ${index + 1}`).join("\n");

describe("TextEditor wheel scrolling", () => {
  it("scrolls the textarea when the editor receives a mouse wheel event", () => {
    render(
      <TextEditor
        content={longContent}
        language="javascript"
        searchMatches={[]}
        currentMatchIndex={-1}
        activePresence={[]}
        selectedLine={null}
        onChange={() => {}}
        onCursorChange={() => {}}
      />,
    );

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    Object.defineProperty(textarea, "scrollHeight", { configurable: true, value: 2000 });
    Object.defineProperty(textarea, "clientHeight", { configurable: true, value: 400 });

    fireEvent.wheel(textarea, { deltaY: 240, deltaX: 12 });

    expect(textarea.scrollTop).toBe(240);
    expect(textarea.scrollLeft).toBe(12);
  });
});
