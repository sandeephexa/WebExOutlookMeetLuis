/*-----------------------------------------------------------------------------
A simple echo bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/

var restify = require('restify');
var builder = require('botbuilder');
var botbuilder_azure = require("botbuilder-azure");
var createMeeting = require('./createmeeting');
var RSMeetingIm = require('./RescheduleMeeting');
let UpdateCalender = require('./updateCalender');
var deleteMeet = require('./deleteMeeting');

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());


// server.get('/meeting', (req, res, next) => {
//     res.send(RSMeetingIm.sendUpdateMember());
// });


/*----------------------------------------------------------------------------------------
 * Bot Storage: This is a great spot to register the private state storage for your bot. 
 * We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
 * For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
 * ---------------------------------------------------------------------------------------- */

var tableName = 'botdata';
var azureTableClient = new botbuilder_azure.AzureTableClient(tableName, process.env['AzureWebJobsStorage']);
var tableStorage = new botbuilder_azure.AzureBotStorage({
    gzipData: false
}, azureTableClient);



// Create your bot with a function to receive messages from the user
var bot = new builder.UniversalBot(connector);
bot.set('storage', tableStorage);

// Make sure you add code to validate these fields
var luisAppId = process.env.LuisAppId;
var luisAPIKey = process.env.LuisAPIKey;
var luisAPIHostName = process.env.LuisAPIHostName || 'westus.api.cognitive.microsoft.com';


const LuisModelUrl = `https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/${luisAppId}?subscription-key=${luisAPIKey}&staging=true&verbose=true&timezoneOffset=330&q=`;

