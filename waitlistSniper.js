// dependencies: npm install require cheerio, npm install nodemailer, npm install twilio

const request = require("request");
const cheerio = require("cheerio");

// declare array of pages to check
pagesList = ["https://www.uvm.edu/academics/courses/?term=201909&crn=90429", "https://www.uvm.edu/academics/courses/?term=201909&crn=90225", "https://www.uvm.edu/academics/courses/?term=201909&crn=93187"]

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


            // print availability to console
            if (availableSeats > 0) {
                console.log(`THERE ARE ${availableSeats} AVAILABLE SEATS!`, "\t" + crnNumber)
            } else if (availableSeats === 0) {
                console.log(`${crnNumber} is fully enrolled`)
            } else {
                console.log(`${crnNumber} is over-enrolled by ${Math.abs(availableSeats)}`)
            }


            // execute if seats are available
            if (availableSeats > 0) {
                // begin working with nodemailer
                const nodemailer = require('nodemailer');

                var transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: 'kingofpowerhouses@gmail.com',
                        pass: 'thissortaworks2000'
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

                // begin working with twilio: npm install twilio
                const accountSid = 'AC053c2bb72f89cf01b19dd31479b91763';
                const authToken = 'd67cea20b5a6fbf380d952e5cf34a570';
                const client = require('twilio')(accountSid, authToken);

                // call content: "<Response><Say voice="Polly.Joanna">Time to sign up for class!</Say></Response>"
                client.calls
                    .create({
                        url: 'https://twimlets.com/echo?Twiml=%3CResponse%3E%0A%3CSay%20voice%3D%22Polly.Joanna%22%3ETime%20to%20sign%20up%20for%20class!%3C%2FSay%3E%0A%3C%2FResponse%3E&',
                        to: '+18027774849',
                        from: '+19374216969'
                    })
                    .then(call => console.log(call.sid));


                // create sanity test emails to confirm system is online
            } else if (availableSeats <= 0) {
                const nodemailer = require('nodemailer');

                var transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: 'kingofpowerhouses@gmail.com',
                        pass: 'thissortaworks2000'
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

function courseURL(courseNumber) {
    fall2019BaseURL = "https://www.uvm.edu/academics/courses/?term=201909&crn="
    return fall2019BaseURL.concat(courseNumber)
}