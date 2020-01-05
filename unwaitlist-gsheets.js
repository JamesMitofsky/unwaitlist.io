// description: this program checks google sheets to see if a new course request has been
//              made. If one has, then email the user with an email confirming their registration
//              or acknowledging that their CRN does not exist.

// npm install googleapis@39 --save nodemailer dotenv

// require google sheets
const GoogleSpreadsheet = require('google-spreadsheet');
const { promisify } = require('util');
// require emailing
const nodemailer = require('nodemailer');
// require environment variables
require('dotenv').config()

// build credential object
let creds = {
    type: process.env.type,
    project_id: process.env.project_id,
    private_key_id: process.env.private_key_id,
    private_key: JSON.parse(`"${process.env.private_key}"`), // escape newlines in string
    client_email: process.env.client_email,
    client_id: process.env.client_id,
    auth_uri: process.env.auth_uri,
    token_uri: process.env.token_uri,
    auth_provider_x509_cert_url: process.env.auth_provider_x509_cert_url,
    client_x509_cert_url: process.env.client_x509_cert_url,
}


// call main function
accessSpreadsheet()


// async to open spreadsheet
async function accessSpreadsheet() {
    let sheetId = '1DjsN1HiiS7Iv7lKNucjeoQ6aS0_291JAovZ0LfgOItM'
    const doc = new GoogleSpreadsheet(sheetId);

    // pass credentials to doc
    await promisify(doc.useServiceAccountAuth)(creds);
    const info = await promisify(doc.getInfo)();

    // load spreadsheets
    const requestSheet = info.worksheets[0];
    const cancelationSheet = info.worksheets[1];
    const staticCourseInfoSheet = info.worksheets[2] // TODO replace with local storage

    // log which sheets are loaded
    console.log(`\nLoaded Spreadsheets: "${requestSheet.title}" and "${cancelationSheet.title}" and "${staticCourseInfoSheet.title}" `);

    // declare rows objects
    const rowsOfRequestSheet = await promisify(requestSheet.getRows)({});
    const rowsOfCancelationSheet = await promisify(cancelationSheet.getRows)({})
    const rowsOfStaticCourseInfo = await promisify(staticCourseInfoSheet.getRows)({}) // todo: replace this with locally stored data

    console.log("Connected...")

    evaluateRequest(rowsOfRequestSheet, rowsOfCancelationSheet, rowsOfStaticCourseInfo)

}



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

                    if (isRegNumCanceled == false) {
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

        // send failure email
        // declare email contents
        let emailSubject = "Unfound CRN"
        let emailBody = `The system couldn't find the CRN you gave it - make sure you're in the right semester. If you think something went wrong here, bop me on Twitter @JamesTedesco802.
        
        Here's the CRN the system was testing for: ${row.courseregistrationnumber}`
        let emailRecipient = row.email
            // call email function
        sendEmail(emailSubject, emailBody, emailRecipient, row)

    }

    return status
}


// trying to return value from inside loop
function checkIfDuplicate(currentRequestRow, rowsOfRequestSheet) {

    // declare conditional
    let status = true

    rowsOfRequestSheet.forEach(checkingRow => {

        //if CRN is already requested & there's no live request pending, deny service
        if (currentRequestRow.courseregistrationnumber == checkingRow.courseregistrationnumber && checkingRow.currentstatus == "Watching") {

            console.log("Duplicate:", currentRequestRow.courseregistrationnumber, currentRequestRow.currentstatus)

            // log it on spreadsheet
            currentRequestRow.currentstatus = "Duplicate"
            currentRequestRow.save()

            // declare email contents
            let emailSubject = "Duplicate Request"
                // TODO: give user the date of when we started checking
            let emailBody = `It looks like we're already checking this class for you, but if this is a mistake, definitely bop me on Twitter @JamesTedesco802.\n\nHere's a link to the class your were looking at: https://www.uvm.edu/academics/courses/?term=202001&crn=${currentRequestRow.courseregistrationnumber}`
            let emailRecipient = currentRequestRow.email
                // call email function
            sendEmail(emailSubject, emailBody, emailRecipient, currentRequestRow)


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

            // mark canceled on the cancelationSheet
            canceledRow.cancelationstatus = "Handled"
            canceledRow.save()

            // mark canceled on the requestSheet
            row.currentstatus = "Canceled"
            row.save()

            // declare email contents
            let emailSubject = "Already Canceled Request"
            let emailBody = `I don't know how you managed it so quickly, but somehow your request already looks to be canceled.
            If this is a mistake, definitely bop me on Twitter @JamesTedesco802.
            
            Here's a link to the class your were looking at: https://www.uvm.edu/academics/courses/?term=202001&crn=${row.courseregistrationnumber}`
            let emailRecipient = row.email
                // call email function
            sendEmail(emailSubject, emailBody, emailRecipient, row)

            return status = false
        }
    })

    // return to main func that the class is not canceled
    return status
}


function confirmedRequest(row) {

    // if current status is still default (left blank), begin checking
    if (row.currentstatus == "") {
        // console.log() which student is currently being reviewed
        console.log("Available Class:", row.courseregistrationnumber, row.email)

        // declare email contents
        let emailSubject = "Unwaitlist Confirmation"
        let emailBody = `Unwaitlist is now checking your course: https://www.uvm.edu/academics/courses/?term=202001&crn=${row.courseregistrationnumber}`
        let emailRecipient = row.email
            // call email function
        sendEmail(emailSubject, emailBody, emailRecipient, row)

        // after sent, write confirmation to spreadsheet
        // row.initialemail = "Confirmation Sent"
        row.currentstatus = "Watching"
        row.save()
    }
}


function sendEmail(emailSubject, emailBody, emailRecipient, row) {
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
        to: emailRecipient,
        subject: emailSubject,
        text: emailBody
    };
    // send email
    transporter.sendMail(mailOptions, function(error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log(`Email sent to ${emailRecipient} --> ` + info.response);
        }
    });

    row.initialemail = "Confirmation Sent"
    row.save()
}