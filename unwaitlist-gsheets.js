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


// send confirmation info
function evaluateRequest(rowsOfRequestSheet, rowsOfCancelationSheet, rowsOfStaticCourseInfo) {


    // iterate through every row of main request sheet
    rowsOfRequestSheet.forEach(row => {

        // first, make sure this is a new user by checking they haven't been confirmed with but the line isn't blank
        if (row.courseregistrationnumber != "" && row.initialemail != "Confirmation Sent") {

            console.log("\nEntered new section: missing confirmation")

            // indicate if duplicate
            console.log("Testing for duplicate")
            let duplicateStatus = checkIfDuplicate(row, rowsOfRequestSheet)
            // trying to extract true/false value from called function
            console.log(duplicateStatus)

            // create variable outside of if-statement
            let validityOfCRN = true

            if (duplicateStatus === false) {
                console.log("failed duplicate test")
                // ensure CRN exists for current semester, and email user if unfound
                validityOfCRN = checkCRNValidity(row, rowsOfStaticCourseInfo)

                //trying to evaluate validity as false here and pass that out of this if-statement
                console.log("validity logged as false", validityOfCRN)

            } else if (validityOfCRN === false) {
                // this seems like it should be part of the main program
                // if email and crn from cancelation sheet match (and not already handled), mark cancelation on request sheet
                checkIfCanceled(row, rowsOfCancelationSheet)

            } else {
                // if valid request, send confirmation to student
                confirmedRequest(row)

            }

        }
    })

}

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

function checkIfDuplicate(currentRequestRow, rowsOfRequestSheet) {
    rowsOfRequestSheet.forEach(row => {
        if (currentRequestRow == row) {
            // send duplicate email
            console.log("Duplicate")
            let confirmedDuplicate = true
            return confirmedDuplicate
        }
    })
}

function checkCRNValidity(requestRow, rowsOfStaticCourseInfo) {
    rowsOfStaticCourseInfo.forEach(infoRow => {
        if (infoRow.compnumb != requestRow.courseregistrationnumber) {
            requestRow.currentstatus = "Unfound CRN"
            requestRow.save()
            // send unfound email
            console.log("Unfound CRN")
            return false
        }
    })
}

function confirmedRequest(row) {
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

    // replace with local storage
    const staticCourseInfoSheet = info.worksheets[2]
    // console.log() show which sheets are loaded
    console.log(`\nLoaded Spreadsheets: "${requestSheet.title}" and "${cancelationSheet.title}" and "${staticCourseInfoSheet.title}" `);

    // declare rows objects
    const rowsOfRequestSheet = await promisify(requestSheet.getRows)({
    });
    const rowsOfCancelationSheet = await promisify(cancelationSheet.getRows)({
    })

    // replace this with locally stored data
    const rowsOfStaticCourseInfo = await promisify(staticCourseInfoSheet.getRows)({
    })

    console.log("connected")
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

