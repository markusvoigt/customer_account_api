# Demo of how to authenticate with and use the Shopify Customer Account API

## How to work with the new [Shopify Customer Account API](https://shopify.dev/docs/api/customer):

# Shopify Customer Account API — Quick Start Guide

A Node.js CLI script that walks you through the **Confidential Client OAuth flow** for the Shopify Customer Account API.

## Prerequisites

1. **Node.js** v18+ (uses built-in `fetch`)
2. Install the **Headless** or **Hydrogen** sales channel on your Shopify store
3. Gather the following from the channel settings:
   - `CLIENT_ID`
   - `CLIENT_SECRET`
   - `SHOP_ID` (numeric)
   - `STOREFRONT_DOMAIN` (e.g. `my-store.myshopify.com`)
4. Whitelist a **redirect URL** in the Customer Account API settings (e.g. a [webhook.site](https://webhook.site) URL)

## Configuration

Open `customer_account_api.js` and update the constants at the top of the file:

```js
const CLIENT_ID        = "shp_your-client-id";
const CLIENT_SECRET    = "your-client-secret";
const SHOP_ID          = "12345678";
const STOREFRONT_DOMAIN = "my-store.myshopify.com";
const REDIRECT_URL     = "https://webhook.site/your-unique-url";
```

## Usage

### Step 1 — Generate the Authorization URL

```bash
node customer_account_api.js authorize
```

Open the printed URL in a browser and log in with a customer account. After login you'll be redirected to your `REDIRECT_URL` with a `code` query parameter in the URL.

### Step 2 — Exchange the Code for Tokens

```bash
node customer_account_api.js token <CODE>
```

Replace `<CODE>` with the value from the redirect URL. On success you'll receive:

| Token            | Purpose                          |
| ---------------- | -------------------------------- |
| `access_token`   | Authenticate API requests        |
| `refresh_token`  | Get a new access token when it expires |
| `id_token`       | OpenID Connect identity token    |

### Step 3 — Query the Customer Account API

```bash
node customer_account_api.js query <ACCESS_TOKEN>
```

Runs a sample GraphQL query that returns the customer's name and email:

```graphql
{
  customer {
    emailAddress { emailAddress }
    firstName
    lastName
  }
}
```

### Step 4 — Refresh an Expired Token

Access tokens expire after ~2 hours. Refresh with:

```bash
node customer_account_api.js refresh <REFRESH_TOKEN>
```

This returns a new `access_token` and `refresh_token`.

## Full Flow Summary

```
authorize → browser login → copy code → token <code> → query <access_token>
                                                      ↘ refresh <refresh_token> (when expired)
```

## Reference

- [Customer Account API Docs](https://shopify.dev/docs/api/customer/latest)

## Previous version

- Use the [authorization.js script](https://github.com/markusvoigt/customer_account_api/blob/main/authorization.js) to generate a URL that redirects the customer to the new Shopify Customer Account Login Page. [Official guide here](https://shopify.dev/docs/api/customer#step-authorization).

- Note down the code URL query parameter and use the [obtain_access_token.js script](https://github.com/markusvoigt/customer_account_api/blob/main/obtain_access_token.js) to obtain an Access Token. [Official guide here](https://shopify.dev/docs/api/customer#step-obtain-access-token). 

- Exchange the Access Token for a new Access Token to actually authenticate with Customer Account API using [the exchange_access_token.js script](https://github.com/markusvoigt/customer_account_api/blob/main/obtain_access_token.js). [Official guide here](https://shopify.dev/docs/api/customer#step-use-access-token).

- Use e.g. Postman to make a request to https://shopify.com/[STORE-ID]/account/customer/api/unstable/graphql and authenticate by setting the access tokenas the Authorization header. [Screenshot from Postman](https://screenshot.click/07-15-rdc31-u68tu.png) and [Official Guide here](https://shopify.dev/docs/api/customer#endpoints).

- Optional: Use the Refresh Token obtained together with the access token to renew it after it has expired after 2 hours using the [obtain_access_token_with_refresh_token.js script](https://github.com/markusvoigt/customer_account_api/blob/main/obtain_access_token_with_refresh_token.js). 

Demo video: https://screenshot.click/07-17-2ahr4-33qka.mp4
