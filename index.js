require("dotenv").config();
const express = require("express");

const app = express();
app.use(express.json());

app.all("/api/data",          require("./api/data"));
app.all("/api/daycycle",      require("./api/daycycle"));
app.all("/api/foodmenu",      require("./api/foodmenu"));
app.all("/api/cron-daycycle", require("./api/cron-daycycle"));
app.all("/api/cron-foodmenu", require("./api/cron-foodmenu"));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`schooltimer-api running at http://localhost:${PORT}`);
  console.log(`  GET http://localhost:${PORT}/api/data`);
});
