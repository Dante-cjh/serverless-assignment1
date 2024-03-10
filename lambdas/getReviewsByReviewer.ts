import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

function createDDbDocClient() {
    const ddbClient = new DynamoDBClient({ region: process.env.REGION });
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
    const reviewerName = event.pathParameters?.reviewerName;

    if (!reviewerName) {
        return {
            statusCode: 400,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({Message: "Missing or invalid reviewer name"}),
        };
    }

    const params = {
        TableName: process.env.TABLE_NAME, // Ensure you have a GSI for ReviewerName
        IndexName: 'ReviewerNameIndex', // Assuming you have a GSI named "ReviewerNameIndex"
        KeyConditionExpression: '#reviewerName = :reviewerName',
        ExpressionAttributeNames: {
            '#reviewerName': 'ReviewerName',
        },
        ExpressionAttributeValues: {
            ':reviewerName': reviewerName,
        },
    };

    try {
        const queryOutput = await ddbDocClient.send(new QueryCommand(params));
        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ reviews: queryOutput.Items }),
        };
    } catch (error) {
        console.error('Error retrieving reviews by reviewer: ', error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "Failed to retrieve reviews", details: error }),
        };
    }
};
