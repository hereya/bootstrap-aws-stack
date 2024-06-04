import * as cdk from 'aws-cdk-lib';
import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class HereyaBootstrapAwsStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // create s3 bucket for storing hereya projects source code
        const bucket = new s3.Bucket(this, 'hereya-projects-source-code', {
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        const project = new codebuild.Project(this, 'hereyaCdk', {
            projectName: 'hereyaCdk',
            environment: {
                buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
            },
            buildSpec: codebuild.BuildSpec.fromObject({
                version: '0.2',
                env: {
                    shell: 'bash',
                    variables: {
                        HEREYA_ID: '',
                        HEREYA_IAC_TYPE: '',
                        HEREYA_DESTROY: '',
                        HEREYA_INFRA_TYPE: '',
                        HEREYA_PARAMETERS: '',
                        HEREYA_WORKSPACE_ENV: '',
                        PKG_REPO_URL: '',
                        HEREYA_PROJECT_S3_KEY: '',
                        HEREYA_DEPLOY: '',
                        HEREYA_SOURCE_CODE_BUCKET: bucket.bucketName,
                    }
                },
                phases: {
                    install: {
                        'runtime-versions': {
                            nodejs: '20.x',
                        },
                        commands: [
                            'npm install -g hereya-cli',
                        ],
                    },
                    pre_build: {
                        commands: [
                            'git clone $PKG_REPO_URL source-code/',
                            'if [[ "$HEREYA_DEPLOY" == "true" ]] ; then  aws s3 cp' +
                            ` s3://$HEREYA_SOURCE_CODE_BUCKET/$HEREYA_PROJECT_S3_KEY` +
                            ' project-source-code/ --recursive; fi',
                        ],
                    },
                    build: {
                        commands: [
                            'cd source-code',
                            'npm install',
                            'if [[ "$HEREYA_DEPLOY" == "true" ]] ; then hereya remote exec $PWD --source ../project-source-code; else hereya remote exec $PWD; fi',
                        ],
                    },
                },
            }),
        });
        // Add permissions to the project's role
        project.role?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));

        const terraformStateBucket = new s3.Bucket(scope, 'terraformStateBucket', {
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

        const terraformProject = new codebuild.Project(this, 'hereyaTerraform', {
            projectName: 'hereyaTerraform',
            environment: {
                buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
            },
            buildSpec: codebuild.BuildSpec.fromObject({
                version: '0.2',
                env: {
                    shell: 'bash',
                    variables: {
                        HEREYA_ID: '',
                        HEREYA_IAC_TYPE: '',
                        HEREYA_DESTROY: '',
                        HEREYA_INFRA_TYPE: '',
                        HEREYA_PARAMETERS: '',
                        HEREYA_WORKSPACE_ENV: '',
                        PKG_REPO_URL: '',
                        HEREYA_PROJECT_S3_KEY: '',
                        HEREYA_DEPLOY: '',
                        HEREYA_SOURCE_CODE_BUCKET: bucket.bucketName,
                        TERRAFORM_STATE_BUCKET: terraformStateBucket.bucketName,
                        TERRAFORM_STATE_LOCK_TABLE: tfStateLockTable.tableName,
                        AWS_REGION: this.region,
                    }
                },
                phases: {
                    install: {
                        'runtime-versions': {
                            nodejs: '20.x',
                        },
                        commands: [
                            'sudo yum install -y yum-utils',
                            'sudo yum-config-manager --add-repo https://rpm.releases.hashicorp.com/AmazonLinux/hashicorp.repo',
                            'sudo yum -y install terraform',
                            'npm install -g hereya-cli',
                        ],
                    },
                    pre_build: {
                        commands: [
                            'git clone $PKG_REPO_URL source-code/',
                            'if [[ "$HEREYA_DEPLOY" == "true" ]] ; then  aws s3 cp' +
                            ` s3://$HEREYA_SOURCE_CODE_BUCKET/$HEREYA_PROJECT_S3_KEY` +
                            ' project-source-code/ --recursive; fi',
                        ],
                    },
                    build: {
                        commands: [
                            'cd source-code',
                            'echo "terraform {\n' +
                            '  backend \\"s3\\" {\n' +
                            '    bucket = \\"$TERRAFORM_STATE_BUCKET\\"\n' +
                            '    key = \\"$HEREYA_ID/terraform.tfstate\\"\n' +
                            '    region = \\"$AWS_REGION\\"\n' +
                            '    dynamodb_table = \\"$TERRAFORM_STATE_LOCK_TABLE\\"\n' +
                            '  }\n' +
                            '}" > hereya_terraform_backend.tf\n',
                            'if [[ "$HEREYA_DEPLOY" == "true" ]] ; then hereya remote exec $PWD --source ../project-source-code; else hereya remote exec $PWD; fi',
                        ],
                    },
                },
            }),
        });

        terraformProject.role?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));


        new CfnOutput(this, 'cdkCodebuildProjectName', {
            value: project.projectName,
            description: 'The name of the CodeBuild project for CDK deployment',
        })

        new CfnOutput(this, 'hereyaSourceCodeBucketName', {
            value: bucket.bucketName,
            description: 'The name of the S3 bucket for storing hereya projects source code',
            exportName: 'hereyaSourceCodeBucketName',
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
    }
}
