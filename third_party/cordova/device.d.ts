
// Interface definition for cordova-plugin-device
interface Device {
  cordova: string;
  model: string;
  platform: string;
  uuid: string;
  version: string;
  manufacturer: string;
  isVirtual: boolean;
  serial: string;
}

interface Window {
  device: Device;
}
