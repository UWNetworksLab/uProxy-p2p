// Copyright (c) 2010 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview This is a simple template engine inspired by JsTemplates
 * optimized for i18n.
 *
 * It currently supports two handlers:
 *
 *   * i18n-content which sets the textContent of the element
 *
 *     <span i18n-content="myContent"></span>
 *     i18nTemplate.process(element, {'myContent': 'Content'});
 *
 *   * i18n-values is a list of attribute-value or property-value pairs.
 *     Properties are prefixed with a '.' and can contain nested properties.
 *
 *     <span i18n-values="title:myTitle;.style.fontSize:fontSize"></span>
 *     i18nTemplate.process(element, {
 *       'myTitle': 'Title',
 *       'fontSize': '13px'
 *     });
 */

var i18nTemplate = (function() {
  /**
   * This provides the handlers for the templating engine. The key is used as
   * the attribute name and the value is the function that gets called for every
   * single node that has this attribute.
   * @type {Object}
   */
  var handlers = {
    /**
     * This handler sets the textContent of the element.
     */
    'i18n-content': function(element, attributeValue, obj) {
      element.textContent = obj[attributeValue];
    },

    /**
     * This handler adds options to a select element.
     */
    'i18n-options': function(element, attributeValue, obj) {
      var options = obj[attributeValue];
      options.forEach(function(values) {
        var option = typeof values == 'string' ? new Option(values) :
            new Option(values[1], values[0]);
        element.appendChild(option);
      });
    },

    /**
     * This is used to set HTML attributes and DOM properties,. The syntax is:
     *   attributename:key;
     *   .domProperty:key;
     *   .nested.dom.property:key
     */
    'i18n-values': function(element, attributeValue, obj) {
      var parts = attributeValue.replace(/\s/g, '').split(/;/);
      for (var j = 0; j < parts.length; j++) {
        var a = parts[j].match(/^([^:]+):(.+)$/);
        if (a) {
          var propName = a[1];
          var propExpr = a[2];

          // Ignore missing properties
          if (propExpr in obj) {
            var value = obj[propExpr];
            if (propName.charAt(0) == '.') {
              var path = propName.slice(1).split('.');
              var object = element;
              while (object && path.length > 1) {
                object = object[path.shift()];
              }
              if (object) {
                object[path] = value;
                // In case we set innerHTML (ignoring others) we need to
                // recursively check the content
                if (path == 'innerHTML') {
                  process(element, obj);
                }
              }
            } else {
              element.setAttribute(propName, value);
            }
          } else {
            console.warn('i18n-values: Missing value for "' + propExpr + '"');
          }
        }
      }
    }
  };

  var attributeNames = [];
  for (var key in handlers) {
    attributeNames.push(key);
  }
  
  /**
   * Processes a DOM tree with the {@code obj} map.
   */
  function process(node, obj) {
    var selector = node.nodeName + ' /deep/ [' + 
        attributeNames.join('], ' + node.nodeName + ' /deep/ [') + ']';    
    var elements = node.querySelectorAll(selector);
    for (var element, i = 0; element = elements[i]; i++) {
      for (var j = 0; j < attributeNames.length; j++) {
        var name = attributeNames[j];
        var att = element.getAttribute(name);
        if (att != null) {
          handlers[name](element, att, obj);
        }
      }
    }
  }

  return {
    process: process
  };
})();
