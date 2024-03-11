import {APIGatewayProxyHandlerV2} from 'aws-lambda';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient, QueryCommand} from '@aws-sdk/lib-dynamodb';
import * as AWS from 'aws-sdk';
import {Translate} from "aws-sdk";

const translate = new AWS.Translate();

function createDDbDocClient() {
    const ddbClient = new DynamoDBClient({region: process.env.REGION});
    const translateConfig = {
        marshallOptions: {
            convertEmptyValues: true,
            removeUndefinedValues: true,
            convertClassInstanceToMap: true,
        },
        unmarshallOptions: {
            wrapNumbers: false,
        },
    };

    return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
    const ddbDocClient = createDDbDocClient();

    const parameters = event?.pathParameters;
    const movieId = parameters?.movieId ? parseInt(parameters.movieId) : undefined;
    const reviewerName = event.pathParameters?.reviewerName;
    const language = event.queryStringParameters?.language;

    if (!language) {
        return {
            statusCode: 400,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({Message: "Missing language from the body"}),
        };
    }

    if (!movieId) {
        return {
            statusCode: 400,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({Message: "Missing or invalid movieId"}),
        };
    }

    if (!reviewerName) {
        return {
            statusCode: 400,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({Message: "Missing or invalid reviewer name"}),
        };
    }

    const queryCommandInput: any = {
        TableName: process.env.TABLE_NAME, // 确保环境变量名称正确
        KeyConditionExpression: '#reviewerName = :reviewerName AND #movieId = :movieId',
        ExpressionAttributeNames: {
            '#reviewerName': 'ReviewerName',
            '#movieId': 'MovieId',
        },
        ExpressionAttributeValues: {
            ':reviewerName': reviewerName,
            ":movieId": movieId,
        },
    };

    const queryOutput = await ddbDocClient.send(new QueryCommand(queryCommandInput));

    // @ts-ignore
    const response = queryOutput.Items[0];
    console.log(queryOutput.Items);
    const text = response.Content;

    try {
        const translateParams: Translate.Types.TranslateTextRequest = {
            SourceLanguageCode: 'en',
            TargetLanguageCode: language,
            Text: text
        };
        const translatedMessage = await translate.translateText(translateParams).promise();
        return {
            statusCode: 200,
            headers: {"content-type": "application/json"},
            body: JSON.stringify({translatedMessage}),
        };

    } catch (error) {
        console.log('error in translation',error);
        return {
            statusCode: 500,
            headers: {"content-type": "application/json"},
            body: JSON.stringify({error: "unable to translate the message", details: error}),
        };
    }
};
