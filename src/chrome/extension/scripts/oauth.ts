class OAuth {
	constructor() {
  }

  public getCredentials(network :string) {
		if (network === 'google') {
			var googleAuth = new GoogleAuth();		
      googleAuth.login();
    }
  }
}
