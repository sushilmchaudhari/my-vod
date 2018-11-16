
'use strict';
const response = require('cfn-response');
const s3Config = require('./lib/s3.js');
const cfConfig = require('./lib/cloudfront.js');
const etsConfig = require('./lib/ets.js');
const mcConfig = require('./lib/media-convert.js');
const MetricsHelper = require('./lib/metrics-helper.js');
const uuid = require('uuid');
const moment = require('moment');
const metricsHelper = new MetricsHelper();

exports.handler = function(event, context) {
  console.log('Received event:', JSON.stringify(event, null, 2));

  if (event.RequestType === 'Create') {

    switch (event.ResourceProperties.Resource) {

      case 'S3Notification':
        //Conigures the s3 source bucket notification configuration to trigger the ingest-execute Lambda function
        s3Config.s3Notification(event)
          .then(() => {
            response.send(event, context, response.SUCCESS);
          })
          .catch(err => {
            console.log(err, err.stack);
            response.send(event, context, response.FAILED);
          });
        break;

      case 'ImageOverlay':
        //uploads an example watermark file to the s3 source bucket
        s3Config.putObject(event)
          .then(() => {
            response.send(event, context, response.SUCCESS);
          })
          .catch(err => {
            console.log(err, err.stack);
            response.send(event, context, response.FAILED);
          });
        break;

      case 'CloudFrontIdentity':
        // creates a CloudFrontIdentity for the ABR destination bucket
        cfConfig.createIdentity(event)
          .then(responseData => {
            response.send(event, context, response.SUCCESS, responseData);
          })
          .catch(err => {
            console.log(err, err.stack);
            response.send(event, context, response.FAILED);
          });
        break;

      //Elastic Transcoder
      case 'Pipeline':
        // Creates the MP4 and ABR Elastic Transcoder Pipelines
        etsConfig.createPipeline(event)
          .then(responseData => {
            response.send(event, context, response.SUCCESS, responseData, responseData.PipelineId);
          })
          .catch(err => {
            console.log(err, err.stack);
            response.send(event, context, response.FAILED);
          });
        break;

      case 'EtsPresets':
        // Creates the MP4 and ABR Elastic Transcoder custom presets for MP4, HLS and DASH
        etsConfig.createPreset()
          .then(responseData => {
            response.send(event, context, response.SUCCESS,responseData);
          })
          .catch(err => {
            console.log(err, err.stack);
            response.send(event, context, response.FAILED);
          });
        break;
      //MediaConvert
      case 'MediaConvertPresets':
        // Creates custom presets
        mcConfig.createPreset(event)
          .then(() => {
            response.send(event, context, response.SUCCESS);
          })
          .catch(err => {
            console.log(err, err.stack);
            response.send(event, context, response.FAILED);
          });
        break;

      case 'EndPoint':
        // Get MediaConvert REgional / Account EndPoint
        mcConfig.endpointUrl(event)
          .then(responseData => {
            response.send(event, context, response.SUCCESS, responseData, responseData.EndpointUrl);
          })
          .catch(err => {
            console.log(err, err.stack);
            response.send(event, context, response.FAILED);
          });
        break;

      case ('SendMetric'):
        //Sends annonomous useage data to AWS
        let metric = {
            Solution: event.ResourceProperties.SolutionId,
            UUID: event.ResourceProperties.UUID,
            TimeStamp: moment().utc().format('YYYY-MM-DD HH:mm:ss.S'),
            Data: {
                Version: event.ResourceProperties.Version,
                Launched: moment().utc().format(),
                Transcoder: event.ResourceProperties.Transcoder,
                Parameters: event.ResourceProperties.Parameters
            }
        };
        metricsHelper.sendAnonymousMetric(metric, function(err, data) {
          if (err) {
            console.log(err, err.stack);
          } else {
            console.log('data sent: ', metric);
            response.send(event, context, response.SUCCESS);
            return;
          }
        });
        break;

      case ('UUID'):
        //Creates a UUID for the MetricsHelper function
        let responseData = {
          UUID: uuid.v4()
        };
        response.send(event, context, response.SUCCESS, responseData);
        break;

      default:
        console.log('no case match, sending success response');
        response.send(event, context, response.SUCCESS);
        // defualt response if Resource or RequestType (delete update) not defined.
    }

  }

  if (event.RequestType === 'Delete') {

    switch (event.ResourceProperties.Resource) {

      case 'Pipeline':
        etsConfig.deletePipeline(event)
          .then(() => {
            response.send(event, context, response.SUCCESS);
          })
          .catch(err => {
            console.log(err, err.stack);
            response.send(event, context, response.FAILED);
          });
        break;

      case 'EtsPresets':
        etsConfig.deletePreset()
          .then(res => {
            console.log(res);
            response.send(event, context, response.SUCCESS);
          })
          .catch(function(err) {
            console.log(err, err.stack);
            response.send(event, context, response.FAILED);
          });
        break;

      case ('SendMetric'):
        let metric = {
            Solution: event.ResourceProperties.solutionId,
            UUID: event.ResourceProperties.UUID,
            TimeStamp: moment().utc().format('YYYY-MM-DD HH:mm:ss.S'),
            Data: {
                Version: event.ResourceProperties.version,
                Deleted: moment().utc().format()
            }
        };
        metricsHelper.sendAnonymousMetric(metric, function(err, data) {
          if (err) {
            console.log(err, err.stack);
          } else {
            console.log('data sent');
            response.send(event, context, response.SUCCESS);
            return;
          }
        });
        break;

      default:
        console.log('no case match, sending success response');
        response.send(event, context, response.SUCCESS);
        // defualt response if Resource or RequestType (delete update) not defined.
    }
  }
};
