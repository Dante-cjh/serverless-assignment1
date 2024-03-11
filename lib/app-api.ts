import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import * as node from "aws-cdk-lib/aws-lambda-nodejs";
import {generateBatch} from "../shared/util";
import {movies, movieCasts, movieReviews} from "../seed/movies";
import * as iam from 'aws-cdk-lib/aws-iam';

type AppApiProps = {
    userPoolId: string;
    userPoolClientId: string;
};

export class AppApi extends Construct {
    constructor(scope: Construct, id: string, props: AppApiProps) {
        super(scope, id);

        // Tables
        const moviesTable = new dynamodb.Table(this, "MoviesTable", {
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            partitionKey: {name: "id", type: dynamodb.AttributeType.NUMBER},
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            tableName: "Movies",
        });

        const movieCastsTable = new dynamodb.Table(this, "MovieCastTable", {
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            partitionKey: {name: "movieId", type: dynamodb.AttributeType.NUMBER},
            sortKey: {name: "actorName", type: dynamodb.AttributeType.STRING},
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            tableName: "MovieCast",
        });

        movieCastsTable.addLocalSecondaryIndex({
            indexName: "roleIx",
            sortKey: {name: "roleName", type: dynamodb.AttributeType.STRING},
        });

        const movieReviewTable = new dynamodb.Table(this, 'MovieReviews', {
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            partitionKey: {name: 'MovieId', type: dynamodb.AttributeType.NUMBER},
            sortKey: {name: 'ReviewerName', type: dynamodb.AttributeType.STRING},
            tableName: 'MovieReviews',
            removalPolicy: cdk.RemovalPolicy.DESTROY, // 注意：实际生产中应该小心使用此设置
        });

        // Add a global secondary index to support queries by ReviewerName.
        movieReviewTable.addGlobalSecondaryIndex({
            indexName: 'ReviewerNameIndex',
            partitionKey: {name: 'ReviewerName', type: dynamodb.AttributeType.STRING},
            projectionType: dynamodb.ProjectionType.ALL,
        });

        const appApi = new apig.RestApi(this, "AppApi", {
            description: "App RestApi",
            endpointTypes: [apig.EndpointType.REGIONAL],
            defaultCorsPreflightOptions: {
                allowOrigins: apig.Cors.ALL_ORIGINS,
            },
        });

        const appCommonFnProps = {
            architecture: lambda.Architecture.ARM_64,
            timeout: cdk.Duration.seconds(10),
            memorySize: 128,
            runtime: lambda.Runtime.NODEJS_16_X,
            handler: "handler",
            environment: {
                USER_POOL_ID: props.userPoolId,
                CLIENT_ID: props.userPoolClientId,
                REGION: cdk.Aws.REGION,
            },
        };

        // Functions
        new custom.AwsCustomResource(this, "moviesddbInitData", {
            onCreate: {
                service: "DynamoDB",
                action: "batchWriteItem",
                parameters: {
                    RequestItems: {
                        [moviesTable.tableName]: generateBatch(movies),
                        [movieCastsTable.tableName]: generateBatch(movieCasts),
                        [movieReviewTable.tableName]: generateBatch(movieReviews)
                    },
                },
                physicalResourceId: custom.PhysicalResourceId.of("moviesddbInitData"), //.of(Date.now().toString()),
            },
            policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
                resources: [moviesTable.tableArn, movieCastsTable.tableArn, movieReviewTable.tableArn],  // Includes movie cast
            }),
        });

        const getMovieByIdFn = new node.NodejsFunction(this, "GetMovieByIdFn", {
            ...appCommonFnProps,
            entry: `${__dirname}/../lambdas/getMovieById.ts`,
            environment: {
                ...appCommonFnProps.environment, // 继承共通的环境变量
                TABLE_NAME: moviesTable.tableName, // 添加或覆盖特定的环境变量
                MOVIE_CAST_TABLE: movieCastsTable.tableName,
            },
        });

        const getAllMoviesFn = new node.NodejsFunction(this, "GetAllMoviesFn", {
            ...appCommonFnProps,
            entry: `${__dirname}/../lambdas/getAllMovies.ts`,
            environment: {
                ...appCommonFnProps.environment, // 继承共通的环境变量
                TABLE_NAME: moviesTable.tableName, // 添加或覆盖特定的环境变量
            },
        });

        const newMovieFn = new node.NodejsFunction(this, "AddMovieFn", {
            ...appCommonFnProps,
            entry: `${__dirname}/../lambdas/addMovie.ts`,
            environment: {
                ...appCommonFnProps.environment,
                TABLE_NAME: moviesTable.tableName,
            },
        });

        const deleteMovieFn = new node.NodejsFunction(this, "DeleteMovieFn", {
            ...appCommonFnProps,
            entry: `${__dirname}/../lambdas/deleteMovie.ts`,
            environment: {
                ...appCommonFnProps.environment, // 继承共通的环境变量
                TABLE_NAME: moviesTable.tableName, // 添加或覆盖特定的环境变量
            },
        });

        const getMovieCastMembersFn = new node.NodejsFunction(this, "GetCastMemberFn", {
            ...appCommonFnProps,
            entry: `${__dirname}/../lambdas/getMovieCastMember.ts`,
            environment: {
                ...appCommonFnProps.environment, // 继承共通的环境变量
                TABLE_NAME: movieCastsTable.tableName, // 添加或覆盖特定的环境变量
            },
        });

        const getReviewsByIdFn = new node.NodejsFunction(this, "getReviewsByIdFn", {
            ...appCommonFnProps,
            entry: `${__dirname}/../lambdas/getMovieReviews.ts`,
            environment: {
                ...appCommonFnProps.environment, // 继承共通的环境变量
                TABLE_NAME: movieReviewTable.tableName, // 添加或覆盖特定的环境变量
            },
        });

        const newReviewFn = new node.NodejsFunction(this, "AddReviewFn", {
            ...appCommonFnProps,
            entry: `${__dirname}/../lambdas/addMovieReview.ts`,
            environment: {
                ...appCommonFnProps.environment,
                TABLE_NAME: movieReviewTable.tableName,
            },
        });

        const updateMovieReviewFn = new node.NodejsFunction(this, "updateMovieReviewFn", {
            ...appCommonFnProps,
            entry: `${__dirname}/../lambdas/updateMovieReview.ts`,
            environment: {
                ...appCommonFnProps.environment,
                TABLE_NAME: movieReviewTable.tableName,
            },
        });

        const getReviewsByParam = new node.NodejsFunction(this, "GetReviewsByParam", {
            ...appCommonFnProps,
            entry: `${__dirname}/../lambdas/getReviewsByParams.ts`,
            environment: {
                ...appCommonFnProps.environment, // 继承共通的环境变量
                TABLE_NAME: movieReviewTable.tableName, // 添加或覆盖特定的环境变量
            },
        });

        const getReviewsByReviewerFn = new node.NodejsFunction(this, "GetReviewsByReviewerFunction", {
            ...appCommonFnProps,
            entry: `${__dirname}/../lambdas/getReviewsByReviewer.ts`,
            environment: {
                ...appCommonFnProps.environment, // 继承共通的环境变量
                TABLE_NAME: movieReviewTable.tableName, // 添加或覆盖特定的环境变量
            },
        });

        const getReviewByIdAndReviewerFn = new node.NodejsFunction(this, "GetReviewByIdAndReviewerFn", {
            ...appCommonFnProps,
            entry: "./lambdas/getReviewByIdAndReviewer.ts",
            environment: {
                ...appCommonFnProps.environment, // 继承共通的环境变量
                TABLE_NAME: movieReviewTable.tableName, // 添加或覆盖特定的环境变量
            }
        });

        const translateFn = new node.NodejsFunction(this, "Translate", {
            ...appCommonFnProps,
            entry: "./lambdas/translate.ts",
            environment: {
                ...appCommonFnProps.environment, // 继承共通的环境变量
                TABLE_NAME: movieReviewTable.tableName, // 添加或覆盖特定的环境变量
            },
        });

        // 创建一个新的IAM策略，允许调用Translate服务
        const translatePolicy = new iam.PolicyStatement({
            actions: ["translate:TranslateText"], // 定义允许的操作
            resources: ["*"], // 在这个例子中，资源设置为所有，根据需要进行限制
        });

        // 将IAM策略附加到Lambda函数的执行角色上
        translateFn.addToRolePolicy(translatePolicy);

        // Permissions
        moviesTable.grantReadData(getMovieByIdFn)
        moviesTable.grantReadData(getAllMoviesFn)
        moviesTable.grantReadWriteData(newMovieFn)
        moviesTable.grantReadWriteData(deleteMovieFn)
        movieCastsTable.grantReadData(getMovieCastMembersFn);
        movieCastsTable.grantReadData(getMovieByIdFn);
        movieReviewTable.grantReadData(getReviewsByIdFn);
        movieReviewTable.grantReadData(getReviewsByReviewerFn);
        movieReviewTable.grantReadData(getReviewByIdAndReviewerFn);
        movieReviewTable.grantReadWriteData(getReviewsByParam);
        movieReviewTable.grantReadWriteData(newReviewFn);
        movieReviewTable.grantReadWriteData(updateMovieReviewFn);
        movieReviewTable.grantReadWriteData(translateFn);


        // authorizer
        const authorizerFn = new node.NodejsFunction(this, "AuthorizerFn", {
            ...appCommonFnProps,
            entry: "./lambdas/auth/authorizer.ts",
        });

        const requestAuthorizer = new apig.RequestAuthorizer(
            this,
            "RequestAuthorizer",
            {
                identitySources: [apig.IdentitySource.header("cookie")],
                handler: authorizerFn,
                resultsCacheTtl: cdk.Duration.minutes(0),
            }
        );


        // REST API
        const api = new apig.RestApi(this, "RestAPI", {
            description: "demo api",
            deployOptions: {
                stageName: "dev",
            },
            defaultCorsPreflightOptions: {
                allowHeaders: ["Content-Type", "X-Amz-Date"],
                allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
                allowCredentials: true,
                allowOrigins: ["*"],
            },
        });

        const moviesEndpoint = api.root.addResource("movies");
        moviesEndpoint.addMethod(
            "GET",
            new apig.LambdaIntegration(getAllMoviesFn, {proxy: true})
        );

        const movieEndpoint = moviesEndpoint.addResource("{movieId}");
        movieEndpoint.addMethod(
            "GET",
            new apig.LambdaIntegration(getMovieByIdFn, {proxy: true})
        );

        moviesEndpoint.addMethod(
            "POST",
            new apig.LambdaIntegration(newMovieFn, {proxy: true})
        );

        movieEndpoint.addMethod(
            "DELETE",
            new apig.LambdaIntegration(deleteMovieFn, {proxy: true})
        )

        const movieCastEndpoint = moviesEndpoint.addResource("cast");
        movieCastEndpoint.addMethod(
            "GET",
            new apig.LambdaIntegration(getMovieCastMembersFn, {proxy: true})
        );

        const movieReviewEndpoint = movieEndpoint.addResource("reviews");
        movieReviewEndpoint.addMethod(
            "GET",
            new apig.LambdaIntegration(getReviewsByIdFn, {proxy: true})
        );

        movieReviewEndpoint.addMethod(
            "POST",
            new apig.LambdaIntegration(newReviewFn, {proxy: true}),{
                authorizer: requestAuthorizer,
                authorizationType: apig.AuthorizationType.CUSTOM,
            }
        );

        const reviewerEndpoint = movieReviewEndpoint.addResource("{param}");
        reviewerEndpoint.addMethod("GET", new apig.LambdaIntegration(getReviewsByParam, {proxy: true}));

        reviewerEndpoint.addMethod('PUT', new apig.LambdaIntegration(updateMovieReviewFn, {proxy: true}),{
            authorizer: requestAuthorizer,
            authorizationType: apig.AuthorizationType.CUSTOM,
        });

        const reviewsEndpoint = api.root.addResource('reviews');
        const allReviewsEndpoint = reviewsEndpoint.addResource('{reviewerName}');
        allReviewsEndpoint.addMethod('GET', new apig.LambdaIntegration(getReviewsByReviewerFn));

        const reviewByIdAndReviewer = allReviewsEndpoint.addResource('{movieId}');
        reviewByIdAndReviewer.addMethod('GET', new apig.LambdaIntegration(getReviewByIdAndReviewerFn));

        const translateReview = reviewByIdAndReviewer.addResource('translation');
        translateReview.addMethod('GET', new apig.LambdaIntegration(translateFn));
    }
}