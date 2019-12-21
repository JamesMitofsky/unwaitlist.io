// npm install googleapis@39 --save nodemailer dotenv

// google sheets
const GoogleSpreadsheet = require('google-spreadsheet');
const { promisify } = require('util');
const creds = require('./client_secret.json')
// emailing
const nodemailer = require('nodemailer');
// environment variables
require('dotenv').config()


// async to open spreadsheet
async function accessSpreadsheet() {
    const doc = new GoogleSpreadsheet('1DjsN1HiiS7Iv7lKNucjeoQ6aS0_291JAovZ0LfgOItM')
    // don't know how to store client secrets in Azure functions
    await promisify(doc.useServiceAccountAuth)(creds);
    const info = await promisify(doc.getInfo)();
    const requestSheet = info.worksheets[0];
    const cancelationSheet = info.worksheets[1]
    console.log(`\nLoaded Spreadsheets: "${requestSheet.title}" and "${cancelationSheet.title}"`)

    // declare rows object
    const rowsOfRequestSheet = await promisify(requestSheet.getRows)({
    });
    const rowsOfCancelationSheet = await promisify(cancelationSheet.getRows)({
    })

    // create empty arrays for console indexing
    const canceledList = []
    const watchingList = []

    // iterate through every row of main request sheet
    rowsOfRequestSheet.forEach(row => {
        // access cancelation sheet: if class is canceled, mark it on the main request sheet
        rowsOfCancelationSheet.forEach(canceledRow => {
            if (canceledRow.email == row.email && canceledRow.courseregistrationnumber == row.courseregistrationnumber && row.currentstatus != "Canceled") {
                row.currentstatus = "Canceled"
                row.save()
                // use the console as a safety check for successful change
                if (row.currentstatus != "Canceled") {
                    console.log("Error: cancelation not logged", row.email)
                } else {
                    console.log("Success: canceled")
                }
            }
        })

        // now in main request sheet again, if status is marked as canceled (regardless of how recent the change), push to array
        if (row.currentstatus == "Canceled") {
            canceledList.push(row.email)
        }

        // if not marked as canceled or yet confirmed, send confirmation email
        if (row.initialemail != "Confirmation Sent" && row.currentstatus != "Canceled") {

            // begin working with nodemailer
            let transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            // set email content
            let mailOptions = {
                from: 'unwaitlist.io@gmail.com',
                // set useremail
                to: row.email,
                subject: 'Unwaitlist Confirmation',
                text: `Unwaitlist is now checking your course: https://www.uvm.edu/academics/courses/?term=202001&crn=${row.courseregistrationnumber}`
            };

            transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    console.log(error);
                } else {
                    console.log(`Email sent to ${row.email} --> ` + info.response);
                }
            });

            // begin working with twilio
            const accountSid = process.env.TWILIO_SID;
            const authToken = process.env.TWILIO_TOKEN;
            const client = require('twilio')(accountSid, authToken);

            // transcript from twilio call: "<Response><Say voice="Polly.Joanna">Time to sign up for class!</Say></Response>"
            // client.calls
                // .create({
                //     url: 'https://twimlets.com/echo?Twiml=%3CResponse%3E%0A%3CSay%20voice%3D%22Polly.Joanna%22%3ETime%20to%20sign%20up%20for%20class!%3C%2FSay%3E%0A%3C%2FResponse%3E&',
                //     to: '+18027774849',
                //     from: '+19374216969'
                // })
                // .then(call => console.log(call.sid));


            // after sent, write confirmation to spreadsheet
            row.initialemail = "Confirmation Sent"
            row.save()
        }
        // count all confirmations, regardless of whether they were sent just now or earlier
        if (row.initialemail == "Confirmation Sent" && row.currentstatus != "Canceled") {
            row.currentstatus = "Watching"
            row.save()
            watchingList.push(row.email)
        }
    })

    // console log which students have recieved a confirmation or have canceled
    console.log(`\nWatching: ${watchingList.length}`)
    for (i = 0; i < watchingList.length; i++) {
        console.log(`\t${watchingList[i]}`)
    }
    console.log(`\nCanceled: ${canceledList.length}`)
    for (i = 0; i < canceledList.length; i++) {
        console.log(`\t${canceledList[i]}`)
    }
    console.log("\n")


}


// call main function
accessSpreadsheet();

