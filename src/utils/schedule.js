const { scheduleJob } = require("node-schedule");
const moment = require("#config/moment");
const Task = require("#models/task");
const sendEmail = require("#config/mailer");

const scheduleTasks = async () => {
  scheduleJob("Set notifications", { hour: 1, minute: 59 }, async () => {
    console.log('Scheduling...')
    await scheduleNotifications()
    // await scheduleDeleteTasksJob()
  });
};

const scheduleNotifications = async () => {
  try {
    const tasks = await Task.find({
      notify: true,
      notificationDate: {
        $gte: moment().toISOString(),
        $lt: moment(moment().format("YYYY-MM-DD 23:59")).toISOString(),
      },
    });
    for (const {
      _id,
      title,
      description,
      notificationDate,
      limitDate,
      userEmail,
    } of tasks) {
      const date = new Date(notificationDate);
      scheduleJob(`${_id}`, date, async () => {
        await sendEmail(userEmail, title, "Notification", {
          description,
          limitDate: moment(limitDate).format("DD [de] MMMM [del] YYYY"),
        });
        await Task.updateOne({ _id }, { notified: true });
      });
    }
  } catch (error) {
    console.log(error);
  }
};

// const scheduleDeleteTasksJob = () => {
//   try {
    
//   } catch (error) {
    
//   }
// }

module.exports = scheduleTasks;
