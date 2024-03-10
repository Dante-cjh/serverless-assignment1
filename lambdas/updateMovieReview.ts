import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import {DynamoDBDocumentClient, UpdateCommand} from "@aws-sdk/lib-dynamodb";
// @ts-ignore
import schema from "../shared/types.schema.json";
import Ajv from "ajv";
import {APIGatewayProxyHandlerV2} from "aws-lambda";

const ajv = new Ajv();
const isValidBodyParams = ajv.compile(schema.definitions["UpdateMovieReviewRequest"] || {});

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
    try {
        // Print Event
        console.log("Event: ", event);
        const parameters = event?.pathParameters;
        const movieId = parameters?.movieId ? parseInt(parameters.movieId) : undefined;
        const reviewerName = parameters?.reviewerName;
        const body = event.body ? JSON.parse(event.body) : undefined;
        if (!body) {
            return {
                statusCode: 500,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ message: "Missing request body" }),
            };
        }

        if (!isValidBodyParams(body)) {
            return {
                statusCode: 500,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    message: `Incorrect type. Must match UpdateMovieReviewRequest schema`,
                    schema: schema.definitions["UpdateMovieReviewRequest"],
                }),
            };
        }

        const params: any = {
            TableName: process.env.TABLE_NAME,
            Key: {
                MovieId: movieId,
                ReviewerName: reviewerName,
            },
            UpdateExpression: 'SET Content = :content, Rating = :rating ',
            ExpressionAttributeValues: {
                ':content': body.Content,
                ':rating': body.Rating
            },
            ReturnValues: 'UPDATED_NEW',
        };

        const commandOutput = await ddbDocClient.send(new UpdateCommand(params));
        return {
            statusCode: 201,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ message: "Review updated successfully", updatedAttributes: commandOutput.Attributes}),
        };
    } catch (error: any) {
        console.log(JSON.stringify(error));
        return {
            statusCode: 500,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ error }),
        };
    }
};

function createDDbDocClient() {
    const ddbClient = new DynamoDBClient({ region: process.env.REGION });
    const marshallOptions = {
        convertEmptyValues: true,
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
    };
    const unmarshallOptions = {
        wrapNumbers: false,
    };
    const translateConfig = { marshallOptions, unmarshallOptions };
    return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}