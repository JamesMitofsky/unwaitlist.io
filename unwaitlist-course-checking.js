// dependencies: npm install require axios nodemailer twilio dotenv googleapis@39 --save

// Google Sheets
const GoogleSpreadsheet = require('google-spreadsheet');
const { promisify } = require('util');
const creds = require('./client_secret.json')
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

    let openCourses = []
    let closedCourses = []


    for (course of unprocessedData.allCourses) {
        if (course.availabilityStatus == "Open") {
            openCourses.push(course)
        } else {
            closedCourses.push(course)
        }
    }

    // report how many classes are open and full
    // console.log("Open:", openCourses.length, "\nClosed:", closedCourses.length)

    return [
        openCourses,
        closedCourses
    ]
}

// async to open spreadsheet
async function accessSpreadsheet(openCourses) {
    const doc = new GoogleSpreadsheet('1DjsN1HiiS7Iv7lKNucjeoQ6aS0_291JAovZ0LfgOItM')
    // don't know how to store client secrets in Azure functions
    await promisify(doc.useServiceAccountAuth)(creds);
    const info = await promisify(doc.getInfo)();
    const requestSheet = info.worksheets[0];
    console.log(`\nLoaded Spreadsheet "${requestSheet.title}"`)

    // declare rows object
    const rowsOfRequestSheet = await promisify(requestSheet.getRows)({
    });

    //if crn from gSheet is in openCourses array, execute
    rowsOfRequestSheet.forEach(row => {
        openCourses.forEach(course => {

            // if not marked as canceled, open prior to now, and the CRNs from open courses and requested match
            if (row.courseregistrationnumber == course.crn && row.currentstatus != "Open: notification sent" && row.currentstatus != "Canceled") {

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
                    subject: 'Your Course is Open!',
                    text: `Use this CRN to sign up: ${row.courseregistrationnumber}\n\n https://www.uvm.edu/academics/courses/?term=202001&crn=${row.courseregistrationnumber}`
                };

                transporter.sendMail(mailOptions, function (error, info) {
                    if (error) {
                        console.log(error);
                    } else {
                        console.log(`Email sent to ${row.email} --> ` + info.response);
                    }
                });

                // begin working with twilio
                // transcript from twilio call: "<Response><Say voice="Polly.Joanna">Time to sign up for class!</Say></Response>"

                // internet phone service
                const accountSid = process.env.TWILIO_SID;
                const authToken = process.env.TWILIO_TOKEN;
                const client = require('twilio')(accountSid, authToken);

                client.calls
                    .create({
                        url: 'http://twimlets.com/echo?Twiml=Your%20course%20is%20now%20open.%20Check%20your%20email%20for%20the%20Course%20Registration%20Number.&',
                        to: `+1${row.phonenumber}`,
                        from: '+19088384751'
                    })

                row.currentstatus = "Open: notification sent"
                row.save()
                console.log("Email and call sent")
            }
        })
    })
    console.log("\nProgram end")
}

// main func. made async to respect child functions (at least, I think so)
async function main() {

    // get enrollment numbers from csv
    const csvFile = "https://giraffe.uvm.edu/~rgweb/batch/curr_enroll_spring.txt"
    // fall enrollment: https://giraffe.uvm.edu/~rgweb/batch/curr_enroll_fall.txt

    // access current data from online
    const allCourseData = await getCourseInfo(csvFile)

    // process course data into open/closed catagorizations
    const [openCourses, closedCourses] = await getProcessedCourseInfo(allCourseData)

    accessSpreadsheet(openCourses)
}

main()