// description: this program checks google sheets to see if a new course request has been
//              made. If one has, then email the user with an email confirming their registration
//              or acknowledging that their CRN does not exist.


// require google sheets
const GoogleSpreadsheet = require('google-spreadsheet');
const { promisify } = require('util');
// require emailing
const nodemailer = require('nodemailer');
// require environment variables
require('dotenv').config()
    // website loading
const axios = require("axios");
//  Twilio credentials
const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_TOKEN;
const client = require('twilio')(accountSid, authToken);

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
    let testId = '1wtHWjTTWn9LNp4r8_xJiGGiO-YV4PsoQ_gWTeahbUxs'

    // IMPORTANT: connecting to test or actual doc
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
    const rowsOfStaticCourseInfo = await promisify(staticCourseInfoSheet.getRows)({}) // TODO (maybe): replace this with locally stored data

    console.log("Connected...")

    evaluateRequest(rowsOfRequestSheet, rowsOfCancelationSheet, rowsOfStaticCourseInfo)

}



// send confirmation info
async function evaluateRequest(rowsOfRequestSheet, rowsOfCancelationSheet, rowsOfStaticCourseInfo) {


    // declare enrollment csv location
    const csvFile = "https://giraffe.uvm.edu/~rgweb/batch/curr_enroll_fall.txt"
        // fall enrollment: https://giraffe.uvm.edu/~rgweb/batch/curr_enroll_fall.txt
        // spring enrollment: https://giraffe.uvm.edu/~rgweb/batch/curr_enroll_spring.txt

    // open and parse csvFile into object
    const allCourseData = await getCourseInfo(csvFile)
        // process allCourseData into open/closed catagorizations
    const [openCourses, closedCourses] = await getProcessedCourseInfo(allCourseData)


    // iterate through every row of main request sheet
    rowsOfRequestSheet.forEach(row => {

        // check if we need to process, otherwise leave immediately
        let rowHasData = row.courseregistrationnumber != ""
            // if currentStatus is blank, user hasn't been processed - testing to phase out the confirmation sent column
        let confirmationNotSent = row.currentstatus == ""
        let unhandledRequest = rowHasData && confirmationNotSent
            // if the request has already been handled, check if duplicate or unique
        if (unhandledRequest) {
            console.log("\nEntered new section: missing confirmation\n")

            // check if class is canceled, otherwise leave immediately
            if (!checkIsCanceled(row, rowsOfCancelationSheet, rowsOfStaticCourseInfo)) { return }

            // TODO: import all course names locally so this can be reactivated
            //  if CRN does not exist, then exit immediately
            if (!checkCRNIsValid(row, rowsOfStaticCourseInfo)) { return }

            // if crn is non unique (duplicate), then exit immediately
            if (!checkIfIsUnique(row, rowsOfRequestSheet, rowsOfStaticCourseInfo)) { return }

            // if we've passed all the checks, process the row
            confirmRequest(row, rowsOfStaticCourseInfo)
        } else if (row.currentstatus == "Watching") { // check class only if the initial request has already been handled
            // if canceled, no need to continue
            if (!checkIsCanceled(row, rowsOfCancelationSheet, rowsOfStaticCourseInfo)) { return }
            // if available, end here, because no need to get double confirmation with cross listings
            if (!checkIsAvailable(row, rowsOfStaticCourseInfo, openCourses, row.courseregistrationnumber)) { return }

            // UNDER_DEVELOPMENT: if unavailable or unwatched from last function, try this
            // checkCrossListingAvailability(row, rowsOfStaticCourseInfo, openCourses)
        }



    })
}



async function checkCRNIsValid(currentRow, rowsOfStaticCourseInfo) {

    // check to see if the CRN doesn't exist
    let crnExists = rowsOfStaticCourseInfo.some(r => r.compnumb == currentRow.courseregistrationnumber)
    if (crnExists) { return true } // isValid

    currentRow.currentstatus = "Unfound CRN"
    currentRow.save()


    // declare email contents
    let emailRecipient = currentRow.email
    let emailSubject = "Unfound CRN"
    let emailBody = `The system couldn't find the CRN provided. 
                     Please make sure you're in the right semester. 
                     If you think something went wrong here, bop me on Twitter 
                     <a href="https://twitter.com/JamesTedesco802">@JamesTedesco802</a>.
 
                     Here's the CRN the system was testing for: ${currentRow.courseregistrationnumber}
                     <br/><br/>
                     <img height="350" src="https://unwaitlist.io/email_assets/PNGs/unfound_CRN.png" alt="Unfound_CRN Image">`
        // call email function
    contactUser(emailSubject, emailBody, emailRecipient)


    console.log("Invalid CRN")

    return false // invalid
}



