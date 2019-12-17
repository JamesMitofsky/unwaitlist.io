// npm install googleapis@39 --save


// require dependencies
const GoogleSpreadsheet = require('google-spreadsheet');
const { promisify } = require('util');

// call credentials
const creds = require('./client_secret.json')

// why doesn't this seem to receive the first parameter
// function checkForConfirmation(confirmationStatus, row) {
//     // console.log( confirmationStatus)
//     if(confirmationStatus != "Confirmation Sent") {
//         console.log("confirmation status:", confirmationStatus)
//     }
// }

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

    // declare cells
    const cells = await promisify(sheet.getCells)({  
    })



    // iterate through every row
    rows.forEach(row => {
        // if email sent, do nothing
        if(row.initialemail == "Confirmation Sent") {
            console.log("Already sent --> ", row.email)
        } 
        // else, email user to confirm their registration
        else {
            // TODO: integrate with nodemailer for confirmation emails



            // after sent, write confirmation to spreadsheet
            row.initialemail = "Confirmation Sent"
            row.save()
            console.log("Sending now --> ", row.email)
        }
    })

}

// call main function
accessSpreadsheet();

