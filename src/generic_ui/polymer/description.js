Polymer({
  description: 'My computer',
  update: function() {
    console.log('updating description to ' + this.description);
    // TODO(keroserene): Actually check that the description update propogates
    // through.
    core.updateDescription(this.description);
  }
});
