var request     = require('request');
var properties = require('../config/properties.js');

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

//curl to subscribe app, then listen for POST calls at webhook
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
console.log(messageText);
    // call Wit.AI API to retrieve intent of recieved message
    callWitAI(messageText, senderID);
        //console.log('intent : ' + intent);



}

function callWitAI(query, senderID){
  query = encodeURIComponent(query);
    request({
        uri: 'https://api.wit.ai/message?v=20161003&q='+query,
        qs:  {access_token: 'IFCCAT4A44BJIK7YZURRKW5RDJQIF4GP'},
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
            //console.error("Unable to send message %m", error);

        }
    });
}

function handleIntent(senderID, witai_data){
    try{
        intent = witai_data["entities"]["intent"][0]["value"];
    }
    catch(ex){
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
                    console.log("weather : "+curr_weather);
                    sendTextMessage(senderID, curr_weather);
                });
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

                    //current weather forecastx
                    var flag_rain_start,flag_rain_stop = 0;
                    summary = body["currently"]["summary"];
                    time1 = body["currently"]["time"];
                    curr_prec = body["currently"]["precipIntensity"];
                    humidity = ((body["currently"]["humidity"])*100).toFixed(2)+" % humid";
                    temperature_f = body["currently"]["temperature"];
                    temperature_c = ((((temperature_f-32)*5)/9).toFixed(2))+" \u00B0C";
                    console.log(summary+' '+temperature_f);
                    curr_weather_data =(summary+", "+temperature_c+", "+humidity).toString();

                    var min_weather_data = '';
                    //if weather forecast per minute is provided by api
                    if(body["minutely"]){
                    //minute weather forecast
                    icon = body["minutely"]["icon"];
                    data = body["minutely"]["data"];
                    var time2,time_diff_stop,time_diff_start = 0;
                    if(icon=='rain' || icon=='partly-cloudy-day' || icon=='partly-cloudy-night'){
                        for(var i=0;i<data.length;i++){
                            time2 = data[i]["time"];
                            if(time2 > time1){
                                //rain will stop at :
                                if(curr_prec > 0 && data[i]["precipIntensity"]==0)
                                {
                                    flag_rain_stop = 1;
                                    time_diff_stop = ((time2-time1)/60).toFixed(0);
                                    break;
                                }
                                //rain will start at :
                                if(curr_prec == 0 && data[i]["precipIntensity"]>0 && data[i]["precipProbability"]>0.1)
                                {
                                    flag_rain_start = 1;
                                    time_diff_start = ((time2-time1)/60).toFixed(0);
                                    break;
                                }
                            }
                        }
                        if(time_diff_start>0){
                            min_weather_data = " ***** "+icon+" will start in "+time_diff_start+" min";
                        }
                        if(time_diff_stop>0){
                            min_weather_data = " ***** "+icon+" will stop in "+time_diff_stop+" min";
                        }
                    }
                }

                var hr_weather_data = '';
                //if weather forecast per hr is provided by api
                if(body["hourly"]){
                //hr weather forecast
                icon = body["hourly"]["icon"];
                data = body["hourly"]["data"];
                summary_hr = " :-) "+body["hourly"]["summary"];
                var time2,time_diff_stop_hr,time_diff_start_hr = 0;
                if(icon=='snow' || icon=='rain'){
                    for(var i=0;i<data.length;i++){
                        time2 = data[i]["time"];
                        if(time2 > time1){
                            //rain will stop at :
                            if(curr_prec > 0 && data[i]["precipIntensity"]==0 && flag_rain_stop == 0)
                            {
                                time_diff_stop_hr = ((time2-time1)/3600).toFixed(0);
                                break;
                            }
                            //rain will start at :
                            if(curr_prec == 0 && data[i]["precipIntensity"]>0 && data[i]["precipProbability"]>0.1 && flag_rain_start == 0)
                            {
                                time_diff_start_hr = ((time2-time1)/3600).toFixed(0);
                                break;
                            }
                        }
                    }
                    if(time_diff_start_hr>0){
                        hr_weather_data = " ***** "+icon+" will start in "+time_diff_start_hr+" hr";
                    }
                    if(time_diff_stop_hr>0){
                        hr_weather_data = " ***** "+icon+" will stop in "+time_diff_stop_hr+" hr";
                    }
                }
            }



                    weather_data = curr_weather_data+summary_hr+min_weather_data+hr_weather_data;
                    callback(null, weather_data);
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
