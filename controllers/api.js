var request     = require('request');
var properties = require('../config/properties.js');
var helper = require('../services/WeatherService.js');

//GET request : webhook call
exports.validateWebhook = function(req, res) {
    if (req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === properties.verify_token) {
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
    var precipitate_type = '';
    var weather_variable = '';
    var weather_yesno = '';
    var begin_end = '';

    try{
        intent = witai_data["entities"]["intent"][0]["value"];
    } catch(ex) {
        try{
            //If only location is provided
            location = witai_data["entities"]["location"][0]["value"];
            intent = 'weather';
        } catch(ex){
            intent = 'intent_not_found';
        }
    }

    switch(intent){
        case "greeting":
            sendTextMessage(senderID, "Hello, I am Gafh, a weather bot. :-)");
            break;

        case "weather":
            //Location provided
            try{
                location = (witai_data["entities"]["location"][0]["value"]).trim();
            }
            catch(error) {
                sendTextMessage(senderID, "Please provide the location");
                break;
            }
            //Weather type provided
            try{
                precipitate_type = (witai_data["entities"]["precipitate_type"][0]["value"]).trim();
            }
            catch(error){
                console.log("Precipitate type not provided");
            }
            //Weather variable provided
            try{
                weather_variable = (witai_data["entities"]["weather_variable"][0]["value"]).trim();
            }
            catch(error){
                console.log("Weather variable not provided");
            }
            //Yes/No queries
            try{
                weather_yesno = (witai_data["entities"]["weather_yesno"][0]["value"]).trim();
            }
            catch(error){
                console.log("Not a yes_no query");
            }
            //Begin/ENd queries
            try{
                begin_end = (witai_data["entities"]["begin_end"][0]["value"]).trim();
            }
            catch(error){
                console.log("Not a begin end query");
            }

            getGeolocation(location, function(error, lat_lng){
                if (!error) {
                    getWeatherData(lat_lng, function(error, summary){
                        summary = JSON.parse(summary);
                        getWeatherForecast(senderID, summary, precipitate_type, weather_variable, weather_yesno, begin_end);
                    });
                }
                else {
                    console.error("Could not retrieve geolocation");
                    sendTextMessage(senderID, "Sorry, I could not find your location :-(");
                }
            });
            break;

        default :
            sendTextMessage(senderID, "Sorry, I am not trained to answer that yet :-(");
    }
}

//Retrieve geolocation from google api
function getGeolocation(location, callback){
    var API_KEY = properties.google_api_token;
    var BASE_URL = properties.geolocation_endpoint;
    var url = BASE_URL + location + "&key=" + API_KEY;

    request(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            try{
                res = JSON.parse(response.body);
                lat = res["results"][0]["geometry"]["location"]["lat"];
                lng = res["results"][0]["geometry"]["location"]["lng"];
                lat_lng = (lat+","+lng).toString();
                callback(null,lat_lng);
            } catch(error) {
                callback(error);
            }
        }
        else {
            console.error("Unable to retrieve geolocation", error);
            callback(error);
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
            callback(null,body);
        } else {
            console.error("Unable to retrieve weather information", error);
            callback(error);
        }
    });
}

function getWeatherForecast(senderID, body, precipitate_type, weather_variable, weather_yesno, begin_end){
    var weather_print_data = '';
    var curr_weather_data = '';
    var prec_yesno = '';

    wind_speed = body["currently"]["windSpeed"];
    humidity = ((body["currently"]["humidity"])*100).toFixed(2)+" %";
    temperature_f = body["currently"]["temperature"];
    feels_like_f = body["currently"]["apparentTemperature"];
    temperature_c = helper.convertTemp(temperature_f);
    feels_like_c = helper.convertTemp(feels_like_f);
    summary_hr = ". "+body["hourly"]["summary"];

    //Weather variable
    if(weather_variable){
        switch(weather_variable){
            case "wind speed":
                weather_print_data = 'Wind speed: ' + wind_speed+' kph';
                if(weather_yesno){
                    if(wind_speed >2){
                        weather_print_data="Yes, " + weather_print_data;
                    } else {
                        weather_print_data="No, " + weather_print_data;
                    }
                }
                break;
            case "temperature":
                weather_print_data = 'Actual: ' + temperature_c + '\nFeels like: ' + feels_like_c ;
                break;
            case "humidity":
                weather_print_data = 'Humidity: ' + humidity;
                break;
        }
    }
    else if(precipitate_type){
        channel = 'prec_type';
        weather_print_data = helper.prec_forecast(body, precipitate_type, begin_end, weather_yesno, channel);
    }
    else{
        //Current weather forecast
        channel = 'weather_summary';
        prec_status = helper.prec_forecast(body, channel);
        summary = body["currently"]["summary"];
        curr_weather_data =(summary+", "+temperature_c+", "+humidity+", "+wind_speed).toString();
        weather_print_data = curr_weather_data + summary_hr + prec_status;
    }
    sendTextMessage(senderID, weather_print_data);
}

function sendTextMessage(recipientId, messageText) {
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
