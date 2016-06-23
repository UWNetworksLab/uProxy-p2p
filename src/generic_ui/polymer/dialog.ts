/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

// this class covers two different cases: trying to set the dialog to be
// offscreen and not having correct information on where the dialog should be
// positioned.  For the case where the dialog is being set to be offscreen
// (i.e. style.left < 0), this causes issues in later calculations for what the
// width of the element should end up being.  In cases where there is not
// enough information about the size of the dialog (i.e.
// sizingTarget.offsetWidth == 0), the DOM did not have a chance to redraw
// itself after switching to displaying the element and we are going to set a
// left position that is ridiculously far to the right (approximately at the
// center of the screen).  In this case, setting the position to be all the way
// at the left is probably not the exact desired behaviour (we probably want to
// be a few pixels over to the right), but it's not going to be noticeable by
// 99% of our users, only occurs on ititial startup, seems to only occur about
// 1/10 times, and is immediately fixed by closing and re-opening the panel.
Polymer({
  repositionTarget: function() {
    this.super(arguments);

    if (parseFloat(this.target.style.left) < 0 || !this.sizingTarget.offsetWidth) {
      this.target.style.left = '0px';
    }
  }
});




