const { Schema, model } = require("mongoose");
const userSchema = new Schema(
  {
    user: { type: String, required: true },
    firstName: { type: String, required: true },
    secondName: { type: String },
    firstLastName: { type: String, required: true },
    secondLastName: { type: String },
    email: { type: String, required: true },
    password: { type: String, required: true },
    temporalToken: { type: String, default: null },
    verified: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);
module.exports = model("user", userSchema);
