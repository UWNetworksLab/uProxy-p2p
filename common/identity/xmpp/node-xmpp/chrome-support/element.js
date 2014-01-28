Element.prototype.write = function(writer) {
    var tag = "<" + this.name;
    for(var k in this.attrs) {
        var v = this.attrs[k];
        if (v || v === '' || v === 0) {
          tag += " " + k + "=\"";
          if (typeof v != 'string')
            v = v.toString();
          tag += escapeXml(v) + "\"";
        }
    }
    if (this.children.length == 0) {
        tag += "/>";
        writer(tag);
    } else {
        tag += ">";
        writer(tag);
        for(var i = 0; i < this.children.length; i++) {
          var child = this.children[i];
          /* Skip null/undefined */
          if (child || child === 0) {
            if (child.write)
            child.write(writer);
          else if (typeof child === 'string')
            writer(escapeXmlText(child));
          else if (child.toString)
            writer(escapeXmlText(child.toString()));
        }
      }
      writer("</" + this.name + ">");
    }
};
