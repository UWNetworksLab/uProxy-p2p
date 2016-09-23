Polymer({
  // Injected configuration
  publish: {
    selectedLanguage: null,
    languageList: []
  },
  msg: null,
  // Public methods
  onDone: function(handler) {
    this.addEventListener('done', handler);
  },
  onLanguageSelected: function(handler) {
    this.addEventListener('language-selected', function(event) {
      handler(event.detail);
    });
  },
  // Private methods
  selectedLanguageChanged(oldValue, newValue) {
    this.fireLanguageSelected_(this.selectedLanguage);
  },
  handleNext_: function(event) {
    this.fireLanguageSelected_(this.selectedLanguage);
    this.fireDone_();
  },
  fireLanguageSelected_: function(language) {
    console.log('Selected language ', language);
    this.fire('language-selected', language);
  },
  fireDone_: function() {
    this.fire('done');
  }
});