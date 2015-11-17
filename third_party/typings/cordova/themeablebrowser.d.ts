/// <reference path="cordova.d.ts" />

// See https://github.com/initialxy/cordova-plugin-themeablebrowser
// (or https://github.com/bemasc/cordova-plugin-themeablebrowser)
declare module cordova.ThemeableBrowser {
  var EVT_ERR: string;
  var EVT_WRN: string;

  interface Button {
    image?: string;
    imagePressed?: string;
    wwwImage?: string;
    wwwImagePressed?: string;
    wwwImageDensity?: number;
    align?: string;
    event?: string;
  }

  interface MenuItem {
    event: string;
    label: string;
  }

  interface Menu extends Button {
    items: MenuItem[];
  }

  interface Options {
    statusbar?: {color?:string;};
    toolbar?: {height?:number; color?:string;};
    title?: {color?:string; showPageTitle?:boolean;};
    backButton?: Button;
    forwardButton?: Button;
    closeButton?: Button;
    customButtons?: Button[];
    menu?: Menu;
    backButtonCanClose?: boolean;
  }

  var open: (url:string, target:string, options:Options) => Window;
}
