    export class StackPanel {
      private wrapped_views_ = [] as HTMLElement[];
      // Takes the element that will be the root for this panel.
      constructor(private root_node_ :HTMLElement) { }

      empty() :boolean {
        return this.wrapped_views_.length === 0;
      }

      pushView(view :Node) :void {
        // Hide top view.
        if (!this.empty()) {
          let top = this.topView();
          top.style.display = 'none';
        }
        // Add new view.
        let wrapped_view = document.createElement('div');
        wrapped_view.appendChild(view);
        this.wrapped_views_.push(wrapped_view);
        this.root_node_.appendChild(wrapped_view);
      }

      popView() :void {
        this.popViews(1);
      }

      popViews(count :number) :void {
        for (let i = 0; i < count && !this.empty(); i += 1) {
          this.wrapped_views_.pop().remove();
        }
        if (!this.empty()) {
          this.topView().style.display = '';
        }
      }

      private topView() :HTMLElement {
        if (this.empty()) { return null; }
        return this.wrapped_views_[this.wrapped_views_.length - 1];
      }
  }
    