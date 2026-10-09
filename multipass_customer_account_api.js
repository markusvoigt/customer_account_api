#!/usr/bin/env node

/**
 * Shopify Customer Account API — Multipass Bearer Grant tester
 *
 * Exchanges a Shopify Multipass token/assertion for a Customer Account API access token.
 * This targets the internal, flag-gated grant:
 *   grant_type=urn:shopify:params:oauth:grant-type:multipass
 *
 * Requirements:
 *   - Dev store has Multipass enabled
 *   - Store has Multipass configured and you can mint a valid Multipass token.
 *   - Customer Account API client belongs to a Headless/Hydrogen storefront.
 *   - Node.js 18+ for global fetch.
 *
 * Configure with env vars, or edit DEFAULTS below:
 *   SHOPIFY_STOREFRONT_DOMAIN=markusvoigt.myshopify.com
 *   SHOPIFY_SHOP_ID=59717910550
 *   CAAPI_CLIENT_ID=shp_... or UUID client id from Customer Account API settings
 *   CAAPI_CLIENT_SECRET=...                optional, if testing confidential client behavior
 *   CAAPI_ORIGIN=https://your-store.com    optional, used for Customer Account API GraphQL query
 *   STOREFRONT_ACCESS_TOKEN=...             required for cart/checkout commands
 *
 * Usage:
 *   node multipass_customer_account_api.js discover
 *   MULTIPASS_TOKEN='...' node multipass_customer_account_api.js exchange
 *   node multipass_customer_account_api.js exchange '<MULTIPASS_TOKEN>'
 *   node multipass_customer_account_api.js exchange --token-file /path/to/token.txt
 *   node multipass_customer_account_api.js query '<ACCESS_TOKEN>'
 *   node multipass_customer_account_api.js checkout '<ACCESS_TOKEN>' [--open]
 *   MULTIPASS_TOKEN='...' node multipass_customer_account_api.js exchange-and-query
 *   MULTIPASS_TOKEN='...' node multipass_customer_account_api.js exchange-and-checkout [--open]
 */

const DEFAULTS = {
  SHOPIFY_STOREFRONT_DOMAIN: "markusvoigt.myshopify.com",
  SHOPIFY_SHOP_ID: "59717910550",
  CAAPI_CLIENT_ID: "",
  CAAPI_CLIENT_SECRET: "",
  CAAPI_ORIGIN: "", // Example: https://markusvoigt.myshopify.com or custom storefront origin
  CUSTOMER_API_VERSION: "2026-07",
  STOREFRONT_ACCESS_TOKEN: "",
  STOREFRONT_API_VERSION: "2026-07",
  CHECKOUT_VARIANT_ID: "gid://shopify/ProductVariant/62022086787094",
  CHECKOUT_QUANTITY: "1",
};

const GRANT_TYPE = "urn:shopify:params:oauth:grant-type:multipass";

function env(name) {
  return process.env[name] || DEFAULTS[name] || "";
}

function requireConfig(name) {
  const value = env(name);
  if (!value) {
    throw new Error(
      `Missing ${name}. Set it as an environment variable or edit DEFAULTS in this script.`
    );
  }
  return value;
}

function jsonLog(title, data) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
  console.dir(data, { depth: null, colors: true });
}

async function readStdinIfAvailable() {
  if (process.stdin.isTTY) return "";

  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8").trim();
}

async function readTokenArg(args) {
  const fileIndex = args.indexOf("--token-file");
  if (fileIndex >= 0) {
    const file = args[fileIndex + 1];
    if (!file) throw new Error("--token-file requires a path");
    const fs = await import("node:fs/promises");
    return (await fs.readFile(file, "utf8")).trim();
  }

  return args[0] || process.env.MULTIPASS_TOKEN || (await readStdinIfAvailable());
}

async function discoverOpenIdConfiguration() {
  const domain = requireConfig("SHOPIFY_STOREFRONT_DOMAIN");
  const url = `https://${domain}/.well-known/openid-configuration`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`OIDC discovery failed (${res.status}) at ${url}:\n${text}`);
  }

  return JSON.parse(text);
}

