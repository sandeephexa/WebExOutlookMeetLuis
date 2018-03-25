'use strict';

// variables declaration
var AuthenticationContext = require('adal-node').AuthenticationContext;
var MicrosoftGraph = require("@microsoft/microsoft-graph-client");
var moment = require('moment-timezone');
let meId = "me";
var weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const BETA = 'beta';
var supportedVersions = ['beta', 'v1.0'];
var MicrosoftGraphClient = MicrosoftGraph.Client;
var graphClientMap = new Map();
var oAuthorityURL = "https://login.microsoftonline.com/hexawareonline.onmicrosoft.com";
var oResource = 'https://graph.microsoft.com';
// var oClientId = "74272c2a-c28f-4ac0-8d06-3f6285998181";
// var oClientSecret = "kfleqBUUXI90njLQ319!_%;";
var oClientId = 'd69fa207-b0bd-41ff-aa0f-f9178ee309d4';
var oClientSecret = 'dLqi9Z/gmrsGLhgdnmW4CDqUUhTMwBzP/c0hr5LBFmo=';
var eMailid = "";
const addSubtractDate = require("add-subtract-date");
var sharepointToken = "";


function getTimezoneString(session) {

    var diff = getTimezoneCorrection(session, true) * 60;


    if (diff < 0) {
        diff -= getTimezoneCorrection(session, false);
    } else {
        diff += getTimezoneCorrection(session, false);
    }
    console.log("DIFF: " + diff);
    /*
            var d = new Date();
            d.setMinutes(d.getMinutes() + 330);
            console.log(d);
        
            console.log("TZ > "+ String(String(d).split("(")[1]).split(")")[0])
            console.log(d.getTimezoneOffset());
            console.log("GUESS >>> "+ moment.tz.guess()); 
            console.log("M: "+ moment(session.message.localTimestamp).format("Z"))*/

    diff = "" + diff;

    let tzMap = {
        "-720": "Dateline Standard Time",
        "-660": "Samoa Standard Time",
        "-600": "Hawaiian Standard Time",
        "-540": "Alaskan Standard Time",
        "-480": "Pacific Standard Time",
        "-420": "Mountain Standard Time",
        "-360": "Central Standard Time",
        "-300": "Eastern Standard Time",
        "-240": "Atlantic Standard Time",
        "-210": "Newfoundland and Labrador Standard Time",
        "-180": "E. South America Standard Time",
        "-120": "Mid-Atlantic Standard Time",
        "-60": "Azores Standard Time",
        "0": "GMT Standard Time",
        "60": "Central Europe Standard Time",
        "120": "E. Europe Standard Time",
        "180": "Russian Standard Time",
        "210": "Iran Standard Time",
        "240": "Arabian Standard Time",
        "270": "Transitional Islamic State of Afghanistan Standard Time",
        "300": "West Asia Standard Time",
        "330": "India Standard Time",
        "345": "Nepal Standard Time",
        "360": "Central Asia Standard Time",
        "420": "S.E. Asia Standard Time",
        "480": "China Standard Time",
        "540": "Korea Standard Time",
        "570": "A.U.S. Central Standard Time",
        "600": "A.U.S. Eastern Standard Time",
        "660": "Central Pacific Standard Timea",
        "720": "New Zealand Standard Time"
    }

    if (diff in tzMap) {
        console.log("TZ: " + tzMap[diff]);
        return tzMap[diff];
    } else {
        console.log("TZ: " + tzMap["0"]);
        return tzMap["0"];
    }

}

function getTimezoneCorrection(session, returnHours) {

    var hoursDiff = 0;
    var minutesDiff = 0;

    var offset = 1;

    if (session.message && session.message.localTimestamp) {

        var extraTime = session.message.localTimestamp.split("T")[1];

        if (extraTime.indexOf('+') > -1) {
            extraTime = extraTime.split("+")[1];
        } else {
            extraTime = extraTime.split("-")[1];
            offset = -1;
        }

        extraTime = extraTime.split(":");

        hoursDiff = parseInt(extraTime[0]) * offset;
        minutesDiff = parseInt(extraTime[1]);

    } else {
        session.send("local timestamp not present in session")
    }


    if (returnHours) {
        return hoursDiff;
    } else {
        return minutesDiff
    }
}

