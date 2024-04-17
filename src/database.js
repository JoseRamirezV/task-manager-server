const mongoose = require("mongoose");
mongoose
  .connect(process.env.MONGODB_URI)
  .then((res) => console.log("> Connected..."))
  .catch((err) =>
    console.log(
      `> Error while connecting to mongoDB : ${err.message}`
    )
  );
