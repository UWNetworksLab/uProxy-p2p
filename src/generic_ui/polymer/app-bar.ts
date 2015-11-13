Polymer({
  color: '#009688',
  back: function() {
    if (!this.disableback) {
      this.fire('go-back');
    }
  }
});
