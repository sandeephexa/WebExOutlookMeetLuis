//Bot function Editing by anitha
var request = require("request");
var rp = require('request-promise');
const XmlReader = require('xml-reader');
let UpdateCalender = require('./updateCalender');
const xmlQuery = require('xml-query');
let UpdateMeetingKey = 620373909;

var header = {
  'Postman-Token': '3c47290a-2141-ae22-5744-16d21de134c3',
  'Cache-Control': 'no-cache'
}

sendUpdateMember = function (a, arrList, session) {
  if ((arrList != "") && (a != "")) {
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
        xsi:type="java:com.webex.service.binding.meeting.SetMeeting">
        <meetingkey>${a}</meetingkey>
        <participants>
          <attendees>
            ${arrList}
          </attendees>
        </participants>
        <attendeeOptions>
          <emailInvitations>true</emailInvitations>
        </attendeeOptions>
        <schedule>
          <openTime>300</openTime>
        </schedule>
      </bodyContent>
    </body>
  </serv:message>`,
      headers: header
    };
    rp(options).then(function (body, request) {
        console.log(body);
        var xmlSend = body;
        const astSend = XmlReader.parseSync(xmlSend);
        const xqSend = xmlQuery(astSend);

        var meetingResultX = xmlQuery(astSend).find('serv:result').text();
        console.log(meetingResultX);

        if (meetingResultX == 'FAILURE') {
          session.endDialog(`Can't find any meeting with this Key ${meetingResultX}. So, provide the correct meeting key`);
        } else if (meetingResultX == 'SUCCESS') {

          UpdateCalender.updateMeeting(session);
          session.endDialog(`Great, Meeting rescheduling is ${meetingResultX}. The participents are added, kindly check the mail.`); 
        } else {
          session.endDialog(`result`);
        }
        // console.log(`Great, rescheduling is ${meetingResultX}. The participents are added, kindly check the mail.`);
        // session.send(`Great, Meeting rescheduling is ${meetingResultX}. The participents are added, kindly check the mail.`);
        return body;
      })
      .catch(function (err) {
        console.log(err);
        return err;
      });
  } else {
    session.endDialog(`Unfortunately the section is closed. So, start over the conversation.`);
  }
}


GetUpdateMember = function (a, session) {
  if (a != '') {
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
        'postman-token': '87544b87-0ab3-cfe6-cf86-ef2bab10e900',
        'cache-control': 'no-cache'
      }
    };
    rp(options).then(function (body) {
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
        console.log(meetingResult);
        console.log("meetingResult");
        if (meetingResult == 'SUCCESS') {

          console.log(`Your meeting keys is ${meetingKeyX} and the conference name is ${confNameX} 
          and meeting starts from ${startDateN}`);

          UpdateCalender.RetrieveSchedule(session, startDateN, durationN);
          session.endDialog(`Your meeting keys is ${meetingKeyX} and the conference name is ${confNameX} 
          and meeting starts from ${startDateN}`);

        } else if (meetingResult == 'FAILURE') {
          session.endDialog(`Can't find any meeting with this Key ${meetingKeyX}. And the response is : ${reasonFail}`);
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
}

module.exports.GetUpdateMember = GetUpdateMember;
module.exports.sendUpdateMember = sendUpdateMember;