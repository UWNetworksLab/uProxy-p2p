Polymer({
  color: '#12A391',
  back: function() {
    if (!this.disableback) {
      this.fire('go-back');
    }
  }
});
