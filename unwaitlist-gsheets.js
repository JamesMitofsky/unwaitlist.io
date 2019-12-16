// npm install googleapis@39


// require dependencies
const GoogleSpreadsheet = require('google-spreadsheet');
const { promisify } = require('util');

// call credentials
const creds = require('./client_secret.json')

// print cells in a row
function printRow(student) {
    console.log(student.email)
    console.log(student.phonenumber)
    console.log(student.courseregistrationnumber)
    console.log(student.initialemail)
}

// async to open spreadsheet
async function accessSpreadsheet() {
    const doc = new GoogleSpreadsheet('1DjsN1HiiS7Iv7lKNucjeoQ6aS0_291JAovZ0LfgOItM')
    await promisify(doc.useServiceAccountAuth)(creds);
    const info = await promisify(doc.getInfo)();
    const sheet = info.worksheets[0];
    console.log(`Title: ${sheet.title}`)

    // get all rows
    const rows = await promisify(sheet.getRows)( {
        offset:0
    });

    // for each row, print cells
    rows.forEach(row => {
        // call function
        printRow(row)
    })
}

// call main function
accessSpreadsheet();

