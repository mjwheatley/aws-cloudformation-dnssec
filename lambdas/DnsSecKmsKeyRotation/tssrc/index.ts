/* eslint-disable @typescript-eslint/naming-convention */
import * as AWS from 'aws-sdk';
import {
  CreateAliasRequest,
  CreateKeyRequest,
  CreateKeyResponse,
  GetKeyPolicyRequest,
  GetKeyPolicyResponse,
  KeyMetadata, ScheduleKeyDeletionRequest, ScheduleKeyDeletionResponse, UpdateAliasRequest
} from 'aws-sdk/clients/kms';

const secretsManager = new AWS.SecretsManager();
const kms = new AWS.KMS();

const {
  KMS_KEY_ALIAS: kmsKeyAlias = ``
} = process.env;

export const handler = async (event: any) => {
  console.log(`EVENT: ${JSON.stringify(event)}`);
  const {
    SecretId: arn,
    ClientRequestToken: token,
    Step: step
  } = event;

  const client = secretsManager;

  const metadata = await client.describeSecret({ SecretId: arn }).promise();
  if (!metadata.RotationEnabled) {
    throw new Error(`Secret ${arn} is not enabled for rotation`);
  }

  const { VersionIdsToStages: versions }: any = metadata;
  if (!Object.keys(versions).includes(token)) {
    throw new Error(`Secret Version ${token} has no stage for rotation of secret ${arn}`);
  } else if (versions[token].includes('AWSCURRENT')) {
    return;
  } else if (!versions[token].includes('AWSPENDING')) {
    throw new Error(`Secret version ${token} not set as AWSPENDING for rotation of secret ${arn}.`);
  }

  console.log(`step`, step);
  switch (step) {
    case 'createSecret':
      return await createSecret(client, arn, token);
    case 'setSecret':
      return await setSecret(client, arn, token);
    case 'testSecret':
      return await testSecret(client, arn, token);
    case 'finishSecret':
      return await finishSecret(client, arn, token);
    default:
      throw new Error('Invalid step parameter');
  }
};

const createSecret = async (client: AWS.SecretsManager, arn: string, token: string) => {
  console.log(`Trace`, `createSecret()`);
  const { SecretString: currentKey = `` } = await client.getSecretValue({
    SecretId: arn, VersionStage: 'AWSCURRENT'
  }).promise() || {};
  console.log(`currentKey`, currentKey);

  try {
    await client.getSecretValue({
      SecretId: arn, VersionStage: 'AWSPENDING', VersionId: token
    }).promise();
  } catch (e: any) {
    if (e.code === 'ResourceNotFoundException') {
      console.log(`ResourceNotFoundException`, `No AWSPENDING version, continuing to create new secret`);
      try {
        /**
         * Get policy from current key
         * Create new KMS Key
         * Store new key ID as the pending secret value
         * **/
        const getKeyPolicyParams: GetKeyPolicyRequest = {
          KeyId: currentKey,
          PolicyName: `default`
        };
        const { Policy }: GetKeyPolicyResponse = await kms.getKeyPolicy(getKeyPolicyParams).promise();
        console.log(`Policy`, Policy);
        const aliasSuffix = new Date().toISOString().split(`T`)[0].replace(/-/g, ``);
        const createKeyParams: CreateKeyRequest = {
          Policy,
          KeyUsage: `SIGN_VERIFY`,
          KeySpec: `ECC_NIST_P256`,
          Description: `${kmsKeyAlias}-start-${aliasSuffix}`
        };
        const { KeyMetadata }: CreateKeyResponse = await kms.createKey(createKeyParams).promise();
        const { KeyId: keyId } = KeyMetadata || {} as KeyMetadata;
        console.log(`New KMS Key ID`, keyId);
        await client.putSecretValue({
          SecretId: arn,
          ClientRequestToken: token,
          SecretString: keyId,
          VersionStages: ['AWSPENDING']
        }).promise();
        console.log(`Successfully created new KMS Key!!!`);
      } catch (error) {
        console.error(`KMS Error`, error);
        throw error;
      }
    } else {
      throw e;
    }
  }
};

