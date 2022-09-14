const { getAWSWithCredentials } = require(`./utils`);
const AWS = getAWSWithCredentials();
const {
   REGION,
   applicationPrefix
} = process.env;
const awsCloudformation = new AWS.CloudFormation({
   apiVersion: `2010-05-15`,
   region: REGION
});

/**
 * Gets the root stack using the applicationPrefix, REGION, and ENV
 * then parses out the name of the nested framework stack
 * and returns an array of resource objects
 * @return {Array<{Object}>} frameworkResources
 * **/
const getFrameworkStackResources = async () => {
   const stackName = `${applicationPrefix}-sam-stack`;
   let stackResourcesResponse = await awsCloudformation.describeStackResources({
      StackName: stackName
   }).promise();
   const stackResources = stackResourcesResponse.StackResources;
   const nestedFrameworkStackResource = stackResources.find((resource) => {
      return resource.LogicalResourceId === `framework`;
   });
   const nestedFrameworkStackName = nestedFrameworkStackResource.PhysicalResourceId.split(`/`)[1];
   stackResourcesResponse = await awsCloudformation.describeStackResources({
      StackName: nestedFrameworkStackName
   }).promise();
   return stackResourcesResponse.StackResources;
};

/**
 * Get the API Gateway ID from the framework stack resources
 * @param {Array<Object>} stackResources
 * @return {String} apigwId
 * **/
const getApiGwIdFromFrameworkResources = (stackResources) => {
   return stackResources.find((resource) => {
      return resource.LogicalResourceId === `apigw`;
   }).PhysicalResourceId;
};

/**
 * Get Cognito User Pool Client ID from the framework stack resources
 * @param {Array<Object>} stackResources
 * @return {String} cognitoUserPoolClientId
 * **/
const getCognitoUserPoolClientIdFromFrameworkResources = (stackResources) => {
   return stackResources.find((resource) => {
      return resource.LogicalResourceId === `cognitoUserPoolClient`;
   }).PhysicalResourceId;
};

/**
 * Get Cognito User Pool ID from the framework stack resources
 * @param {Array<Object>} stackResources
 * @return {String} cognitoUserPoolId
 * **/
const getCognitoUserPoolIdFromFrameworkResources = (stackResources) => {
   return stackResources.find((resource) => {
      return resource.LogicalResourceId === `cognitoUserPool`;
   }).PhysicalResourceId;
};

module.exports = {
   awsCloudformation,
   getFrameworkStackResources,
   getApiGwIdFromFrameworkResources,
   getCognitoUserPoolClientIdFromFrameworkResources,
   getCognitoUserPoolIdFromFrameworkResources
};
