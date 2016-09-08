    class RootPanel {
      // Takes the element that will be the root for this panel.
      constructor(root_node) {
        this.root_node_ = root_node;
        this.content_node_ = null;
      }
      setContent(content_node){
        if (this.content_node_ !== null) {
          this.root_node_.removeChild(this.content_node_);
        }
        this.content_node_ = content_node;
        this.root_node_.appendChild(content_node);
      }
    }
    