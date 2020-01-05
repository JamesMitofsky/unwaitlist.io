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
            console.log("\nEntered new section: missing confirmation\n")

            // declare boolean checkers
            let isRegNumInvalid = true
            let isRegNumDuplicate = true
            let isRegNumCanceled = true

            // check if CRN exists this semester and email user if unfound
            isRegNumInvalid = checkCRNValidity(row, rowsOfStaticCourseInfo)

            // if course num is valid, check if duplicate
            if (isRegNumInvalid == false) {
                isRegNumDuplicate = checkIfDuplicate(row, rowsOfRequestSheet)
                
                // if class is not duplicate, check if canceled
                if (isRegNumDuplicate == false) {
                    isRegNumCanceled = checkIfCanceled(row, rowsOfCancelationSheet)

                    if(isRegNumCanceled == false) {
                        confirmedRequest(row)
                    }

                }
            }

        }
    })

}



function checkCRNValidity(requestRow, rowsOfStaticCourseInfo) {

    // declare boolean
    let status = true
    
    // check to see if the CRN doesn't exist
    rowsOfStaticCourseInfo.forEach(infoRow => {

        // if CRN exists, return false
        if (infoRow.compnumb == requestRow.courseregistrationnumber) {
            // valid CRN - matches crn from database
            console.log("Valid CRN")
            return status = false
        }
    })

    if (status == true) {
        // invalid CRN
        requestRow.currentstatus = "Unfound CRN"
        requestRow.save()
    }

    return status
}


// trying to return value from inside loop
function checkIfDuplicate(currentRequestRow, rowsOfRequestSheet) {

    // declare conditional
    let status = true

    rowsOfRequestSheet.forEach(row => {

        //if CRN is already requested & there's no live request pending, deny service
        if (currentRequestRow == row && currentRequestRow.currentstatus == "Watching" || currentRequestRow.currentstatus == "Canceled") {
            // send failure email
            console.log("Duplicate")

            // log it on spreadsheet
            row.currentstatus = "Duplicate"
            row.save()

        } else {
            // otherwise, allow the program to continue running
            status = false

        }
    })
    return status
}



// check all combinations of requests and cancelations
function checkIfCanceled(row, rowsOfCancelationSheet) {

    let status = true

    rowsOfCancelationSheet.forEach(canceledRow => {

        // helps make if statement criteria human readable
        let sameEmail = canceledRow.email == row.email
        let sameCRN = canceledRow.courseregistrationnumber == row.courseregistrationnumber
        let notCanceled = row.currentstatus != "Canceled"

        // marks cancel request as dealt with
        let notHandled = canceledRow.cancelationstatus != "Handled"

        // if user email and class match, as well as they haven't yet canceled this class, handle the request
        if (sameEmail && sameCRN && notCanceled && notHandled) {
            // mark canceled on the requestSheet
            row.currentstatus = "Canceled"
            row.save()
            // mark canceled on the cancelationSheet
            canceledRow.cancelationstatus = "Handled"
            canceledRow.save()

            // console.log() whether a cancelation error occurred
            // if (row.currentstatus == "Canceled") {
            //     console.log("Successfully canceled for", row.email, row.courseregistrationnumber)
            // }

            return status = false
        }
    })
    
    // return to main func that the class is not canceled
    return status
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
    // console.log which sheets are loaded
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