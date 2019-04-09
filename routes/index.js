"use strict";
require("dotenv").config({ path: __dirname + "/../.env" });
const Story = require("../models/story");
const Contact = require("../models/contact");
const Location = require("../models/location");
const Course = require("../models/course");
const Event = require("../models/event");
const request = require("request");
const express = require("express");
const router = express.Router();
const { sendMail } = require("../helpers/helper");

if (!process.env.AUTHORIZATION || !process.env.URL) {
  console.error(
    "Please set a Mailchimp URL or AUTHORIZATION ApiKey in .env file"
  );
  process.exit();
}

router.get("/", async (req, res) => {
  try {
    const stories = await Story.find({})
      .sort("order")
      .limit(3)
      .exec({});
    const locations = await Location.find({});

    let courses = await Course.find({});
    let events = [];
    for await (let loc of locations) {
      if (!events) {
        events[await Event.findOne({ location: loc._id }).populate("location")];
      } else {
        const event = await Event.findOne({ location: loc._id }).populate(
          "location"
        );
        if (event) {
          events.push(event);
        }
      }
    }

    res.render("index", {
      events,
      stories,
      locations,
      courses
    });
    //console.log('From index.js router', events);
  } catch (err) {
    console.log(err);
  }
});

router.post("/contact", async (req, res, next) => {
  const contact = new Contact();
  contact.name = req.body.name;
  contact.email = req.body.email;
  contact.body = req.body.body;
  contact.createdAt = new Date();
  contact.isCompany = req.body.companytour ? true : false;
  contact.locations = req.body.locations;
  if (!contact.email) {
    res.redirect(req.headers.referer);
  }

  contact.save(async function (err) {
    if (err) res.send(err);
    const mailOptions = {
      from: 'mgidro16@gmail.com',
      to: req.body.companytour ? process.env.TOURMAILRECEIVER : process.env.MAILRECEIVER,
      subject: req.body.companytour ? `Company Tour request from website` : `Message on website`,
      text: `${req.body.body}`,
      html: `Имя: ${req.body.name}, Почта клиента: ${req.body.email}, Текст сообщения: ${req.body.body}`
    }
    const info = await sendMail(req, mailOptions);
    req.flash(
      "success",
      `Спасибо за Ваше сообщение. Мы Вам очень скоро ответим.`
    );
    console.log("Message sent: %s", info.messageId);
    res.redirect(req.headers.referer);
    next();
  });
});

router.get("/tour", async (req, res) => {
  try {
    res.render("tour", { companytour: true });
  } catch (err) {
    console.log(err);
  }
});


router.post("/newsletter-signup", function (req, res) {
  const { email } = req.body;

  // Make sure fields are filled
  if (!email) {
    return res.status(422).json({
      code: 422,
      message: "No valid email address given!"
    });
  }

  // Construct req data
  const data = {
    members: [
      {
        email_address: email,
        status: "subscribed"
        // merge_fields: {}
      }
    ]
  };

  try {
    const postData = JSON.stringify(data);

    const options = {
      url: process.env.URL,
      method: "POST",
      headers: {
        Authorization: process.env.AUTHORIZATION
      },
      body: postData
    };

    request(options, (err, response) => {
      if (err) {
        return res.json({
          code: response.statusCode,
          message: error.message
        });
      } else {
        const json = JSON.parse(response.body);
        if (response.statusCode === 200 && json.errors.length === 0) {
          return res.status(200).json({
            code: 200,
            message: "Successfully subscribed to the newsletter!"
          });
        } else {
          return res.status(422).json({
            code: json.errors ? 422 : response.statusCode,
            message: json.errors
          });
        }
      }
    });
  } catch (err) {
    console.log(
      `A error occured in the newsletter subscription route \n\n ${err}`
    );
  }
});

module.exports = router;
