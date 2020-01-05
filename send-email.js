// require emailing
const nodemailer = require('nodemailer');

module.exports = sendEmail

async function sendEmail(emailSubject, emailBody, emailRecipient, row) {

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

    row.initialemail = "Contacted"

    await promisify(row.save)()
}