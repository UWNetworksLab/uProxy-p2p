/// <reference path='facebook_auth.ts' />
/// <reference path='google_auth.ts' />

// TODO: refactor this code so that it is the same in Firefox and Chrome
class OAuth {
  private facebookAuth_ :FacebookAuth;
  private googleAuth_ :GoogleAuth;

  constructor() {
    this.googleAuth_ = new GoogleAuth();
    this.facebookAuth_ = new FacebookAuth();
  }

  public getCredentials(network :string) {
    if (network === 'Google') {
      this.googleAuth_.login();
    } else if (network === 'Facebook') {
      this.facebookAuth_.login();
    }
  }
}
