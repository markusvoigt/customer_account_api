#!/usr/bin/env node

/**
 * Shopify Customer Account API — Confidential Client OAuth Flow
 *
 * Prerequisites:
 *   1. Install the Headless or Hydrogen sales channel on your Shopify store.
 *   2. Note down CLIENT_ID, CLIENT_SECRET, and SHOP_ID from the channel settings.
 *   3. Whitelist a redirect URL in the Customer Account API settings
 *      (e.g. https://webhook.site/...).
 *
 * Usage:
 *   node customer_account_api.js authorize          — Generate the authorization URL
 *   node customer_account_api.js token <code>        — Exchange auth code for access token
 *   node customer_account_api.js refresh <token>     — Refresh an expired access token
 *   node customer_account_api.js query <token>       — Make a sample GraphQL query
 *   node customer_account_api.js logout <id_token>    — Log out a customer
 *
 * Docs: https://shopify.dev/docs/api/customer/latest
 */

// ─── CONFIGURATION — CHANGE THESE ──────────────────────────────────────────────
const CLIENT_ID = "shp_xyc";
const CLIENT_SECRET = "XXXX";
const SHOP_ID = "59717910550"; // Numeric shop ID, e.g. "80360603991"
const STOREFRONT_DOMAIN = "xxx.myshopify.com"; // e.g. "my-store.myshopify.com"
const REDIRECT_URL = ""; // (e.g. https://webhook.site/...).
// ────────────────────────────────────────────────────────────────────────────────

// ─── Helpers ────────────────────────────────────────────────────────────────────

function basicAuthHeader() {
  return `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`;
}

const COMMON_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded",
  Authorization: basicAuthHeader(),
};

/**
 * Discover the OpenID Connect configuration for the store.
 * Returns { authorization_endpoint, token_endpoint, ... }
 */
async function discoverEndpoints() {
  const url = `https://${STOREFRONT_DOMAIN}/.well-known/openid-configuration`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Discovery failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

// ─── Step 1: Authorization ──────────────────────────────────────────────────────

async function authorize() {
  const config = await discoverEndpoints();
  const authUrl = new URL(config.authorization_endpoint);

  authUrl.searchParams.set("scope", "openid email customer-account-api:full");
  authUrl.searchParams.set("client_id", CLIENT_ID);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", REDIRECT_URL);

  console.log("\n┌─────────────────────────────────────────────────────┐");
  console.log("│  Step 1 — Open this URL in a browser to log in:    │");
  console.log("└─────────────────────────────────────────────────────┘\n");
  console.log(authUrl.toString());
  console.log(
    "\nAfter logging in you will be redirected to your REDIRECT_URL." +
    "\nCopy the `code` query parameter and run:\n" +
    "\n  node customer_account_api.js token <CODE>\n"
  );
}

// ─── Step 2: Exchange authorization code for access token ───────────────────────

async function obtainAccessToken(code) {
  const config = await discoverEndpoints();

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URL,
    code,
  });

  const res = await fetch(config.token_endpoint, {
    method: "POST",
    headers: COMMON_HEADERS,
    body,
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("\n✗ Token request failed:\n", data);
    process.exit(1);
  }

  console.log("\n┌─────────────────────────────────────────────────────┐");
  console.log("│  Step 2 — Access token obtained successfully!       │");
  console.log("└─────────────────────────────────────────────────────┘\n");
  console.log("access_token :", data.access_token);
  console.log("refresh_token:", data.refresh_token);
  console.log("id_token     :", data.id_token);
  console.log("expires_in   :", data.expires_in, "seconds");
  console.log(
    "\nMake a sample query:\n" +
    "\n  node customer_account_api.js query <ACCESS_TOKEN>\n" +
    "\nRefresh later with:\n" +
    "\n  node customer_account_api.js refresh <REFRESH_TOKEN>\n"
  );

  return data;
}

// ─── Step 3 (optional): Refresh an expired access token ─────────────────────────

