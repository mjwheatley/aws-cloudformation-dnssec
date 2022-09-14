const fs = require(`fs`);
const { readdirSync } = fs;
const childprocess = require(`child_process`);

const { LOCAL_CLI, REGION } = process.env;
const AWS = require(`aws-sdk`);
const credentials = !!Number(LOCAL_CLI) ?
   new AWS.SharedIniFileCredentials() : new AWS.EnvironmentCredentials(`AWS`);
AWS.config.credentials = credentials;
AWS.config.update({ region: REGION || `us-east-1` });

const getAWSWithCredentials = () => {
   return AWS;
};

const exec = (command) => {
   return new Promise((resolve, reject) => {
      const childProcess = childprocess.exec(
         command,
         { maxBuffer: 1024 * 10000 },
         (error, result) => {
            if (error) {
               reject(error);
            } else {
               resolve(result);
            }
         });
      childProcess.stdout.pipe(process.stdout);
      childProcess.stderr.pipe(process.stderr);
   });
};

const getDirectories = (source) => {
   return readdirSync(source, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);
};

/**
 * @param {String} stringTemplate
 * @param {Object} keyPairs
 * @return {String}
 * **/
const interpolateString = (stringTemplate, keyPairs) => {
   return stringTemplate.replace(
      new RegExp(`\\$\{([^\{(.*?)\}]+)\}`, `g`),
      (_unused, key) => {
         return keyPairs[key];
      });
};

module.exports = {
   exec,
   getDirectories,
   getAWSWithCredentials,
   interpolateString
};
