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
async function evaluateRequest(rowsOfRequestSheet, rowsOfCancelationSheet, rowsOfStaticCourseInfo) {


    // iterate through every row of main request sheet
    rowsOfRequestSheet.forEach(row => {

        // check if we need to process, otherwise leave immediately
        let rowHasData = row.courseregistrationnumber != ""
        // if currentStatus is blank, user hasn't been processed - testing to phase out the confirmation sent column
        let confirmationNotSent = row.currentstatus == ""
        let needToProcess = rowHasData && confirmationNotSent
        if (!needToProcess) { return }

        console.log("\nEntered new section: missing confirmation\n")

        // check if class is canceled, otherwise leave immediately
        if (!checkIsCanceled(row, rowsOfCancelationSheet)) { return }

        //  if CRN does not exist, then exit immediately
        if (!checkCRNIsValid(row, rowsOfStaticCourseInfo)) { return }

        // if crn is non unique (duplicate), then exit immediately
        if (!checkIfIsUnique(row, rowsOfRequestSheet)) { return }

        // if we've passed all the checks, process the row
        confirmedRequest(row, rowsOfStaticCourseInfo)

    })
}



async function checkCRNIsValid(row, rowsOfStaticCourseInfo) {

    // check to see if the CRN doesn't exist
    let crnExists = rowsOfStaticCourseInfo.some(r => r.compnumb == row.courseregistrationnumber)
    if (crnExists) return true; // isValid


    // declare email contents
    let messageType = "Unfound CRN"
    let emailRecipient = row.email
    let emailSubject = "Unfound CRN"
    let emailBody = `The system couldn't find the CRN provided. 
                     Please make sure you're in the right semester. 
                     If you think something went wrong here, bop me on Twitter 
                     <a href="https://twitter.com/JamesTedesco802">@JamesTedesco802</a>.
 
                     Here's the CRN the system was testing for: ${row.courseregistrationnumber}`
    // call email function
    sendEmail(emailSubject, emailBody, emailRecipient, row, messageType)


    console.log("Invalid CRN")

    return false // invalid
}



// check all combinations of requests and cancelations
async function checkIsCanceled(row, rowsOfCancelationSheet) {

    // let cancelationRequested = rowsOfCancelationSheet.some(canceledRow => {
    //     canceledRow.email == row.email &&
    //     canceledRow.courseregistrationnumber == row.courseregistrationnumber &&
    //     canceledRow.cancelationstatus != "Handled"
    // })

    // if (!cancelationRequested) { return false }

    let isCanceled = false

    rowsOfCancelationSheet.forEach(canceledRow => {

        // helps make if statement criteria human readable
        let sameEmail = canceledRow.email == row.email
        let sameCRN = canceledRow.courseregistrationnumber == row.courseregistrationnumber
        // let notCanceled = row.currentstatus != "Canceled"
        let notHandled = canceledRow.cancelationstatus != "Handled"
        let cancelationRequested = sameEmail && sameCRN && notHandled

        // if user email and class match, as well as they haven't yet canceled this class, handle the request
        if (cancelationRequested) {

            isCanceled = true

            // declare email contents
            messageType = "Canceled"
            let emailRecipient = row.email
            let emailSubject = "Already Canceled Request"
            let emailBody = `I don't know how you managed it so quickly, but somehow your request already looks to be canceled.
            If this is a mistake, definitely bop me on Twitter @JamesTedesco802.
            <br/><br/>
            Here's a link to the class your were looking at: https://www.uvm.edu/academics/courses/?term=202001&crn=${row.courseregistrationnumber}`
            // call email function
            sendEmail(emailSubject, emailBody, emailRecipient, row, messageType, canceledRow)
            console.log("Canceled")


        }
    })
    return isCanceled

}


// trying to return value from inside loop
async function checkIfIsUnique(currentRequestRow, rowsOfRequestSheet) {

    let foundDuplicate = rowsOfRequestSheet.some(row => {
        return row.courseregistrationnumber === currentRequestRow.courseregistrationnumber && // same course request
            row.email === currentRequestRow.email && // same user
            row.currentstatus === "Watching" // there is already a live tracking request
    })

    // if not found duplicate, we are unique - return valid
    if (!foundDuplicate) { return true }


    // declare email contents
    let messageType = "Duplicate"
    let emailRecipient = currentRequestRow.email
    let emailSubject = "Duplicate Request"
        // TODO: give user the date of when we started checking
    let emailBody = `It looks like we're already checking this class for you, but if this is a mistake, 
    definitely bop me on Twitter <a href="https://twitter.com/JamesTedesco802">@JamesTedesco802</a>.
    <br/><br/>
    
    Here's a link to the class your were looking at: 
    
    <a href="https://www.uvm.edu/academics/courses/?term=202001&crn=${currentRequestRow.courseregistrationnumber}">
        CRN #${currentRequestRow.courseregistrationnumber}
    </a>`

    // call email function
    sendEmail(emailSubject, emailBody, emailRecipient, currentRequestRow, messageType)

    return false; //invalid
}


async function confirmedRequest(row, rowsOfStaticCourseInfo) {

    // if current status is still default (left blank), begin checking
    if (row.currentstatus == "") {
        // console.log() which student is currently being reviewed
        console.log("Now checking valid CRN:", row.courseregistrationnumber, row.email)

        let rowOfCourseName = rowsOfStaticCourseInfo.find(dataRow => {
            return dataRow.compnumb == row.courseregistrationnumber
        })

        let courseName = rowOfCourseName.title


        // declare email contents
        let messageType = "Watching"
        let emailSubject = "Unwaitlist Confirmation"
        let emailBody = `Unwaitlist is now checking your course: <a href="https://www.uvm.edu/academics/courses/?term=202001&crn=${row.courseregistrationnumber}">${courseName}</a>`
        let emailRecipient = row.email
        // call email function
        sendEmail(emailSubject, emailBody, emailRecipient, row, messageType)

    }
}


async function sendEmail(emailSubject, emailBody, emailRecipient, row, messageType, canceledRow) {

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
        html: emailBody
    };

    // send email - fire & forget
    transporter.sendMail(mailOptions, function(error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log(`Email sent to ${emailRecipient} --> ` + info.response);
        }
    });


    // update tracking status from in this email function
    if (messageType == "Watching") {
        row.currentstatus = messageType
        row.save()
    } else if (messageType == "Unfound CRN") {
        row.currentstatus = messageType
        row.save()
    } else if (messageType == "Duplicate") {
        row.currentstatus = messageType
        row.save()
    } else if (messageType == "Canceled") {
        row.currentstatus = messageType
        row.save()
        // also mark cancelation sheet
        canceledRow.cancelationstatus = "Handled"
        canceledRow.save()
    }

}