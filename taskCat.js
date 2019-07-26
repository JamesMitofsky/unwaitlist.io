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
            let crnNumber = crnField.nextSibling.data

            // prase enrollment data
            let enrollParts = enrollAndSeats.split("/")				// ex. ["24", "23"]
            let enrollNum = +enrollParts[0]						    // ex. 24
            let seatsNum = +enrollParts[1]							// ex. 23
            // evaluate number of seats available
            let availableSeats = seatsNum - enrollNum


            // print availability to console
            if (availableSeats > 0) {
                console.log(`THERE ARE ${availableSeats} AVAILABLE SEATS!`, "\t" + crnNumber)
            } else if (availableSeats === 0) {
                console.log(`${crnNumber} is fully enrolled`)
            } else {
                console.log(`${crnNumber} is over-enrolled by ${Math.abs(availableSeats)}`)
            }

        }
    })

    


}