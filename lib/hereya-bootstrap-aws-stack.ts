import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CfnOutput } from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';

export class HereyaBootstrapAwsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

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
            ],
          },
          build: {
            commands: [
              'cd source-code',
              'npm install',
              'hereya remote exec $PWD',
            ],
          },
        },
      }),
    });
    // Add permissions to the project's role
    project.role?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));

    new CfnOutput(this, 'cdkCodebuildProjectName', {
      value: project.projectName,
      description: 'The name of the CodeBuild project for CDK deployment',
    })
  }
}
