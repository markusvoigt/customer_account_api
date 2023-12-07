// https://shopify.dev/docs/api/customer#step-use-access-token
// CHANGE THESE CONSTANTS
const CLIENT_ID = "shp_bd5ecbf1-775b-43f7-86d8-8c2e7ad7xxx";
const CLIENT_SECRET = "XXX";
const SHOP_ID = "59717910550";
const ACCESS_TOKEN = "atkn_xxx";

const body = new URLSearchParams();
body.append("grant_type", "urn:ietf:params:oauth:grant-type:token-exchange");
body.append("client_id", CLIENT_ID);
body.append("audience", "30243aa5-17c1-465a-8493-944bcc4e88aa");
body.append("subject_token", ACCESS_TOKEN);
body.append(
  "subject_token_type",
  "urn:ietf:params:oauth:token-type:access_token"
);
body.append("scopes", "https://api.customers.com/auth/customer.graphql");

const auth_header = `${CLIENT_ID}:${CLIENT_SECRET}`;
const headers = {
  "content-type": "application/x-www-form-urlencoded",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.93 Safari/537.36",
  Authorization: `Basic ${Buffer.from(auth_header).toString("base64")}`,
};

const response = fetch(`https://shopify.com/${SHOP_ID}/auth/oauth/token`, {
  method: "POST",
  headers: headers,
  body,
})
  .then((response) => response.json())
  .then((response) => console.dir(response));