async function refreshAccessToken(refreshToken) {
  const config = await discoverEndpoints();

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URL,
    refresh_token: refreshToken,
  });

  const res = await fetch(config.token_endpoint, {
    method: "POST",
    headers: COMMON_HEADERS,
    body,
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("\n✗ Refresh request failed:\n", data);
    process.exit(1);
  }

  console.log("\n┌─────────────────────────────────────────────────────┐");
  console.log("│  Token refreshed successfully!                      │");
  console.log("└─────────────────────────────────────────────────────┘\n");
  console.log("access_token :", data.access_token);
  console.log("refresh_token:", data.refresh_token);
  console.log("expires_in   :", data.expires_in, "seconds");

  return data;
}

// ─── Step 4: Make a sample GraphQL query ────────────────────────────────────────

async function queryCustomerApi(accessToken) {
  const graphqlUrl = `https://shopify.com/${SHOP_ID}/account/customer/api/2025-04/graphql`;

  const query = `{
    customer {
      emailAddress {
        emailAddress
      }
      firstName
      lastName
    }
  }`;

  const res = await fetch(graphqlUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: accessToken,
    },
    body: JSON.stringify({ query }),
  });

  const data = await res.json();

  console.log("\n┌─────────────────────────────────────────────────────┐");
  console.log("│  Customer Account API Response                      │");
  console.log("└─────────────────────────────────────────────────────┘\n");
  console.dir(data, { depth: null });

  return data;
}

// ─── Step 5: Log out a customer ─────────────────────────────────────────────

async function logout(idToken) {
  const config = await discoverEndpoints();

  const logoutUrl = new URL(config.end_session_endpoint);
  logoutUrl.searchParams.set("id_token_hint", idToken);
  logoutUrl.searchParams.set("post_logout_redirect_uri", REDIRECT_URL);

  console.log("\n┌─────────────────────────────────────────────────────┐");
  console.log("│  Step 5 — Open this URL in a browser to log out:    │");
  console.log("└─────────────────────────────────────────────────────┘\n");
  console.log(logoutUrl.toString());
  console.log(
    "\nThe customer will be logged out and redirected to:\n" +
    `  ${REDIRECT_URL}\n`
  );
}

// ─── CLI Router ─────────────────────────────────────────────────────────────────

async function main() {
  const [command, arg] = process.argv.slice(2);

  switch (command) {
    case "authorize":
      await authorize();
      break;

    case "token":
      if (!arg) {
        console.error("Usage: node customer_account_api.js token <CODE>");
        process.exit(1);
      }
      await obtainAccessToken(arg);
      break;

    case "refresh":
      if (!arg) {
        console.error("Usage: node customer_account_api.js refresh <REFRESH_TOKEN>");
        process.exit(1);
      }
      await refreshAccessToken(arg);
      break;

    case "query":
      if (!arg) {
        console.error("Usage: node customer_account_api.js query <ACCESS_TOKEN>");
        process.exit(1);
      }
      await queryCustomerApi(arg);
      break;
      
    case "logout":
      if (!arg) {
        console.error("Usage: node customer_account_api.js logout <ID_TOKEN>");
        process.exit(1);
      }
      await logout(arg);
      break;

    default:
      console.log(`
Shopify Customer Account API — Confidential Client OAuth Flow

Usage:
  node customer_account_api.js authorize          Generate the login URL
  node customer_account_api.js token <code>        Exchange auth code for tokens
  node customer_account_api.js refresh <token>     Refresh an expired access token
  node customer_account_api.js query <token>       Make a sample GraphQL query
  node customer_account_api.js logout <id_token>    Log out a customer

Flow:
  1. Run "authorize" and open the URL in a browser.
  2. Log in, then copy the "code" query parameter from the redirect.
  3. Run "token <code>" to get an access_token + refresh_token.
  4. Run "query <access_token>" to test the Customer Account API.
  5. When the token expires (~2 hours), run "refresh <refresh_token>".
  6. Run "logout <id_token>" to log the customer out.
`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
