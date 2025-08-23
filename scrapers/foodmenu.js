import * as dotenv from "dotenv";
dotenv.config();
import fetch from "node-fetch";

const FOODMENU_UPDATE_API = process.env.FOODMENU_UPDATE_API; // e.g., 'https://schooltimer-api.vercel.app/api/foodmenu'
const GraphQLAPI = process.env.FOOD_MENU_GRAPHQL_API;

async function getGraphQLData() {
  var dateObj = new Date();
  var month = dateObj.getUTCMonth() + 1; //months from 1-12
  var day = dateObj.getUTCDate();
  var year = dateObj.getUTCFullYear();

  // Query for the GraphQL Api for getting the food menu
  const query = `
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
    `;

  // Fetch request from the GraphQL Api for requesting the data
  await fetch(GraphQLAPI, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      let breakfastUnfiltered = data.data.site0.items || []; // Default to empty array if undefined
      let lunchUnfiltered = data.data.site1.items || [];    // Default to empty array if undefined

      // Deletes "or" from breakfast Object
      breakfastUnfiltered = breakfastUnfiltered.filter(item => item && item.product.name !== "or");

      // Deletes "or" from lunch Object
      lunchUnfiltered = lunchUnfiltered.filter(item => item && item.product.name !== "or");

      // Displays nothing on the menu if both are empty
      if (breakfastUnfiltered.length === 0 && lunchUnfiltered.length === 0) {
        breakfastUnfiltered = [{ product: { name: "Nothing on the menu!" } }];
        lunchUnfiltered = [{ product: { name: "Nothing on the menu!" } }];
      }

      // Stores and new organized data
      const deploymentReadyData = {
        breakfast: breakfastUnfiltered,
        lunch: lunchUnfiltered,
      };

      updateDB(deploymentReadyData); // Update the database with current menu
    });
}

async function updateDB(GraphQLData) {
  const requestOptions = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": process.env.API_KEY, // Add API key for authentication
    },
    body: JSON.stringify(GraphQLData),
  };

  await fetch(FOODMENU_UPDATE_API, requestOptions)
    .then((response) => response.json())
    .then((data) => console.log("Food Menu Updated!"))
    .catch((error) => console.error("Update failed:", error));
}

// Runs the main function
getGraphQLData().catch(console.error);