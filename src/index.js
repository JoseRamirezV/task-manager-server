require("dotenv").config();
require("./database");
const scheduleNotifications = require("./utils/schedule");
const app = require("./app");

const port = app.get("port");

app.listen(port, () => {
  scheduleNotifications()
  console.log("> Server is up and running on port : " + port);
});
