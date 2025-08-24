const dotenv = require("dotenv");
dotenv.config();
const fetch = require("node-fetch");

const FOODMENU_UPDATE_API = process.env.FOODMENU_UPDATE_API;
const GraphQLAPI = process.env.FOOD_MENU_GRAPHQL_API;

async function getGraphQLData() {
  var dateObj = new Date();
  var month = dateObj.getUTCMonth() + 1; //months from 1-12
  var day = dateObj.getUTCDate();
  var year = dateObj.getUTCFullYear();

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

  try {
    const response = await fetch(GraphQLAPI, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL API failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Debug: Log the response structure
    console.log('GraphQL Response:', JSON.stringify(data, null, 2));
    
    if (!data.data) {
      throw new Error('GraphQL response missing data property');
    }

    let breakfastUnfiltered = data.data.site0?.items || [];
    let lunchUnfiltered = data.data.site1?.items || [];

      breakfastUnfiltered = breakfastUnfiltered.filter(item => item && item.product.name !== "or");
      lunchUnfiltered = lunchUnfiltered.filter(item => item && item.product.name !== "or");

      if (breakfastUnfiltered.length === 0 && lunchUnfiltered.length === 0) {
        breakfastUnfiltered = [{ product: { name: "Nothing on the menu!" } }];
        lunchUnfiltered = [{ product: { name: "Nothing on the menu!" } }];
      }

      const deploymentReadyData = {
        breakfast: breakfastUnfiltered,
        lunch: lunchUnfiltered,
      };

      updateDB(deploymentReadyData);
    } catch (error) {
      console.error('Error in getGraphQLData:', error);
      throw error;
    }
}

async function updateDB(GraphQLData) {
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