function utcToLocalTimeZone(meetingStartTime, meetingEndTime, session) {

    let meetingTimeArray = [];

    var d = new Date(meetingStartTime);
    d = addSubtractDate.add(d, getTimezoneCorrection(session, true), "hours");
    let meetingStartNewTime = addSubtractDate.add(d, getTimezoneCorrection(session, false), "minutes");

    d = new Date(meetingEndTime);
    d = addSubtractDate.add(d, getTimezoneCorrection(session, true), "hours");
    let meetingEndNewTime = addSubtractDate.add(d, getTimezoneCorrection(session, false), "minutes");
    meetingTimeArray.push(meetingStartNewTime);
    meetingTimeArray.push(meetingEndNewTime);

    return meetingTimeArray;
}

function correctTimeZone(meetingStartTime, meetingEndTime, session) {

    let meetingTimeArray = [];

    var d = new Date(meetingStartTime);
    d = addSubtractDate.subtract(d, getTimezoneCorrection(session, true), "hours");
    let meetingStartNewTime = addSubtractDate.subtract(d, getTimezoneCorrection(session, false), "minutes");

    d = new Date(meetingEndTime);
    d = addSubtractDate.subtract(d, getTimezoneCorrection(session, true), "hours");
    let meetingEndNewTime = addSubtractDate.subtract(d, getTimezoneCorrection(session, false), "minutes");

    meetingTimeArray.push(meetingStartNewTime);
    meetingTimeArray.push(meetingEndNewTime);

    return meetingTimeArray;
}

function apiGateway(session, uri, req, method, successCallback, errorCallback, apiVersion) {

    if (!sharepointToken) {

        let context = new AuthenticationContext(oAuthorityURL);

        context.acquireTokenWithClientCredentials(oResource, oClientId, oClientSecret,
            function (err, tokenResponse) {

                if (err) {
                    errorCallback("Access error. Are you logged into your Hexaware account?");
                } else {

                    sharepointToken = tokenResponse.accessToken;

                    supportedVersions.forEach(function (version) {
                        MicrosoftGraphClient = MicrosoftGraph.Client.init({
                            defaultVersion: version,
                            authProvider: (done) => {
                                done(null, sharepointToken); //first parameter takes an error if you can't get an access token 
                            }
                        });
                        graphClientMap.set(version, MicrosoftGraphClient);
                    });

                    setMeId(session);

                    apiGateway(session, uri, req, method, successCallback, errorCallback, apiVersion);
                }
            });


    } else {

        if (!apiVersion) {
            apiVersion = 'v1.0';
        }

        let graphClient = graphClientMap.get(apiVersion);
        if (graphClient == null) {
            sharepointToken = null;
            return apiGateway(session, uri, req, method, successCallback, errorCallback, apiVersion);
        }

        graphClient = graphClient.api(uri);

        let apiCallFunction = function (err, res) {
            if (err) {

                console.log('Error is ' + JSON.stringify(err));

                let errMsg = err.message;
                let index = errMsg.indexOf('Access token has expired');

                if (index >= 0) {
                    console.log("reseting token");
                    sharepointToken = null;
                    return apiGateway(session, uri, req, method, successCallback, errorCallback, apiVersion);
                } else {
                    errorCallback(err.message);
                }
            } else {
                successCallback(res);
            }
        };

        //COMMENTED OUT BY KENRICK: 31 Jan 2018 - tested, this line is not required. GET events displaying correct time
        graphClient.header('outlook.timezone', getTimezoneString(session));

        if (method == 'POST') {
            graphClient.post(req, apiCallFunction);
        } else if (method == 'PUT') {
            graphClient.put(req, apiCallFunction);
        } else if (method == 'PATCH') {
            graphClient.patch(req, apiCallFunction);
        } else {
            graphClient.get(apiCallFunction);
        }

    }
}

function setMeId(session) {

    if (session.message.user.aadObjectId) {
        meId = session.message.user.aadObjectId;
    } else if (session.message.user.id) {
        meId = session.message.user.id.replace("sip:", "");
        eMailid = meId;
    }

}

function displayMeeting(session, type, webLink) {

    displayMeetingInfo(session, type, webLink);

    var finalStr = "";

    if (type == 1) {
        finalStr = session.send(botdialogs.GET_BOT_MESSAGE('MEETING_CREATED'));
    } else {
        finalStr = session.send(botdialogs.GET_BOT_MESSAGE('MEETING_UPDATED'));
    }

    session.send(finalStr);
    session.userData.triggerAction = "";
    session.userData.APICallKey = "";
}

