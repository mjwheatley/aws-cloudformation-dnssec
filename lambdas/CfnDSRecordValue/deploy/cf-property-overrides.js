const { existsSync } = require(`fs`);
const cfPropertyOverrides = require(`./cf-property-overrides.json`);
const envPropertyOverridesPath = `./cf-property-overrides.${process.env.ENV}.json`;
if (existsSync(envPropertyOverridesPath)) {
   const envPropertyOverrides = require(envPropertyOverridesPath);
   Object.assign(cfPropertyOverrides, envPropertyOverrides);
}
module.exports = cfPropertyOverrides;
