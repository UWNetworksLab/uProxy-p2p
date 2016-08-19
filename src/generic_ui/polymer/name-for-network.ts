/// <reference path='./context.d.ts' />
require('polymer');

Polymer({
  isEmail: function(text :string) {
    /* regex from regular-expressions.info */
    return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i.test(text);
  }
});
