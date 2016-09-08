    class StackPanel {
      // Takes the element that will be the root for this panel.
      constructor(root_node) {
        this.root_node_ = root_node;
        this.wrapped_views_ = [];
      }
      empty() {
        return this.wrapped_views_.length === 0;
      }
      pushView(view) {
        // Hide top view.
        if (!this.empty()) {
          let top = this.topView_();
          top.style.display = 'none';
        }
        // Add new view.
        let wrapped_view = document.createElement('div');
        wrapped_view.appendChild(view);
        this.wrapped_views_.push(wrapped_view);
        this.root_node_.appendChild(wrapped_view);
      }
      popView() {
        this.popViews(1);
      }
      popViews(count) {
        for (let i = 0; i < count && !this.empty(); i += 1) {
          this.wrapped_views_.pop().remove();
        }
        if (!this.empty()) {
          this.topView_().style.display = '';
        }
      }
      topView_() {
        if (this.empty()) { return null; }
        return this.wrapped_views_[this.wrapped_views_.length - 1];
      }
  }
    