async function discoverCustomerAccountApi() {
  const domain = requireConfig("SHOPIFY_STOREFRONT_DOMAIN");
  const url = `https://${domain}/.well-known/customer-account-api`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Customer Account API discovery failed (${res.status}) at ${url}:\n${text}`);
  }

  return JSON.parse(text);
}

function basicAuthHeader(clientId, clientSecret) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

async function exchangeMultipassForCustomerAccountToken(multipassToken) {
  if (!multipassToken) {
    throw new Error(
      "Missing Multipass token. Pass it as an argument, MULTIPASS_TOKEN env var, stdin, or --token-file."
    );
  }

  const clientId = requireConfig("CAAPI_CLIENT_ID");
  const clientSecret = env("CAAPI_CLIENT_SECRET");
  const openid = await discoverOpenIdConfiguration();

  const body = new URLSearchParams({
    grant_type: GRANT_TYPE,
    assertion: multipassToken,
    client_id: clientId,
  });

  // The current internal implementation loads the client by client_id for this grant.
  // Some confidential-client test harnesses also pass the secret, so support it without requiring it.
  if (clientSecret) {
    body.set("client_secret", clientSecret);
  }

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": "caapi-multipass-test/1.0",
  };

  if (clientSecret) {
    headers.Authorization = basicAuthHeader(clientId, clientSecret);
  }

  const res = await fetch(openid.token_endpoint, {
    method: "POST",
    headers,
    body,
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const supported = openid.grant_types_supported || [];
    console.error("\nToken endpoint:", openid.token_endpoint);
    if (!supported.includes(GRANT_TYPE)) {
      console.error(
        "Note: discovery does not advertise the Multipass grant. That can mean the flag is off, " +
          "the grant is not rolled out on this shop/domain, or discovery has not been updated for it."
      );
      console.error("grant_types_supported:", supported);
    }
    throw new Error(`Multipass exchange failed (${res.status}):\n${JSON.stringify(data, null, 2)}`);
  }

  return {
    tokenEndpoint: openid.token_endpoint,
    response: data,
  };
}

async function queryCustomerApi(accessToken) {
  if (!accessToken) throw new Error("Missing Customer Account API access token");

  let graphqlUrl;
  try {
    const caapi = await discoverCustomerAccountApi();
    graphqlUrl = caapi.graphql_api;
  } catch {
    // Fallback shape used by public docs / Hydrogen source if discovery is unavailable.
    graphqlUrl = `https://shopify.com/${requireConfig("SHOPIFY_SHOP_ID")}/account/customer/api/${env(
      "CUSTOMER_API_VERSION"
    )}/graphql`;
  }

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: accessToken,
    "User-Agent": "caapi-multipass-test/1.0",
  };

  const origin = env("CAAPI_ORIGIN") || `https://${requireConfig("SHOPIFY_STOREFRONT_DOMAIN")}`;
  if (origin) headers.Origin = origin;

  const query = `#graphql
    query CurrentCustomer {
      customer {
        id
        firstName
        lastName
        emailAddress { emailAddress }
      }
    }
  `;

  const res = await fetch(graphqlUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return {
    graphqlUrl,
    status: res.status,
    ok: res.ok,
    response: data,
  };
}

async function createCheckoutWithBuyerIdentity(accessToken, { open = false } = {}) {
  if (!accessToken) throw new Error("Missing Customer Account API access token");

  const domain = requireConfig("SHOPIFY_STOREFRONT_DOMAIN");
  const storefrontToken = requireConfig("STOREFRONT_ACCESS_TOKEN");
  const variantId = requireConfig("CHECKOUT_VARIANT_ID");
  const quantity = Number(env("CHECKOUT_QUANTITY") || "1");
  const version = env("STOREFRONT_API_VERSION") || "2026-07";
  const graphqlUrl = `https://${domain}/api/${version}/graphql.json`;

  const mutation = `#graphql
    mutation CartCreateForCustomerAccountToken($input: CartInput!) {
      cartCreate(input: $input) {
        cart {
          id
          checkoutUrl
          buyerIdentity {
            customer { id }
          }
          lines(first: 10) {
            nodes {
              id
              quantity
              merchandise {
                ... on ProductVariant {
                  id
                  title
                }
              }
            }
          }
        }
        userErrors {
          field
          code
          message
        }
      }
    }
  `;

  const variables = {
    input: {
      lines: [{ merchandiseId: variantId, quantity }],
      buyerIdentity: {
        customerAccessToken: accessToken,
      },
    },
  };

  const res = await fetch(graphqlUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": storefrontToken,
      "User-Agent": "caapi-multipass-test/1.0",
    },
    body: JSON.stringify({ query: mutation, variables }),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  const userErrors = data?.data?.cartCreate?.userErrors || [];
  const checkoutUrl = data?.data?.cartCreate?.cart?.checkoutUrl;

  if (!res.ok || data.errors || userErrors.length || !checkoutUrl) {
    return {
      graphqlUrl,
      status: res.status,
      ok: false,
      response: data,
    };
  }

  if (open) {
    const { spawn } = await import("node:child_process");
    spawn("open", [checkoutUrl], { detached: true, stdio: "ignore" }).unref();
  }

  return {
    graphqlUrl,
    status: res.status,
    ok: true,
    checkoutUrl,
    response: data,
  };
}

