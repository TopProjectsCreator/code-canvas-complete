import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FindReplace } from "@/components/ide/FindReplace";

describe("FindReplace", () => {
  it("replace all handles regex matches that can be empty without truncating later matches", async () => {
    const onReplace = vi.fn();
    const onHighlightChange = vi.fn();

    render(
      <FindReplace
        content={"alpha"}
        isOpen={true}
        onClose={() => {}}
        onReplace={onReplace}
        onHighlightChange={onHighlightChange}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Find"), {
      target: { value: "^|$" },
    });
    fireEvent.click(screen.getByTitle("Use Regular Expression"));
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    fireEvent.change(screen.getByPlaceholderText("Replace"), {
      target: { value: "X" },
    });

    await waitFor(() => {
      expect(screen.getByText("1/2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle("Replace All"));

    expect(onReplace).toHaveBeenCalledWith("XalphaX");
  });
});
