import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { useAuth } from "context/AuthContext";
import { fx } from "./fixtures";
import { renderWithProviders } from "./renderWithProviders";

function Probe(): ReactElement {
  const { user, loading } = useAuth();
  if (loading) return <p>đang tải</p>;
  return <p>{user ? `xin chào ${user.fullName}` : "khách"}</p>;
}

describe("renderWithProviders", () => {
  it("mặc định là khách khi /auth/me trả 401", async () => {
    renderWithProviders(<Probe />);
    await waitFor(() => expect(screen.getByText("khách")).toBeInTheDocument());
  });

  it("nạp sẵn user khi truyền opts.user", async () => {
    renderWithProviders(<Probe />, { user: fx.user });
    await waitFor(() =>
      expect(screen.getByText("xin chào Người Dùng")).toBeInTheDocument(),
    );
  });
});
