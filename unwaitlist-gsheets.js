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
    const rowsOfRequestSheet = await promisify(requestSheet.getRows)( {
    });
    const rowsOfCancelationSheet = await promisify(cancelationSheet.getRows)( {
    })

    // create empty arrays for console indexing
    const canceledList = []
    const confirmedList = []

    // iterate through every row of main request sheet
    rowsOfRequestSheet.forEach(row => {
        // access cancelation sheet: if class is canceled, mark it on the main request sheet
        rowsOfCancelationSheet.forEach(canceledRow => {
            if(canceledRow.email == row.email && canceledRow.courseregistrationnumber == row.courseregistrationnumber && row.currentstatus != "Canceled") {
                row.currentstatus = "Canceled"
                row.save()
                // use the console as a safety check for successful change
                if(row.currentstatus != "Canceled") {
                    console.log("Error: cancelation not logged", row.email)
                } else {
                    console.log("Success: canceled")
                }
            }
        })

        // now in main request sheet again, if status is marked as canceled (regardless of how recent the change), push to array
        if(row.currentstatus == "Canceled") {
            canceledList.push(row.email)
        }

        // if not marked as canceled or yet confirmed, send confirmation email
        if(row.initialemail != "Confirmation Sent" && row.currentstatus != "Canceled") {

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
                    console.log('Email sent: ' + info.response);
                }
            });

            // after sent, write confirmation to spreadsheet
            row.initialemail = "Confirmation Sent"
            row.save()
            if(row.initialemail == "Confirmation Sent") {
                console.log("Email just sent")
            }
        }
        if(row.initialemail == "Confirmation Sent") {
            confirmedList.push(row.email)
        }
    })

    // console log which students have recieved a confirmation or have canceled
    console.log(`\nRequested: ${confirmedList.length}`)
    for(i=0; i < confirmedList.length; i++) {
        console.log(`\t${confirmedList[i]}`)
    }
    console.log(`\nCanceled: ${canceledList.length}`)
    for(i=0; i < canceledList.length; i++) {
        console.log(`\t${canceledList[i]}`)
    }
    console.log("\n")


}


// call main function
accessSpreadsheet();