String.prototype.capitalize = function () {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

// Main dialog with LUIS
var KeySession = '';
var mySession = '';
var createSession = '';
var validator = require("email-validator");
// ----------------------------------------------------------------


var recognizer = new builder.LuisRecognizer(LuisModelUrl);
var intents = new builder.IntentDialog({
        recognizers: [recognizer]
    })
    .matches('Greeting', (session) => {
        const LuisModelUrl = 'https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/f91dd71e-8a47-4378-87a6-6b61eb64661a?subscription-key=633cb50cee194bc4b500689a53b268f5&staging=true&verbose=true&timezoneOffset=330&q=';

        var recognizer = new builder.LuisRecognizer(LuisModelUrl);
        var intents = new builder.IntentDialog({
            recognizers: [recognizer]
        })
        var welcomeCard = new builder.HeroCard(session)
            .title('CISCO WEBEX')
            .subtitle('Hi, I am your WebEx Assistant. I can help you create, reschedule and cancel meetings.')
            .images([
                new builder.CardImage(session)
                .url('https://slack-files2.s3-us-west-2.amazonaws.com/avatars/2017-07-24/216982531396_f9249cce8e2f14329466_512.png')
                .alt('Cisco WebEx')
            ])
            .buttons([
                builder.CardAction.imBack(session, "Create Meeting", "Create Meeting"),
                builder.CardAction.imBack(session, "Update Meeting", "Update Meeting"),
                builder.CardAction.imBack(session, "Cancel Meeting", "Cancel Meeting")
            ]);

        session.send(new builder.Message(session)
            .addAttachment(welcomeCard));
    })
    .matches('Help', (session) => {
        session.send('You reached Help intent, you said \'%s\'.', session.message.text);
    })
    .matches('Cancel', (session) => {
        session.send('You reached Cancel intent, you said \'%s\'.', session.message.text);
    })
    .matches('DeleteMeeting', (session) => {

        mySession.session = session.message.text;
        session.userData.session = session.message.text;
        session.beginDialog('MeetingValid');
    })
    .matches('AddParticipant', (session) => {
        session.userData.participantStatus = "Add";
        session.send(`Please provide username of the participant to be added for the meeting`);
        session.beginDialog('UserSearch');
    })
    .matches('RemoveParticipant', (session) => {
        session.userData.participantStatus = "Remove";
        session.send(`Please provide username of the participant to be removed from this meeting`);
        session.beginDialog('UserSearch');
    })
    .matches('SendMeeting', (session) => {
        var emaillist = session.userData.emailarray;
        var subjectMeeting = session.userData.subjectMeeting;
        var meetingPlace = session.userData.meetingPlace;
        var dateScheduling = session.userData.dateScheduling;
        var startdate = dateScheduling.resolution.start;
        var enddate = dateScheduling.resolution.end;
        createMeeting.sendMeeting(subjectMeeting, meetingPlace, dateScheduling, emaillist, startdate, enddate, session).then(function (result) {
            createMeeting.createOutlookMeeting(session).then(function (respp) {
                var EditButtons = new builder.HeroCard(session)
                    .text('Meeting is Scheduled. Anything else?')
                    .buttons([
                        builder.CardAction.imBack(session, "Create Meeting", "Create Meeting"),
                        builder.CardAction.imBack(session, "Update Meeting", "Update Meeting"),
                        builder.CardAction.imBack(session, "Cancel Meeting", "Cancel Meeting")
                        // builder.CardAction.imBack(session, "Edit Content", "Content")
                    ]);

                session.send(new builder.Message(session)
                    .addAttachment(EditButtons));
                session.userData = null;

            }).catch(function (errdata) {
                session.send(errdata);
                session.userData = null;
            })

        }).catch(function (errdata) {
            session.send(errdata);

        })
    })
    .matches('Exit', (session) => {
        var emaillist = JSON.stringify(session.userData.emailarray);
        var subjectMeeting = session.userData.subjectMeeting;
        var meetingPlace = session.userData.meetingPlace;
        var dateScheduling = session.userData.dateScheduling;
        var startdate = dateScheduling.resolution.start;
        var enddate = dateScheduling.resolution.end;
        var newdate = startdate.split('T');
        var enddate = enddate.split('T');
        var timestart = newdate[1].split('.')
        var timeend = enddate[1].split('.')
        var ExitCard = new builder.HeroCard(session)
            .title(`${subjectMeeting}`)
            .subtitle(`${meetingPlace}\n\nDate:${newdate[0]}\n\n Time: ${timestart[0]} - ${timeend[1]}`)
            .buttons([
                builder.CardAction.imBack(session, "Send Meeting", "Send Meeting")
            ]);

        session.send(new builder.Message(session)
            .addAttachment(ExitCard));
    })
    .matches('Createmeeting', (session) => {
        createSession.session = session;
        session.beginDialog('meetingCreate');

    })
    // .matches('Subjectmeeting', (session, args, next) => {
    //     var subjectMeeting = builder.EntityRecognizer.findEntity(args.entities, 'SubjectMessage');

    //     session.send(`Meeting subject is ${subjectMeeting.entity.capitalize()}. Where would the meeting be?`);
    // })
    .matches('Meetingplace', (session, args, next) => {
        var meetingPlace = builder.EntityRecognizer.findEntity(args.entities, 'MeetingPlace');
        session.userData.meetingPlace = meetingPlace.entity.capitalize();
        session.send(`what is your preferred meeting schedule? Awesome example (If you’re stuck!!) “tomorrow 5 to 5.30 pm”`);
    })
    // .matches('EditMeeting', (session) => {
    //     session.send('You reached Edit intent, you said \'%s\'.', session.message.text);
    // })


    // -----------------------------------------reschedule meeting----------------------------------------

    .matches('UpdateMeet', (session) => {
        // session.userData = null;
        session.userData.matchedContacts = null;
        var EditButtons = new builder.HeroCard(session)
            .text('Please select to edit the meeting')
            .buttons([
                builder.CardAction.imBack(session, "Edit Member", "Member"),
                // builder.CardAction.imBack(session, "Edit Timing", "Timing"),
                // builder.CardAction.imBack(session, "Edit Content", "Content")
            ]);

        session.send(new builder.Message(session)
            .addAttachment(EditButtons));
    })
    // -----------------------------------------
    .matches('MemberEdit', (session) => {
        // var a = '';
        // var arrEmail = '';
        KeySession.session = session.message.text;
        session.userData.session = session.message.text;
        session.beginDialog('ValidateMeetingKey');
        // session.beginDialog('RetrieveMeetingList');
    })
    .matches('ExitIntent', (session) => {
        session.userData = null;
        session.endConversation('ok bye have a nice day \'%s\'.', session.message.text);
    })

    // -------------------------------------------------------------------------
    /*
    .matches('<yourIntent>')... See details at http://docs.botframework.com/builder/node/guides/understanding-natural-language/
    */
    .onDefault((session) => {
        var welcomeCard = new builder.HeroCard(session)
            .title('CISCO WEBEX')
            .subtitle('That may be beyond my abilities. I can help you create, reschedule and cancel meetings.')
            .images([
                new builder.CardImage(session)
                .url('https://slack-files2.s3-us-west-2.amazonaws.com/avatars/2017-07-24/216982531396_f9249cce8e2f14329466_512.png')
                .alt('Cisco WebEx')
            ])
            .buttons([
                builder.CardAction.imBack(session, "Create Meeting", "Create Meeting"),
                builder.CardAction.imBack(session, "Update Meeting", "Update Meeting"),
                builder.CardAction.imBack(session, "Cancel Meeting", "Cancel Meeting")
            ]);

        session.send(new builder.Message(session)
            .addAttachment(welcomeCard));
    });





//-----------CreateMeetingDialog-------------------------------------------
function ValidateEmailSS(inputText) {
    var mailformat = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (inputText.match(mailformat)) {
        return true;
    } else {
        return false;
    }
}

bot.dialog('meetingCreate', [
    function (session) {
        builder.Prompts.text(session, "Okay, what is the subject of your meeting?");

    },
    function (session, results) {
        session.userData.subjectMeeting = results.response.capitalize();
        session.endDialog(`Meeting subject is ${session.userData.subjectMeeting}`);
        session.beginDialog('MeetingPlace');
    }
]);
bot.dialog('MeetingPlace', [
    function (session) {
        builder.Prompts.text(session, 'Where would the meeting be?');

    },
    function (session, results) {
        session.userData.meetingPlace = results.response.capitalize();
        session.endDialog(`Meeting place is ${session.userData.meetingPlace}`);
        session.beginDialog('ScheduledDate');
    }
]);
bot.dialog('ScheduledDate', [
    function (session) {
        builder.Prompts.time(session, 'what is your preferred meeting schedule? Awesome example (If you’re stuck!!) “tomorrow 5 to 5.30 pm”');
        // session.beginDialog('EmailValidations');
    },
    function (session, results) {
        session.userData.dateScheduling = results.response;
        var start = session.userData.dateScheduling.resolution.start;
        var end = session.userData.dateScheduling.resolution.end;
        session.beginDialog('UserSearch');
    }
]);
bot.dialog('UserSearch', [
    function (session) {
        builder.Prompts.text(session, 'Please enter the username of the participant');
        // session.beginDialog('EmailValidations');
    },
    function (session, results) {
        session.userData.searchUsername = results.response;
        createMeeting.searchContact(session).then(function (resp) {
            session.endDialog(session.userData.contactPromptStringS);
            console.log(session.userData.matchedContactsS);
            session.beginDialog('SelectOptions');

        }).catch(function (errdata) {
            session.send(JSON.stringify(errdata));
            console.log(errdata);
            session.beginDialog('UserSearch');
        });

    }
]);
bot.dialog('SelectOptions', [
    function (session) {
        builder.Prompts.number(session, 'Select your options');
        // session.beginDialog('EmailValidations');
    },
    function (session, results) {
        var searchResult = results.response;
        if (searchResult) {
            if (session.userData.participantStatus == "Add") {
                var matched = session.userData.matchedContactsS[searchResult - 1];
                session.userData.emailArraysN.push(matched);
                session.userData.emailarray.push(matched.EmailAddress.Address);
                session.userData.participantsS.push(matched.EmailAddress.Name);
                console.log(session.userData.emailarray);
            } else if (session.userData.participantStatus == "Remove") {
                var matched = session.userData.matchedContactsS[searchResult - 1];
                session.userData.emailArraysN.splice(matched, 1);
                session.userData.emailarray.splice(matched, 1);
                session.userData.participantsS.splice(matched, 1);
                console.log(session.userData.emailarray);
            } else if (session.userData.hasOwnProperty("emailArraysN")) {
                var matched = session.userData.matchedContactsS[searchResult - 1];
                session.userData.emailArraysN.push(matched);
                session.userData.emailarray.push(matched.EmailAddress.Address);
                session.userData.participantsS.push(matched.EmailAddress.Name);
                console.log(session.userData.emailarray);
            } else {
                var matched = session.userData.matchedContactsS[searchResult - 1];
                session.userData.emailArraysN = [];
                session.userData.emailarray = [];
                session.userData.participantsS = [];
                session.userData.emailArraysN.push(matched);
                session.userData.emailarray.push(matched.EmailAddress.Address);
                session.userData.participantsS.push(matched.EmailAddress.Name);
                console.log(session.userData.emailarray);
            }
        }
        var msg = new builder.HeroCard(session)
            .text(`${session.userData.participantsS} \n\nSelect your options`)
            .buttons([
                builder.CardAction.imBack(session, "Add Participant", "Add Participant"),
                builder.CardAction.imBack(session, "Remove Participant", "Remove Participant"),
                builder.CardAction.imBack(session, "Ignore", "Ignore")
            ]);
        session.send(new builder.Message(session)
            .addAttachment(msg));

        session.endDialog();
    }
]);

bot.dialog('EmailValidations', [
    function (session) {
        builder.Prompts.text(session, "Please Enter the email id of participants")
    },
    function (session, results) {

        if (ValidateEmailSS(results.response)) {
            if (session.userData.hasOwnProperty('participantStatus')) {
                var emaillist = session.userData.emailarray;
                var emailind = emaillist.indexOf(results.response);
                if (emailind == -1) {
                    if (session.userData.participantStatus == "Add") {
                        session.userData.emailarray.push(results.response);
                    }
                }
                if (emailind > -1) {
                    if (session.userData.participantStatus == "Remove") {
                        session.userData.emailarray.splice(emailind, 1);
                    }
                }
            } else if (session.userData.hasOwnProperty('emailarray')) {
                session.userData.emailarray.push(results.response);
            } else {
                session.userData.emailarray = [];
                session.userData.emailarray.push(results.response);
            }

            var msg = new builder.HeroCard(session)
                .text(`${session.userData.emailarray} \n\nSelect your options`)
                .buttons([
                    builder.CardAction.imBack(session, "Add Participant", "Add Participant"),
                    builder.CardAction.imBack(session, "Remove Participant", "Remove Participant"),
                    builder.CardAction.imBack(session, "Ignore", "Ignore")
                ]);
            session.send(new builder.Message(session)
                .addAttachment(msg));
            session.endDialog();
        } else {
            // Repeat the dialog
            session.replaceDialog('EmailValidations', {
                reprompt: true
            });
        }
    }
]);
bot.dialog('ValidateMeetingKey', [
    function (session) {
        builder.Prompts.number(session, "Kindly give me your 9 digit meeting key. To add the participants");
    },
    function (session, results) {
        session.userData.meetingLength = results.response;
        var meetinglen = session.userData.meetingLength;
       
        var a = meetinglen.toString();

        if (a.length == 9) {

            var getList = RSMeetingIm.GetUpdateMember(a, session);
            // var getOutlookList = UpdateCalender.RetrieveSchedule(session);

            if (getList != 'FAILURE') {
                setTimeout(() => {
                     // ---clear the session mailid session 
                    session.userData.addEmail = null;
                    session.userData.matchedContacts = null;
                    session.userData.participant = null;
                    
                    session.beginDialog('ValidateEmail');
                }, 1500);
            } else {
                console.log("---------------else in validatemeetingkey" + getList);
                session.endDialog(`Invalid meeting key ${getList}`);
            }

        } else {
            session.endDialog(`Sorry, meeting key is not valid, Please give me your correct meeting key.`);
            session.beginDialog('ValidateMeetingKey');
            // session.endConversation(`please start from first`);

        }
    }
]);

//function to validate email
function checkEmail(email) {
    var regExp = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,5}$/;
    return regExp.test(email) ? true : false;
}

