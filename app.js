var express = require('express');
var app = express();
var bodyParser= require('body-parser');
var request = require('request');

app.use(bodyParser.json());

app.get('/webhook', function(req, res) {
 if (req.query['hub.verify_token'] === 'gafhbot_project') {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);
  }
});
