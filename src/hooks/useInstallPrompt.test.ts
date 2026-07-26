import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInstallPrompt } from "./useInstallPrompt";

function fireBIP() {
  const e = new Event("beforeinstallprompt") as Event & {
    prompt: () => Promise<void>;
  };
  e.prompt = vi.fn().mockResolvedValue(undefined);
  act(() => window.dispatchEvent(e));
  return e;
}

describe("useInstallPrompt", () => {
  it("canInstall=false ban đầu", () => {
    act(() => window.dispatchEvent(new Event("appinstalled"))); // reset store
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);
  });

  it("beforeinstallprompt -> canInstall=true; promptInstall gọi prompt() rồi tiêu thụ", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const e = fireBIP();
    expect(result.current.canInstall).toBe(true);
    await act(async () => {
      await result.current.promptInstall();
    });
    expect(e.prompt).toHaveBeenCalledOnce();
    expect(result.current.canInstall).toBe(false);
  });

  it("appinstalled -> canInstall=false", () => {
    const { result } = renderHook(() => useInstallPrompt());
    fireBIP();
    expect(result.current.canInstall).toBe(true);
    act(() => window.dispatchEvent(new Event("appinstalled")));
    expect(result.current.canInstall).toBe(false);
  });
});
