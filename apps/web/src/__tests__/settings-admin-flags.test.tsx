import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsPage from "@/app/trips/settings/page";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const mockUseAuth = jest.fn();
jest.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockList = jest.fn();
const mockSet = jest.fn();
jest.mock("@/lib/api", () => ({
  api: {
    users: { updatePreferences: jest.fn() },
    featureFlags: {
      list: (...args: unknown[]) => mockList(...args),
      set: (...args: unknown[]) => mockSet(...args),
    },
  },
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const FLAGS = [
  {
    name: "kiwi_flights",
    description: "Use Kiwi.com as the flight search provider instead of Skiplagged.",
    enabled: false,
  },
  {
    name: "email_notifications",
    description: "Send daily price-drop email digests to users.",
    enabled: true,
  },
];

function authAs(isAdmin: boolean) {
  mockUseAuth.mockReturnValue({
    user: {
      id: "u1",
      email: "a@b.com",
      email_notifications_enabled: true,
      is_admin: isAdmin,
    },
    isLoading: false,
    refreshUser: jest.fn(),
  });
}

describe("Settings admin flags card", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockList.mockResolvedValue({ flags: FLAGS });
  });

  it("is hidden for non-admin users", () => {
    authAs(false);
    render(<SettingsPage />);
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    expect(mockList).not.toHaveBeenCalled();
  });

  it("lists flags with humanized labels for admin users", async () => {
    authAs(true);
    render(<SettingsPage />);
    expect(await screen.findByText("Admin")).toBeInTheDocument();
    expect(await screen.findByText("Kiwi flights")).toBeInTheDocument();
    const kiwi = screen.getByRole("switch", { name: "Kiwi flights flag" });
    expect(kiwi).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Email notifications flag" })).toBeChecked();
  });

  it("toggles a flag and reflects the server response", async () => {
    authAs(true);
    mockSet.mockResolvedValue({
      name: "kiwi_flights",
      description: FLAGS[0].description,
      enabled: true,
    });
    render(<SettingsPage />);

    const kiwi = await screen.findByRole("switch", { name: "Kiwi flights flag" });
    await userEvent.click(kiwi);

    expect(mockSet).toHaveBeenCalledWith("kiwi_flights", true);
    await waitFor(() =>
      expect(screen.getByRole("switch", { name: "Kiwi flights flag" })).toBeChecked(),
    );
  });

  it("shows an error state when the flag list fails to load", async () => {
    authAs(true);
    mockList.mockRejectedValue(new Error("403"));
    render(<SettingsPage />);
    expect(await screen.findByText(/failed to load feature flags/i)).toBeInTheDocument();
  });

  it("keeps prior state and toasts on a failed toggle", async () => {
    authAs(true);
    mockSet.mockRejectedValue(new Error("500"));
    render(<SettingsPage />);

    const kiwi = await screen.findByRole("switch", { name: "Kiwi flights flag" });
    await userEvent.click(kiwi);

    await waitFor(() => expect(mockSet).toHaveBeenCalled());
    expect(screen.getByRole("switch", { name: "Kiwi flights flag" })).not.toBeChecked();
  });
});
