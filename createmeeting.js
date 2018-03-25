var request = require('request');
const xmlQuery = require('xml-query');
const XmlReader = require('xml-reader');
var Promise = require('promise');
const addSubtractDate = require("add-subtract-date");
var AuthenticationContext = require('adal-node').AuthenticationContext;
var MicrosoftGraph = require("@microsoft/microsoft-graph-client");
var oResource = 'https://graph.microsoft.com';
var oAuthorityURL = 'https://login.microsoftonline.com/hexawareonline.onmicrosoft.com';
var oClientId = 'd69fa207-b0bd-41ff-aa0f-f9178ee309d4';
var oClientSecret = 'dLqi9Z/gmrsGLhgdnmW4CDqUUhTMwBzP/c0hr5LBFmo=';
var MicrosoftGraphClient = MicrosoftGraph.Client;
var meId = "me";
var supportedVersions = ['beta', 'v1.0'];
var graphClientMap = new Map();
var sharepointToken = "";
var SendMeeting = function (subjectMeeting, meetingPlace, dateScheduling, emaillist, startdate, enddate, session) {
    var attendeess = '';
    var startDate = startdate.split('T');
    var timem = startDate[1].split('.');
    var fulldate = startDate[0].split('-');
    var year = fulldate[0];
    var month = fulldate[1];
    var date = fulldate[2];
    var finalfulldate = month + "/" + date + "/" + year + " " + timem[0];
    console.log(finalfulldate);
    emaillist.forEach(function (emailids) {
        if (emailids) {
            attendeess += `<attendee>
            <person>
              <email>${emailids}</email>
            </person>
          </attendee>`;
        }
    });
    return new Promise(function (resolve, reject) {
        return CreateMeeting(subjectMeeting, meetingPlace, finalfulldate, session).then(function (result) {
            console.log(result);
            var nowDate = startdate.split(' ');


            let rawbody = `<serv:message xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <header>
    <securityContext>
      <webExID>NuanceWebex</webExID>
      <password>#23_Srini</password>
      <siteName>apidemoeu</siteName>
    </securityContext>
  </header>
  <body>
    <bodyContent
      xsi:type="java:com.webex.service.binding.meeting.SetMeeting">
      <meetingkey>${result.meeting_id}</meetingkey>
      <participants>
        <attendees>
         ${attendeess}
        </attendees>
      </participants>
      <enableOptions>
                <chat>true</chat>
                <poll>true</poll>
                <audioVideo>true</audioVideo>
      </enableOptions>
      <attendeeOptions>
        <emailInvitations>true</emailInvitations>
      </attendeeOptions>
      <schedule>
        <openTime>300</openTime>
         <joinTeleconfBeforeHost>true</joinTeleconfBeforeHost>
        <timeZoneID>41</timeZoneID>
      </schedule>
    </bodyContent>
  </body>
</serv:message>`;
            console.log('---------------------------Raw Body ----------------------------');
            console.log(rawbody);
            console.log('-----------------------------------------------------------------');
            request.post({
                headers: { 'content-type': 'application/xml' },
                url: 'https://apidemoeu.webex.com/WBXService/XMLService',
                body: rawbody
            }, function (error, response, body) {
                const ast = XmlReader.parseSync(body);
                const result = xmlQuery(ast).find('serv:result').text();
                console.log('---------------------------Meeting Body ----------------------------');
                console.log(JSON.stringify(body));
                console.log('-----------------------------------------------------------------');
                resolve(result);
            });

        }).catch(function (errdata) {
            console.log('---------------------------Meeting Error ----------------------------');
            console.log(JSON.stringify(errdata))
            console.log('-----------------------------------------------------------------');
            reject(errdata)
        })
    })

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

var createOutlookMeeting = function (session) {
    return new Promise(function (resolve, reject) {
        var r = {};
        setMeId(session);


        let meetingSubject = session.userData.subjectMeeting;
        var dateScheduling = session.userData.dateScheduling;
        let meetingStartTime = dateScheduling.resolution.start;
        let meetingEndTime = dateScheduling.resolution.end;
        let participants = session.userData.matchedContactsS;
        let meetingLocation = session.userData.meetingPlace;
        var meetingNewTime = correctTimeZone(meetingStartTime, meetingEndTime, session);
        var eventInfo = {
            "Subject": meetingSubject,
            "Start": {
                "DateTime": meetingNewTime[0],
                "TimeZone": getTimezoneString(session)
            },
            "End": {
                "DateTime": meetingNewTime[1],
                "TimeZone": getTimezoneString(session)
            },
            "location": {
                "displayName": meetingLocation
            },
            "ShowAs": "Free",
            "IsReminderOn": false,
            "Body": {
                "content": "Arranged by " + process.env.botName,
                "contentType": "Text"
            }
        };

        if (participants && participants.length > 0) {
            eventInfo["Attendees"] = participants;
        }

        apiGateway(session,
            '/users/' + meId + '/calendar/events',
            eventInfo,
            'POST',
            function (res) {
                console.log(JSON.stringify(res));
                session.endDialog();
                resolve(res);
            },
            function (errMessage) {
                console.log(errMessage);
                reject(errMessage);
            }
        );
    });
}

var searchContact = function (session) {
    setMeId(session);
    var contactname = session.userData.searchUsername;
    //select=DisplayName,EmailAddresses&
    //"/users/"+ meId +"/people?$search="+contactname
    return new Promise(function (resolve, reject) {
        var r = {};
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
                                contactInfo = " " + contactInfo + '<br/>';
                            }
                        }

                    }, this);

                } else {
                    contactInfo = "Could not find '" + contactname + "' in external contacts. Please Choose from below action <br/>";
                    session.replaceDialog('UserSearch', {
                        reprompt: true
                    });
                }

                session.userData.matchedContactsS = emailContacts;
                session.userData.contactPromptStringS = contactInfo;
                resolve(res);
            },
            function (errMessage) {
                session.send("We could not fetch the given contacts" + JSON.stringify(errMessage));
                reject(errMessage);
            }
        );
    });
}
var CreateMeeting = function (subjectMeeting, meetingPlace, startdate, session) {
    return new Promise(function (resolve, reject) {
        var r = {};
        let rawbody = `<?xml version="1.0" encoding="UTF-8"?>
<serv:message xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <header>
        <securityContext>
            <webExID>NuanceWebex</webExID>
            <password>#23_Srini</password>
            <siteName>apidemoeu</siteName>
        </securityContext>
    </header>
    <body>
        <bodyContent xsi:type="java:com.webex.service.binding.meeting.CreateMeeting">
            <metaData>
                <confName>${subjectMeeting + '-' + meetingPlace}</confName>
            </metaData>
            <schedule>
                <startDate>${startdate}</startDate>
            </schedule>
        </bodyContent>
    </body>
</serv:message>`;
        request.post({
            headers: { 'content-type': 'application/xml' },
            url: 'https://apidemoeu.webex.com/WBXService/XMLService',
            body: rawbody
        }, function (error, response, body) {
            try {
                // console.log(response);
                const ast = XmlReader.parseSync(body);
                const meeting_id = xmlQuery(ast).find('meet:meetingkey').text();
                const server_host = xmlQuery(ast).find('serv:host').text();
                const server_attd = xmlQuery(ast).find('serv:attendee').text();
                r.meeting_id = meeting_id;
                r.server_host = server_host;
                r.server_attd = server_attd;
                console.log('----------------------------------Create Meeting resonse ---------------------------')
                console.log(body)
                console.log('-------------------------------------------------------------------------------------');
                resolve(r);

            }
            catch (e) {
                console.log('----------------------------------Create Meeting error ---------------------------')
                console.log(e)
                console.log('----------------------------------------------------------------------------------');
                reject(e);

            }

        });
    });
}

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
    console.log(d);
    d = addSubtractDate.subtract(d, getTimezoneCorrection(session, true), "hours");
    let meetingStartNewTime = addSubtractDate.subtract(d, getTimezoneCorrection(session, false), "minutes");
    console.log(meetingStartNewTime);
    d = new Date(meetingEndTime);
    d = addSubtractDate.subtract(d, getTimezoneCorrection(session, true), "hours");
    let meetingEndNewTime = addSubtractDate.subtract(d, getTimezoneCorrection(session, false), "minutes");
    console.log(meetingEndNewTime);
    meetingTimeArray.push(meetingStartNewTime);
    meetingTimeArray.push(meetingEndNewTime);

    return meetingTimeArray;
}
module.exports.searchContact = searchContact;
module.exports.sendMeeting = SendMeeting;
module.exports.createOutlookMeeting = createOutlookMeeting;
