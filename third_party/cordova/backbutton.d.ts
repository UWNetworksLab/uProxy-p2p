interface Navigator {
  Backbutton: {
    goBack: (success: Function, failure: Function) => void;
    goHome: (success: Function, failure: Function) => void;
  }
}
