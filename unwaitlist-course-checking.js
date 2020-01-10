// description: this program takes the list of currently pending classes from the google sheet and checks against the 
//              CSV file from UVM's database to see if their is course availability. If there is, it emails and calls
//              the respective student.

// dependencies: npm install require axios nodemailer twilio dotenv googleapis@39 --save

// gSheets
const GoogleSpreadsheet = require('google-spreadsheet');
const { promisify } = require('util');
// website loading
const axios = require("axios");
// emailing
const nodemailer = require('nodemailer');
require('dotenv').config()
// calling
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




main()

// async to respect child functions (at least, I think so)
async function main() {

    // declare enrollment csv location
    const csvFile = "https://giraffe.uvm.edu/~rgweb/batch/curr_enroll_spring.txt"
    // fall enrollment: https://giraffe.uvm.edu/~rgweb/batch/curr_enroll_fall.txt

    // open and parse csvFile into object
    const allCourseData = await getCourseInfo(csvFile)

    // process allCourseData into open/closed catagorizations
    const [openCourses, closedCourses] = await getProcessedCourseInfo(allCourseData)

    // check gSheet for which students need to be contacted about open courses
    accessSpreadsheet(openCourses)
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
    const baseURL = "https://www.uvm.edu/academics/courses/?term=202001&crn="
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
            let maxClassSeats = await parseInt(csvRowCells[i][8].trim())
            let numOfStudentsEnrolled = await parseInt(csvRowCells[i][9].trim())

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

// open spreadsheet
async function accessSpreadsheet(openCourses) {
    const doc = new GoogleSpreadsheet('1DjsN1HiiS7Iv7lKNucjeoQ6aS0_291JAovZ0LfgOItM')
    await promisify(doc.useServiceAccountAuth)(creds);
    const info = await promisify(doc.getInfo)();
    const requestSheet = info.worksheets[0];
    const staticCourseInfoSheet = info.worksheets[2];
    console.log(`\nLoaded Spreadsheet "${requestSheet.title}" and "${staticCourseInfoSheet.title}"`)

    // parse request spreadsheet by rows
    const rowsOfRequestSheet = await promisify(requestSheet.getRows)({});
    const rowsOfStaticCourseInfo = await promisify(staticCourseInfoSheet.getRows)({}) // todo: replace this with locally stored data

    // loop through request sheet rows
    rowsOfRequestSheet.forEach(row => {
        // loop through rows of open sheet
        openCourses.forEach(openCourse => {

            // if course is open and status is marked as watching, email student
            let courseHasAvailability = row.courseregistrationnumber == openCourse.crn
            let courseIsBeingWatched = row.currentstatus == "Watching"
            if (courseHasAvailability && courseIsBeingWatched) {

                // save to spreadsheet early to avoid double calls
                row.currentstatus = "Available: notification sent"
                row.save()

                let rowOfCourseName = rowsOfStaticCourseInfo.find(dataRow => {
                    return dataRow.compnumb == row.courseregistrationnumber
                })


                // declare email contents
                let courseName = rowOfCourseName.title
                let emailRecipient = row.email
                let emailSubject = "Your Course is Open!"
                let emailBody = `Your class, <a href="https://www.uvm.edu/academics/courses/?term=202001&crn=${row.courseregistrationnumber}">${courseName}</a>, now has availability.
                <br/><br/>
                Use this CRN to sign up: ${row.courseregistrationnumber}`

                // call email function
                sendEmail(emailSubject, emailBody, emailRecipient, row)
            }

        })
    })
}

async function sendEmail(emailSubject, emailBody, emailRecipient, row) {

    // begin using nodemailer -- declare email credentials
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
        to: emailRecipient,
        subject: emailSubject,
        html: emailBody
    };
    // send email
    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log(`Email sent to ${row.email} --> ` + info.response);
        }
    });

    // initiate call to specific student
    client.calls
        .create({
            // Message: "A class that Unwaitlist has been watching for you is now open. Check your email for the CRN."
            url: 'http://twimlets.com/echo?Twiml=%3CResponse%3E%3CSay%3EA%20class%20that%20Unwaitlist%20has%20been%20watching%20for%20you%20is%20now%20open.%20Check%20your%20email%20for%20the%20CRN.%3C%2FSay%3E%3C%2FResponse%3E&',
            to: `+1${row.phonenumber}`,
            from: '+19088384751'
        })


    console.log("Notified student")
}