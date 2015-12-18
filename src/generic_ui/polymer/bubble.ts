Polymer({
  active: false,
  close: function() {
    this.fire('closed');
  },
  isHidden: function(element :HTMLElement) {
    // an element is considered to be hidden if it is not displayed or any of
    // its parents are not displayed
    if (window.getComputedStyle(element).display === 'none') {
      return true;
    }

    if (!element.parentElement) {
      return false;
    }

    return this.isHidden(element.parentElement);
  },
  doReposition: function() {
    if (!this.active) {
      // if the current element is not active, put off repositioning it until
      // it is actually active (this function will be called then)
      return;
    }

    // TODO The below code is in place to deal with the fact that nearly all
    // the elements we use are initially in the DOM but hidden until the user
    // switches to their view.  In this state, they do not have a well-defined
    // position, which causes us to be unable to correctly position the element.
    // In the future, it would be nice to move to a model where elements are
    // not created until we want to show them, this chunk of code can be
    // removed once that happens.
    var prev = this.previousElementSibling;
    if (!prev || this.isHidden(prev)) {
      // This handles the case where the bubble is active (should be displayed)
      // but it would actually not be shown since its target is not visible.
      // We will get a callback to this function once from the element becoming
      // active and, if the DOM has not been fully constructed at that point,
      // a hidden attribute may not yet have been assigned to the parent and we
      // will remove the hidden attribute from the bubble.  This ensures that
      // we will re-hide the bubble when we actually get the domReady event.
      this.setAttribute('hidden', '');

      this.async(this.doReposition, null, 500);
      return;
    }

    this.reposition();
  },
  reposition: function() {
    var prev = this.previousElementSibling;
    if (!prev) {
      // this handles the case where the element has been removed from the DOM
      // before a callback
      return;
    }

    var prevCntr = prev.offsetLeft + prev.offsetWidth / 2;
    // use width of target if the parent is not an element
    var parentWidth = prev.offsetWidth;
    if (this.parentElement) {
      parentWidth = this.parentElement.offsetWidth;
    }

    this.style.top = (prev.offsetHeight + prev.offsetTop) + 'px';

    /* width should be half of the parent width, between min and max */
    var width = 0;
    if (parentWidth < 340) {
      width = (parentWidth - 40);
    } else if (parentWidth < 600) {
      width = 300;
    } else if (parentWidth < 800) {
      width = parentWidth / 2;
    } else {
      width = 400;
    }
    this.style.width = width + 'px';

    if (prevCntr * 3 < parentWidth) {
      /* center is in the left third of the screen, arrow on left side */
      this.style.left = (prevCntr - 10) + 'px';

      this.$.arrow.style.left = '0px';
      this.$.arrow.style['margin-left'] = '0';
    } else if (prevCntr * 3 / 2 < parentWidth) {
      /* center is in the middle third of the screen, arrow in middle */
      this.style.left = (prevCntr - width / 2) + 'px';

      this.$.arrow.style.left = '50%';
      this.$.arrow.style['margin-left'] = '-10px';
    } else {
      /* center is in the right third of the screen, arrow on right side */
      this.style.left = (prevCntr - (width - 10)) + 'px';

      this.$.arrow.style.right = '0px';
      this.$.arrow.style['margin-left'] = '0';
    }

    // once we have the correct positioning for the element, show it
    this.removeAttribute('hidden');
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
  },
  activeChanged: function(old :boolean, val :boolean) {
    if (val) {
      // we will un-hide the element at the end of repositioning
      this.async(() => {
        this.doReposition();
      });
    } else {
      this.setAttribute('hidden', '');
    }
  },
  ready: function() {
    this.model = ui_context.model;
  }
});