const setSecret = async (client: AWS.SecretsManager, arn: string, token: string) => {
  console.log(`Trace`, `setSecret()`);
  console.log(`kmsKeyAlias`, kmsKeyAlias);
  /**
   * Create an end date alias for the current key
   * Create a start date alias for the new key
   * Update the active alias to point to the new key
   * **/
  const { SecretString: currentKey = `` } = await client.getSecretValue({
    SecretId: arn, VersionStage: 'AWSCURRENT'
  }).promise() || {};
  console.log(`currentKey`, currentKey);
  /** Create end date alias for the current key **/
  try {
    const aliasSuffix = new Date().toISOString().split(`T`)[0].replace(/-/g, ``);
    const createAliasParams: CreateAliasRequest = {
      TargetKeyId: currentKey,
      AliasName: `${kmsKeyAlias}-end-${aliasSuffix}`
    };
    const createAliasResponse = await kms.createAlias(createAliasParams).promise();
    console.log(`createAlias() response`, createAliasResponse);
  } catch (error) {
    console.error(`Error creating end date alias`, error);
  }

  const { SecretString: pendingKey = `` } = await client.getSecretValue({
    SecretId: arn, VersionStage: 'AWSPENDING', VersionId: token
  }).promise();
  console.log(`pendingKey`, pendingKey);
  /** Create start date alias **/
  try {
    const aliasSuffix = new Date().toISOString().split(`T`)[0].replace(/-/g, ``);
    const createAliasParams: CreateAliasRequest = {
      TargetKeyId: pendingKey,
      AliasName: `${kmsKeyAlias}-start-${aliasSuffix}`
    };
    const createAliasResponse = await kms.createAlias(createAliasParams).promise();
    console.log(`createAlias() response`, createAliasResponse);
  } catch (error) {
    console.error(`Error creating start date alias`, error);
  }

  /** Update active alias **/
  const params: UpdateAliasRequest = {
    TargetKeyId: pendingKey,
    AliasName: kmsKeyAlias
  };
  const response = await kms.updateAlias(params).promise();
  console.log(`updateAlias() response`, response);
};

const testSecret = async (client: AWS.SecretsManager, arn: string, token: string) => {
  console.log(`Trace`, `testSecret()`);
  const { SecretString: pendingKey = `` } = await client.getSecretValue({
    SecretId: arn, VersionStage: 'AWSPENDING', VersionId: token
  }).promise();
  console.log(`pendingKey`, pendingKey);
};

const getVersion = async (client: AWS.SecretsManager, arn: string, versionKey: string) => {
  const { VersionIdsToStages: versions }: any =
    await client.describeSecret({ SecretId: arn }).promise();

  const [version]: any = Object.entries(versions)
    .find(([_, stage]: any) => stage.includes(versionKey)) || {};

  if (!version) {
    throw new Error(`Could not find ${versionKey} version`);
  }
  return version;
};

const finishSecret = async (client: AWS.SecretsManager, arn: string, token: string) => {
  console.log(`Trace`, `finishSecret()`);
  /**
   * Schedule key deletion for old previous
   * Update pending to current
   * **/
  const currentVersion = await getVersion(client, arn, 'AWSCURRENT');
  if (currentVersion === token) {
    console.log(`finishSecret: Version ${currentVersion} already marked as AWSCURRENT for ${arn}`);
    return;
  }

  try {
    const previousVersionId = await getVersion(client, arn, 'AWSPREVIOUS');
    const { SecretString: secretString = `` } = await client.getSecretValue({
      SecretId: arn, VersionStage: 'AWSPREVIOUS', VersionId: previousVersionId
    }).promise();
    const previousKey = secretString;
    console.log(`previousKey`, previousKey);
    try {
      const params: ScheduleKeyDeletionRequest = {
        KeyId: previousKey,
        PendingWindowInDays: 7
      };
      const response: ScheduleKeyDeletionResponse = await kms.scheduleKeyDeletion(params).promise();
      console.log(`ScheduleKeyDeletionResponse`, response);
    } catch (error) {
      console.error(`scheduleKeyDeletion() Error`, error);
    }
  } catch (error: any) {
    console.error(`Error getting AWSPREVIOUS`, error);
  }

  await client.updateSecretVersionStage({
    SecretId: arn,
    VersionStage: 'AWSCURRENT',
    MoveToVersionId: token,
    RemoveFromVersionId: currentVersion
  }).promise();
  console.log(`Successfully finished promoting pending to current`);
};
