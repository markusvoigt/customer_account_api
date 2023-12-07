# Demo of how to authenticate with and use the Shopify Customer Account API

## How to work with the new [Shopify Customer Account API](https://shopify.dev/docs/api/customer):

- Install the Headless Sales Channel or Hydrogen on your Shopify store

- Note down the CLIENT_ID and CLIENT_SECRET provided e.g. by the headless channel, [see screenshot](https://screenshot.click/07-59-udvy7-ms7if.png).

- Whitelist an arbitrary redirect URL in the settings for the Customer Account API. I just used webhook.site

- Use the [authorization.js script](https://github.com/markusvoigt/customer_account_api/blob/main/authorization.js) to generate a URL that redirects the customer to the new Shopify Customer Account Login Page. [Official guide here](https://shopify.dev/docs/api/customer#step-authorization).

- Note down the code URL query parameter and use the [obtain_access_token.js script](https://github.com/markusvoigt/customer_account_api/blob/main/obtain_access_token.js) to obtain an Access Token. [Official guide here](https://shopify.dev/docs/api/customer#step-obtain-access-token). 

- Exchange the Access Token for a new Access Token to actually authenticate with Customer Account API using [the exchange_access_token.js script](https://github.com/markusvoigt/customer_account_api/blob/main/obtain_access_token.js). [Official guide here](https://shopify.dev/docs/api/customer#step-use-access-token).

- Use e.g. Postman to make a request to https://shopify.com/[STORE-ID]/account/customer/api/unstable/graphql and authenticate by setting the access tokenas the Authorization header. [Screenshot from Postman](https://screenshot.click/07-15-rdc31-u68tu.png) and [Official Guide here](https://shopify.dev/docs/api/customer#endpoints).

- Optional: Use the Refresh Token obtained together with the access token to renew it after it has expired after 2 hours using the [obtain_access_token_with_refresh_token.js script](https://github.com/markusvoigt/customer_account_api/blob/main/obtain_access_token_with_refresh_token.js). 

Demo video: https://screenshot.click/07-17-2ahr4-33qka.mp4
