
// Interface definition for cordova-plugin-background-webview
interface BackgroundWebView {
  start(jsPath: string) : Promise<void>;
  stop(): Promise<void>;
}

interface Window {
  backgroundWebView: BackgroundWebView;
}
