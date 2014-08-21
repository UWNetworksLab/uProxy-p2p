Polymer({
  contacts: [],
  ready: function() {
    console.log('initializing roster');
    this.contacts.push({
      name: 'alice',
      description: 'just some laptop'
    });
    this.contacts.push({ name: 'bob' });
    this.contacts.push({ name: 'charlie' });
    this.contacts.push({ name: 'dave' });
    this.contacts.push({ name: 'eve' });
  }
});
