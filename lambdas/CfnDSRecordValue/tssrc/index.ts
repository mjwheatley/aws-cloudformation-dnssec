import AWS from 'aws-sdk';
import response, { FAILED, ResponseStatus, SUCCESS } from 'cfn-response';
import { CloudFormationCustomResourceHandler, CloudFormationCustomResourceEvent, Context } from 'aws-lambda';
import { GetDNSSECResponse } from 'aws-sdk/clients/route53';

const {
  HOSTED_ZONE_ID: HostedZoneId = ``
} = process.env;
const route53 = new AWS.Route53();

export const handler: CloudFormationCustomResourceHandler = (
  event: CloudFormationCustomResourceEvent,
  context: Context
) => {
  console.log('REQUEST RECEIVED:\n' + JSON.stringify(event));
  const { RequestType: requestType } = event;
  let responseStatus: ResponseStatus = FAILED;
  let responseData: any = {};
  // For Delete requests, immediately send a SUCCESS response.
  if (requestType === `Delete`) {
    responseStatus = SUCCESS;
    response.send(event, context, responseStatus, responseData);
  } else if ([`Create`, `Update`].includes(requestType)) {
    const params = {
      HostedZoneId
    };
    route53.getDNSSEC(params).promise().then(({ KeySigningKeys: ksks }: GetDNSSECResponse) => {
      const { DSRecord: dsRecord } = ksks[0];
      responseData.DSRecordValue = dsRecord;
      responseStatus = SUCCESS;
      response.send(event, context, responseStatus, responseData);
    }).catch((error: any) => {
      console.error(`route53.getDNSSEC() Error`, error);
      responseData = { Error: error.message };
      response.send(event, context, responseStatus, responseData);
    });
  } else {
    console.log(`Unexpected RequestType!`);
    response.send(event, context, responseStatus, responseData);
  }
};
