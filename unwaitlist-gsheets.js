// npm install googleapis@39 --save nodemailer dotenv

// google sheets
const GoogleSpreadsheet = require('google-spreadsheet');
const { promisify } = require('util');
const creds = require('./client_secret.json')
// emailing
const nodemailer = require('nodemailer');
// environment variables
require('dotenv').config()


// async to open spreadsheet
async function accessSpreadsheet() {
    const doc = new GoogleSpreadsheet('1DjsN1HiiS7Iv7lKNucjeoQ6aS0_291JAovZ0LfgOItM')
    await promisify(doc.useServiceAccountAuth)(creds);
    const info = await promisify(doc.getInfo)();
    const sheet = info.worksheets[0];
    console.log(`Title: ${sheet.title}`)

    // declare rows object
    const rows = await promisify(sheet.getRows)( {
    });


    // iterate through every row
    rows.forEach(row => {
        // if email sent, do nothing
        if(row.initialemail != "Confirmation Sent") {\

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
                subject: 'Unwaitlist Confirmation',
                text: `Unwaitlist is now checking your course: https://www.uvm.edu/academics/courses/?term=202001&crn=${row.courseregistrationnumber}`
            };

            transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    console.log(error);
                } else {
                    console.log('Email sent: ' + info.response);
                }
            });

            // after sent, write confirmation to spreadsheet
            row.initialemail = "Confirmation Sent"
            row.save()
            console.log("Sending now --> ", row.email)
        } 
        else {
            console.log("Already sent")
        }
    })

}

// call main function
accessSpreadsheet();

