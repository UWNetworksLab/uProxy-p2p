This is the OAuth 2.0 library for Chrome Extensions. It's available on
both [github][] and on [google code][].

[Sample extensions][samples] that use this library can be found in this same
distribution, but please note that you will need to run the
`cp-oauth2.sh` script inside the `samples` directory to get these
samples to work.

# Thanks, contributors!

Many thanks to [neocotic@](https://github.com/neocotic) and other
contributors for their great work in keeping this library up-to-date.

# How to use this library

Register your application with an OAuth 2.0 endpoint that you'd like to
use. If it's a Google API you're calling, go to the [Google APIs][gapi]
page, create your application and note your client ID and client secret.
For more info on this, check out the [Google OAuth 2.0][goauth2] docs.
When you setup your application, you will be asked to provide redirect
URI(s). Please provide the URI that corresponds to the service you're
using.

Here's a table that will come in handy:

<table id="impls">
  <tr>
    <th>Adapter</th>
    <th>Redirect URI</th>
    <th>Access Token URI</th>
  </tr>
  <tr>
    <td>google</td>
    <td>http://www.google.com/robots.txt</td>
    <td>https://accounts.google.com/o/oauth2/token</td>
  </tr>
  <tr>
    <td>facebook</td>
    <td>http://www.facebook.com/robots.txt</td>
    <td>https://graph.facebook.com/oauth/access_token</td>
  </tr>
  <tr>
    <td>github</td>
    <td>https://github.com/robots.txt</td>
    <td>https://github.com/login/oauth/access_token</td>
  </tr>
  <tr>
    <td>bitly</td>
    <td>http://bitly.com/robots.txt</td>
    <td>https://api-ssl.bitly.com/oauth/access_token</td>
  </tr>
</table>

#### Step 1: Copy library

You will need to copy the [oauth2 library][oauth2crx] into your chrome
extension root into a directory called `oauth2`.

#### Step 2: Inject content script

Then you need to modify your manifest.json file to include a content
script at the redirect URL used by the Google adapter. The "matches"
redirect URI can be looked up in the table above:

    "content_scripts": [
      {
        "matches": ["http://www.google.com/robots.txt*"],
        "js": ["oauth2/oauth2_inject.js"],
        "run_at": "document_start"
      }
    ],

#### Step 3: Allow access token URL

Also, you will need to add a permission to Google's access token
granting URL, since the library will do an XHR against it. The access
token URI can be looked up in the table above as well.

    "permissions": [
      "https://accounts.google.com/o/oauth2/token"
    ]

#### Step 4: Include the OAuth 2.0 library

Next, in your extension's code, you should include the OAuth 2.0
library:

    <script src="/oauth2/oauth2.js"></script>

#### Step 5: Configure the OAuth 2.0 endpoint

And configure your OAuth 2 connection by providing clientId,
clientSecret and apiScopes from the registration page. The authorize()
method may create a new popup window for the user to grant your
extension access to the OAuth2 endpoint.

    var googleAuth = new OAuth2('google', {
      client_id: '17755888930840',
      client_secret: 'b4a5741bd3d6de6ac591c7b0e279c9f',
      api_scope: 'https://www.googleapis.com/auth/tasks'
    });

    googleAuth.authorize(function() {
      // Ready for action, can now make requests with
      googleAuth.getAccessToken()
    });

#### Step 6: Use the access token

Now that your user has an access token via `auth.getAccessToken()`, you
can request protected data by adding the accessToken as a request header

    xhr.setRequestHeader('Authorization', 'OAuth ' + myAuth.getAccessToken())

or by passing it as part of the URL (depending on your particular impl):

    myUrl + '?oauth_token=' + myAuth.getAccessToken();

**Note**: if you have multiple OAuth 2.0 endpoints that you would like
to authorize with, you can do that too! Just inject content scripts and
add permissions for all of the providers you would like to authorize
with.

For more information about this library, please see this [blog
post][blog].


[gapi]: https://code.google.com/apis/console/
[goauth2]: http://code.google.com/apis/accounts/docs/OAuth2.html
[oauth crx]: http://code.google.com/chrome/extensions/tut_oauth.html
[oauth2crx]: https://github.com/borismus/oauth2-extensions/tree/master/lib

[github]: https://github.com/borismus/oauth2-extensions/
[google code]: http://code.google.com/p/oauth2-extensions/
[samples]: https://github.com/borismus/oauth2-extensions/samples
[blog]: http://smus.com/oauth2-chrome-extensions
