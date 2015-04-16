/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

Polymer({
  hideForSearch: function(name :string, query :string) {
    if (query.length === 0) {
      return false;
    }
    return name.toLowerCase().indexOf(query.toLowerCase()) === -1;
  }
});
