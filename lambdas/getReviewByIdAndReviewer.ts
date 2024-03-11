import {APIGatewayProxyHandlerV2} from "aws-lambda";

import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import {DynamoDBDocumentClient, GetCommand, QueryCommand, QueryCommandInput} from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDocumentClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
    try {
        console.log("Event: ", event);
        const parameters = event?.pathParameters;
        const movieId = parameters?.movieId ? parseInt(parameters.movieId) : undefined;
        const reviewerName = event.pathParameters?.reviewerName;

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

        // Return Response
        return {
            statusCode: 200,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({reviews: queryOutput.Items}),
        };
    } catch (error: any) {
        console.log(JSON.stringify(error));
        return {
            statusCode: 500,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({error}),
        };
    }
};

function createDocumentClient() {
    const ddbClient = new DynamoDBClient({region: process.env.REGION});
    const marshallOptions = {
        convertEmptyValues: true,
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
    };
    const unmarshallOptions = {
        wrapNumbers: false,
    };
    const translateConfig = {marshallOptions, unmarshallOptions};
    return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}

// Determine if it is a valid year
function isValidYear(param: string): boolean {
    // assuming a four-digit year
    return /^\d{4}$/.test(param);
}
