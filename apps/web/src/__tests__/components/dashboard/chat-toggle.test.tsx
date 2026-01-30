import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderHook } from "@testing-library/react";
import {
  ChatToggle,
  useChatExpanded,
  FloatingChatToggle,
} from "../../../components/dashboard/chat-toggle";

// Mock localStorage
let mockStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: jest.fn((key: string) => mockStore[key] ?? null),
  setItem: jest.fn((key: string, value: string) => {
    mockStore[key] = value;
  }),
  clear: () => {
    mockStore = {};
  },
  reset: () => {
    mockStore = {};
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
  },
};

Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
});

describe("ChatToggle", () => {
  it("renders expanded state", () => {
    const onToggle = jest.fn();
    render(<ChatToggle isExpanded={true} onToggle={onToggle} />);

    const button = screen.getByRole("button", { name: /collapse chat panel/i });
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Hide Chat")).toBeInTheDocument();
  });

  it("renders collapsed state", () => {
    const onToggle = jest.fn();
    render(<ChatToggle isExpanded={false} onToggle={onToggle} />);

    const button = screen.getByRole("button", { name: /expand chat panel/i });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Show Chat")).toBeInTheDocument();
  });

  it("calls onToggle with opposite state when clicked", async () => {
    const user = userEvent.setup();
    const onToggle = jest.fn();
    render(<ChatToggle isExpanded={true} onToggle={onToggle} />);

    await user.click(screen.getByRole("button"));

    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it("applies custom className", () => {
    const onToggle = jest.fn();
    render(
      <ChatToggle isExpanded={true} onToggle={onToggle} className="custom-class" />
    );

    const button = screen.getByRole("button");
    expect(button).toHaveClass("custom-class");
  });
});

describe("useChatExpanded", () => {
  beforeEach(() => {
    mockLocalStorage.reset();
  });

  it("initializes with default value when localStorage is empty", () => {
    const { result } = renderHook(() => useChatExpanded(true));

    expect(result.current.isExpanded).toBe(true);
  });

  it("loads state from localStorage on mount", async () => {
    mockStore["vacation-tracker-chat-expanded"] = "false";

    const { result } = renderHook(() => useChatExpanded(true));

    // Wait for useEffect to run
    await act(async () => {});

    expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
      "vacation-tracker-chat-expanded"
    );
    expect(result.current.isExpanded).toBe(false);
  });

  it("persists state to localStorage when changed", async () => {
    const { result } = renderHook(() => useChatExpanded(true));

    // Wait for hydration
    await act(async () => {});

    // Toggle state
    act(() => {
      result.current.toggle();
    });

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      "vacation-tracker-chat-expanded",
      "false"
    );
  });

  it("toggle toggles the state", async () => {
    const { result } = renderHook(() => useChatExpanded(true));

    // Wait for hydration
    await act(async () => {});

    expect(result.current.isExpanded).toBe(true);

    act(() => {
      result.current.toggle();
    });

    expect(result.current.isExpanded).toBe(false);

    act(() => {
      result.current.toggle();
    });

    expect(result.current.isExpanded).toBe(true);
  });

  it("setExpanded sets specific value", async () => {
    const { result } = renderHook(() => useChatExpanded(true));

    // Wait for hydration
    await act(async () => {});

    act(() => {
      result.current.setExpanded(false);
    });

    expect(result.current.isExpanded).toBe(false);

    act(() => {
      result.current.setExpanded(true);
    });

    expect(result.current.isExpanded).toBe(true);
  });

  it("isHydrated becomes true after initial load", async () => {
    const { result } = renderHook(() => useChatExpanded(true));

    // Wait for useEffect
    await act(async () => {});

    expect(result.current.isHydrated).toBe(true);
  });
});

describe("FloatingChatToggle", () => {
  it("returns null when expanded", () => {
    const onToggle = jest.fn();
    const { container } = render(
      <FloatingChatToggle isExpanded={true} onToggle={onToggle} />
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders button when collapsed", () => {
    const onToggle = jest.fn();
    render(<FloatingChatToggle isExpanded={false} onToggle={onToggle} />);

    expect(screen.getByRole("button", { name: /open chat/i })).toBeInTheDocument();
  });

  it("calls onToggle with true when clicked", async () => {
    const user = userEvent.setup();
    const onToggle = jest.fn();
    render(<FloatingChatToggle isExpanded={false} onToggle={onToggle} />);

    await user.click(screen.getByRole("button"));

    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it("shows unread count when greater than 0", () => {
    const onToggle = jest.fn();
    render(
      <FloatingChatToggle isExpanded={false} onToggle={onToggle} unreadCount={5} />
    );

    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("shows 9+ when unread count exceeds 9", () => {
    const onToggle = jest.fn();
    render(
      <FloatingChatToggle isExpanded={false} onToggle={onToggle} unreadCount={15} />
    );

    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("does not show badge when unread count is 0", () => {
    const onToggle = jest.fn();
    render(
      <FloatingChatToggle isExpanded={false} onToggle={onToggle} unreadCount={0} />
    );

    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
