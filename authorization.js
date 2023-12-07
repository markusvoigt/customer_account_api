// https://shopify.dev/docs/api/customer#step-authorization

// CHANGE THESE CONSTANTS
const CLIENT_ID = "shp_bd5ecbf1-775b-43f7-86d8-8c2e7ad7xxx";
const SHOP_ID = "59717910550";
const REDIRECT_URL =
  "https://webhook.site/1908028c-f2e4-4be0-85a2-189381d9c5ec";

const authorizationRequestUrl = new URL(
  `https://shopify.com/${SHOP_ID}/auth/oauth/authorize`
);
authorizationRequestUrl.searchParams.append(
  "scope",
  "openid email https://api.customers.com/auth/customer.graphql"
);
authorizationRequestUrl.searchParams.append("client_id", CLIENT_ID);
authorizationRequestUrl.searchParams.append("response_type", "code");
authorizationRequestUrl.searchParams.append("redirect_uri", REDIRECT_URL);

// VISIT THIS URL AND NOTE THE CODE URL QUERY PARAMETER AND USE IT FOR obtain_access_token.js
console.log(authorizationRequestUrl.toString());
