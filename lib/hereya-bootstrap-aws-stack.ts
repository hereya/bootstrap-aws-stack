import * as cdk from 'aws-cdk-lib';
import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class HereyaBootstrapAwsStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const terraformStateBucket = new s3.Bucket(this, 'terraformStateBucket', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            versioned: true,
            removalPolicy: RemovalPolicy.RETAIN,
        });

        const tfStateLockTable = new dynamodb.TableV2(this, 'terraformStateLock', {
            partitionKey: {
                name: 'LockID',
                type: dynamodb.AttributeType.STRING
            },
        });

        const hereyaBackendBucket = new s3.Bucket(this, 'hereyaBackendBucket', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            versioned: true,
            removalPolicy: RemovalPolicy.RETAIN,
            objectLockEnabled: true,
        });

        new CfnOutput(this, 'terraformStateBucketRegion', {
            value: terraformStateBucket.env.region,
            description: 'The region of the S3 bucket for storing terraform state files',
            exportName: 'hereyaTerraformStateBucketRegion',
        })

        new CfnOutput(this, 'terraformStateBucketName', {
            value: terraformStateBucket.bucketName,
            description: 'The name of the S3 bucket for storing terraform state files',
            exportName: 'hereyaTerraformStateBucketName',
        })

        new CfnOutput(this, 'terraformStateLockTableName', {
            value: tfStateLockTable.tableName,
            description: 'The name of the DynamoDB table for storing terraform state lock',
            exportName: 'hereyaTerraformStateLockTableName',
        })

        new CfnOutput(this, 'backendBucket', {
            value: hereyaBackendBucket.bucketName,
            description: 'The name of the S3 bucket for storing hereya backend files',
            exportName: 'backendBucket',
        })
    }
}
