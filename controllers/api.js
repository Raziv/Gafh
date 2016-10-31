var request     = require('request');
var properties = require('../config/properties.js');
var helper = require('../services/WeatherService.js');

//GET request : webhook call
exports.validateWebhook = function(req, res) {
    if (req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === 'gafhbot_project') {
        console.log("Validating webhook");
        res.status(200).send(req.query['hub.challenge']);
    } else {
        console.error("Failed validation. Make sure the validation tokens match.");
        res.sendStatus(403);
    }
}

//Listen for POST calls at webhook
exports.handleMessage = function (req, res) {
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
}

function receivedMessage(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfMessage = event.timestamp;
    var message = event.message;
    var messageId = message.mid;
    var messageText = message.text;
    console.log(messageText);
    // call Wit.AI API to retrieve intent of recieved message
    callWitAI(messageText, senderID);
}

function callWitAI(query, senderID){
  query = encodeURIComponent(query);
    request({
        uri: properties.wit_ai_endpoint + query,
        qs:  {access_token: properties.wit_ai_token},
        method: 'GET'
      },function(error, response, body){
        if (!error && response.statusCode == 200) {
            try{
                witai_data = JSON.parse(response.body);
                handleIntent(senderID, witai_data);
            } catch(ex) {
                console.error("Unable to send message %m", ex);
            }
        } else {
            console.log(response.statusCode);
        }
    });
}

function handleIntent(senderID, witai_data){
    try{
        intent = witai_data["entities"]["intent"][0]["value"];
    } catch(ex) {
        intent = 'no_intent_found';
    }
    console.log(intent);
    switch(intent){
        case "greeting":
            sendTextMessage(senderID, "Hey, I am Gafh. :-)");
            break;

        case "weather":
            location = witai_data["entities"]["location"][0]["value"];
            getGeolocation(location, function(err, lat_lng){
                console.log(lat_lng);
                getWeatherData(lat_lng, function(err, summary){
                    curr_weather = summary;
                    //console.log("weather : "+curr_weather);
                    sendTextMessageTest(senderID, curr_weather);
                });
            });
            break;

        default :
            sendTextMessage(senderID, "Sorry, I am not trained to answer that yet :-(");
    }
}

function sendTextMessageTest(senderID,body){
    //Current weather forecast
    body= JSON.parse(body);
    var flag_rain_start, flag_rain_stop = 0;
    summary = body["currently"]["summary"];
    time1 = body["currently"]["time"];
    curr_prec = body["currently"]["precipIntensity"];
    humidity = ((body["currently"]["humidity"])*100).toFixed(2)+" % humid";
    temperature_f = body["currently"]["temperature"];
    temperature_c = ((((temperature_f-32)*5)/9).toFixed(2))+" \u00B0C";
    console.log(summary+' '+temperature_f);
    curr_weather_data =(summary+", "+temperature_c+", "+humidity).toString();

    //Weather forecast per minute
    var min_weather_data = '';
    if(body["minutely"]){
        icon = body["minutely"]["icon"];
        data = body["minutely"]["data"];
        var time2, time_diff_stop, time_diff_start, min_prec_status = 0;
        if(icon=='rain' || icon=='partly-cloudy-day' || icon=='partly-cloudy-night'){
            var retdata = helper.prepipitateTime(body, 'minutely');
            if(retdata){
                res = retdata.split(':');
                min_prec_status = res[0];
                start_stop_time = res[1];
                min_weather_data = helper.printMessage(min_prec_status, start_stop_time, icon, 'min');
            }
        }
    }

    //Weather forecast per hr
    var hr_weather_data = '';
    if(body["hourly"]){
        icon = body["hourly"]["icon"];
        data = body["hourly"]["data"];
        summary_hr = ". "+body["hourly"]["summary"];
        var time2, time_diff_stop_hr, time_diff_start_hr = 0;
        if(icon=='snow' || icon=='rain'){
            if(min_prec_status == 'start' || min_prec_status == 0){
                var retdata = helper.prepipitateTime(body, 'hourly',min_prec_status);
                if(retdata){
                    res = retdata.split(':');
                    hr_prec_status = res[0];
                    start_stop_time = res[1];
                    hr_weather_data = helper.printMessage(hr_prec_status, start_stop_time, icon, 'hr');
                }
            }
        }
    }

    weather_data = curr_weather_data + summary_hr + min_weather_data + hr_weather_data;

    sendTextMessage(senderID, weather_data);
}

function getGeolocation(location, callback){
    console.log('location : '+location);
    var API_KEY = properties.google_api_token;
    var BASE_URL = properties.geolocation_endpoint;
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
    var DARK_SKY_KEY = properties.dark_sky_key;
    var BASE_URL = properties.dark_sky_endpoint;
    var url = BASE_URL + DARK_SKY_KEY + "/" + lat_lng;

    request(url, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            try{
                //body= JSON.parse(response.body);
                callback(null,body);

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
        uri: properties.facebook_message_endpoint,
        qs: { access_token: properties.page_token },
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
