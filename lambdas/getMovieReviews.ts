import {APIGatewayProxyHandlerV2} from "aws-lambda";

import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import {DynamoDBDocumentClient, GetCommand, QueryCommand, QueryCommandInput} from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDocumentClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
    try {
        console.log("Event: ", event);
        const parameters = event?.pathParameters;
        const movieId = parameters?.movieId ? parseInt(parameters.movieId) : undefined;
        const minRating = event.queryStringParameters?.minRating;
        const reviewerName = parameters?.reviewerName;
        // const reviewYear = parameters?.year;

        if (!movieId) {
            return {
                statusCode: 400,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({Message: "Missing or invalid movieId"}),
            };
        }

        let filterExpression = '';

        let keyConditionExpression: string = "MovieId = :movieId";

        let expressionAttributeValues: any = {
            ":movieId": movieId,
        };

        if (minRating) {
            filterExpression += 'Rating >= :minRating';
            expressionAttributeValues[":minRating"] = parseInt(minRating);
        }

        if (reviewerName) {
            keyConditionExpression += " AND ReviewerName = :reviewerName";
            expressionAttributeValues[":reviewerName"] = reviewerName;
        }

        // if (reviewYear) {
        //     filterExpression += filterExpression ? ' AND ' : '';
        //     filterExpression += 'begins_with(ReviewDate, :reviewYear)';
        //     expressionAttributeValues[":reviewYear"] = reviewYear;
        // }

        const queryCommandInput: any = {
            TableName: process.env.TABLE_NAME, // 确保环境变量名称正确
            KeyConditionExpression: keyConditionExpression,
            ExpressionAttributeValues: expressionAttributeValues,
        };

        // 如果有过滤条件，添加到查询命令输入
        if (filterExpression) {
            queryCommandInput["FilterExpression"] = filterExpression;
        }

        const queryOutput = await ddbDocClient.send(new QueryCommand(queryCommandInput));
        console.log("QueryCommand response: ", queryOutput);

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
