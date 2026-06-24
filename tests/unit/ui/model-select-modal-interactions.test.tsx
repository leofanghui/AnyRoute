// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const { default: ModelSelectModal } = await import("@/shared/components/ModelSelectModal");

const containers: HTMLElement[] = [];

async function renderModal(props: Partial<React.ComponentProps<typeof ModelSelectModal>> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const root = createRoot(container);
  await act(async () => {
    root.render(
      <ModelSelectModal
        isOpen={true}
        onClose={() => {}}
        onSelect={() => {}}
        showCombos={false}
        activeProviders={[]}
        alwaysIncludeProviders={["opencode"]}
        {...props}
      />
    );
  });

  await act(async () => {});
  return container;
}

function findButton(container: HTMLElement, label: string) {
  return Array.from(container.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(label)
  ) as HTMLButtonElement | undefined;
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/provider-nodes") {
        return { ok: true, json: async () => ({ nodes: [] }) };
      }
      if (url === "/api/provider-models") {
        return { ok: true, json: async () => ({ models: {} }) };
      }
      if (url === "/api/combos") {
        return { ok: true, json: async () => ({ combos: [] }) };
      }
      return { ok: true, json: async () => ({}) };
    })
  );
});

afterEach(() => {
  while (containers.length > 0) {
    containers.pop()?.remove();
  }
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("ModelSelectModal interactions", () => {
  it("keeps default single-select auto-close behavior", async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const container = await renderModal({ onSelect, onClose });
    const modelButton = findButton(container, "Big Pickle");

    expect(modelButton).toBeDefined();
    await act(async () => {
      modelButton!.click();
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the modal open and renders Done when keepOpenOnSelect is enabled", async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const container = await renderModal({ onSelect, onClose, keepOpenOnSelect: true });
    const modelButton = findButton(container, "Big Pickle");

    expect(modelButton).toBeDefined();
    expect(findButton(container, "done")).toBeDefined();

    await act(async () => {
      modelButton!.click();
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      findButton(container, "done")!.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onDeselect instead of onSelect for already-added models", async () => {
    const probeSelect = vi.fn();
    const probeContainer = await renderModal({ onSelect: probeSelect, keepOpenOnSelect: true });

    await act(async () => {
      findButton(probeContainer, "Big Pickle")!.click();
    });

    const capturedValue = probeSelect.mock.calls[0][0].value as string;
    const onSelect = vi.fn();
    const onDeselect = vi.fn();
    const container = await renderModal({
      onSelect,
      onDeselect,
      keepOpenOnSelect: true,
      addedModelValues: [capturedValue],
    });

    const addedButton = findButton(container, "Big Pickle");
    expect(addedButton?.textContent).toContain("✓");

    await act(async () => {
      addedButton!.click();
    });

    expect(onDeselect).toHaveBeenCalledTimes(1);
    expect(onDeselect.mock.calls[0][0]).toMatchObject({ value: capturedValue });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not duplicate Done footer when multiSelect owns the footer", async () => {
    const container = await renderModal({ keepOpenOnSelect: true, multiSelect: true });
    const doneButtons = Array.from(container.querySelectorAll("button")).filter(
      (button) => button.textContent?.trim() === "done"
    );

    expect(doneButtons.length).toBe(1);
  });
});
