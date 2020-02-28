// this program just needs to be run once a semester
// TODO: integrate as check function in the main program

const GoogleSpreadsheet = require('google-spreadsheet');
const { promisify } = require('util');
require('dotenv').config()
// website loading
const axios = require("axios");

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
    const doc = new GoogleSpreadsheet(testId);

    // pass credentials to doc
    await promisify(doc.useServiceAccountAuth)(creds);
    const info = await promisify(doc.getInfo)();

    // load spreadsheet as rows
    const staticCourseInfoSheet = info.worksheets[2]
    const rowsOfStaticCourseInfo = await promisify(staticCourseInfoSheet.getRows)({})
    console.log("Spreadsheet loaded")

    // grab string object from uvm registrar's page
    let websiteString = await getCourseData()

    let arrayOfCrossListings = getCrossListings(websiteString)

    crossListingsToSpreadsheet(arrayOfCrossListings, rowsOfStaticCourseInfo)


}


async function getCourseData() {

    const courseDataSource = "https://giraffe.uvm.edu/~rgweb/batch/curr_enroll_spring.html"

    try {
        let response = await axios.get(courseDataSource);
        courseData = response.data
    } catch (error) {
        console.error(error);
    }

    return courseData

}


function getCrossListings(courseDataString) {
    // let mainData = document.getElementsByTagName("pre")[0]
    // let dataContent = mainData.textContent
    // let rowsOfData = dataContent.split("\n")

    let rowsOfData = courseDataString.split("\n")

    // rows of all cross listed courses
    crossListedCourses = rowsOfData.filter(row => row.includes("XL:"))


    let allRowCRNs = []
    // new idea with matching - first CRN is current course
    crossListedCourses.forEach(row => {
        allRowCRNs.push(row.match(/\b\d{5}\b/g))
    })

    return allRowCRNs


}


function crossListingsToSpreadsheet(arrayOfCrossListings, rowsOfStaticCourseInfo) {

    // rowsOfStaticCourseInfo.forEach(spreadsheetRow => {
    //     arrayOfCrossListings.forEach(xlData => {
    //         if (spreadsheetRow.compnumb == xlData[0]) {
    //             matches.push(xlData)
    //         }
    //     })
    // })

    arrayOfCrossListings.forEach(row => {
        rowsOfStaticCourseInfo.forEach(dataRow => {
            if (row[0] == dataRow.compnumb) {
                // commented out to be make main program easier to write // removes first CRN (which is the main course CRN)
                // let splicedCrossListings = row.slice(1)
                // convert to string for spreadsheet reading
                // let formattedCrossListings = splicedCrossListings.toString()

                // ship out array values as one string for the spreadsheet cell
                let formattedCrossListings = row.toString()

                // for some reason is losing the comma
                dataRow.crosslistings = formattedCrossListings
                dataRow.save()
            }
        })
    })


    // check to see if there are duplicate listings from the main data sheet
    // listOfDuplicates = []
    // rowsOfStaticCourseInfo.filter(checkingRow => {
    //     if (checkingRow.compnumb == checkingRow.compnumb) {
    //         listOfDuplicates.push()
    //     }
    // })
    // listOfDuplicates.forEach(item => {
    //     if (item.length > 0) {
    //         console.log(item)
    //     }
    // })

    // mainList = []
    // rowsOfStaticCourseInfo.forEach(checkingRow => {
    //     rowsOfStaticCourseInfo.forEach(row => {
    //         if (checkingRow.compnumb == row.compnumb) {
    //             mainList.push(checkingRow)
    //         }
    //     })
    // })





    // console.log("xlData duplicates",findDuplicates(matches).length)
    // console.log("Main block duplicates",findDuplicates(courseNumbs).length)
    // console.log("# of cross-listings", arrayOfCrossListings.length)
    // console.log("# of times CompNumb & cross-listings matched", matches.length)
    // console.log("Length of all course data",rowsOfStaticCourseInfo.length)


    // if (allRowCRNs[i][0] == row.compnumb) {
    //     row.crosslistings = allRowCRNs[i]
    // }
}