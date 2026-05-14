export type MatrixManagedDeviceInfo = {
  deviceId: string;
  displayName: string | null;
  current: boolean;
};

export type MatrixDeviceHealthSummary = {
  currentDeviceId: string | null;
  staleZhushouDevices: MatrixManagedDeviceInfo[];
  currentZhushouDevices: MatrixManagedDeviceInfo[];
};

const ZHUSHOU_DEVICE_NAME_PREFIX = "助手 ";

export function isZhushouManagedMatrixDevice(displayName: string | null | undefined): boolean {
  return displayName?.startsWith(ZHUSHOU_DEVICE_NAME_PREFIX) === true;
}

export function summarizeMatrixDeviceHealth(
  devices: MatrixManagedDeviceInfo[],
): MatrixDeviceHealthSummary {
  const currentDeviceId = devices.find((device) => device.current)?.deviceId ?? null;
  const zhushouDevices = devices.filter((device) =>
    isZhushouManagedMatrixDevice(device.displayName),
  );
  return {
    currentDeviceId,
    staleZhushouDevices: zhushouDevices.filter((device) => !device.current),
    currentZhushouDevices: zhushouDevices.filter((device) => device.current),
  };
}
