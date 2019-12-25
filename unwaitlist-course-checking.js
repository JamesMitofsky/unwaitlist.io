// description: this program takes the list of currently pending classes from the google sheet and checks against the 
//              CSV file from UVM's database to see if their is course availability. If there is, it emails and calls
//              the respective student.

// dependencies: npm install require axios nodemailer twilio dotenv googleapis@39 --save

// Google Sheets
const GoogleSpreadsheet = require('google-spreadsheet');
const { promisify } = require('util');
const creds = require('./client_secret.json');
// page loading
const axios = require("axios");
// email
const nodemailer = require('nodemailer');
// environment variables
require('dotenv').config()



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
    // don't know how to store client secrets in Azure functions
    await promisify(doc.useServiceAccountAuth)(creds);
    const info = await promisify(doc.getInfo)();
    // load request spreadsheet
    const requestSheet = info.worksheets[0];
    console.log(`\nLoaded Spreadsheet "${requestSheet.title}"`)

    // parse request spreadsheet by rows
    const rowsOfRequestSheet = await promisify(requestSheet.getRows)({
    });

    // loop through request sheet rows
    rowsOfRequestSheet.forEach(row => {
        // loop through rows of open sheet
        openCourses.forEach(course => {

            // same CRNs and current status is marked as watching
            // if not marked as canceled, open prior to now, and the CRNs from open courses and requested match
            if (row.courseregistrationnumber == course.crn && row.requeststatus == "Watching") {

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
                    // declare current student as email recipient
                    to: row.email,
                    subject: 'Your Course is Open!',
                    text: `Use this CRN to sign up: ${row.courseregistrationnumber}\n\n https://www.uvm.edu/academics/courses/?term=202001&crn=${row.courseregistrationnumber}`
                };
                // send email
                transporter.sendMail(mailOptions, function (error, info) {
                    if (error) {
                        console.log(error);
                    } else {
                        console.log(`Email sent to ${row.email} --> ` + info.response);
                    }
                });


                // begin working with Twilio -- declare credentials
                const accountSid = process.env.TWILIO_SID;
                const authToken = process.env.TWILIO_TOKEN;
                const client = require('twilio')(accountSid, authToken);

                // initiate call to specific student
                client.calls
                    .create({
                        url: 'http://twimlets.com/echo?Twiml=Your%20course%20is%20now%20open.%20Check%20your%20email%20for%20the%20Course%20Registration%20Number.&',
                        to: `+1${row.phonenumber}`,
                        from: '+19088384751'
                    })

                row.requeststatus = "Available: notification sent"
                row.save()
                console.log("Email and call sent")
            }
        })
    })
    console.log("\nProgram end")
}

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

main()