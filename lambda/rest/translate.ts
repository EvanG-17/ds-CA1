import { APIGatewayProxyHandler } from 'aws-lambda';
import 'source-map-support/register';
import * as AWS from 'aws-sdk';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

//https://docs.aws.amazon.com/translate/latest/dg/getting-started.html
const ddbDocClient = createDDbDocClient();
const translate = new AWS.Translate();

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    console.log("Event:", JSON.stringify(event));
    console.log("Table Name:", process.env.TABLE_NAME);
    console.log("Region:", process.env.REGION);

    const movieId = event?.pathParameters?.movieId;
    const language = event.queryStringParameters?.language;

    if (!movieId) {
      return {
        statusCode: 404,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ Message: "Invalid movie Id" }),
      };
    }

    if (!language) {
      return {
        statusCode: 404,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ Message: "Invalid language entered" }),
      };
    }

    const reviewResponse = await ddbDocClient.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME,
        Key: { id: parseInt(movieId) },
      })
    );

    if (!reviewResponse.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: 'Movie not found'
        })
      };
    }

    //Change Item.overview to whatever needs to be translated such as original_title. Overview has alot of text so its a good example
    const text = reviewResponse.Item.overview;

    if (!text) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: 'No content available for translation',
        }),
      };
    }

    console.log("Text length:", text.length);
    if (text.length > 5000) {
      console.log("Text too long for translation, truncating.");
    }

    const translateParams = {
      Text: text.substring(0, 5000),
      SourceLanguageCode: 'en',
      TargetLanguageCode: language,
    };

    const translatedMessage = await translate.translateText(translateParams).promise();

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        data: translatedMessage.TranslatedText, 
      }),
    };

  } 
  
  catch (error: any) {

    console.error("Error:", JSON.stringify(error));
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
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
