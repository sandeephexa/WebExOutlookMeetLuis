var restify = require('restify');
var builder = require('botbuilder');
var botbuilder_azure = require("botbuilder-azure");

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

//const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v1/application?id=' + luisAppId + '&subscription-key=' + luisAPIKey;

const LuisModelUrl = 'https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/a5c9f919-77fb-4c77-8a6c-947100ae7612?subscription-key=3900d1e040ce4b02b65a03345bce2ad4&staging=true&verbose=true&timezoneOffset=0&q=';

// Main dialog with LUIS
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
var mySession = '';
var intents = new builder.IntentDialog({
        recognizers: [recognizer]
    })
    .matches('Greeting', (session) => {
        session.send('You reached Greeting intent, you said \'%s\'.', session.message.text);
    })
    .matches('Help', (session) => {
        session.send('You reached Help intent, you said \'%s\'.', session.message.text);
    })
    .matches('Cancel', (session) => {
        session.send('You reached Cancel intent, you said \'%s\'.', session.message.text);
    })
    /*
    .matches('<yourIntent>')... See details at http://docs.botframework.com/builder/node/guides/understanding-natural-language/
    */
    .matches('WelcomeIntent', (session) => {
        session.send('Hello, Welcome to HDFC Life. I can give information about <br/> - New insurance policies. <br/> - Existing insurance policy expiry date', session.message.text);
    })
    .matches('ThankYouIntent', (session) => {
        session.send('thanks for contacting HDFC life. have a good day.', session.message.text);
    })

    // .matches('PolicyNumber', (session) => {
    //     session.send('Great! And when is your birthday? Please share in YYYY-MM-DD format.', session.message.text);
    // })
    // .matches('MobileNumber', (session) => {
    //     session.send('your insurance plan will expire on 15 jan 2026', session.message.text);
    // })
    .matches('IssueIntent', (session) => {
        //session.send('Okay i will help you with that, could you please share your 8 digit HDFC Life policy no.?', session.message.text);
        mySession.session = session.message.text;
        session.userData.session = session.message.text;
        session.beginDialog('policyNumber');
    })

    .matches('DateIntent', (session) => {
        //session.send('Please share your registered 10-digit mobile number.', session.message.text);
        mySession.session = session.message.text;
        session.userData.session = session.message.text;
        session.beginDialog('mobileNumber');
    })
    .matches('NewInsurance', (session) => {
        //session.send('Okay, what is the tenure you are expecting <br/> ex: 1 year <br/>5 years <br/>10 years, session.message.text);
        mySession.session = session.message.text;
        session.userData.session = session.message.text;
        session.beginDialog('tenureYear');
    })

    .onDefault((session) => {
        session.send('Sorry, I did not understand \'%s\'.', session.message.text);
    });

bot.dialog('policyNumber', [
    function (session) {
        builder.Prompts.number(session, "could you please share your 8 digit HDFC Life policy number ?");
    },
    function (session, results) {
        session.userData.policyNumberCount = results.response;
        console.log(session.userData);
        var policylen = session.userData.policyNumberCount;
        var a = policylen.toString();

        if (a.length == 8) {
            //session.send("invalid policy number. policy number should be 8 digit");
            session.endDialog(' Thanks, now please share your date of birth in DD/MM/YYYY format. ');
            //session.beginDialog('bookparty');

        } else {
            // builder.Prompts.number(session,"invalid policy number. policy number should be 8 digit");
            session.endDialog("invalid policy number. policy number should be 8 digit");
            session.beginDialog('policyNumber');

        }
        //session.beginDialog('policyNumber');   
    }


]);

// mobile number
bot.dialog('mobileNumber', [
    function (session) {
        builder.Prompts.number(session, "please share your registered 10 digit mobile number ");
    },
    function (session, results) {
        session.userData.mobileNumberCount = results.response;
        console.log(session.userData);
        var mob = session.userData.mobileNumberCount;
        var m = mob.toString();
        let val;
        val = Math.floor(Math.random() * 30 + 1);
        console.log(val);
        if (m.length == 10) {
            //session.send("invalid policy number. policy number should be 8 digit");
            session.endDialog(`<p> your insurance plan will expire on ${val} jan 2026</p>`);
            //session.beginDialog('bookparty');

        } else {
            session.endDialog("invalid mobile number. mobile number should be 10 digit");

            session.beginDialog('mobileNumber');
        }
    },

]);

// tenure year
bot.dialog('tenureYear', [
    function (session) {
        builder.Prompts.number(session, "Okay, what is the tenure you are expecting <br/> ex: 5 years <br/>10 years <br/>20 years");
    },
    function (session, results) {
        session.userData.tenureCount = results.response;
        console.log(session.userData);
        var tenure = session.userData.tenureCount;
        var t = tenure.toString();

        if (t === "5 years'" || t === "5") {
            //session.send("invalid policy number. policy number should be 8 digit");

            session.endDialog('policy term : 5 years </br> sum assured : 10 lacs </br> premium for 1cr coverage : Rs 4,986/Year, Rs 434/Month, Rs 15/Day ');
            //session.beginDialog('bookparty');

        } else if (t === "10 years" || t === "10") {
            //session.send("invalid policy number. policy number should be 8 digit");

            session.endDialog('policy term : 10 years </br> sum assured : 20 lacs </br> premium for 1 cr coverage : Rs 7,256/Year, Rs 653/Month, Rs 22/Day');
            //session.beginDialog('bookparty');

        } else if (t === "20 years" || t === "20") {
            //session.send("invalid policy number. policy number should be 8 digit");

            session.endDialog(' policy term : 20 years </br> sum assured : 25 lacs </br> premium for 1 cr coverage : Rs 61,935/Year, Rs5,395/Month');
            //session.beginDialog('bookparty');

        } else {
            builder.Prompts.number(session, "please enter valid option");

        }

    }


]);

bot.dialog('/', intents);