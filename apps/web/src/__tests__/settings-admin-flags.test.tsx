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
const mockSettingsList = jest.fn();
const mockSettingsSet = jest.fn();
jest.mock("@/lib/api", () => ({
  api: {
    users: { updatePreferences: jest.fn() },
    featureFlags: {
      list: (...args: unknown[]) => mockList(...args),
      set: (...args: unknown[]) => mockSet(...args),
    },
    appSettings: {
      list: (...args: unknown[]) => mockSettingsList(...args),
      set: (...args: unknown[]) => mockSettingsSet(...args),
    },
  },
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const FLAGS = [
  {
    name: "beta_optimizer",
    description: "Enable the flexible-date optimizer (beta).",
    enabled: false,
  },
  {
    name: "email_notifications",
    description: "Send daily price-drop email digests to users.",
    enabled: true,
  },
];

const SETTINGS = [
  {
    name: "flight_provider",
    description: "Which provider serves flight searches (hotels stay on Skiplagged).",
    value: "skiplagged",
    allowed_values: ["skiplagged", "kiwi", "fast_flights"],
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
    mockSettingsList.mockResolvedValue({ settings: SETTINGS });
  });

  it("is hidden for non-admin users", () => {
    authAs(false);
    render(<SettingsPage />);
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    expect(mockList).not.toHaveBeenCalled();
    expect(mockSettingsList).not.toHaveBeenCalled();
  });

  it("lists flags with humanized labels for admin users", async () => {
    authAs(true);
    render(<SettingsPage />);
    expect(await screen.findByText("Admin")).toBeInTheDocument();
    expect(await screen.findByText("Beta optimizer")).toBeInTheDocument();
    const optimizer = screen.getByRole("switch", { name: "Beta optimizer flag" });
    expect(optimizer).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Email notifications flag" })).toBeChecked();
  });

  it("toggles a flag and reflects the server response", async () => {
    authAs(true);
    mockSet.mockResolvedValue({
      name: "beta_optimizer",
      description: FLAGS[0].description,
      enabled: true,
    });
    render(<SettingsPage />);

    const optimizer = await screen.findByRole("switch", { name: "Beta optimizer flag" });
    await userEvent.click(optimizer);

    expect(mockSet).toHaveBeenCalledWith("beta_optimizer", true);
    await waitFor(() =>
      expect(screen.getByRole("switch", { name: "Beta optimizer flag" })).toBeChecked(),
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

    const optimizer = await screen.findByRole("switch", { name: "Beta optimizer flag" });
    await userEvent.click(optimizer);

    await waitFor(() => expect(mockSet).toHaveBeenCalled());
    expect(screen.getByRole("switch", { name: "Beta optimizer flag" })).not.toBeChecked();
  });
});

describe("Settings flight-provider switch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockList.mockResolvedValue({ flags: FLAGS });
    mockSettingsList.mockResolvedValue({ settings: SETTINGS });
  });

  it("renders a three-way switch with the active provider selected", async () => {
    authAs(true);
    render(<SettingsPage />);

    expect(await screen.findByText("Flight provider")).toBeInTheDocument();
    const group = screen.getByRole("radiogroup", { name: "Flight provider" });
    expect(group).toBeInTheDocument();

    const skiplagged = screen.getByRole("radio", { name: "Skiplagged" });
    const kiwi = screen.getByRole("radio", { name: "Kiwi" });
    const fastFlights = screen.getByRole("radio", { name: "Fast Flights" });
    expect(skiplagged).toHaveAttribute("aria-checked", "true");
    expect(kiwi).toHaveAttribute("aria-checked", "false");
    expect(fastFlights).toHaveAttribute("aria-checked", "false");
  });

  it("selects a new provider and reflects the server response", async () => {
    authAs(true);
    mockSettingsSet.mockResolvedValue({
      ...SETTINGS[0],
      value: "fast_flights",
    });
    render(<SettingsPage />);

    const fastFlights = await screen.findByRole("radio", { name: "Fast Flights" });
    await userEvent.click(fastFlights);

    expect(mockSettingsSet).toHaveBeenCalledWith("flight_provider", "fast_flights");
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "Fast Flights" })).toHaveAttribute(
        "aria-checked",
        "true",
      ),
    );
    expect(screen.getByRole("radio", { name: "Skiplagged" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("does not call the API when clicking the already-active provider", async () => {
    authAs(true);
    render(<SettingsPage />);

    const skiplagged = await screen.findByRole("radio", { name: "Skiplagged" });
    await userEvent.click(skiplagged);

    expect(mockSettingsSet).not.toHaveBeenCalled();
  });

  it("keeps prior selection and toasts on a failed update", async () => {
    authAs(true);
    mockSettingsSet.mockRejectedValue(new Error("500"));
    render(<SettingsPage />);

    const kiwi = await screen.findByRole("radio", { name: "Kiwi" });
    await userEvent.click(kiwi);

    await waitFor(() => expect(mockSettingsSet).toHaveBeenCalled());
    expect(screen.getByRole("radio", { name: "Skiplagged" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Kiwi" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("shows an error state when the settings list fails to load", async () => {
    authAs(true);
    mockSettingsList.mockRejectedValue(new Error("403"));
    render(<SettingsPage />);
    expect(await screen.findByText(/failed to load feature flags/i)).toBeInTheDocument();
  });
});

describe("Settings page scroll container", () => {
  it("wraps content in an internal scroll region (body is overflow:hidden)", () => {
    authAs(true);
    mockList.mockResolvedValue({ flags: FLAGS });
    mockSettingsList.mockResolvedValue({ settings: SETTINGS });
    render(<SettingsPage />);
    const region = screen.getByTestId("settings-scroll-region");
    expect(region).toHaveClass("overflow-y-auto", "flex-1", "min-h-0");
  });
});