function matchContactName(contacts, n, session) {

    var returnVal = n;
    console.log("------------valuecheck------------n");
    console.log(n);
    console.log(returnVal);
    console.log(contacts);
    console.log(JSON.stringify(contacts));
    console.log("contacts");
    for (let i = 0; i < contacts.length; i++) {
        // console.log(contacts[i].EmailAddress[0].Address.indexOf(n));
        console.log("-----------------contacts[i].mail " + JSON.stringify(contacts[i]));
        if (contacts[i] && contacts[i].EmailAddress && contacts[i].EmailAddress.Address && contacts[i].EmailAddress.Address.indexOf(n) >= -1) {
            //             console.log(contacts[i].mail.indexOf(n));
            returnVal = "" + (i + 1);
        }
    }
    console.log(returnVal);
    return returnVal;
}

function getContactJSON(contResp) {
    // let userName = contResp.displayName;
    // let emailId = contResp.userPrincipalName;
    let userName = contResp.EmailAddress.Address;
    let emailId = contResp.EmailAddress.Name;
    var retValue = null;

    if (userName) {
        // retValue = {
        //     "EmailAddress": {
        //         "Address": emailId,
        //         "Name": userName
        //     },
        //     "Type": "Required",
        //     "checkAvailablity": "true"
        // };
        retValue = userName;
    }
    return retValue;
}

