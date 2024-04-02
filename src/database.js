const mongoose = require("mongoose");
console.log(process.env.URI);
mongoose
  .connect(process.env.URI)
  .then((res) => console.log("> Connected..."))
  .catch((err) =>
    console.log(
      `> Error while connecting to mongoDB : ${err.message}`
    )
  );
