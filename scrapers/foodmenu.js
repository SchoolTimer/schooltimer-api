import * as dotenv from "dotenv";
dotenv.config();
import fetch from "node-fetch";

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
    });
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