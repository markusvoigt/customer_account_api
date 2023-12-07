// https://shopify.dev/docs/api/customer#step-obtain-access-token
// CHANGE THESE CONSTANTS
const CLIENT_ID = "shp_bd5ecbf1-775b-43f7-86d8-8c2e7ad7xxx";
const CLIENT_SECRET = "XXX";
const SHOP_ID = "59717910550";
const REDIRECT_URL =
  "https://webhook.site/1908028c-f2e4-4be0-85a2-189381d9c5ec";
// INSERT CODE RECEIVED AS THE URL QUERY PARAMETER IN REDIRECT AFTER THE FIRST STEP
const CODE_RETURNED = "XXX";

const body = new URLSearchParams();
body.append("grant_type", "authorization_code");
body.append("client_id", CLIENT_ID);
body.append("redirect_uri", REDIRECT_URL);

body.append("code", CODE_RETURNED);
const auth_header = `${CLIENT_ID}:${CLIENT_SECRET}`;
const headers = {
  "content-type": "application/x-www-form-urlencoded",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.93 Safari/537.36",
  Origin: REDIRECT_URL,
  Authorization: `Basic ${Buffer.from(auth_header).toString("base64")}`,
};

const response = fetch(`https://shopify.com/${SHOP_ID}/auth/oauth/token`, {
  method: "POST",
  headers: headers,
  body,
})
  .then((response) => response.json())
  .then((response) => console.dir(response));