function getCurrentTime(session) {
    return moment();
}

function dateToLocal(d, f) {
    return moment.utc(d).local().format(f);
}

function formatEventDateTime(duration) {
    var hours = duration.asHours();
    if (hours < 1) {
        hours = duration.asMinutes() + " minutes";
    } else {
        var hoursExt = "";
        if (hours > 2) {
            hoursExt = "s";
        }
        var minExt = "";
        if (duration.asMinutes() % 60 > 0) {
            minExt += ", " + duration.asMinutes() % 60 + " minute";
            if (duration.asMinutes() % 60 > 1) {
                minExt += "s";
            }
        }
        hours = Math.floor(duration.asMinutes() / 60) + " hour" + hoursExt + minExt;
    }
    return hours;
}

// function resolveDuration(durationN,startDate) {
//     const addSubtractDate = require("add-subtract-date");
//     var moment = require("moment");
//     if ((typeof dateTimeJSON["StartTime"] != 'undefined') && typeof dateTimeJSON["Duration"] != 'undefined') {
//         var tempDate;
//         if ((typeof dateTimeJSON["Date"] == 'undefined') || (dateTimeJSON.Date == 'Invalid date')) {
//             var currentDate = new Date();
//             tempDate = moment(currentDate).format("YYYY-MM-DD");
//         } else {
//             tempDate = dateTimeJSON.Date;
//         }

//         var meetingStartTimeNew = tempDate + "T" + dateTimeJSON.StartTime + "Z";
//         var d = new Date(meetingStartTimeNew);
//         console.log("FROM DURATION FUNCTION" + d);
//         d = addSubtractDate.add(d, dateTimeJSON.Duration, "seconds");
//         dateTimeJSON["EndTime"] = moment.utc(d).format("HH:mm:ss.sss");
//         console.log("END TIME:" + JSON.stringify(dateTimeJSON));

//     }

//     return dateTimeJSON.EndTime;
// }


