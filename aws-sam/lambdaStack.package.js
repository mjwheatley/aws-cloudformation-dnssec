/* eslint-disable no-console */
const { join } = require(`path`);
const { exec, getDirectories } = require(`../devops/scripts/lib/utils`);
const skipLambdas = require(`./skipLambdas`);
const {
   LAMBDAS,
   applicationPrefix,
   ENV = `nonprod`,
   REGION = `us-east-1`
} = process.env;
let lambdas = [];
if (!LAMBDAS || LAMBDAS.toUpperCase() === `ALL`) {
   const lambdasDir = join(__dirname, `../lambdas`);
   lambdas = getDirectories(lambdasDir);
} else {
   lambdas = LAMBDAS.split(`,`);
}
require(`events`).EventEmitter.defaultMaxListeners = 100;

const start = async () => {
   const promises = [];
   for (let i = 0; i < lambdas.length; i++) {
      const lambdaName = lambdas[i];
      if (skipLambdas.includes(lambdaName)) {
         continue;
      }
      let lambdaKeyName = lambdaName;
      lambdaKeyName = lambdaKeyName.charAt(0).toUpperCase() + lambdaKeyName.slice(1) + `Lambda`;
      const nestedStackResourceName = `nestedStack${lambdaKeyName}`;
      const commands = [
         `sam package`,
         `--template-file .aws-sam/${nestedStackResourceName}/template.yaml`,
         `--output-template-file .aws-sam/${nestedStackResourceName}/packaged-template.yaml`,
         `--s3-bucket ${applicationPrefix}-sam-stack-${ENV}-${REGION}`,
         `--region ${REGION}`
      ];
      const command = commands.join(` `);
      console.log(command);
      const promise = exec(
         command
      ).then((result) => {
         console.log(`Successfully deployed nested stack ${nestedStackResourceName}`, result);
         return {
            nestedStackResourceName,
            success: true
         };
      }).catch((error) => {
         console.error(`Error deploying nested stack ${nestedStackResourceName}`, error);
         return {
            nestedStackResourceName,
            success: false
         };
      });
      promises.push(promise);
   }
   return Promise.all(promises).then((results) => {
      const response = {
         message: `Finished packing and deploying nested lambda stacks`,
         succeeded: [],
         failed: []
      };
      results.forEach((result) => {
         const { nestedStackResourceName, success } = result;
         const group = success ? response.succeeded : response.failed;
         group.push(nestedStackResourceName);
      });
      return response;
   });
};

start().then((result) => {
   console.log(`lambdaStack.package.js`, result);
}).catch((error) => {
   throw error;
});
