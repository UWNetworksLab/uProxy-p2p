export class StackPanel {
  private root_node_ :Node;
  private wrapped_views_ :HTMLElement[];

  // Takes the element that will be the root for this panel.
  constructor(root_node :Node) {
    this.root_node_ = root_node;
    this.wrapped_views_ = [];
  }

  public empty() :boolean {
    return this.wrapped_views_.length === 0;
  }

  public pushView(view :Node) :void {
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

  public popView() :void {
    this.popViews(1);
  }

  public popViews(count :number) :void {
    for (let i = 0; i < count && !this.empty(); i += 1) {
      this.wrapped_views_.pop().remove();
    }
    if (!this.empty()) {
      this.topView_().style.display = '';
    }
  }

  private topView_() :HTMLElement {
    if (this.empty()) { return null; }
    return this.wrapped_views_[this.wrapped_views_.length - 1];
  }
}
