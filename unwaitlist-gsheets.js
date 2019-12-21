// npm install googleapis@39 --save nodemailer dotenv

// google sheets
const GoogleSpreadsheet = require('google-spreadsheet');
const { promisify } = require('util');
const creds = require('./client_secret.json');
// emailing
const nodemailer = require('nodemailer');
// environment variables
require('dotenv').config()


// async to open spreadsheet
async function accessSpreadsheet() {
    const doc = new GoogleSpreadsheet('1DjsN1HiiS7Iv7lKNucjeoQ6aS0_291JAovZ0LfgOItM');
    // don't know how to store client secrets in Azure functions
    await promisify(doc.useServiceAccountAuth)(creds);
    const info = await promisify(doc.getInfo)();
    // load spreadsheets
    const requestSheet = info.worksheets[0];
    const cancelationSheet = info.worksheets[1];
    // console.log() show which sheets are loaded
    console.log(`\nLoaded Spreadsheets: "${requestSheet.title}" and "${cancelationSheet.title}"`);

    // declare rows objects
    const rowsOfRequestSheet = await promisify(requestSheet.getRows)({
    });
    const rowsOfCancelationSheet = await promisify(cancelationSheet.getRows)({
    })

    // console.log() create arrays for indexing students
    const canceledList = []
    const watchingList = []

    // iterate through every row of main request sheet
    rowsOfRequestSheet.forEach(row => {
        // access cancelation sheet: if class is canceled, mark it on the main request sheet
        rowsOfCancelationSheet.forEach(canceledRow => {
            if (canceledRow.email == row.email && canceledRow.courseregistrationnumber == row.courseregistrationnumber && row.currentstatus != "Canceled") {
                row.currentstatus = "Canceled"
                row.save()

                // console.log() whether a cancelation error occurred
                if (row.currentstatus != "Canceled") {
                    console.log("Error: cancelation not logged", row.email)
                } else {
                    console.log("Success: canceled")
                }
            }
        })
        // add to canceled indexing
        if (row.currentstatus == "Canceled") {
            canceledList.push(row.email)
        }
        

        // if neither marked canceled nor confirmed, send confirmation email
        if (row.initialemail != "Confirmation Sent" && row.currentstatus != "Canceled") {
            // console.log() which student is currently being reviewed
            console.log(row.courseregistrationnumber, row.email)

            // begin working with nodemailer
            let transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });
            // declare email content
            let mailOptions = {
                from: 'unwaitlist.io@gmail.com',
                // set useremail
                to: row.email,
                subject: 'Unwaitlist Confirmation',
                text: `Unwaitlist is now checking your course: https://www.uvm.edu/academics/courses/?term=202001&crn=${row.courseregistrationnumber}`
            };
            // send email
            transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    console.log(error);
                } else {
                    console.log(`Email sent to ${row.email} --> ` + info.response);
                }
            });

            // after sent, write confirmation to spreadsheet
            row.initialemail = "Confirmation Sent"
            row.currentstatus = "Watching"
            row.save()
        }

        // add to confirmations indexing
        if (row.currentstatus == "Watching") {
            watchingList.push(row.email)
        }
    })

    // console log which students have recieved a confirmation or have canceled
    // console.log(`\nWatching: ${watchingList.length}`)
    // for (i = 0; i < watchingList.length; i++) {
    //     console.log(`\t${watchingList[i]}`)
    // }
    // console.log(`\nCanceled: ${canceledList.length}`)
    // for (i = 0; i < canceledList.length; i++) {
    //     console.log(`\t${canceledList[i]}`)
    // }
    // console.log("\n")

}


// call main function
accessSpreadsheet();

