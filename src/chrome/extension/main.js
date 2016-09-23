console.debug('Loading main.js');

define(['generic_ui/scripts/stack_panel'], function (stack_panel) {
  'use strict';
  class Settings {
    constructor() {
      this.language = null;
    }
    setLanguage(language) {
      this.language = language;
    }
    enableMetrics(enable) {
      this.enableMetrics = enable;
    }
  }

  class HomeViewUnwrapped extends HTMLElement {
    createdCallback() {
      this.innerHTML = '<h1>Home</h1>' +
        '<p><button>Get Access from Peer</button></p>' +
        '<p><button>Get Access from Cloud Proxy</button></p>' +
        '<p><button>Share Access</button></p>';
    }
  }
  const HomeView = document.registerElement('home-view', HomeViewUnwrapped);

  function makeTranslator(language) {
    let messages = {
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
    return function (msgId) {
      if (!messages[language]) { return msgId; }
      return messages[language][msgId] || messages['en'][msgId] || msgId;
    };
  }

  function main() {
    console.debug('Starting main()');

    let settings = new Settings();
    let stackPanel = new stack_panel.StackPanel(document.getElementById('root-panel'));
    let welcome_view = new WelcomeView();
    welcome_view.languageList = [
      { code: 'en', name: 'English' },
      { code: 'ar', name: 'Arabic' },
      { code: 'zh', name: 'Chinese' },
      { code: 'es', name: 'Spanish' }
    ];
    welcome_view.selectedLanguage = 'zh';
    welcome_view.onLanguageSelected((language) => {
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
        stackPanel.pushView(new HomeView());
        console.log('Settings: ', settings);
      });
      stackPanel.pushView(choice_view);
    });
    stackPanel.pushView(welcome_view);
  }

  return main;
});