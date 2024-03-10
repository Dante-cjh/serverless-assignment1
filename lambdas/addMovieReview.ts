import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import {DynamoDBDocumentClient, PutCommand} from "@aws-sdk/lib-dynamodb";
// @ts-ignore
import schema from "../shared/types.schema.json";
import Ajv from "ajv";
import {APIGatewayProxyHandlerV2} from "aws-lambda";

const ajv = new Ajv();
const isValidBodyParams = ajv.compile(schema.definitions["AddMovieReviewRequest"] || {});

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
    try {
        // Print Event
        console.log("Event: ", event);
        let body = event.body ? JSON.parse(event.body) : undefined;
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
                    message: `Incorrect type. Must match Movie schema`,
                    schema: schema.definitions["MovieReview"],
                }),
            };
        }

        // Get the current date and format it as YYYY-MM-DD
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0]; // 将日期格式化为 YYYY-MM-DD

        // Adding the ReviewDate field to the body object
        // @ts-ignore
        body = {
            ...body,
            ReviewDate: formattedDate,
        };
        console.log(body);
        const commandOutput = await ddbDocClient.send(
            new PutCommand({
                TableName: process.env.TABLE_NAME,
                Item: body,
            })
        );
        return {
            statusCode: 201,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ message: "Movie review added" }),
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