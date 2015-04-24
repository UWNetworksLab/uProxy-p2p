/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

// we never want to set a position for the dialog that is off the screen, this
// ensures that the minimum values for left and top will always be >= 0
Polymer({
  repositionTarget: function() {
    this.super();

    if (parseFloat(this.target.style.left) < 0) {
      this.target.style.left = '0px';
    }

    if (parseFloat(this.target.style.top) < 0) {
      this.target.style.top = '0px';
    }
  }
});
