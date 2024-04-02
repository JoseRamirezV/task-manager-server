const { Types } = require("mongoose");
const { scheduleJob, scheduledJobs } = require("node-schedule");
const moment = require("../config/moment");
const Task = require("../models/task");
const sendEmail = require("../config/mailer");

module.exports = {
  get: async (req, res) => {
    try {
      const userEmail = req.params.email;
      const tasks = await Task.find({ userEmail });
      res.status(200).json(tasks);
    } catch (error) {
      res.status(500).json({ error });
    }
  },

  add: async (req, res) => {
    try {
      const newTask = new Task(req.body);
      const {
        _id,
        notificationDate,
        notify,
        userEmail,
        title,
        description,
        limitDate,
      } = await newTask.save();
      const mustNotifyToday =
        moment(notificationDate).format("YYYY-MM-DD") ===
        moment().format("YYYY-MM-DD");

      if (mustNotifyToday) {
        notifyToday({
          id: _id,
          notificationDate,
          userEmail,
          notify,
          title,
          description,
          limitDate,
        });
      }
      res.status(200).json({ task: {
        _id,
        notificationDate,
        notify,
        userEmail,
        title,
        description,
        limitDate,
      }, message: "Added" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  update: async (req, res) => {
    try {
      const id = req.params.id;
      const {
        title,
        notify,
        description,
        notificationDate,
        limitDate,
        userEmail,
      } = req.body;
      const oldNotification = scheduledJobs[`${id}`];
      if (notify) {
        const { notificationDate: oldNotificationDate } = await Task.findById(
          id
        );
        const dateChanged =
          moment(notificationDate).format("YYYY-MM-DD HH:mm") !==
          moment(oldNotificationDate).format("YYYY-MM-DD HH:mm");

        if (dateChanged) {
          if (oldNotification) oldNotification.cancel();
          req.body.notified = false;
          const mustNotifyToday =
            moment(notificationDate).format("YYYY-MM-DD") ===
            moment().format("YYYY-MM-DD");

          if (mustNotifyToday) {
            notifyToday({
              id,
              notificationDate,
              userEmail,
              title,
              description,
              limitDate,
            });
          }
        }
      } else {
        if (oldNotification) oldNotification.cancel();
      }
      const task = await Task.findByIdAndUpdate(id, req.body, { new: true });
      console.log(scheduledJobs);
      res.status(200).json({ task });
    } catch (error) {
      res.status(500).json({ error: "couldn't update" });
    }
  },

  delete: async (req, res) => {
    try {
      const data = req.body;
      const ids = data.map((id) => new Types.ObjectId(`${id}`));
      await Task.deleteMany({
        _id: {
          $in: ids,
        },
      });
      res.status(200).json({ message: "Deleted" });
    } catch (error) {
      res.status(500).json({ error: "couldn't delete" });
    }
  },
};

const notifyToday = ({
  notificationDate,
  limitDate,
  id,
  userEmail,
  title,
  description,
}) => {
  const date = new Date(notificationDate);
  scheduleJob(`${id}`, date, async () => {
    await sendEmail(userEmail, title, "Notification", {
      description,
      limitDate: moment(limitDate).format("DD [de] MMMM [del] YYYY"),
    });
    await Task.updateOne({ _id: id }, { notified: true });
  });
};
