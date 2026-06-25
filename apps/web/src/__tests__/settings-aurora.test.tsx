import { render, screen } from "@testing-library/react";
import SettingsPage from "@/app/trips/settings/page";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "a@b.com", email_notifications_enabled: true },
    isLoading: false,
    refreshUser: jest.fn(),
  }),
}));
jest.mock("@/lib/api", () => ({ api: { users: { updatePreferences: jest.fn() } } }));

describe("Settings (Aurora)", () => {
  it("shows Email (on) and SMS (off) toggles and no Trip members section", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    const email = screen.getByRole("switch", { name: /email/i });
    expect(email).toBeChecked();
    const sms = screen.getByRole("switch", { name: /sms/i });
    expect(sms).not.toBeChecked();
    expect(sms).toBeDisabled();
    expect(screen.queryByText(/trip members/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sharing/i)).not.toBeInTheDocument();
  });
});
