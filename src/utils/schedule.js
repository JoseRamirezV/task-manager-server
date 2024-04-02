const { scheduleJob } = require("node-schedule");
const moment = require("../config/moment");
const Task = require("../models/task");
const sendMail = require("../config/mailer");

const scheduleNotifications = async () => {
  scheduleJob('Set notifications',{ hour: 20, minute: 21, second:37}, async () => {
    try {
      const tasks = await Task.find({
        notify: true,
        notificationDate: {
          $gte: moment().format("YYYY-MM-DD"),
          $lt: moment().format("YYYY-MM-DD 22:59"),
        },
      });
      for (const { _id, title, description, notificationDate, limitDate, userEmail } of tasks) {
        const date = new Date(notificationDate);
        scheduleJob(`${_id}`, date, async () => {
          await sendMail(
            userEmail,
            title,
            description,
            moment(limitDate).format("DD [de] MMMM [del] YYYY")
          );
          await Task.updateOne({ _id }, { notified: true });
        });
      }
    } catch (error) {
      console.log(error);
    }
  });
};

module.exports = scheduleNotifications;
