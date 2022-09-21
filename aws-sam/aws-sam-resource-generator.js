/* eslint-disable no-console */
const fs = require(`fs`);
const {
        readdirSync,
        writeFileSync,
        existsSync
      } = fs;
const { join } = require(`path`);
const template = require(`./aws-sam-resource-templates.json`);
const deployJson = require(`./stacks/stack-root.json`);
const skipLambdas = require(`./skipLambdas`);
const { ENV } = process.env;

const getDirectories = (source) => {
  return readdirSync(source, { withFileTypes: true })
  .filter((dirent) => dirent.isDirectory())
  .map((dirent) => dirent.name);
};

const generateResourcesForLambdas = async () => {
  const deployDir = join(__dirname, `./deploy`);
  await fs.promises.mkdir(deployDir, { recursive: true }).catch((error) => {
    console.error(`Error making deployment directory`, error);
    throw error;
  });

  const lambdasDir = join(__dirname, `../lambdas`);
  const lambdas = getDirectories(lambdasDir);

  for (let i = 0; i < lambdas.length; i++) {
    const lambdaStack = JSON.parse(JSON.stringify(template.lambdaStack));

    const lambdaName = lambdas[i];

    if (skipLambdas.includes(lambdaName)) {
      continue;
    }

    let lambdaKeyName = lambdaName;
    lambdaKeyName = lambdaKeyName.charAt(0).toUpperCase() + lambdaKeyName.slice(1) + `Lambda`;

    /**
     * Lambda
     * **/
    const propertyOverridesPath = join(__dirname,
      `../lambdas/${lambdaName}/deploy/cf-property-overrides.js`);
    let propertyOverrides = {};
    if (existsSync(propertyOverridesPath)) {
      console.log(`Adding property overrides for ${lambdaName}`, propertyOverridesPath);
      propertyOverrides = require(propertyOverridesPath);
    }
    Object.assign(lambdaStack.Parameters, propertyOverrides.StackParameters);

    const lambdaResource = JSON.parse(JSON.stringify(template.lambda));
    // const lambdaResourceName = `lambda${lambdaKeyName}`;
    const functionNamePrefix = lambdaResource.Properties.FunctionName[`Fn::Sub`];
    const functionName = `${functionNamePrefix}-${ENV}-${lambdaName}`;
    lambdaResource.Properties.FunctionName[`Fn::Sub`] = functionName;
    lambdaResource.Properties.CodeUri = lambdaResource.Properties.CodeUri
                                                      .replace(/lambdaName/g, lambdaName);
    Object.assign(lambdaResource.Properties, propertyOverrides.Function);
    lambdaStack.Resources[`LambdaFunction`] = lambdaResource;
    if (propertyOverrides.StackOutputs) {
      Object.assign(lambdaStack.Outputs, propertyOverrides.StackOutputs);
    }

    /**
     * Lambda Execution Role
     * **/
    const roleResource = JSON.parse(JSON.stringify(template.lambdaExecutionRole));
    let roleName = roleResource.Properties.RoleName[`Fn::Sub`];
    roleResource.Properties.RoleName[`Fn::Sub`] = roleName + functionName;
    lambdaStack.Resources.LambdaExecutionRole = roleResource;

    /**
     * Lambda Execution Policy
     * **/
    const policyResource = JSON.parse(JSON.stringify(template.lambdaExecutionPolicy));
    lambdaStack.Resources.LambdaExecutionPolicy = policyResource;

    /**
     * Lambda Layer
     * **/
    const packageJsonPath = `${lambdasDir}/${lambdaName}/package.json`;
    const packageJson = require(packageJsonPath);
    if (packageJson.dependencies && Object.keys(packageJson.dependencies).length) {
      const layerResource = JSON.parse(JSON.stringify(template.layerLambdaNodeModules));
      const layerResourceName = `layer${lambdaKeyName}NodeModules`;
      layerResource.Properties.Content = layerResource.Properties.Content.replace(`lambdaName`, lambdaName);
      layerResource.Properties.Description[`Fn::Sub`] = layerResource.Properties.Description[`Fn::Sub`]
      .replace(`\${functionName}`, functionName);
      layerResource.Properties.LayerName[`Fn::Sub`] = layerResource.Properties.LayerName[`Fn::Sub`]
      .replace(`\${functionName}`, functionName);
      Object.assign(layerResource.Properties, propertyOverrides.Layer);
      lambdaStack.Resources[layerResourceName] = layerResource;
      lambdaStack.Globals.Function.Layers = [
        {
          "Ref": layerResourceName
        }
      ];
    } else {
      delete lambdaStack.Globals.Function.Layers;
    }

    /**
     * LogGroup
     * **/
    const logGroupResource = JSON.parse(JSON.stringify(template.logGroupLambda));
    const logGroupResourceName = `logGroup${lambdaKeyName}`;
    const logGroupNamePrefix = logGroupResource.Properties.LogGroupName[`Fn::Sub`];
    const logGroupName = logGroupNamePrefix + functionName;
    logGroupResource.Properties.LogGroupName[`Fn::Sub`] = logGroupName;
    Object.assign(logGroupResource.Properties, propertyOverrides.LogGroup);
    lambdaStack.Resources[logGroupResourceName] = logGroupResource;

    /**
     * Resources
     * **/
    if (propertyOverrides.Resources) {
      Object.keys(propertyOverrides.Resources).forEach((resourceKey) => {
        const resource = propertyOverrides.Resources[resourceKey];
        lambdaStack.Resources[resourceKey] = resource;
      });
    }

    /**
     * Nested Lambda Stack
     * **/
    const nestedStackResource = JSON.parse(JSON.stringify(template.nestedStack));
    const nestedStackResourceName = `nestedStack${lambdaKeyName}`;
    const locationPath = nestedStackResource.Properties.Location
                                            .replace(`lambdaName`, nestedStackResourceName);
    nestedStackResource.Properties.Location = locationPath;
    Object.assign(nestedStackResource.Properties.Parameters, propertyOverrides.NestedStackParameters);
    deployJson.Resources[nestedStackResourceName] = nestedStackResource;
    writeFileSync(`aws-sam/deploy/${nestedStackResourceName}.deploy.json`,
      JSON.stringify(lambdaStack, null, 2));
  }

  writeFileSync(`aws-sam/deploy/root.deploy.json`, JSON.stringify(deployJson, null, 2));
};

generateResourcesForLambdas().then(() => {
  console.log(`Successfully generated nested lambda stacks`);
});
