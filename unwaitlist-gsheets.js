// description: this program checks google sheets to see if a new course request has been
//              made. If one has, then email the user with an email confirming their registration
//              or acknowledging that their CRN does not exist.

// npm install googleapis@39 --save nodemailer dotenv

// require google sheets
const GoogleSpreadsheet = require('google-spreadsheet');
const { promisify } = require('util');
const creds = require('./client_secret.json');
// require emailing
const nodemailer = require('nodemailer');
// require environment variables
require('dotenv').config()

// this function is in a loop checking all combinations of requests and cancelations
function checkIfCanceled(row, rowsOfCancelationSheet) {
    rowsOfCancelationSheet.forEach(canceledRow => {
        // helps make if statement criteria human readable
        let sameEmail = canceledRow.email == row.email
        let sameCRN = canceledRow.courseregistrationnumber == row.courseregistrationnumber
        let notCanceled = row.currentstatus != "Canceled"
        // this is important to make sure a user isn't forever prevented from reactivating that CRN
        let notHandled = canceledRow.cancelationstatus != "Handled"

        if (sameEmail && sameCRN && notCanceled && notHandled) {
            row.currentstatus = "Canceled"
            row.save()
            canceledRow.cancelationstatus = "Handled"
            canceledRow.save()

            // console.log() whether a cancelation error occurred
            if (row.currentstatus == "Canceled") {
                console.log("Successfully canceled for", row.email, row.courseregistrationnumber)
            } else {
                console.log("Error: cancelation not logged", row.email)
            }
        }
    })
}

function checkCRNValidity(row, rowsOfStaticCourseInfo) {
    rowsOfStaticCourseInfo.forEach(infoRow => {
        if (infoRow.compnumb != row.courseregistrationnumber) {
            row.currentstatus = "Unfound CRN"
            row.save()
            // send unfound email
            console.log("Unfound CRN")
        }
    })
}

function unfoundCRN(currentRow, rowsOfRequestSheet) {
    rowsOfRequestSheet.forEach(row => {
        if (currentRow == row) {
            // send duplicate email
            console.log("Duplicate")
        }
    })
}


// send confirmation info
function evaluateRequest(rowsOfRequestSheet, rowsOfCancelationSheet, rowsOfStaticCourseInfo) {

    // iterate through every row of main request sheet
    rowsOfRequestSheet.forEach(row => {

        // first, make sure this is a new user by checking they haven't been confirmed with but the line isn't blank
        if (row.courseregistrationnumber != "" && row.initialemail != "Confirmation Sent") {

            // if email and crn from cancelation sheet match (and not already handled), mark cancelation on request sheet
            checkIfCanceled(row, rowsOfCancelationSheet)

        //roll these into a single if statement with elifs for other conditions
            // ensure CRN exists for current semester, and email user if unfound
            checkCRNValidity(row, rowsOfStaticCourseInfo)
            // indicate if duplicate
            unfoundCRN(row, rowsOfRequestSheet)
            // send email if confirming request enrollment
            // confirmedRequest()

            // if neither marked canceled nor confirmed, send confirmation email
            if (row.currentstatus != "Canceled" && row.currentstatus != "Unfound CRN") {
                // console.log() which student is currently being reviewed
                console.log("Available Class:", row.courseregistrationnumber, row.email)

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
                    // set user email
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
        }
    })

}


// async to open spreadsheet
async function accessSpreadsheet() {
    const doc = new GoogleSpreadsheet('1DjsN1HiiS7Iv7lKNucjeoQ6aS0_291JAovZ0LfgOItM');
    // don't know how to store client secrets in Azure functions
    await promisify(doc.useServiceAccountAuth)(creds);
    const info = await promisify(doc.getInfo)();
    // load spreadsheets
    const requestSheet = info.worksheets[0];
    const cancelationSheet = info.worksheets[1];
    const staticCourseInfoSheet = info.worksheets[2]
    // console.log() show which sheets are loaded
    console.log(`\nLoaded Spreadsheets: "${requestSheet.title}" and "${cancelationSheet.title}" and "${staticCourseInfoSheet.title}" `);

    // declare rows objects
    const rowsOfRequestSheet = await promisify(requestSheet.getRows)({
    });
    const rowsOfCancelationSheet = await promisify(cancelationSheet.getRows)({
    })
    const rowsOfStaticCourseInfo = await promisify(staticCourseInfoSheet.getRows)({
    })

    evaluateRequest(rowsOfRequestSheet, rowsOfCancelationSheet, rowsOfStaticCourseInfo)


    // console log which students have recieved a confirmation or have canceled
    // const canceledList = []
    // const watchingList = []

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
accessSpreadsheet()

