// supabase/functions/update-foodmenu/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
function assertAbsoluteUrl(name, value) {
  if (!value || typeof value !== "string") {
    throw new Error(`${name} is missing. Check your environment variables.`);
  }
  try {
    const parsed = new URL(value);
    if (!parsed.protocol || parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`${name} must be an absolute http(s) URL. Received: ${value}`);
    }
  } catch (_err) {
    throw new Error(`${name} must be an absolute URL. Received: ${value}`);
  }
}
async function getGraphQLData() {
  const GraphQLAPI = Deno.env.get("FOOD_MENU_GRAPHQL_API");
  assertAbsoluteUrl("FOOD_MENU_GRAPHQL_API", GraphQLAPI);
  const dateObj = new Date();
  const month = dateObj.getUTCMonth() + 1;
  const day = dateObj.getUTCDate();
  const year = dateObj.getUTCFullYear();
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
  const response = await fetch(GraphQLAPI, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      query
    })
  });
  const data = await response.json();
  let breakfastUnfiltered = data.data.site0?.items || [];
  let lunchUnfiltered = data.data.site1?.items || [];
  breakfastUnfiltered = breakfastUnfiltered.filter((item)=>item && item.product.name !== "or");
  lunchUnfiltered = lunchUnfiltered.filter((item)=>item && item.product.name !== "or");
  if (breakfastUnfiltered.length === 0 && lunchUnfiltered.length === 0) {
    breakfastUnfiltered = [
      {
        product: {
          name: "Nothing on the menu!"
        }
      }
    ];
    lunchUnfiltered = [
      {
        product: {
          name: "Nothing on the menu!"
        }
      }
    ];
  }
  return {
    breakfast: breakfastUnfiltered,
    lunch: lunchUnfiltered
  };
}
async function updateDB(GraphQLData) {
  const FOODMENU_UPDATE_API = Deno.env.get("FOODMENU_UPDATE_API");
  const API_KEY = Deno.env.get("API_KEY");
  assertAbsoluteUrl("FOODMENU_UPDATE_API", FOODMENU_UPDATE_API);
  const response = await fetch(FOODMENU_UPDATE_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": API_KEY ?? ""
    },
    body: JSON.stringify(GraphQLData)
  });
  if (!response.ok) {
    throw new Error(`Update failed: ${response.statusText}`);
  }
  return await response.json();
}
serve(async (_req)=>{
  try {
    const data = await getGraphQLData();
    await updateDB(data);
    return new Response(JSON.stringify({
      message: "Food Menu Updated!",
      data
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({
      error: err.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
});