function RetrieveSchedule(session, startDateN, durationN) {

    setMeId(session);
    console.log("---------------inside retrieve section");
    let startDate = new Date(startDateN).toISOString();
    let endDate;
    //have to change the duration end date
    let durationM = moment.duration(durationN, 'seconds');

    console.log("MEID: " + meId);

    let uri = '/users/' + meId + "/calendarview?";
    console.log("startdate" + startDate);

    if (!endDate) {
        var d = new Date(startDate);
        let dateParam = moment(startDate).format("YYYY-MM-DD");
        console.log("uri--------------end date " + dateParam);
        console.log("uri--------------end date " + durationM);

        uri = uri + "startDateTime=" + dateParam + "T00:00&endDateTime=" + dateParam + "T23:59"
        console.log("uri--------------end date " + uri);
    } else {
        var d = new Date(startDate);
        let dateParam = moment(startDate).format("YYYY-MM-DD");
        console.log("dateParam" + dateParam);
        var d = new Date(endDate);
        let dateEndParam = moment(endDate).format("YYYY-MM-DD");
        console.log("dateParam-----------------" + dateEndParam);
        uri = uri + "startDateTime=" + dateParam + "T00:00&endDateTime=" + dateEndParam + "T23:59"
    }

    uri = uri + "&$select=Subject,attendees,webLink,isCancelled,isOrganizer,location,organizer,start,end&$top=30";
    apiGateway(session, uri, null, 'GET',
        function (res) {
            console.log("-----------------check the res");
            console.log(res);
            // session.userData.xyzmeetId = null;
            let outlookMeetID = res.value[0].id;
            session.userData.outlookMeetUpdateID = outlookMeetID;
            var userEvents = res.value;
            var userEventPromptString = '';
            let ind = 1;

            // New Format Start
            if (userEvents) {

                var meetingStartTime = startDate;
                let formatDate = new Date(meetingStartTime);

                userEventPromptString = userEventPromptString + '<b><br />' + weekDays[formatDate.getDay()] +
                    ', ' + months[formatDate.getMonth()] +
                    ' ' + formatDate.getDate() + '</b> <br/>';



                userEvents.sort(function (a, b) {
                    var keyA = new Date(a.start.dateTime),
                        keyB = new Date(b.start.dateTime);
                    // Compare the 2 dates
                    if (keyA < keyB) return -1;
                    if (keyA > keyB) return 1;
                    return 0;
                });

                var validEvents = [];
                session.userData.eventButtons = [];
                session.userData.userEventInitPromptString = userEventPromptString
                userEvents.forEach(function (element) {

                    if (element.isCancelled != true) {
                        if (moment(element.end.dateTime).diff(getCurrentTime(session), 'minutes') > 0) {

                            let timeZone = utcToLocalTimeZone(element.start.dateTime, element.end.dateTime, session);
                            var dateAppoint = dateToLocal(timeZone[0], "h:mm a")
                            var duration = moment.duration(moment(timeZone[1]).diff(moment(timeZone[0])));

                            var hours = formatEventDateTime(duration);

                            let eventStr = ind + '.' + ' ' + dateAppoint + ' ';
                            eventStr = eventStr + ' <b><a href="' + element.webLink + '">' + element.subject + ' </a></b>';
                            eventStr = eventStr + ' ' + "(" + hours + ")";
                            if (!element.isOrganizer) {
                                eventStr = eventStr + ' ' + " organized by " + element.organizer.emailAddress.name;
                            }

                            userEventPromptString = userEventPromptString + eventStr
                            userEventPromptString = userEventPromptString + '<br/>';

                            validEvents.push(element);
                            session.userData.eventButtons.push({
                                "type": "imBack",
                                "title": eventStr,
                                "value": "" + ind
                            });

                            ind++;

                        }
                    }



                }, this);
            }
            // New Format End
            // session.userData.userEvents = validEvents;
            // session.userData.userEventPrompt = userEventPromptString;
            console.log(outlookMeetID);
            session.userData.xyzmeetId = outlookMeetID;
            //  outlookMeetID =session.userData.meetingoutID;
            console.log("outlookMeetID--------------xyz------------");
            console.log(session.userData.xyzmeetId);

            //session.send(userEventPromptString);
            // return session.beginDialog('chooseMeeting');

        },
        function (err) {
            session.send("Sorry, we couldn't fetch your meetings. " + err);
        });
}
// Retrieve Schedule for delete
function RetrieveSchedule2(session, startDateN, durationN, confNameX) {

    setMeId(session);
    console.log("---------------inside retrieve2 section with subject" + confNameX);
    let startDate = new Date(startDateN).toISOString();
    let endDate;
    let durationM = moment.duration(durationN, 'seconds');
    var subX = confNameX.split('-');

    var webxSub = subX[0]
    console.log("splitted confNameX " + webxSub);


    console.log("MEID: " + meId);

    let uri = '/users/' + meId + "/calendarview?";
    console.log("startdate" + startDate);

    if (!endDate) {
        var d = new Date(startDate);
        let dateParam = moment(startDate).format("YYYY-MM-DD");
        console.log("uri--------------end date " + dateParam);
        console.log("uri--------------end date " + durationM);

        uri = uri + "startDateTime=" + dateParam + "T00:00&endDateTime=" + dateParam + "T23:59"
        console.log("uri--------------end date " + uri);
    } else {
        var d = new Date(startDate);
        let dateParam = moment(startDate).format("YYYY-MM-DD");
        console.log("dateParam" + dateParam);
        var d = new Date(endDate);
        let dateEndParam = moment(endDate).format("YYYY-MM-DD");
        console.log("dateParam-----------------" + dateEndParam);
        uri = uri + "startDateTime=" + dateParam + "T00:00&endDateTime=" + dateEndParam + "T23:59"
    }

    uri = uri + "&$select=Subject,attendees,webLink,isCancelled,isOrganizer,location,organizer,start,end&$top=30";
    apiGateway(session, uri, null, 'GET',
        function (res) {
            // console.log("result from retrieve 2 "+JSON.stringify(res));
            // console.log("Sandy result length "+res.length);
            var resLength = Object.keys(res).length;
            console.log("Sandy response length" + resLength);
            let outlookSub = '';
            let outlookMeetingID = '';


            for (var j = 0; j < resLength; j++) {
                if (res.value[j].subject == webxSub) {
                    outlookMeetingID = res.value[j].id;
                    outlookSub = res.value[j].subject;
                }
            }
            // let outlookMeetID = res.value[0].id;
            var userEvents = res.value;
            var userEventPromptString = '';
            let ind = 1;
            console.log("sandy id " + outlookMeetingID + " sandy subject" + outlookSub);
            // New Format Start
            if (userEvents) {

                var meetingStartTime = startDate;
                let formatDate = new Date(meetingStartTime);

                userEventPromptString = userEventPromptString + '<b><br />' + weekDays[formatDate.getDay()] +
                    ', ' + months[formatDate.getMonth()] +
                    ' ' + formatDate.getDate() + '</b> <br/>';



                userEvents.sort(function (a, b) {
                    var keyA = new Date(a.start.dateTime),
                        keyB = new Date(b.start.dateTime);
                    // Compare the 2 dates
                    if (keyA < keyB) return -1;
                    if (keyA > keyB) return 1;
                    return 0;
                });

                var validEvents = [];
                session.userData.eventButtons = [];
                session.userData.userEventInitPromptString = userEventPromptString
                userEvents.forEach(function (element) {

                    if (element.isCancelled != true) {
                        if (moment(element.end.dateTime).diff(getCurrentTime(session), 'minutes') > 0) {

                            let timeZone = utcToLocalTimeZone(element.start.dateTime, element.end.dateTime, session);
                            var dateAppoint = dateToLocal(timeZone[0], "h:mm a")
                            var duration = moment.duration(moment(timeZone[1]).diff(moment(timeZone[0])));

                            var hours = formatEventDateTime(duration);
                            console.log("inside Retrieve2 " + duration + " " + hours);
                            let eventStr = ind + '.' + ' ' + dateAppoint + ' ';
                            eventStr = eventStr + ' <b><a href="' + element.webLink + '">' + element.subject + ' </a></b>';
                            eventStr = eventStr + ' ' + "(" + hours + ")";
                            if (!element.isOrganizer) {
                                eventStr = eventStr + ' ' + " organized by " + element.organizer.emailAddress.name;
                            }

                            userEventPromptString = userEventPromptString + eventStr
                            userEventPromptString = userEventPromptString + '<br/>';

                            validEvents.push(element);
                            session.userData.eventButtons.push({
                                "type": "imBack",
                                "title": eventStr,
                                "value": "" + ind
                            });

                            ind++;

                        }
                    }



                }, this);
            }
            // New Format End
            // session.userData.userEvents = validEvents;
            // session.userData.userEventPrompt = userEventPromptString;
            console.log("outlookMeetingID--------------------------");
            console.log(outlookMeetingID);
            //session.userData.meetingoutID = outlookMeetID;

            deleteMeeting(outlookMeetingID, session, outlookSub);
            //session.send(userEventPromptString);
            // return session.beginDialog('chooseMeeting');

        },
        function (err) {
            session.send("Sorry, we couldn't fetch your meetings. " + err);
        });
}

