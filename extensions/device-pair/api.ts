export {
  approveDevicePairing,
  clearDeviceBootstrapTokens,
  issueDeviceBootstrapToken,
  PAIRING_SETUP_BOOTSTRAP_PROFILE,
  listDevicePairing,
  revokeDeviceBootstrapToken,
  type DeviceBootstrapProfile,
} from "assistant/plugin-sdk/device-bootstrap";
export { definePluginEntry, type AssistantPluginApi } from "assistant/plugin-sdk/plugin-entry";
export {
  resolveGatewayBindUrl,
  resolveGatewayPort,
  resolveTailnetHostWithRunner,
} from "assistant/plugin-sdk/core";
export {
  resolvePreferredAssistantTmpDir,
  runPluginCommandWithTimeout,
} from "assistant/plugin-sdk/sandbox";
export { renderQrPngBase64 } from "./qr-image.js";
