import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Se mockea clientApp para no inicializar Firebase de verdad en jsdom y para poder
// mover el projectId entre casos. `vi.hoisted` porque vi.mock se iza por encima
// de las declaraciones del módulo.
const mocks = vi.hoisted(() => ({ projectId: "ayrsteel-2026" }));

vi.mock("@/lib/firebase/clientApp", () => ({
  get firebaseConfig() {
    return { projectId: mocks.projectId };
  },
}));

import { DevEnvironmentRibbon } from "./DevEnvironmentRibbon";

const RIBBON = "dev-environment-ribbon";

describe("DevEnvironmentRibbon", () => {
  beforeEach(() => cleanup());

  it("NO renderiza nada cuando el projectId es el de producción", () => {
    mocks.projectId = "ayrsteel-2026";
    const { container } = render(<DevEnvironmentRibbon />);
    expect(screen.queryByTestId(RIBBON)).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza la franja cuando el projectId es ayrsteel-test", () => {
    mocks.projectId = "ayrsteel-test";
    render(<DevEnvironmentRibbon />);
    const el = screen.getByTestId(RIBBON);
    expect(el).toBeTruthy();
    expect(el.textContent).toMatch(/modo desarrollo/i);
  });

  it("renderiza con projectId ausente (fail-loud)", () => {
    mocks.projectId = undefined as unknown as string;
    render(<DevEnvironmentRibbon />);
    expect(screen.getByTestId(RIBBON)).toBeTruthy();
  });

  it("no intercepta clicks: pointer-events none y aria-hidden", () => {
    mocks.projectId = "ayrsteel-test";
    render(<DevEnvironmentRibbon />);
    const el = screen.getByTestId(RIBBON);
    expect(el.style.pointerEvents).toBe("none");
    expect(el.getAttribute("aria-hidden")).toBe("true");
  });

  it("queda fijo arriba a la derecha y por encima de todo", () => {
    mocks.projectId = "ayrsteel-test";
    render(<DevEnvironmentRibbon />);
    const el = screen.getByTestId(RIBBON);
    expect(el.style.position).toBe("fixed");
    expect(el.style.top).toBe("0px");
    expect(el.style.right).toBe("0px");
    expect(Number(el.style.zIndex)).toBeGreaterThan(1000);
  });
});
