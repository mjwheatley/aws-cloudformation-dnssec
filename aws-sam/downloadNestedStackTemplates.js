/* eslint-disable no-console */
const fs = require(`fs`);
const { writeFileSync } = fs;
const { join } = require(`path`);
const { getAWSWithCredentials } = require(`../devops/scripts/lib/utils`);
const AWS = getAWSWithCredentials();
const awsCloudformation = new AWS.CloudFormation({
   apiVersion: `2010-05-15`
});

const run = async () => {
   try {
      console.log(`Downloading nested stack templates`);
      const stackName = `${process.env.applicationPrefix}-sam-stack`;
      console.log(`Get stack resources`, stackName);
      const stackResourcesResponse = await awsCloudformation.describeStackResources({
         StackName: stackName
      }).promise();
      const stackResources = stackResourcesResponse.StackResources;
      const nestedStacks = stackResources.filter((resource) => {
         return resource.LogicalResourceId === `vpc` || resource.LogicalResourceId.includes(`stack`);
      });
      const stackNameMap = {};
      nestedStacks.forEach((nestedStack) => {
         stackNameMap[nestedStack.LogicalResourceId] = nestedStack.PhysicalResourceId.split(`/`)[1];
      });
      console.log(`Nested Stack Map`, stackNameMap);
      const stackResourceIds = Object.keys(stackNameMap);
      for (let i = 0; i < stackResourceIds.length; i++) {
         const resourceId = stackResourceIds[i];
         const stackName = stackNameMap[resourceId];
         console.log(`getTemplate()`, { stackName });
         const templateResponse = await awsCloudformation.getTemplate({
            StackName: stackName,
            TemplateStage: `Original`
         }).promise();
         const stackDir = join(__dirname, `../.aws-sam/${resourceId}`);
         await fs.promises.mkdir(stackDir, { recursive: true }).catch((error) => {
            console.error(`Error making deployment directory`, error);
            throw error;
         });
         writeFileSync(`${stackDir}/packaged-template.yaml`, templateResponse.TemplateBody);

         await new Promise((resolve) => setTimeout(resolve, 500));
      }
   } catch (error) {
      console.error(`Cloudformation Error`, error);
      throw new Error(`Cloudformation Error`);
   }
   return `Successfully downloaded nested stack templates.`;
};

run().then((result) => {
   console.log(`downloadNestedStackTemplates.js result`, result);
}).catch((error) => {
   throw error;
});
