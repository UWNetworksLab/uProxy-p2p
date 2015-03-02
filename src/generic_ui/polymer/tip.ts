Polymer({
  close: function() {
    this.fire('closed');
    this.remove();
  },
  doReposition: function() {
    // TODO The below code is in place to deal with the fact that nearly all
    // the elements we use are initially in the DOM but hidden until the user
    // switches to their view.  In this state, they do not have a well-defined
    // position, which causes us to be unable to correctly position the elemnt.
    // In the future, it would be nice to move to a model where elements are
    // not created until we want to show them, this chunk of code can be
    // removed once that happens.

    var prev = this.previousSibling;
    if (prev.offsetLeft === 0 && prev.offsetTop === 0 && prev.offsetWidth === 0
        && prev.offsetHeight === 0) {
      this.async(this.doReposition, null, 500);
      return;
    }

    this.reposition();
  },
  reposition: function() {
    var prev = this.previousSibling;
    if (!prev) {
      /* we should only see this if a callback was pending when we destroyed the dom element */
      return;
    }

    var prevCntr = prev.offsetLeft + prev.offsetWidth / 2;
    var parentWidth = this.parentElement.offsetWidth;

    this.style.top = (prev.offsetHeight + prev.offsetTop) + 'px';

    /* width should be half of the parent width, between min and max */
    if (parentWidth < 340) {
      this.style.width = (parentWidth - 40) + 'px';
    } else if (parentWidth < 600) {
      this.style.width = '300px';
    } else if (parentWidth < 800) {
      this.style.width = (parentWidth / 2) + 'px';
    } else {
      this.style.width = '400px';
    }

    if (prevCntr * 3 < parentWidth) {
      /* center is in the left third of the screen, arrow on left side */
      this.style.left = (prevCntr - 10) + 'px';

      this.$.arrow.style.left = '0px';
      this.$.arrow.style['margin-left'] = '0';
    } else if (prevCntr * 3 / 2 < parentWidth) {
      /* center is in the middle third of the screen, arrow in middle */
      this.style.left = (prevCntr - this.offsetWidth / 2) + 'px';

      this.$.arrow.style.left = '50%';
      this.$.arrow.style['margin-left'] = '-10px';
    } else {
      /* center is in the right third of the screen, arrow on right side */
      this.style.left = (prevCntr - (this.offsetWidth - 10)) + 'px';

      this.$.arrow.style.right = '0px';
      this.$.arrow.style['margin-left'] = '0';
    }
  },
  attached: function() {
    this.repositionCallback = () => {
      /* pretty much just binding the function to this */
      this.doReposition();
    }
    window.addEventListener('resize', this.repositionCallback);
  },
  detached: function() {
    window.removeEventListener('resize', this.repositionCallback);
  },
  domReady: function() {
    this.doReposition();
  }
});
