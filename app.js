var express     = require('express');
var app         = express();
var bodyParser  = require('body-parser');
var request     = require('request');
var rssReader   = require('feed-read');

var dark_sky_key       = process.env.DARK_SKY_KEY;
var page_token         = process.env.PAGE_TOKEN;
var port_token         = process.env.PORT_TOKEN;

app.use(bodyParser.json());

//GET request : webhook call
app.get('/webhook', function(req, res) {
    if (req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === 'gafhbot_project') {
        console.log("Validating webhook");
        res.status(200).send(req.query['hub.challenge']);
    } else {
        console.error("Failed validation. Make sure the validation tokens match.");
        res.sendStatus(403);
    }
});

//curl to subscribe app, then listen for POST calls at webhook
app.post('/webhook', function (req, res) {
    var data = req.body;
    console.log("post");
    // Make sure this is a page subscription
    if (data.object == 'page') {
        // Iterate over each entry
        // There may be multiple if batched
        data.entry.forEach(function(pageEntry) {
            var pageID = pageEntry.id;
            var timeOfEvent = pageEntry.time;
            // Iterate over each messaging event
            pageEntry.messaging.forEach(function(messagingEvent) {
                if (messagingEvent.message) {
                    receivedMessage(messagingEvent);
                } else {
                    console.log("Webhook received unknown messagingEvent: ", messagingEvent);
                }
            });
        });
        res.sendStatus(200);
    }
});

function receivedMessage(event) {
    //console.log("received");
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfMessage = event.timestamp;
    var message = event.message;

    //console.log("Received message for user %d and page %d at %d with message:",
    //senderID, recipientID, timeOfMessage);
    //console.log(JSON.stringify(message));

    var messageId = message.mid;
    // You may get a text or attachment but not both
    var messageText = message.text;

    // call Wit.AI API to retrieve intent of recieved message
    callWitAI(messageText, function(err, witai_data){
        //console.log('intent : ' + intent);

    });
    handleIntent(senderID, witai_data);
}

function callWitAI(query, callback){
  query = encodeURIComponent(query);
    request({
        uri: 'https://api.wit.ai/message?v=20161003&q='+query,
        qs:  {access_token: 'IFCCAT4A44BJIK7YZURRKW5RDJQIF4GP'},
        method: 'GET'
      },function(error, response, body){
        if (!error && response.statusCode == 200) {
            try{
                witai_data = JSON.parse(response.body);
                callback(null, witai_data);
            } catch(ex) {
                callback(ex);
            }
        } else {
            //console.log(response.statusCode);
            //console.error("Unable to send message %m", error);
            callback(error);
        }
    });
}

function handleIntent(senderID, witai_data){

    intent = witai_data["entities"]["intent"][0]["value"];

    switch(intent){
        case "greeting":
            sendTextMessage(senderID, "Hey, I am Gafh. :-)");
            break;

        case "weather":
            location = witai_data["entities"]["location"][0]["value"];
            getGeolocation(location, function(err, lat_lng){});
            getWeatherData(lat_lng, function(err, summary){
                curr_weather = summary;
                console.log("weather : "+curr_weather);
                sendTextMessage(senderID, curr_weather);
            });
            break;

        default :
            sendTextMessage(senderID, "Sorry, I am not trained to answer that yet :-(");
    }
}

function getGeolocation(location, callback){
    console.log('location : '+location);

    var API_KEY = "AIzaSyBYOu9ZmhY-QrVGOk4TCQPd2Qzc0b3CSXA";
    var BASE_URL = "https://maps.googleapis.com/maps/api/geocode/json?address=";
    var address = "260 Wellesley street, Toronto, Canada";
    var url = BASE_URL + location + "&key=" + API_KEY;

    request(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            res = JSON.parse(response.body);
            lat = res["results"][0]["geometry"]["location"]["lat"];
            lng = res["results"][0]["geometry"]["location"]["lng"];
            lat_lng = (lat+","+lng).toString();
            callback(null,lat_lng);
        }
        else {
            // The request failed, handle it
        }
    });
}


//Using Dark Sky API to retrieve weather data
function getWeatherData(lat_lng, callback){

    request('https://api.darksky.net/forecast/b66ce5b0a9fa37518e4238304b935d43/'+lat_lng,
        function(error, response, body){
            if (!error && response.statusCode == 200) {
                try{
                    body= JSON.parse(response.body);
                    summary = body["currently"]["summary"];
                    humidity = ((body["currently"]["humidity"])*100).toFixed(2)+" % humid";
                    temperature_f = body["currently"]["temperature"];
                    temperature_c = ((((temperature_f-32)*5)/9).toFixed(2))+" \u00B0C";
                    console.log(summary+' '+temperature_f);
                    summary =(summary+", "+temperature_c+", "+humidity).toString();
                    callback(null, summary);
                } catch(ex) {
                    callback(ex);
                }
            } else {
                console.error("Unable to retrieve weather information %m", error);
                callback(error);
            }
    });
}

function sendTextMessage(recipientId, messageText) {

    console.log(messageText);
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: messageText
        }
    };
    callSendAPI(messageData)
}

function callSendAPI(messageData) {
    request({
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: { access_token: page_token },
        method: 'POST',
        json: messageData

    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var recipientId = body.recipient_id;
            var messageId = body.message_id;

            console.log("Successfully sent generic message with id %s to recipient %s",
            messageId, recipientId);
        } else {
            console.error("Unable to send message.");
            console.error(response);
            console.error(error);
        }
    });
}

app.listen(port_token);
