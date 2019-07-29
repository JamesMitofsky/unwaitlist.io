# unwaitlist
Gotta scrape 'n send that waitlist info


#### Quickstart: install dependencies
````npm install require cheerio nodemailer twilio dotenv````


# Project Resource Catalog

### Azure Functions: free, cloud-based execution
- Timer function: https://docs.microsoft.com/en-us/azure/azure-functions/functions-bindings-timer
- KUDU debug console for adding dependencies: https://blogs.msdn.microsoft.com/benjaminperkins/2014/03/24/using-kudu-with-windows-azure-web-sites/
    1. > select function
    2. > platform features
    3. > advanced tools (Kudu)
    4. > debug console (located in navbar)
    5. > run npm installs for dependencies
- Using Environment Variables in Azure: https://www.freecodecamp.org/news/heres-how-you-can-actually-use-node-environment-variables-8fdf98f53a0a/
    1. > select function
    2. > platform features
    3. > configuration
    4. > add as application setting (as deployment)


### NodeMailer: email
- Quick start: https://www.w3schools.com/nodejs/nodejs_email.asp
- In Google Settings, make account available to "Less Secure" apps


### Twilio: web-based phone calls
- Outbound call quickstart: https://www.twilio.com/docs/voice/quickstart/node?code-sample=code-make-an-outbound-call&code-language=Node.js&code-sdk-version=3.x
- Text to speech docs: https://www.twilio.com/docs/voice/twiml/say/text-speech
- Twimlet Echo, URL builder: https://www.twilio.com/labs/twimlets/echo


### dotenv: protecting sensitive variables
- https://www.npmjs.com/package/dotenv


### Considerations beyond the code
- Setup email filter to move 'online status confirmed' emails from inbox to folder without notification
- Set Twilio number as emergency contact which can override Do Not Disturb and Silent