process.env.DEBUG = 'actions-on-google:*';

const Assistant = require('actions-on-google').ApiAiApp;
var FlightStatsAPI = require('flightstats')
var express = require('express');
var bodyParser = require('body-parser');
var request_lib = require('request'); // for sending the http requests to Numbers API
var assert = require('assert');
var rp = require('request-promise');
let apiId = process.env.API_ID;
let apiKey = process.env.API_key;
console.log(apiId);
console.log(apiKey);
var app = express();

app.set('port', (process.env.PORT || 8080));
app.use(bodyParser.json({
    type: 'application/json'
}));

// get by action
const TrackByFlight_ID = "TrackByFlightID";
const TrackByStarting_Date = "TrackByStartingDate";
const Help_Intent = "HelpIntent";
const WelcomeIntent = "input.welcome";
const quit_Intent = "quit_Intent";

app.post('/', function (req, res) {
    const assistant = new Assistant({
        request: req,
        response: res
    });
    var intent = assistant.getIntent();
    console.log("hi this is intent" + intent);

    function WelcomeSpeach(assistant) {
        console.log("this is assistant" + assistant);
        var reply = "Welcome to FlightStat.. give me you flight number will let you know currently where the flight is";
        assistant.ask(reply);
    }

    function provideDetailsByID(request, response) {
        var flightNumber_url = assistant.getArgument('flightNumber');
        console.log("the flight number is " + flightNumber_url);
        console.log("the response is " + response);
        if (flightNumber_url) {
            console.log(apiId);
            console.log(apiKey);
            var p = Promise.resolve();
            var getDetails = {
                method: 'GET',
                // 933427129 flight number
                uri: `https://api.flightstats.com/flex/flightstatus/rest/v2/json/flight/track/${flightNumber_url}?appId=6aac18a6&appKey=40a7e359cb020a07ead5159c2d5d8162&includeFlightPlan=false&maxPositions=2`,
                // uri: `https://api.flightstats.com/flex/flightstatus/rest/v2/json/flight/track/${flightNumber_url}?appId=${apiId}&appKey=${apiKey}&includeFlightPlan=false&maxPositions=2`,
                json: true,
                resolveWithFullResponse: true,
            };
            console.log("get details log " + JSON.stringify(getDetails));
            p = rp(getDetails)
                .then(function (res) {
                    let flightId = res.body.request.flightId.requested;
                    let maxPositions = res.body.request.maxPositions.requested;
                    let fLNumber = res.body.flightTrack.flightNumber;
                    let carrierCode = res.body.flightTrack.carrierFsCode;
                    let departureDate = res.body.flightTrack.departureDate.dateLocal;
                    let airName = res.body.appendix.airlines[0].name;
                    let airPortName = res.body.appendix.airports[0].name;
                    let airPortLat = res.body.appendix.airports[0].latitude;
                    let airPortLong = res.body.appendix.airports[0].longitude;
                    var airPortCity = res.body.appendix.airports[0].city;
                    var airPortCountryName = res.body.appendix.airports[0].countryName;
                    let airPortregionName = res.body.appendix.airports[0].regionName;
                    var airPortlat = res.body.appendix.airports[0].latitude;
                    var airPortlong = res.body.appendix.airports[0].longitude;
                    var deptdate = new Date(departureDate);
                    console.log("logging flight id " + flightId);
                    // https://maps.googleapis.com/maps/api/staticmap?center=40.642335,-73.78817&zoom=12&size=300x300&maptype=hybrid&key=AIzaSyBdMRmNmPYEkXlEjFe30tIGzAVOwxMdij4
                    assistant.ask(assistant.buildRichResponse()
                        .addSimpleResponse(`Your flight Id is ${flightId}  the maximum positions is ${maxPositions}  and flight number is ${fLNumber} the carrier code is  ${carrierCode} and the departure date is today and the airport name is ${airPortName} and the airport city name is ${airPortCity} and the country name is ${airPortCountryName} the lattitude are ${airPortlat} logitude is ${airPortlong}. Do you want to continue.`)
                        .addBasicCard(assistant.buildBasicCard(`Your flight is in ${airPortName} currently`)
                            .setTitle('Route to airport city')
                            // .setImage(`https://maps.googleapis.com/maps/api/staticmap?center=${airPortLat},${airPortLong}&zoom=14&size=400x400&markers=color:blue%7Clabel:S%7C40.702147,-74.015794&key=AIzaSyBdMRmNmPYEkXlEjFe30tIGzAVOwxMdij4`, 'Image alternate text')
                            .setImage(`https://maps.googleapis.com/maps/api/staticmap?center=${airPortLat},${airPortLong}&zoom=12&size=300x300&maptype=hybrid&key=AIzaSyBdMRmNmPYEkXlEjFe30tIGzAVOwxMdij4`, 'Image alternate text')
                        )
                    );
                });
            return p;
        } else {
            assistant.ask("please tell me your Flight Id Number example 933427129 ");
        }
    }
    // ---------------------------------------search by date------------------
    function provideDetailsByDate(request, response) {
        var AirLineCode = assistant.getArgument('AirLineCode');
        var startDate = assistant.getArgument('startDate');
        var flightNumber = assistant.getArgument('flightNumber');
        console.log("date is been displayed" + startDate);

        var date = new Date(startDate);

        var year = date.getFullYear();
        var current_month = date.getMonth() + 1;
        var month = (current_month < 10 ? "0" : "") + current_month;
        var current_day = date.getDate();
        var day = (current_day < 10 ? "0" : "") + current_day;

        console.log("the hours is :" + year);
        if (flightNumber) {
            if (AirLineCode) {
                if (startDate) {
                    var k = Promise.resolve();
                    var getDetails_date = {
                        method: 'GET',
                        // 933427129 flight number
                        // https://api.flightstats.com/flex/flightstatus/rest/v2/json/flight/tracks/AA/100/arr/2017/09/13?appId=6aac18a6&appKey=40a7e359cb020a07ead5159c2d5d8162&utc=false&includeFlightPlan=false&maxPositions=2
                        // uri: `https://api.flightstats.com/flex/flightstatus/rest/v2/json/flight/track/${flightNumber_url}?appId=${apiId}&appKey=${apiKey}&includeFlightPlan=false&maxPositions=2`,
                        uri: `https://api.flightstats.com/flex/flightstatus/rest/v2/json/flight/tracks/${AirLineCode}/${flightNumber}/arr/${year}/${month}/${day}?appId=6aac18a6&appKey=40a7e359cb020a07ead5159c2d5d8162&utc=false&includeFlightPlan=false&maxPositions=2`,
                        json: true,
                        resolveWithFullResponse: true,
                    };
                    console.log("get details log " + JSON.stringify(getDetails_date));
                    k = rp(getDetails_date)
                        .then(function (res) {

                            console.log("this is res inside the function" + JSON.stringify(res))

                            let flightId = res.body.request.airline.requestedCode;
                            let maxPositions = res.body.request.maxPositions.requested;
                            console.log("logging flight id " + flightId);
                            console.log("logging maxPositions " + maxPositions);
                            let fLNumber = res.body.flightTracks[0].flightNumber;
                            let carrierCode = res.body.flightTracks[0].carrierFsCode;
                            let departureDate = res.body.flightTracks[0].departureDate.dateLocal;
                            let airName = res.body.appendix.airlines[0].name;
                            let airPortName = res.body.appendix.airports[0].name;
                            let airPortCity = res.body.appendix.airports[0].city;
                            let airPortCountryName = res.body.appendix.airports[0].countryName;
                            let airPortregionName = res.body.appendix.airports[0].regionName;
                            let airPortlat = res.body.appendix.airports[0].latitude;
                            let airPortlong = res.body.appendix.airports[0].longitude;
                            assistant.ask(assistant.buildRichResponse()
                                // Create a basic card and add it to the rich response
                                .addSimpleResponse(`Your flight Id is ${flightId}  the maximum positions is ${maxPositions}  and flight number is ${fLNumber} the carrier code is  ${carrierCode} and the departure date is today and the airport name is ${airPortName} and the airport city name is ${airPortCity} and the country name is ${airPortCountryName} the lattitude are ${airPortlat} logitude is ${airPortlong}. Do you want to continue.`)
                                .addBasicCard(assistant.buildBasicCard(`Your flight is in ${airPortName} currently`)
                                    .setTitle('Route to airport city')
                                    // .setImage(`https://maps.googleapis.com/maps/api/staticmap?center=${airPortlat},${airPortlong}&zoom=14&size=400x400&markers=color:blue%7Clabel:S%7C40.702147,-74.015794&key=AIzaSyBdMRmNmPYEkXlEjFe30tIGzAVOwxMdij4`, 'Image alternate text')
                                    .setImage(`https://maps.googleapis.com/maps/api/staticmap?center=${airPortLat},${airPortLong}&zoom=12&size=300x300&maptype=hybrid&key=AIzaSyBdMRmNmPYEkXlEjFe30tIGzAVOwxMdij4`, 'Image alternate text')

                                )
                            );
                            response.send();
                        });
                    return k;
                } else {
                    assistant.ask("Give me your Arrival date");
                }
            } else {
                assistant.ask("please give me your Air line code example AA");
            }
        } else {
            assistant.ask("Give me your Flight Number. example 100");
        }
    }

    // function ThankyouSpeach(assistant) {
    //     var TnkYou = "Welcome to FlightStat.. give me you flight number will let you know currently where the flight is";
    //     assistant.ask(TnkYou);
    // }


    let actionMap = new Map();
    let actionSee = actionMap.get(TrackByFlight_ID);
    console.log("this is action" + actionSee);

    actionMap.set(TrackByFlight_ID, provideDetailsByID);
    actionMap.set(TrackByStarting_Date, provideDetailsByDate);
    actionMap.set(WelcomeIntent, WelcomeSpeach);
    // actionMap.set(quit_Intent, ThankyouSpeach);
    assistant.handleRequest(actionMap);
});

app.get('/', function (req, res) {
    res.send("Server is up and running.")
});

var server = app.listen(app.get('port'), function () {
    console.log('App listening on port %s', server.address().port);
});