function handleCallBack(session, chooseContact) {
    if (!chooseContact) {
        return apiConnect.processMultMatchedContact(session);
    } else {
        return session.beginDialog('chooseContact');
    }
}
bot.dialog('chooseContact', [
    function (session, results) {
//         console.log(abc);
        let message = "Please choose one of the following participants <br/>" + session.userData.contactPromptString;
        console.log(message);
        
        session.userData.participantNotFound = null;
        if (session.userData.participantNotFound) {
            message = "I Could not found " + session.userData.name + ". Do you like to <br/>" + session.userData.contactPromptString;
        }
        builder.Prompts.text(session, message);
    },

    function (session, results) {
        if (results.response) {
            var index = results.response;
            console.log("index");
            //             console.log(index+ " len is  "+len);
            let len = 0;
            if (session.userData.matchedContacts) {
                console.log(session.userData.matchedContacts);
                console.log(` inside choose contacts--------------------${session.userData.matchedContacts}`);
                session.send(` inside choose contacts--------------------${session.userData.matchedContacts}`);
                index = matchContactName(session.userData.matchedContacts, index, session);

                len = session.userData.matchedContacts.length;

                let indices = index.split(',');
                let noOfOptions = indices.length;
                let invalidOptions = [];
                session.userData.participant = [];
                // SEARCH_AGAIN_OPTION = len + 1;
                IGNORE_OPTION = len + 1;
                SHOW_MORE = len + 2;

                if (noOfOptions > 1 || (index > 0 && index <= len)) {

                    let chooseCont = false;
                    for (let i = 0; i < noOfOptions; i++) {

                        let choosenIndex = indices[i];
                        if (choosenIndex > 0 && choosenIndex <= len) {
                            let contactInfo = [];
                            contactInfo = getContactJSON(session.userData.matchedContacts[choosenIndex - 1]);
                            console.log(contactInfo);
                            console.log("contactInfo");
                            // if (!util.checkIfContactExist(session.userData.participant, contactInfo)) {
                            session.userData.participant.push(contactInfo);

                            // let arremailsess = [];
                            // arremailsess = session.userData.participant.push(contactInfo);

                            // } else {
                            //     let message = 'I could see ' + contactInfo.EmailAddress.Name + ' already in list.';
                            //     if (noOfOptions <= 1) {
                            //         message = message + ' Probably you choose wrong choice, Either choose again or ignore';
                            //     }
                            //     session.send(message);
                            //     chooseCont = true;
                            // }
                            console.log(session.userData.participant);




                        } else {
                            invalidOptions.push(choosenIndex);
                        }
                    }
                    if (noOfOptions > 1) {
                        chooseCont = false;
                    }
                    // if (invalidOptions.length > 0) {
                    //     session.send(botdialogs.GET_BOT_MESSAGE('MULTI_SELECTION_INVALID_OPTION'));
                    // }
                    return session.beginDialog('confirmParticipant');;
                    // return handleCallBack(session, chooseCont);
                }
            }
        } else {
            session.send('Improper Input');
            return session.beginDialog('chooseContact');
        }
    }
]);
// -------------------------------------confirm participant
bot.dialog('confirmParticipant', [
    function (session) {
        builder.Prompts.text(session, `Please type "yes" if you add selected participant`);
    },
    function (session, result) {
        console.log(result.response);

        if (result.response === 'yes') {

            console.log("[participants]------------------in app.js");
            console.log(session.userData.participant);
            let emailArr = [];
            emailArr = session.userData.participant;
            let meetinglen = session.userData.meetingLength;

            var a = meetinglen.toString();
            // var arrEmail = Emailstr.toString();
            var arrList = '';
            // var arrEmailForm = arrEmail.split(',');
            // if (a != '') {
            emailArr.forEach(function (membersEmail) {
                if (checkEmail(membersEmail) == true) {
                    arrList += `<attendee>
                        <person>
                        <email>${membersEmail}</email>
                        </person>
                        </attendee>`;
                } else if (checkEmail(membersEmail) == false) {
                    console.log("-------------------else condition");
                    session.send(`This ${membersEmail} ID is not valid.`);
                    // session.beginDialog('ValidateEmail');

                } else {
                    session.endDialog(`Unfortunately the section is closed. So, start over the conversation.`);

                }
            });
            // } else {
            //     session.endDialog(`Invalid meeting key. So, start over the conversation.`)
            // }
            console.log("--------------------arrlist");
            console.log(arrList);

            var getUpdate = RSMeetingIm.sendUpdateMember(a, arrList, session);

            // console.log(results.response);
            // session.userData = null;
        } else {
            session.beginDialog('ValidateEmail');
            // session.endDialog(`Unfortunately the section is closed. So, start over the conversation.`);
        }
    }
]);

