/* eslint-disable no-console */
const fs = require(`fs`);
const {
        writeFileSync,
        existsSync
      } = fs;
const { join } = require(`path`);
const {
        exec,
        getDirectories
      } = require(`./devops/scripts/lib/utils`);
const {
        LAMBDAS,
        installAndBundle
      } = process.env;
let lambdas = [];
if (!LAMBDAS || LAMBDAS.toUpperCase() === `ALL`) {
  const lambdasDir = join(__dirname, `./lambdas`);
  lambdas = getDirectories(lambdasDir);
} else {
  lambdas = LAMBDAS.split(`,`);
}

const start = async () => {
  const buildDir = `./build`;
  const buildPath = join(__dirname, buildDir);
  try {
    await exec(`rm -rf ${buildDir}`);
    await fs.promises.mkdir(buildDir, { recursive: true });
  } catch (error) {
    throw error;
  }

  console.log(`Packaging lambdas`);
  for (let i = 0; i < lambdas.length; i++) {
    const lambdaName = lambdas[i];
    console.log(`Packaging ${lambdaName}`);
    let commands = [
      `cd lambdas/${lambdaName}`,
      `npm i`,
      `cd ../..`,
      `rsync -rv --exclude=node_modules lambdas/${lambdaName}/src/* ${buildPath}/${lambdaName}`,
      `cd ${buildDir}/${lambdaName}`
    ];
    try {
      await exec(commands.join(` && `));
    } catch (error) {
      throw error;
    }
    const prepackedPath = join(__dirname, `${buildDir}/${lambdaName}/${lambdaName}.tgz`);
    if (existsSync(prepackedPath)) {
      console.log(`Lambda is pre-packaged`);
    } else {
      const packageJsonPath = join(__dirname, `${buildDir}/${lambdaName}/package.json`);
      const packageJson = require(packageJsonPath);
      const {
              dependencies = {},
              devDependencies = {}
            } = packageJson;
      if (Object.keys(dependencies).length) {
        commands = [
          `cd ${buildDir}/${lambdaName}`,
          `npm install --production`,
          `mkdir nodejs`,
          `cp -r node_modules nodejs`,
          `zip -r node_modules.zip nodejs`,
          `rm -rf nodejs`
        ];
        try {
          await exec(commands.join(` && `));
        } catch (error) {
          throw error;
        }
        Object.assign(devDependencies, dependencies);
        delete packageJson.dependencies;
        writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      }

      console.log(`npm pack ${lambdaName}`);
      commands = [
        `cd ${buildDir}/${lambdaName}`,
        `npm pack`,
        `mv *.tgz ./${lambdaName}.tgz`
      ];
      try {
        await exec(commands.join(` && `));
      } catch (error) {
        throw error;
      }
    }

    if (!!Number(installAndBundle)) {
      console.log(`Installing production dependencies and bundling ${lambdaName} lambda for deployment.`);
      commands = [
        `cd ${buildDir}`,
        `tar -zxvf ${lambdaName}.tgz`,
        `rm -rf ${lambdaName}`,
        `mv package ${lambdaName}`,
        `cd ${lambdaName}`,
        `npm i --production`,
        `zip -r ../${lambdaName}.zip .`,
        `cd ..`,
        `rm -rf ${lambdaName}`
      ];
      try {
        await exec(commands.join(` && `));
      } catch (error) {
        throw error;
      }
    }
  }
  return `Finished packaging and bundling lambdas`;
};

start().then((result) => {
  console.log(result);
}).catch((error) => {
  console.error(`Caught Error`, error);
});
