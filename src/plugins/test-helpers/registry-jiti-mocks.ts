import { vi } from "vitest";

const registryJitiMocks = vi.hoisted(() => ({
  createJiti: vi.fn(),
  discoverZhushouPlugins: vi.fn(),
  loadPluginManifestRegistry: vi.fn(),
}));

vi.mock("jiti", () => ({
  createJiti: (...args: Parameters<typeof registryJitiMocks.createJiti>) =>
    registryJitiMocks.createJiti(...args),
}));

vi.mock("../discovery.js", () => ({
  discoverZhushouPlugins: (
    ...args: Parameters<typeof registryJitiMocks.discoverZhushouPlugins>
  ) => registryJitiMocks.discoverZhushouPlugins(...args),
}));

vi.mock("../manifest-registry.js", () => ({
  loadPluginManifestRegistry: (
    ...args: Parameters<typeof registryJitiMocks.loadPluginManifestRegistry>
  ) => registryJitiMocks.loadPluginManifestRegistry(...args),
}));

export function resetRegistryJitiMocks(): void {
  registryJitiMocks.createJiti.mockReset();
  registryJitiMocks.discoverZhushouPlugins.mockReset();
  registryJitiMocks.loadPluginManifestRegistry.mockReset();
  registryJitiMocks.discoverZhushouPlugins.mockReturnValue({
    candidates: [],
    diagnostics: [],
  });
  registryJitiMocks.createJiti.mockImplementation(
    (_modulePath: string, _options?: Record<string, unknown>) => () => ({ default: {} }),
  );
}

export function getRegistryJitiMocks() {
  return registryJitiMocks;
}
