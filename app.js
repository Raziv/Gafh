var express     = require('express');
var bodyParser  = require('body-parser');
var webhooks    = require('./routes/webhooks');

var app = express();

app.use(bodyParser.json());
app.use('/webhook', webhooks);

app.listen(process.env.PORT_TOKEN);