// Delete Outlook

function deleteMeeting(meeting_id, session, outlookSub) {
    // console.log("updateMeeting"+updateMeeting);
    setMeId(session);
    // session.send(botdialogs.GET_BOT_MESSAGE('UPDATING_MEETING'));
    // let updateMeetingId = session.userData.meetingoutID;
    // let updateParticipants = session.userData.participant;

    console.log("meeting id of outlook in delete-----------------");
    console.log(meeting_id);

    // for (var i = 0; i < session.userData.updateParticipants; i++) {
    //     session.userData.participant.push(session.userData.updateParticipants[i]);
    // }
    // var eventUpdateInfo = {};
    // if (session.userData.section == 3) {
    // eventUpdateInfo["Attendees"] = session.userData.participant;
    // console.log(eventUpdateInfo);
    // }
    console.log("sandeep test");
    console.log("/users/" + meId + "/events/" + meeting_id + "/" + "cancel");

    apiGateway(session,
        "/users/" + meId + "/events/" + meeting_id + "/" + "cancel", {},
        'POST',
        function (res) {
            console.log(res);
            console.log("---------------------------------------------res");

            // displayMeeting(session, 2, res.webLink);
            console.log("Meeting with subject " + outlookSub + " has been deleted successfully.");

            session.endDialog("Meeting with subject " + outlookSub + " has been deleted successfully.");

        },
        function (err) {
            session.endDialog("DELETE EVENT ERR >>> " + JSON.stringify(err));
        }, 'beta');

}

