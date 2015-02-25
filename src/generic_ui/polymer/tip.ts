Polymer({
  close: function() {
    this.fire('closed');
    this.remove();
  },
  doReposition: function() {
    var prev = this.previousSibling;

    // TODO The below code is in place to deal with the fact that nearly all
    // the elements we use are initially in the DOM but hidden until the user
    // switches to their view.  In this state, they do not have a well-defined
    // position, which causes us to be unable to correctly position the elemnt.
    // In the future, it would be nice to move to a model where elements are
    // not created until we want to show them, this chunk of code can be
    // removed once that happens.
    if (prev.offsetLeft === 0 && prev.offsetTop === 0 && prev.offsetWidth === 0
        && prev.offsetHeight === 0) {
      setTimeout(() => {
        this.doReposition();
      }, 500);
      return;
    }
    this.reposition();

    // it takes a moment for some elements to fully render so try a second time
    setTimeout(() => {
      this.reposition();
    }, 100);
  },
  reposition: function() {
    var prev = this.previousSibling;
    if (!prev) {
      /* we should only see this if a callback was pending when we destroyed the dom element */
      return;
    }

    var prevCntr = prev.offsetLeft + prev.offsetWidth / 2;
    var prevHeight;

    this.style.top = (prev.offsetHeight + prev.offsetTop) + 'px';
    if (prevCntr < 200) {
      /* position our left edge near the center */
      this.style.width = '200px';
      this.style.left = (prevCntr - 10) + 'px';
      this.$.arrow.style.left = '0px';
    } else if (this.parentElement.offsetWidth - prevCntr < 200) {
      /* position our right edge near the center */
      this.style.width = '200px';
      this.style.left = (prevCntr - 190) + 'px';
      this.$.arrow.style.right = '0px';
    } else {
      this.style.left = (prevCntr - this.offsetWidth / 2) + 'px';

      this.$.arrow.style.left = '50%';
      this.$.arrow.style['margin-left'] = '-10px';
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
