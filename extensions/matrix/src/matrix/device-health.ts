export type MatrixManagedDeviceInfo = {
  deviceId: string;
  displayName: string | null;
  current: boolean;
};

export type MatrixDeviceHealthSummary = {
  currentDeviceId: string | null;
  staleAssistantDevices: MatrixManagedDeviceInfo[];
  currentAssistantDevices: MatrixManagedDeviceInfo[];
};

const ASSISTANT_DEVICE_NAME_PREFIX = "助手 ";

export function isAssistantManagedMatrixDevice(displayName: string | null | undefined): boolean {
  return displayName?.startsWith(ASSISTANT_DEVICE_NAME_PREFIX) === true;
}

export function summarizeMatrixDeviceHealth(
  devices: MatrixManagedDeviceInfo[],
): MatrixDeviceHealthSummary {
  const currentDeviceId = devices.find((device) => device.current)?.deviceId ?? null;
  const assistantDevices = devices.filter((device) =>
    isAssistantManagedMatrixDevice(device.displayName),
  );
  return {
    currentDeviceId,
    staleAssistantDevices: assistantDevices.filter((device) => !device.current),
    currentAssistantDevices: assistantDevices.filter((device) => device.current),
  };
}
