import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import SettingsPage from "./page";
import { api } from "../../../lib/api";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockUseAuth = jest.fn();
jest.mock("../../../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("../../../lib/api", () => ({
  api: { users: { updatePreferences: jest.fn() } },
}));

const mockUpdate = api.users.updatePreferences as jest.Mock;
const mockRefreshUser = jest.fn();

function mockUser(emailEnabled: boolean) {
  mockUseAuth.mockReturnValue({
    user: { id: "1", email: "a@b.com", email_notifications_enabled: emailEnabled },
    isLoading: false,
    refreshUser: mockRefreshUser,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdate.mockResolvedValue({
    id: "1",
    email: "a@b.com",
    email_notifications_enabled: false,
  });
});

it("reflects the current preference state", () => {
  mockUser(true);
  render(<SettingsPage />);
  expect(screen.getByRole("switch", { name: /email notifications/i })).toBeChecked();
});

it("disables the toggle and shows a loading shell while auth loads", () => {
  mockUseAuth.mockReturnValue({ user: null, isLoading: true, refreshUser: mockRefreshUser });
  render(<SettingsPage />);
  expect(screen.queryByRole("switch")).not.toBeInTheDocument();
});

it("calls the API and shows a success toast when toggled off", async () => {
  const user = userEvent.setup();
  mockUser(true);
  render(<SettingsPage />);

  await user.click(screen.getByRole("switch", { name: /email notifications/i }));

  await waitFor(() => {
    expect(mockUpdate).toHaveBeenCalledWith(false);
  });
  expect(mockRefreshUser).toHaveBeenCalled();
  expect(toast.success).toHaveBeenCalled();
});

it("shows an error toast when the update fails", async () => {
  const user = userEvent.setup();
  mockUser(false);
  mockUpdate.mockRejectedValueOnce(new Error("boom"));
  render(<SettingsPage />);

  await user.click(screen.getByRole("switch", { name: /email notifications/i }));

  await waitFor(() => {
    expect(toast.error).toHaveBeenCalled();
  });
});

it("navigates back to the dashboard", async () => {
  const user = userEvent.setup();
  mockUser(true);
  render(<SettingsPage />);

  await user.click(screen.getByRole("button", { name: /back/i }));
  expect(mockPush).toHaveBeenCalledWith("/trips");
});
