import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagInput } from "../components/trip-form/tag-input";

jest.mock("../components/trip-form/tag-input.module.css", () => new Proxy({}, {
  get: (_target, prop) => prop,
}));

describe("TagInput", () => {
  it("adds a tag on Enter and clears the input", async () => {
    const onTagsChange = jest.fn();
    const user = userEvent.setup();

    render(
      <TagInput
        tags={[]}
        onTagsChange={onTagsChange}
        placeholder="Add tag"
      />
    );

    const input = screen.getByPlaceholderText("Add tag");
    await user.type(input, "UA{enter}");

    expect(onTagsChange).toHaveBeenCalledWith(["UA"]);
  });

  it("adds a tag on blur", async () => {
    const onTagsChange = jest.fn();
    const user = userEvent.setup();

    render(
      <TagInput
        tags={[]}
        onTagsChange={onTagsChange}
        placeholder="Add tag"
      />
    );

    const input = screen.getByPlaceholderText("Add tag");
    await user.type(input, "DL");
    await user.tab();

    expect(onTagsChange).toHaveBeenCalledWith(["DL"]);
  });

  it("removes the last tag on backspace when input is empty", async () => {
    const onTagsChange = jest.fn();
    const user = userEvent.setup();

    render(
      <TagInput
        tags={["AA"]}
        onTagsChange={onTagsChange}
        placeholder="Add tag"
      />
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "{backspace}");

    expect(onTagsChange).toHaveBeenCalledWith([]);
  });

  it("removes a tag when clicking the remove button", async () => {
    const onTagsChange = jest.fn();
    const user = userEvent.setup();

    render(
      <TagInput
        tags={["UA"]}
        onTagsChange={onTagsChange}
        placeholder="Add tag"
      />
    );

    await user.click(screen.getByLabelText("Remove UA"));

    expect(onTagsChange).toHaveBeenCalledWith([]);
  });

  it("renders suggestions excluding existing tags", () => {
    render(
      <TagInput
        tags={["AA"]}
        onTagsChange={jest.fn()}
        placeholder="Add tag"
        suggestions={["AA", "UA"]}
        id="airlines"
      />
    );

    const list = document.querySelector("datalist#airlines-suggestions");
    expect(list).not.toBeNull();
    const values = Array.from(list?.querySelectorAll("option") ?? []).map(
      (option) => option.value
    );
    expect(values).toEqual(["UA"]);
  });

  it("does not add a duplicate tag", async () => {
    const user = userEvent.setup();
    const onTagsChange = jest.fn();

    render(
      <TagInput
        tags={["UA"]}
        onTagsChange={onTagsChange}
        placeholder="Add tag"
      />
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "UA{enter}");

    expect(onTagsChange).not.toHaveBeenCalled();
  });
});
