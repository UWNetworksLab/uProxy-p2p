/// <reference path='../../../third_party/cordova/webintents.d.ts'/>		

class IntentInterceptor {
  private listeners: ((url: string) => void)[] = [];

  // Pass the launch Url. This will trigger for every listener you add.
  constructor(private launchUrl: string) {}

  public addIntentListener(listener: (url:string) => void): void {
    this.listeners.push(listener);
    if (this.launchUrl) {
      listener(this.launchUrl);
    }
  }

  public fireIntent(url: string) {
    if (!url) {
      return;
    }
    console.debug(`Intent triggered: ${url}`);
    for (let listener of this.listeners) {
      listener(url);
    }
  }
}

let intentInterceptorPromise: Promise<IntentInterceptor> = new Promise((resolve, reject) => {
  // Need to wait for the Cordova plugins to be loaded. 
  window.top.document.addEventListener('deviceready', () => {
    if (!window.top.webintent) {
      reject('window.top.webintent not found (Not running on Android?)');
      return;
    }
    window.top.webintent.getUri((launchUrl) => {
      let intentInterceptor = new IntentInterceptor(launchUrl);
      let callback = intentInterceptor.fireIntent.bind(intentInterceptor);
      window.top.webintent.onNewIntent(callback);
      resolve(intentInterceptor);
    });
  });
});

export function GetGlobalIntentInterceptor() {
  return intentInterceptorPromise;
}
