"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const cfn_response_1 = __importStar(require("cfn-response"));
const { HOSTED_ZONE_ID: HostedZoneId = `` } = process.env;
const route53 = new aws_sdk_1.default.Route53();
const handler = (event, context) => {
    console.log('REQUEST RECEIVED:\n' + JSON.stringify(event));
    const { RequestType: requestType } = event;
    let responseStatus = cfn_response_1.FAILED;
    let responseData = {};
    // For Delete requests, immediately send a SUCCESS response.
    if (requestType === `Delete`) {
        responseStatus = cfn_response_1.SUCCESS;
        cfn_response_1.default.send(event, context, responseStatus, responseData);
    }
    else if ([`Create`, `Update`].includes(requestType)) {
        const params = {
            HostedZoneId
        };
        route53.getDNSSEC(params).promise().then(({ KeySigningKeys: ksks }) => {
            const { DSRecord: dsRecord } = ksks[0];
            responseData.DSRecordValue = dsRecord;
            responseStatus = cfn_response_1.SUCCESS;
            cfn_response_1.default.send(event, context, responseStatus, responseData);
        }).catch((error) => {
            console.error(`route53.getDNSSEC() Error`, error);
            responseData = { Error: error.message };
            cfn_response_1.default.send(event, context, responseStatus, responseData);
        });
    }
    else {
        console.log(`Unexpected RequestType!`);
        cfn_response_1.default.send(event, context, responseStatus, responseData);
    }
};
exports.handler = handler;
//# sourceMappingURL=index.js.map