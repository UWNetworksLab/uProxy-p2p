/// <reference path='../../interfaces/ui-polymer.d.ts' />

Polymer({
  contacts: model.roster,
  ready: function() {
    console.log('initializing roster');
    // this.contacts.push({
      // name: 'alice',
      // description: 'just some laptop'
    // });
    // this.contacts.push({ name: 'bob' });
    // this.contacts.push({ name: 'charlie' });
    // this.contacts.push({ name: 'dave' });
    // this.contacts.push({ name: 'eve' });
  }, 
  searchQuery: '',   
  isSearching: function(query) {
    return query.length > 0;
  },
  matchesQuery: function(name, query) {
    return name.toLowerCase().indexOf(query.toLowerCase()) > -1;
  }
});
