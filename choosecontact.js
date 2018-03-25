(function () {
    'use strict';
    var apiConnect = require('../server/apiServices');
    var builder = require('botbuilder');
    var botdialogs = require('../utils/botdialogs');
    var util = require('../utils/utilities');
    var appConst = require('../utils/applicationConstant');
    var participantServices = require('../server/ParticipantServices');

    let SEARCH_AGAIN_OPTION = appConst.MAXIMUM_CONTACT_PAGE_SIZE + 1;
    let IGNORE_OPTION = appConst.MAXIMUM_CONTACT_PAGE_SIZE + 2;
    let SHOW_MORE = appConst.MAXIMUM_CONTACT_PAGE_SIZE + 3;

    exports.init = function (botDialogue) {
        botDialogue.dialog('chooseContact', dialogFlow)
    }

    var dialogFlow = [

        function (session, results) {
            let message = "Please choose one of the following participants <br/>" + session.userData.paginationRecord.contactPromptString;
            if (session.userData.paginationRecord.participantNotFound) {
                message = "I Could not found " + session.userData.paginationRecord.name + ". Do you like to <br/>" + session.userData.paginationRecord.contactPromptString;
            }
            builder.Prompts.text(session, message);
        },

        function (session, results) {


            if (results.response) {
                var index = results.response;
                let len = 0;


                if (session.userData.paginationRecord.matchedContacts) {

                    index = matchContactName(session.userData.paginationRecord.matchedContacts, index, session);

                    len = session.userData.paginationRecord.matchedContacts.length;

                    let indices = index.split(',');
                    let noOfOptions = indices.length;
                    let invalidOptions = [];

                    // SEARCH_AGAIN_OPTION = len + 1;
                    IGNORE_OPTION = len + 1;
                    SHOW_MORE = len + 2;

                    if (noOfOptions > 1 || (index > 0 && index <= len)) {

                        let chooseCont = false;
                        for (let i = 0; i < noOfOptions; i++) {

                            let choosenIndex = indices[i];
                            if (choosenIndex > 0 && choosenIndex <= len) {
                                let contactInfo = apiConnect.getContactJSON(session.userData.paginationRecord.matchedContacts[choosenIndex - 1]);

                                if (!util.checkIfContactExist(session.userData.participant, contactInfo)) {
                                    session.userData.participant.push(contactInfo);
                                } else {
                                    let message = 'I could see ' + contactInfo.EmailAddress.Name + ' already in list.';
                                    if (noOfOptions <= 1) {
                                        message = message + ' Probably you choose wrong choice, Either choose again or ignore';
                                    }
                                    session.send(message);
                                    chooseCont = true;
                                }
                            } else {
                                invalidOptions.push(choosenIndex);
                            }


                        }
                        if (noOfOptions > 1) {
                            chooseCont = false;
                        }
                        if (invalidOptions.length > 0) {
                            session.send(botdialogs.GET_BOT_MESSAGE('MULTI_SELECTION_INVALID_OPTION'));
                        }
                        return handleCallBack(session, chooseCont);

                    } else if (index == IGNORE_OPTION || index.toLowerCase() == "ignore") {
                        console.log("IGNORE >>>> ")
                        return apiConnect.processMultMatchedContact(session);
                    } else if (index == SHOW_MORE || index.toLowerCase() == "show more") {

                        if (!session.userData.paginationRecord.participantNotFound) {
                            console.log("SHOW MORE >>>> ");

                            return participantServices.searchInternalContact(session, session.userData.paginationRecord.name, apiConnect.meId, false);

                        } else {
                            return session.beginDialog('getContacts');
                        }

                    } else {
                        session.send('Entered Input seems to be invalid');
                        return session.beginDialog('chooseContact');
                    }


                }


            } else {
                session.send('Improper Input');
                return session.beginDialog('chooseContact');
            }
        }
    ];

    function matchContactName(contacts, n, session) {

        var returnVal = n;

        for (let i = 0; i < contacts.length; i++) {

            if (contacts[i].displayName.indexOf(n) > -1) {
                returnVal = "" + (i + 1);
            }

        }

        return returnVal;
    }

    function handleCallBack(session, chooseContact) {
        if (!chooseContact) {
            return apiConnect.processMultMatchedContact(session);
        } else {
            return session.beginDialog('chooseContact');
        }
    }

}());