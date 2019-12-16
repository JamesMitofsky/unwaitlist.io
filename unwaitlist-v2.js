// dependencies: npm install require cheerio nodemailer twilio dotenv
// run in terminal: node unwaitlist-v2.js

// require 
const request = require("request");
const axios = require("axios");
const nodemailer = require('nodemailer');
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
    const baseURL = "https://www.uvm.edu/academics/courses/?term=201909&crn="
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

        // ?? confused about the first condition - for some reason it throws a promise error when i=1
        // second condition catches when the last line has been read
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








// main func. made async to respect child functions
async function main() {

    // creating space to read all my darn errors
    console.log("\n")

    // get enrollment numbers from csv
    let csvFile = "https://giraffe.uvm.edu/~rgweb/batch/curr_enroll_fall.txt"

    // access current data from online
    const allCourseData = await getCourseInfo(csvFile)


    // process course data
    const [openCourses, closedCourses] = await getProcessedCourseInfo(allCourseData)


    // these formats work
    console.log(closedCourses[0].link)
    console.log(openCourses[0].link)

    console.log(allCourseData.allCourses[0].link)
}






































// old code from individual page checks

oldFunction = function () {

    function courseURL(courseNumber) {
        fall2019BaseURL = "https://www.uvm.edu/academics/courses/?term=201909&crn="
        return fall2019BaseURL.concat(courseNumber)
    }

    // begin loop over pages
    for (page of pagesList) {
        // enter request function
        request(page, (error, response, html) => {
            if (!error & response.statusCode == 200) {
                let $ = cheerio.load(html)

                // locate all .field classed elements
                let fields = $(".field")

                // initialize variables for enrollment and CRN fields
                let enrollmentField
                let crnField

                // create anonymous function
                fields.each((i, field) => {
                    // find text of current field
                    let fieldText = $(field).text();
                    // if the field text is that of enrollment, assign the element location to var
                    if (fieldText == "Enrolled/Seats:") {
                        enrollmentField = field
                    } else if (fieldText == "CRN:") {
                        crnField = field
                    }
                })

                // grab data as siblings from labeled fields
                let enrollAndSeats = enrollmentField.nextSibling.data
                let crnNumber = crnField.nextSibling.data.trim()

                // prase enrollment data
                let enrollParts = enrollAndSeats.split("/")				// ex. ["24", "23"]
                let enrollNum = +enrollParts[0]						    // ex. 24
                let seatsNum = +enrollParts[1]							// ex. 23
                // evaluate number of seats available
                let availableSeats = seatsNum - enrollNum



                console.log(courseURL(crnNumber))




                // conditional reveresed for testing
                if (availableSeats < 0) {
                    console.log(`THERE ARE ${availableSeats} AVAILABLE SEATS!`, "\t" + crnNumber)
                } else if (availableSeats === 0) {
                    console.log(`${crnNumber} is fully enrolled`)
                } else {
                    console.log(`${crnNumber} is over-enrolled by ${Math.abs(availableSeats)}`)
                }


                // execute if seats are available
                if (availableSeats > 0) {
                    // begin working with nodemailer

                    var transporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: {
                            user: process.env.EMAIL_USER,
                            pass: process.env.EMAIL_PASS
                        }
                    });
                    // send email if class has space
                    var mailOptions = {
                        from: 'kingofpowerhouses@gmail.com',
                        to: 'jamestedesco802@gmail.com',
                        subject: 'TIME TO MOVE',
                        text: `This class now has availability: ${crnNumber}.\n\n${courseURL(crnNumber)}`
                    };

                    transporter.sendMail(mailOptions, function (error, info) {
                        if (error) {
                            console.log(error);
                        } else {
                            console.log('Email sent: ' + info.response);
                        }
                    });

                    // begin working with twilio
                    const accountSid = process.env.TWILIO_SID;
                    const authToken = process.env.TWILIO_TOKEN;
                    const client = require('twilio')(accountSid, authToken);

                    // transcript from twilio call: "<Response><Say voice="Polly.Joanna">Time to sign up for class!</Say></Response>"
                    client.calls
                        .create({
                            url: 'https://twimlets.com/echo?Twiml=%3CResponse%3E%0A%3CSay%20voice%3D%22Polly.Joanna%22%3ETime%20to%20sign%20up%20for%20class!%3C%2FSay%3E%0A%3C%2FResponse%3E&',
                            to: '+18027774849',
                            from: '+19374216969'
                        })
                        .then(call => console.log(call.sid));


                    // create sanity test emails to confirm system is online
                } else if (availableSeats <= 0) {

                    var transporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: {
                            user: process.env.EMAIL_USER,
                            pass: process.env.EMAIL_PASS
                        }
                    });

                    var mailOptions = {
                        from: 'kingofpowerhouses@gmail.com',
                        to: 'jamestedesco802@gmail.com',
                        subject: 'System Online',
                        text: `The class ${crnNumber} is either fully or over enrolled by ${Math.abs(availableSeats)} seats.\n${courseURL(crnNumber)}`
                    };

                    transporter.sendMail(mailOptions, function (error, info) {
                        if (error) {
                            console.log(error);
                        } else {
                            console.log('Email sent: ' + info.response);
                        }
                    });
                }
            }
        })
    }

    

}