function updateMeeting(session) {
    // console.log("updateMeeting"+updateMeeting);
    setMeId(session);
    // session.send(botdialogs.GET_BOT_MESSAGE('UPDATING_MEETING'));
    console.log("session.userData.xyzmeetId");
    console.log(session.userData.xyzmeetId);
    let updateMeetingId = session.userData.xyzmeetId;
    let updateParticipants = session.userData.participant;

    console.log("meeting id of outlook in update-----------------");
    console.log(updateMeetingId);

    for (var i = 0; i < session.userData.updateParticipants; i++) {
        session.userData.participant.push(session.userData.updateParticipants[i]);
    }
    var eventUpdateInfo = {};
    // if (session.userData.section == 3) {
    eventUpdateInfo["Attendees"] = session.userData.participant;
    console.log(eventUpdateInfo);
    // }
    apiGateway(session,
        "/users/" + meId + "/events/" + updateMeetingId,
        eventUpdateInfo,
        'PATCH',
        function (res) {
            console.log(res);
            console.log("---------------------------------------------res");

            // displayMeeting(session, 2, res.webLink);
            session.send("updated successfully");

            session.endDialog();

        },
        function (err) {
            session.endDialog("RESCHEDULE EVENT ERR >>> " + JSON.stringify(err));
        });

}


// ----------------------search eMailid
function searchOutlookContact(session, emailIdSearch) {
    setMeId(session);
    var contactname = emailIdSearch;
    console.log("--------search outlook name----------" + contactname);
    //select=DisplayName,EmailAddresses&
    //"/users/"+ meId +"/people?$search="+contactname
    apiGateway(
        session,
        "/users?$select=displayName,mail,userPrincipalName,jobTitle&$Filter=startswith(displayName,'" + contactname + "') or startswith(mail,'" + contactname + "') or startswith(userPrincipalName,'" + contactname + "')",
        null,
        'GET',
        function (res) {
            let contactInfo = '';
            let emailContacts = [];

            //session.send('ADD EVENT RES = ' + JSON.stringify(res));
            //session.send (element.userPrincipalName);
            let lastIndex = res.value.length;
            let sNo = 1;
            if (lastIndex > 0) {

                let appendBreak = (lastIndex > 1);

                res.value.forEach(function (element) {
                    let userName = element.displayName;
                    let emailId = element.userPrincipalName;
                    let jobTitle = element.jobTitle;

                    if (emailId) {
                        contactInfo = contactInfo + sNo + '. ' + userName + ', ';
                        if (jobTitle) {
                            contactInfo = contactInfo + jobTitle + ' ';
                        }
                        contactInfo = contactInfo + '<' + emailId + '>';
                        sNo++;
                        emailContacts.push({
                            "EmailAddress": {
                                "Address": emailId,
                                "Name": userName
                            },
                            "Type": "Required"
                        });



                        if (appendBreak) {
                            contactInfo = contactInfo + '<br/>';
                        }
                    }

                }, this);

            } else {
                contactInfo = "Could not find '" + contactname + "' in external contacts. Please Choose from below action <br/>"
            }

            contactInfo = contactInfo + sNo + '. Search Again <br/>';
            sNo++;
            contactInfo = contactInfo + sNo + '. Ignore <br/>';
            sNo++;
            contactInfo = contactInfo + sNo + '. Search External Contacts';
            console.log(contactInfo);
            console.log(session.userData.contactPromptString);
            session.userData.matchedContacts = emailContacts;
            session.userData.contactPromptString = contactInfo;
            // session.endDialog('weather its is coming next step');
            console.log(session.userData.contactPromptString);
            session.send(`email contacts binding ${session.userData.contactPromptString}`);
            session.beginDialog('chooseContact');
        },
        function (errMessage) {
            session.send("We could not fetch the given contacts" + JSON.stringify(errMessage));
        }
    );
}




// -------------------------------------------------

module.exports.updateMeeting = updateMeeting;
module.exports.apiGateway = apiGateway;
module.exports.setMeId = setMeId;
module.exports.searchOutlookContact = searchOutlookContact;
module.exports.RetrieveSchedule = RetrieveSchedule;
module.exports.RetrieveSchedule2 = RetrieveSchedule2;
module.exports.deleteMeeting = deleteMeeting;