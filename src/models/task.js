const { Schema, model } = require("mongoose");
const taskSchema = new Schema(
  {
    userEmail: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    limitDate: { type: Date, default: null },
    notify: { type: Boolean, default: false },
    notificationDate: { type: Date, default: null },
    notified: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);
module.exports = model("task", taskSchema);