// check all combinations of requests and cancelations
async function checkIsCanceled(currentRow, rowsOfCancelationSheet, rowsOfStaticCourseInfo) {

    // let cancelationRequested = rowsOfCancelationSheet.some(canceledRow => {
    //     canceledRow.email == row.email &&
    //     canceledRow.courseregistrationnumber == row.courseregistrationnumber &&
    //     canceledRow.cancelationstatus != "Handled"
    // })

    // if (!cancelationRequested) { return false }

    let isCanceled = false

    rowsOfCancelationSheet.forEach(canceledRow => {

        // helps make if statement criteria human readable
        let sameEmail = canceledRow.email == currentRow.email
        let sameCRN = canceledRow.courseregistrationnumber == currentRow.courseregistrationnumber
            // not needed because field will be blank since the request is new
            // let stillActive = currentRow.currentstatus == "Watching"
        let notHandled = canceledRow.cancelationstatus != "Handled"
        let cancelationRequested = sameEmail && sameCRN && notHandled

        // if user email and class match, as well as they haven't yet canceled this class, handle the request
        if (cancelationRequested) {

            isCanceled = true

            // update gSheets
            currentRow.currentstatus = "Canceled"
            currentRow.save()
                // also mark cancelation sheet
            canceledRow.cancelationstatus = "Handled"
            canceledRow.save()

            let rowOfCourseName = rowsOfStaticCourseInfo.find(dataRow => {
                return dataRow.compnumb == canceledRow.courseregistrationnumber
            })

            let courseName = rowOfCourseName.title

            // declare email contents
            let emailRecipient = currentRow.email
            let emailSubject = "Cancelation Processed"
            let emailBody = `Your cancelation request has been successfully processed. Unwaitlist is no longer tracking <a href="https://www.uvm.edu/academics/courses/?term=202009&crn=${currentRow.courseregistrationnumber}">${courseName}</a>
            If this is a mistake, definitely bop me on Twitter @JamesTedesco802.
            <br/><br/>
            <img height="350" src="https://unwaitlist.io/email_assets/PNGs/canceled.png" alt="Canceled course image">`
                // call email function
            contactUser(emailSubject, emailBody, emailRecipient)
            console.log("Canceled")


        }
    })
    return isCanceled

}


// trying to return value from inside loop
async function checkIfIsUnique(currentRequestRow, rowsOfRequestSheet, rowsOfStaticCourseInfo) {

    let foundDuplicate = rowsOfRequestSheet.some(row => {
        return row.courseregistrationnumber === currentRequestRow.courseregistrationnumber && // same course request
            row.email === currentRequestRow.email && // same user
            row.currentstatus === "Watching" // there is already a live tracking request
    })

    // if not found duplicate, we are unique - return valid
    if (!foundDuplicate) { return true }


    // update gSheet
    currentRequestRow.currentstatus = "Duplicate"
    currentRequestRow.save()

    let rowOfCourseName = rowsOfStaticCourseInfo.find(dataRow => {
        return dataRow.compnumb == currentRequestRow.courseregistrationnumber
    })

    let courseName = rowOfCourseName.title


    // declare email contents
    let emailRecipient = currentRequestRow.email
    let emailSubject = "Duplicate Request"
        // TODO: give user the date of when we started checking
    let emailBody = `It looks like we're already checking <a href="https://www.uvm.edu/academics/courses/?term=202009&crn=${currentRequestRow.courseregistrationnumber}">${courseName}</a> for you, but if this is a mistake, 
    definitely bop me on Twitter <a href="https://twitter.com/JamesTedesco802">@JamesTedesco802</a>.
    <br/><br/>
    <img height="350" src="https://unwaitlist.io/email_assets/PNGs/duplicate.png" alt="canceled test image">`

    // call email function
    contactUser(emailSubject, emailBody, emailRecipient)

    return false; //invalid
}


async function confirmRequest(row, rowsOfStaticCourseInfo) {

    // if current status is still default (left blank), begin checking
    if (row.currentstatus == "") {
        // console.log() which student is currently being reviewed
        console.log("Now checking valid CRN:", row.courseregistrationnumber, row.email)

        let rowOfCourseName = rowsOfStaticCourseInfo.find(dataRow => {
            return dataRow.compnumb == row.courseregistrationnumber
        })

        let courseName = rowOfCourseName.title


        // update gSheet
        row.currentstatus = "Watching"
        row.save()


        // declare email contents
        let emailSubject = "Unwaitlist Confirmation"
        let emailBody = `Sorry for the delay - I was just bopping through the code.
        <br/><br/>
        Unwaitlist is now checking your course: <a href="https://www.uvm.edu/academics/courses/?term=202009&crn=${row.courseregistrationnumber}">${courseName}</a>
        <br/><br/>
        <img height="350" src="https://unwaitlist.io/email_assets/PNGs/confirmation_sent.png" alt="Gallant unicorn image">`
        let emailRecipient = row.email
            // call email function
        contactUser(emailSubject, emailBody, emailRecipient)

    }
}


