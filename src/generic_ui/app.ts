import * as stack_panel from './scripts/stack_panel';

declare class WelcomeView extends HTMLElement {
  languageList :{code:string, name:string}[];
  selectedLanguage :string;
  onLanguageSelected :(callback: (language :string) => void) => void;
  onDone :(callback :() => void) => void;
  msg: any;
};

declare class MetricsChoiceView extends HTMLElement {
  onBack :(callback :() => void) => void;
  onDone :(callback :() => void) => void;
  onMetricsChoiceMade : (callback :(choice :boolean) => void) => void;
  msg: any;
};

class Settings {
  constructor(public language = null as string, public isMetricsEnabled = false) {}
  setLanguage(language :string) :void {
    this.language = language;
  }
  enableMetrics(enabled :boolean) :void {
    this.isMetricsEnabled = enabled;
  }
}

function makeTranslator(language :string) {
  let messages : {[language: string] :{[msgId :string] :string}} = {
    ar: {
      BACK: 'عودة',
      NEXT: 'التالى',
      WELCOME: 'أهلا بك'
    },
    en: {
      BACK: 'Back',
      NEXT: 'Next',
      METRICS_CHOICE_TITLE: 'Metrics Choice',
      METRICS_OPT_IN: 'Opt-In',
      METRICS_OPT_OUT: 'Opt-Out',
      WELCOME: 'Welcome'
    },
    es: {
      BACK: 'Volver',
      NEXT: 'Proximo',
      WELCOME: 'Bienvenido'
    },
    zh: {
      BACK: '返回',
      NEXT: '下一个',
      WELCOME: '欢迎'
    }
  };
  return function(msgId :string) {
    if (!messages[language]) { return msgId; }
    return messages[language][msgId] || messages['en'][msgId] || msgId;
  };
}

function main() {
  let settings = new Settings();
  let stackPanel = new stack_panel.StackPanel(document.getElementById('root-panel'));
  let welcome_view = new WelcomeView();
  welcome_view.languageList = [
    {code: 'en', name: 'English'},
    {code: 'ar', name: 'Arabic'},
    {code: 'zh', name: 'Chinese'},
    {code: 'es', name: 'Spanish'}
  ];
  welcome_view.selectedLanguage = 'zh';
  welcome_view.onLanguageSelected((language :string) => {
    settings.setLanguage(language);
    welcome_view.msg = makeTranslator(language);
  });
  welcome_view.onDone(() => {
    let choice_view = new MetricsChoiceView();
    choice_view.msg = makeTranslator(settings.language);
    choice_view.onBack(() => { stackPanel.popView(); })
    choice_view.onMetricsChoiceMade((optIn) => {
      settings.enableMetrics(optIn);
    });
    choice_view.onDone(() => {
      stackPanel.popViews(2);
      stackPanel.pushView(document.createElement('uproxy-root'));
      console.log('Settings: ', settings);
    });
    stackPanel.pushView(choice_view);
  });
  stackPanel.pushView(welcome_view);
}

window.addEventListener('polymer-ready', main);