var apiController = require('../controller/api');

var express = require('express');
var router = express.Router();

router.get('/',apiController.validateWebhook);
router.post('/',apiController.handleMessage);

module.exports = router;