bot.dialog('ValidateEmail', [
    function (session) {
        // builder.Prompts.text(session, `Enter the participant name Now please add the participents serial number with comma seperated. 
        //                      Ex: 15,14`);
        session.userData.matchedContacts = null;
        session.userData.addEmail = null;
        session.userData.participant = null;
        builder.Prompts.text(session, `Great, Now type the participant name to search
                             Ex: Suzzi`);
    },
    function (session, results) {
        // if (a != '') {
        session.userData.addEmail = results.response;
        // ---------------------------------------------------call email function
        console.log(session.userData.addEmail);
        let emailIdSearch = session.userData.addEmail;
        UpdateCalender.searchOutlookContact(session, emailIdSearch);
    }
]);
// =====================
// meeting ID validation
bot.dialog('MeetingValid', [
    function (session) {
        builder.Prompts.number(session, "Please give your 9 digit meeting ID");
    },
    function (session, results) {
        session.userData.meetingLength = results.response;
        console.log(session.userData);
        var meetinglen = session.userData.meetingLength;
        var meeting_id = meetinglen.toString();
        var result;
        console.log("inside app.js meetingID" + meeting_id);

        //        session.endDialog(`valid meeting ID.`);
        if (meeting_id.length == 9) {

            deleteMeet.deleteOutlook(meeting_id, session).then(function (result3) {

                result = result3;

                // delete outlook
                console.log("sending meeting id to deleteOutlook() ");
                deleteMeet.deleteOutlook(meeting_id, session).then(function (res) {
                        session.endDialog(`deleted response ` + res);
                    })
                    .catch(function (errdata) {
                        session.send(errdata);
                        console.log("error from Webex" + errdata);
                        session.userData = null;
                    })
                // if (result == "FAILURE") 
                // {
                //     session.endDialog(`couldn't find any meeting with ID ${meeting_id}`);
                // } else if (result == "SUCCESS") 
                // {
                //         //  // delete outlook
                //         //  console.log("sending meeting id to deleteOutlook() ");
                //         // deleteMeet.deleteOutlook(meeting_id, session).then(function (res) {
                //         //         session.endDialog(`deleted response ` + res);
                //         //     })
                //         //     .catch(function (errdata) {
                //         //         session.send(errdata);
                //         //         console.log("error from Webex" + errdata);
                //         //         session.userData = null;
                //         //     })
                // } else
                //  {
                //     session.endDialog(`result`);
                //  }
            });

            // deleteMeet.deleteOutlook(meeting_id, session).then(function (res) {
            //         session.endDialog(`response ` + res);
            //     })
            //     .catch(function (errdata) {
            //         session.send(errdata);
            //         console.log("error from Webex" + errdata);
            //         session.userData = null;
            //     })


        } else {

            session.endDialog(`invalid meeting ID.`);
            session.beginDialog('MeetingValid');

        }
        // session.beginDialog('MeetingValid');
    }
]);


bot.dialog('/', intents);