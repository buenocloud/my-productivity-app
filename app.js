/************************************************
 * app.js
 ************************************************/
const express = require('express');
const session = require('express-session');
const { Issuer, generators } = require('openid-client');

const app = express();

// This will store our openid-client "Client" object once we discover it
let client;

// 1) Initialize the OIDC client
async function initializeClient() {
  // Replace with your region and user pool ID
  const issuer = await Issuer.discover('https://cognito-idp.us-east-1.amazonaws.com/us-east-1_GM80ZmPsP');
  
  // Create a client based on your app client settings
  client = new issuer.Client({
    client_id: '5v662co4b8e6mhj1mevv4kcam5',
    client_secret: '111ufjsqanhlrm0d1089h0ohd3mgkb0t9dhkj76s3o2qkm5i0tgt',
    redirect_uris: ['https://d84l1y8p4kdic.cloudfront.net'], // your callback
    response_types: ['code'],
  });
}

// Kick off the initialization
initializeClient().catch(console.error);

// 2) Configure the session middleware
app.use(session({
  secret: 'some secret',
  resave: false,
  saveUninitialized: false
}));

// 3) Add a middleware to check authentication
const checkAuth = (req, res, next) => {
  if (!req.session.userInfo) {
    req.isAuthenticated = false;
  } else {
    req.isAuthenticated = true;
  }
  next();
};

// 4) Serve EJS views
app.set('view engine', 'ejs');

// 5) Home route (uses checkAuth)
app.get('/', checkAuth, (req, res) => {
  res.render('home', {
    isAuthenticated: req.isAuthenticated,
    userInfo: req.session.userInfo
  });
});

// 6) Login route -> redirect user to Cognito-hosted UI
app.get('/login', (req, res) => {
  const nonce = generators.nonce();
  const state = generators.state();

  // store in session to verify upon callback
  req.session.nonce = nonce;
  req.session.state = state;

  const authUrl = client.authorizationUrl({
    scope: 'phone openid email', // or whichever scopes you want
    state: state,
    nonce: nonce
  });

  res.redirect(authUrl);
});

// Helper function to parse path from a full URL
function getPathFromURL(urlString) {
  try {
    const url = new URL(urlString);
    return url.pathname;
  } catch (error) {
    console.error('Invalid URL:', error);
    return null;
  }
}

// 7) Callback route (the redirect URI)
app.get(getPathFromURL('https://d84l1y8p4kdic.cloudfront.net'), async (req, res) => {
  try {
    // parse the query params that Cognito sends back
    const params = client.callbackParams(req);
    
    // complete the OIDC flow with the callback
    const tokenSet = await client.callback(
      'https://d84l1y8p4kdic.cloudfront.net',
      params,
      {
        nonce: req.session.nonce,
        state: req.session.state
      }
    );

    // fetch user info from ID token or Access token
    const userInfo = await client.userinfo(tokenSet.access_token);
    
    // store in session
    req.session.userInfo = userInfo;

    // redirect to home
    res.redirect('/');
  } catch (err) {
    console.error('Callback error:', err);
    res.redirect('/');
  }
});

// 8) Logout route
app.get('/logout', (req, res) => {
    req.session.destroy();
    const logoutUrl = `https://us-east-1gm80zmpsp.auth.us-east-1.amazoncognito.com/logout?client_id=5v662co4b8e6mhj1mevv4kcam5&logout_uri=<logout uri>`;
    res.redirect(logoutUrl);
});
  
// 9) Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Node server listening on port ${port}`);
});