var request = require('request');
const xmlQuery = require('xml-query');
const XmlReader = require('xml-reader');
var Promise = require('promise');
var AuthenticationContext = require('adal-node').AuthenticationContext;
var MicrosoftGraph = require("@microsoft/microsoft-graph-client");
var oResource = 'https://graph.microsoft.com';
var oAuthorityURL = 'https://login.microsoftonline.com/hexawareonline.onmicrosoft.com';
var oClientId = 'd69fa207-b0bd-41ff-aa0f-f9178ee309d4';
var oClientSecret = 'dLqi9Z/gmrsGLhgdnmW4CDqUUhTMwBzP/c0hr5LBFmo=';
var MicrosoftGraphClient = MicrosoftGraph.Client;
var meId = "me";
let UpdateCalender = require('./updateCalender');
var rp = require('request-promise');
var supportedVersions = ['beta', 'v1.0'];
var graphClientMap = new Map();
var sharepointToken = "";

var DeleteMeeting = function (meeting_id) {
    return new Promise(function (resolve, reject) {
        var r = {};
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
            xsi:type="java:com.webex.service.binding.meeting.DelMeeting">
            <meetingKey>${meeting_id}</meetingKey>
        </bodyContent>
    </body>
</serv:message>`;
        console.log(rawbody);
        request.post({
            headers: { 'content-type': 'application/xml' },
            url: 'https://apidemoeu.webex.com/WBXService/XMLService',
            body: rawbody
        }, function (error, response, body) {
            try {
                const ast = XmlReader.parseSync(body);
                const status = xmlQuery(ast).find('serv:result').text();
                console.log("inside deleteMeeting() status ="+status);
                r.status = status;
                resolve(status);
            }
            catch (e) {
                reject(e);
                console.log(e);
            }

        });  
    });
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

// =======================
// Delete outlook meeting
//========================

 var DeleteOutlook = function(a,session)
  {

   return new Promise(function (resolve, reject) {   
 if (a != '') {
     console.log("meeting ID from DeleteOutlook() "+a);
    var options = {
      method: 'POST',
      uri: 'https://apidemoeu.webex.com/WBXService/XMLService',
      body: `<serv:message xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
   <header>
        <securityContext>
            <webExID>NuanceWebex</webExID>
            <password>#23_Srini</password>
            <siteName>apidemoeu</siteName>
        </securityContext>
    </header>
    <body>
      <bodyContent
        xsi:type="java:com.webex.service.binding.meeting.LstsummaryMeeting">
          <meetingKey>${a}</meetingKey>
        <order>
          <orderBy>STARTTIME</orderBy>
        
        </order>
      </bodyContent>
    </body>
  </serv:message>`,
      headers: {
        // 'postman-token': '87544b87-0ab3-cfe6-cf86-ef2bab10e900',
        // 'cache-control': 'no-cache'
          'content-type': 'application/xml' 
        // 'postman-token': '87544b87-0ab3-cfe6-cf86-ef2bab10e900',
        // 'cache-control': 'no-cache'
      }
    };
    rp(options).then(function (body) {
        console.log(body);
        var xml = body;
        const ast = XmlReader.parseSync(xml);
        const xq = xmlQuery(ast);
        let meetingResult = xmlQuery(ast).find('serv:result').text();
        var reasonFail = xmlQuery(ast).find('serv:reason').text();
        let meetingKeyX = xmlQuery(ast).find('meet:meetingKey').text();
        var confNameX = xmlQuery(ast).find('meet:confName').text();
        var startDateN = xmlQuery(ast).find('meet:startDate').text();
        var durationN = xmlQuery(ast).find('meet:duration').text();
        // check the success result
        console.log("inside DeleteOutlook() start time"+startDateN);
         console.log("duration"+durationN);
         console.log("meeting result"+meetingResult);
         
           
        if (meetingResult == 'SUCCESS') {
          // UpdateCalender.RetrieveSchedule(session,startDateN);
        //   session.endDialog(`Your meeting keys is ${meetingKeyX} and the conference name is ${confNameX} 
        // and meeting starts from ${startDateN}`);
        console.log("success");
         UpdateCalender.RetrieveSchedule2(session, startDateN, durationN, confNameX);
         // delete WebEX meeting
         console.log("throwing "+a+" to WebEX Delete");
         deleteMeeting(a).then((res) => {
              session.endDialog(`meeting with ID ${a} had been deleted.`);
         })
         .catch((err) => {
             session.endDialog(`error occured in Webex delete ${err}`);
         })

        } else if (meetingResult == 'FAILURE') {
          session.endDialog(`Sorry ! I couldn't find any meeting with ID ${a}.`);
          return meetingResult;
        } else {
          session.endDialog();
        }
        return body;
      })
      .catch(function (err) {
        console.log(err);
        session.send(err);
        return err;
      });
  } else {
    session.send(`meeting key is invalid`);
  }
   
 });
  }


module.exports.deleteMeeting = DeleteMeeting;
module.exports.deleteOutlook = DeleteOutlook;