async function discover() {
  const [openid, caapi] = await Promise.all([
    discoverOpenIdConfiguration(),
    discoverCustomerAccountApi().catch((error) => ({ error: error.message })),
  ]);

  jsonLog("OpenID configuration", {
    issuer: openid.issuer,
    authorization_endpoint: openid.authorization_endpoint,
    token_endpoint: openid.token_endpoint,
    end_session_endpoint: openid.end_session_endpoint,
    grant_types_supported: openid.grant_types_supported,
  });

  jsonLog("Customer Account API configuration", caapi);

  if (!(openid.grant_types_supported || []).includes(GRANT_TYPE)) {
    console.log(
      `\nWarning: ${GRANT_TYPE} is not listed in grant_types_supported. ` +
        "Try the exchange anyway only if you know the internal flag/path is enabled."
    );
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "discover": {
      await discover();
      break;
    }

    case "exchange": {
      const token = await readTokenArg(args);
      const result = await exchangeMultipassForCustomerAccountToken(token);
      jsonLog("Multipass exchange succeeded", {
        token_endpoint: result.tokenEndpoint,
        token_type: result.response.token_type,
        expires_in: result.response.expires_in,
        access_token: result.response.access_token,
        refresh_token: result.response.refresh_token || null,
        id_token: result.response.id_token || null,
      });
      break;
    }

    case "query": {
      const accessToken = args[0] || process.env.CAAPI_ACCESS_TOKEN || (await readStdinIfAvailable());
      const result = await queryCustomerApi(accessToken);
      jsonLog("Customer Account API query result", result);
      if (!result.ok) process.exitCode = 1;
      break;
    }

    case "checkout": {
      const open = args.includes("--open");
      const accessToken = args.find((arg) => !arg.startsWith("--")) || process.env.CAAPI_ACCESS_TOKEN || (await readStdinIfAvailable());
      const result = await createCheckoutWithBuyerIdentity(accessToken, { open });
      jsonLog("Cart create + buyer identity result", result);
      if (result.checkoutUrl) {
        console.log(`\nCheckout URL:\n${result.checkoutUrl}`);
      }
      if (!result.ok) process.exitCode = 1;
      break;
    }

    case "exchange-and-query": {
      const token = await readTokenArg(args);
      const exchange = await exchangeMultipassForCustomerAccountToken(token);
      jsonLog("Multipass exchange succeeded", {
        token_endpoint: exchange.tokenEndpoint,
        token_type: exchange.response.token_type,
        expires_in: exchange.response.expires_in,
        access_token: exchange.response.access_token,
        refresh_token: exchange.response.refresh_token || null,
        id_token: exchange.response.id_token || null,
      });

      const queryResult = await queryCustomerApi(exchange.response.access_token);
      jsonLog("Customer Account API query result", queryResult);
      if (!queryResult.ok) process.exitCode = 1;
      break;
    }

    case "exchange-and-checkout": {
      const open = args.includes("--open");
      const token = await readTokenArg(args.filter((arg) => arg !== "--open"));
      const exchange = await exchangeMultipassForCustomerAccountToken(token);
      jsonLog("Multipass exchange succeeded", {
        token_endpoint: exchange.tokenEndpoint,
        token_type: exchange.response.token_type,
        expires_in: exchange.response.expires_in,
        access_token: exchange.response.access_token,
        refresh_token: exchange.response.refresh_token || null,
        id_token: exchange.response.id_token || null,
      });

      const checkoutResult = await createCheckoutWithBuyerIdentity(exchange.response.access_token, { open });
      jsonLog("Cart create + buyer identity result", checkoutResult);
      if (checkoutResult.checkoutUrl) {
        console.log(`\nCheckout URL:\n${checkoutResult.checkoutUrl}`);
      }
      if (!checkoutResult.ok) process.exitCode = 1;
      break;
    }

    default:
      console.log(`
Shopify Customer Account API — Multipass Bearer Grant tester

Usage:
  node multipass_customer_account_api.js discover
  MULTIPASS_TOKEN='...' node multipass_customer_account_api.js exchange
  node multipass_customer_account_api.js exchange '<MULTIPASS_TOKEN>'
  node multipass_customer_account_api.js exchange --token-file /path/to/token.txt
  node multipass_customer_account_api.js query '<ACCESS_TOKEN>'
  node multipass_customer_account_api.js checkout '<ACCESS_TOKEN>' [--open]
  MULTIPASS_TOKEN='...' node multipass_customer_account_api.js exchange-and-query
  MULTIPASS_TOKEN='...' node multipass_customer_account_api.js exchange-and-checkout [--open]

Required config:
  SHOPIFY_STOREFRONT_DOMAIN=${DEFAULTS.SHOPIFY_STOREFRONT_DOMAIN}
  SHOPIFY_SHOP_ID=${DEFAULTS.SHOPIFY_SHOP_ID}
  CAAPI_CLIENT_ID=<Customer Account API client id>
  STOREFRONT_ACCESS_TOKEN=<public Storefront API token>

Optional config:
  CAAPI_CLIENT_SECRET=<secret for confidential client tests>
  CAAPI_ORIGIN=https://your-storefront-origin
  STOREFRONT_API_VERSION=${DEFAULTS.STOREFRONT_API_VERSION}
  CHECKOUT_VARIANT_ID=${DEFAULTS.CHECKOUT_VARIANT_ID}
  CHECKOUT_QUANTITY=${DEFAULTS.CHECKOUT_QUANTITY}
`);
  }
}

main().catch((error) => {
  console.error("\n✗", error.message || error);
  process.exit(1);
});
