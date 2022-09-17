/* eslint-disable no-console */
const { join } = require(`path`);
const { exec, getDirectories } = require(`../devops/scripts/lib/utils`);
const skipLambdas = require(`./skipLambdas`);
const { LAMBDAS, applicationPrefix } = process.env;
let lambdas = [];
if (!LAMBDAS || LAMBDAS.toUpperCase() === `ALL`) {
   const lambdasDir = join(__dirname, `../lambdas`);
   lambdas = getDirectories(lambdasDir);
} else {
   lambdas = LAMBDAS.split(`,`);
}
require(`events`).EventEmitter.defaultMaxListeners = 100;

const start = async () => {
   console.log(`Building lambdas`, lambdas);
   try {
      await exec(`npm run lambda:build`);
   } catch (error) {
      throw error;
   }

   const promises = [];
   for (let i = 0; i < lambdas.length; i++) {
      const lambdaName = lambdas[i];
      if (skipLambdas.includes(lambdaName)) {
         continue;
      }
      let lambdaKeyName = lambdaName;
      lambdaKeyName = lambdaKeyName.charAt(0).toUpperCase() + lambdaKeyName.slice(1) + `Lambda`;
      const nestedStackResourceName = `nestedStack${lambdaKeyName}`;
      console.log(`Building lambda stack`, nestedStackResourceName);
      const commands = [
         `sam build`,
         `-b .aws-sam/${nestedStackResourceName}`,
         `-t aws-sam/deploy/${nestedStackResourceName}.deploy.json`,
         `--parameter-overrides applicationPrefix=${applicationPrefix}`
      ];
      const command = commands.join(` `);
      console.log(command);
      const promise = exec(
         command
      ).then((result) => {
         console.log(`Successfully built nested stack ${nestedStackResourceName}`, result);
         return {
            nestedStackResourceName,
            success: true
         };
      }).catch((error) => {
         console.error(`Error building nested stack ${nestedStackResourceName}`, error);
         return {
            nestedStackResourceName,
            success: false
         };
      });
      promises.push(promise);
   }
   return Promise.all(promises).then((results) => {
      const response = {
         message: `Finished building nested lambda stacks`,
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
   console.log(`lambdaStack.build.js result`, result);
}).catch((error) => {
   throw error;
});
