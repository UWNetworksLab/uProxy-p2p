/// <reference path='../../interfaces/ui-polymer.d.ts' />

Polymer({
  hideForSearch: function(name, query) {
    if (query.length === 0) {
      return false;
    }
    return name.toLowerCase().indexOf(query.toLowerCase()) === -1;
  }
});
