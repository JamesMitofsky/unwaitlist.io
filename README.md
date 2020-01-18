# unwaitlist

Gotta scrape 'n send that waitlist info: __unwaitlist.io__

## Setup

### Install NPM packages

```bash
npm install require cheerio nodemailer twilio dotenv googleapis@39 google-spreadsheet
```


### Add `.env` file

With config info for twilio

```ini
# twilio
EMAIL_USER=youemail@domain.com
EMAIL_PASS=***
TWILIO_SID=***
TWILIO_TOKEN=***

# g-sheets auth
type=***
project_id=***
private_key_id=***
private_key=-----BEGIN PRIVATE KEY-----\***
client_email=***
client_id=***
auth_uri=https://accounts.google.com/o/oauth2/auth
token_uri=https://oauth2.googleapis.com/token
auth_provider_x509_cert_url=https://www.googleapis.com/oauth2/v1/certs
client_x509_cert_url=***
```



## Run

You can run the following two commands

```bash
npm run sheets
npm run course
```

Sheets will update [this google sheet](https://docs.google.com/spreadsheets/d/1DjsN1HiiS7Iv7lKNucjeoQ6aS0_291JAovZ0LfgOItM/edit?ts=5e121e54)

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
- [Nodemailer message configuration](https://nodemailer.com/message/)


## Twilio: web-based phone calls

- [Outbound call quickstart](https://www.twilio.com/docs/voice/quickstart/node?code-sample=code-make-an-outbound-call&code-language=Node.js&code-sdk-version=3.x)
- [Text to speech docs](https://www.twilio.com/docs/voice/twiml/say/text-speech)
- [Twimlet Echo, URL builder](https://www.twilio.com/labs/twimlets/echo) - be sure to use the <Response> and <Say> hierarchy


## Axios: promise based http requests
- 


## dotenv: protecting sensitive variables

- Create .env file in root directory
- Declare sensative values as, "NAME=VALUE" (without quotes & each assignment receiving its own line)
- Access these values like, "process.env.NAME"
- https://www.npmjs.com/package/dotenv
- [bug in newline support](https://github.com/motdotla/dotenv/issues/218#issuecomment-325044380)

## Google Sheets API: user management

### Sheets Setup

- Online, visit the [Google Dev Console](https://console.developers.google.com/apis/dashboard) and create a service worker
- Share your spreadsheet with the service worker's email

### Usage

- Reading can be done by cells or rows, but rows seems to make the context more easily understood
- Writing is done simply with the assignment operator to a given cell, but this must be followed by `row.save()`
- Caution: don't fully understand this, but it seems to ensure a save ONLY when it is the last statement to be evaluated in a function. You can force a save to happen immediately with `await promisify(row.save)()` instead of `row.save()`. My experience otherwise has been that it will end the function wherever you call promisify from.


## Considerations beyond the code

- Set Twilio number as emergency contact which can override Do Not Disturb and Silent

## TODO

- Add environment variable tracking in Azure functions.
- Make checking spreadsheet separate from request spreadsheet. This will help with multiple class check requests.
- Have the program check if a CRN exists before registering it on the request sheet and sending a confirmation.

## Resources

### Code Styles / Conventions

* Boolean Values should always be verb questions that have yes/no answer (ex. `isRegNumInvalid`)
  * Preference for interpretation should be default is false
  * State things in the affirmative ex. prefer `IsTrue` to `IsUntrue`

**Cyclomatic Complexity** - number of different possible paths, level of nesting, indentation

**Example Bad**: Cyclomatic Complexity = 3

```js
if (someCondition) {
    if (newCondition) {
        if (nextCondition) {
            // do something
        }
    }
}
```

* Variable name length can get smaller as you limit the scope of that variable

**Example**:

```js
cosnt USER_ROW_INFO = ""
let row = allRows.find(r => r.id === ID)
```

**Example Good**: Cyclomatic Complexity = 1 (with _Early Termination_ (ET))

```js
if (!someCondition) return
if (!newCondition) return
if (!nextCondition) return

// do something
```

### JavaScript Brackets

For guarded if statements, use brackets (just as style convention)

```js
if (!duplicateRow) return true      // bad
if (!duplicateRow) { return true }  // good
```

### Avoid Yoda Conditions

Try to place the target of the investigation as the first term/expersion in an comparison operator

**Bad**:  `7 === x` - reads as "Does 7 equal x?"
**Good**: `x === 7` - reads as "Does 'x' equal 7?"


### JavaScript Array Examples

```js
var array = [{compnum: "13113"}, {compnum: "45345"}, {compnum: "34534"}]

// map values in array to return processed value for each item
array.map(i => i.compnum)

// filter list of values to matching criteria
array.filter(i => i.compnum === "45345")

// filter list of values to matching criteria - but just find the first record - return record
array.find(i => i.compnum === "45345")

// see if any values in array meet criteria
array.some(i => i.compnum === "45345")
```
