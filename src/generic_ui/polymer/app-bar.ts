Polymer({
  back: function() {
    if (!this.disableback) {
      this.fire('go-back');
    }
  }
});
