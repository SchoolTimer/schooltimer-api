const dotenv = require("dotenv");
const path = require("path");
// Ensure we load the root .env regardless of where the script is executed from
dotenv.config({ path: path.resolve(__dirname, "../.env") });
const fetch = require("node-fetch");

const FOODMENU_UPDATE_API = process.env.FOODMENU_UPDATE_API;
const GraphQLAPI = process.env.FOOD_MENU_GRAPHQL_API;

function assertAbsoluteUrl(name, value) {
  if (!value || typeof value !== "string") {
    throw new Error(`${name} is missing. Check your .env configuration.`);
  }
  try {
    const parsed = new URL(value);
    if (
      !parsed.protocol ||
      (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    ) {
      throw new Error(
        `${name} must be an absolute http(s) URL. Received: ${value}`
      );
    }
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(`${name} must be an absolute URL. Received: ${value}`);
    }
    throw err;
  }
}

async function getGraphQLData() {
  var dateObj = new Date();
  var month = dateObj.getUTCMonth() + 1; //months from 1-12
  var day = dateObj.getUTCDate();
  var year = dateObj.getUTCFullYear();

  const query = `
    query {
      site0: menuType(id: "5d13bb11534a134661b51588") {
        name
        items(start_date: "${month}/${day}/${year}", end_date: "${month}/${day}/${year}") {
          product {
            name
          }
        }
      }
      site1: menuType(id: "5d011496534a13a13b2dff32") {
        name
        items(start_date: "${month}/${day}/${year}", end_date: "${month}/${day}/${year}") {
          product {
            name
          }
        }
      }
    }
  `;

  // Validate URL before fetch to give clearer errors
  assertAbsoluteUrl("FOOD_MENU_GRAPHQL_API", GraphQLAPI);

  await fetch(GraphQLAPI, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query }),
  })
    .then((response) => response.json())
    .then((data) => {
      let breakfastUnfiltered = data.data.site0.items || [];
      let lunchUnfiltered = data.data.site1.items || [];

      breakfastUnfiltered = breakfastUnfiltered.filter(
        (item) => item && item.product.name !== "or"
      );
      lunchUnfiltered = lunchUnfiltered.filter(
        (item) => item && item.product.name !== "or"
      );

      if (breakfastUnfiltered.length === 0 && lunchUnfiltered.length === 0) {
        breakfastUnfiltered = [{ product: { name: "Nothing on the menu!" } }];
        lunchUnfiltered = [{ product: { name: "Nothing on the menu!" } }];
      }

      const deploymentReadyData = {
        breakfast: breakfastUnfiltered,
        lunch: lunchUnfiltered,
      };

      updateDB(deploymentReadyData);
    });
}

async function updateDB(GraphQLData) {
  // Validate URL before fetch to give clearer errors
  assertAbsoluteUrl("FOODMENU_UPDATE_API", FOODMENU_UPDATE_API);
  const requestOptions = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": process.env.API_KEY,
    },
    body: JSON.stringify(GraphQLData),
  };

  await fetch(FOODMENU_UPDATE_API, requestOptions)
    .then((response) => response.json())
    .then((data) => console.log("Food Menu Updated!"))
    .catch((error) => console.error("Update failed:", error));
}

getGraphQLData().catch(console.error);