// checks to see if class has spot
function checkIsAvailable(row, rowsOfStaticCourseInfo, openCourses, CRN) {


    // loop through items of open courses object
    openCourses.forEach(openCourse => {

        // if course is open and status is marked as watching, email student
        let courseHasAvailability = CRN == openCourse.crn

        // if the course is unavailable, step out of function
        if (!courseHasAvailability) { return false }


        let rowOfCourseName = rowsOfStaticCourseInfo.find(dataRow => {
            return dataRow.compnumb == row.courseregistrationnumber
        })

        // update gSheet
        row.currentstatus = "Availability notified"
        row.save()

        // declare email contents
        let courseName = rowOfCourseName.title
        let cellNumber = row.phonenumber
        let textMsg = `Your Course is Open! Here's the CRN: ${row.courseregistrationnumber}`
        let emailRecipient = row.email
        let emailSubject = "Your Course is Open!"
        let emailBody = `Your class, <a href="https://www.uvm.edu/academics/courses/?term=202009&crn=${row.courseregistrationnumber}">${courseName}</a>, now has availability.
    <br/><br/>
    Use this CRN to sign up: ${row.courseregistrationnumber}
    <br/><br/>
    <img height="350" src="https://unwaitlist.io/email_assets/PNGs/notified.png" alt="canceled test image">`
        contactUser(emailSubject, emailBody, emailRecipient, cellNumber, textMsg)


    })

    // course has availability
    return true

}

// indexes UVM's CSV file
async function getCourseInfo(csvLink) {
    // use axios to load CSV file
    try {
        let response = await axios.get(csvLink);
        csvDoc = response.data
    } catch (error) {
        console.error(error);
    }

    // removes quotations from all cells and adds each row to an array
    csvRows = csvDoc.replace(/"/g, '').split('\n')

    // set url parameters
    const baseURL = "https://www.uvm.edu/academics/courses/?term=202009&crn="
        // will contain cell information from upcoming loop
    let csvRowCells = []
        // stores all class info
    let allCourses = []
        // indexer
    let courseListPosition = 0

    // split rows into cells
    for (i = 0; i < csvRows.length; i++) {
        const row = csvRows[i]
        csvRowCells.push(row.split(','))

        // i must be > 0 to skip the headers and the row must have content to avoid an error
        if (i > 0 && row != '') {

            // give simple names for composed variables
            let currentCRN = await csvRowCells[i][3].trim()
            let currentLink = await baseURL + currentCRN
            let maxClassSeats = await parseInt(csvRowCells[i][9].trim())
            let numOfStudentsEnrolled = await parseInt(csvRowCells[i][10].trim())

            // start working with object
            allCourses[courseListPosition] = {
                link: currentLink,
                crn: currentCRN,
                numOfStudentsEnrolled,
                maxClassSeats,
            }

            // sorts classes based on whether there is space for at least one more student
            if (numOfStudentsEnrolled < maxClassSeats) {
                allCourses[courseListPosition].availabilityStatus = "Open"
            } else {
                allCourses[courseListPosition].availabilityStatus = "Closed"
            }

            // increment indexer
            courseListPosition++

        }
    }

    return {
        allCourses
    }
}

// evaluates data from UVM's CSV file
function getProcessedCourseInfo(unprocessedData) {

    // create arrays for differentiation of allCourses
    let openCourses = []
    let closedCourses = []

    // differentiate between open and closed courses
    for (course of unprocessedData.allCourses) {
        if (course.availabilityStatus == "Open") {
            openCourses.push(course)
        } else {
            closedCourses.push(course)
        }
    }

    // report how many classes are open and full
    console.log("Open:", openCourses.length, "\nClosed:", closedCourses.length)

    return [
        openCourses,
        closedCourses
    ]
}


function checkCrossListingAvailability(row, rowsOfStaticCourseInfo, openCourses) {

    // convert xListings from spreadsheet to array
    let arrayOfCrossListings = []
    rowsOfStaticCourseInfo.forEach(staticDataRow => {

        // if cell is empty, end function
        if (staticDataRow.crosslistings.length == 0) { return }

        // remove commas from spreadsheet cell
        let crossListingCell = staticDataRow.crosslistings.replace(/,/g, "");

        // match digits at intervals of 5 through the entire string
        let rowOfCrossListings = crossListingCell.match(/\d{5}/g);

        // load these segments as array items
        arrayOfCrossListings.push(rowOfCrossListings)
    })


    // for each xListing cell, seek through all items
    arrayOfCrossListings.forEach(crossListingGroup => {

        // if main CRN of xListing array doesn't match request CRN, end function
        if (crossListingGroup[0] != row.courseregistrationnumber) { return }

        // request CRN matches, so check entire xListing Group
        crossListingGroup.forEach(courseNum => {

            // skip the first CRN (it's the main request & has already been checked)
            if (courseNum == crossListingGroup[0]) { return }

            // print true/false based on availability of all other xListings
            console.log(checkIsAvailable(row, rowsOfStaticCourseInfo, openCourses, courseNum))

        })

    })

}

// sends email with passed contents
async function contactUser(emailSubject, emailBody, emailRecipient, cellNumber, textMsg) {

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

    //pretend email
    // console.log(`Pretend email sent to ${emailRecipient} with subject: ${emailSubject}\n${emailBody}\n\n`)

    // send email - fire & forget
    transporter.sendMail(mailOptions, function(error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log(`${emailSubject} email sent to ${emailRecipient} --> ` + info.response);
        }
    });

    if (emailSubject == "Your Course is Open!") {
        client.messages
            .create({ body: textMsg, from: '+18022103669 ', to: cellNumber })
            .then(message => console.log(message.sid));
    }
}