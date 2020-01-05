# unwaitlist

Gotta scrape 'n send that waitlist info: __unwaitlist.io__

## Setup

### Install NPM packages

```bash
npm install require cheerio nodemailer twilio dotenv googleapis@39 google-spreadsheet
```

### Add client_secret.json

With your credentials from google which should look like this:

```json
{
    "type": "service_account",
    "project_id": "***",
    "private_key_id": "***",
    "private_key": "-----BEGIN PRIVATE KEY-----\n***",
    "client_id": "***",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "***"
  }
```

## Run

You can run the following two commands

```bash
npm run sheets
npm run course
```

## Project Resource Catalog

## Azure Functions: free, cloud-based execution

- [Timer function](https://docs.microsoft.com/en-us/azure/azure-functions/functions-bindings-timer)
- [KUDU debug console for adding dependencies](https://blogs.msdn.microsoft.com/benjaminperkins/2014/03/24/using-kudu-with-windows-azure-web-sites/)
    1. select function
    2. platform features
    3. advanced tools (Kudu)
    4. debug console (located in navbar)
    5. run npm installs for dependencies
- [Using Environment Variables in Azure](https://www.freecodecamp.org/news/heres-how-you-can-actually-use-node-environment-variables-8fdf98f53a0a/)
    1. select function
    2. platform features
    3. configuration
    4. add as application setting (as deployment)


## NodeMailer: email

- [Quick start](https://www.w3schools.com/nodejs/nodejs_email.asp)
- In Google Settings, make account available to "Less Secure" apps


## Twilio: web-based phone calls

- [Outbound call quickstart](https://www.twilio.com/docs/voice/quickstart/node?code-sample=code-make-an-outbound-call&code-language=Node.js&code-sdk-version=3.x)
- [Text to speech docs](https://www.twilio.com/docs/voice/twiml/say/text-speech)
- [Twimlet Echo, URL builder](https://www.twilio.com/labs/twimlets/echo)


## dotenv: protecting sensitive variables

- Create .env file in root directory
- Declare sensative values as, "NAME=VALUE" (without quotes & each assignment receiving its own line)
- Access these values like, "process.env.NAME"
- https://www.npmjs.com/package/dotenv

## Google Sheets API: user management

### Setup

- Online, visit the [Google Dev Console](https://console.developers.google.com/apis/dashboard) and create a service worker
- Share your spreadsheet with the service worker's email

### Usage

- Reading can be done by cells or rows, but rows seems to make the context more easily understood
- Writing is done simply with the assignment operator to a given cell, but this must be followed by "row.save()"


## Considerations beyond the code

- Setup email filter to move 'online status confirmed' emails from inbox to folder without notification
- Set Twilio number as emergency contact which can override Do Not Disturb and Silent

## TODO

- Figure out accessing a client secrets json file in Azure functions.
- Make checking spreadsheet separate from request spreadsheet. This will help with multiple class check requests.
- Have the program check if a CRN exists before registering it on the request sheet and sending a confirmation.
