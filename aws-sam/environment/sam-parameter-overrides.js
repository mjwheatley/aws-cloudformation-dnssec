const { writeFileSync } = require(`fs`);

const paramOverrideKeys = [
  `applicationPrefix`,
  `ENV`,
  `nodejsRuntime`,
  `domainName`,
  `hostedZoneId`,
  `logGroupRetentionInDays`,
  `alertEmail`,
  `alertEmailFallback`
];
const paramOverrides = {};
paramOverrideKeys.forEach((key) => {
  if (process.env[key]) {
    paramOverrides[key] = process.env[key];
  }
});

writeFileSync(
  `aws-sam/environment/sam-parameter-overrides.json`,
  JSON.stringify(paramOverrides, null, 2)
);
