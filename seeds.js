'use strict';
require("dotenv").config({
  path: __dirname + "/.env"
});
const fs = require("fs");
const request = require('request');

const mongoose = require("mongoose");
mongoose.connect(process.env.MONGOURL, { useNewUrlParser: true, useCreateIndex: true, reconnectTries: Number.MAX_VALUE, reconnectInterval: 1000 });
mongoose.Promise = global.Promise; // Tell Mongoose to use ES6 promises

const Story = require("./models/story");
const User = require("./models/user");
const Menulocation = require("./models/menulocation");
const Contact = require("./models/contact");
const Course = require("./models/course");
const Location = require("./models/location");
const Page = require("./models/page");
const Event = require("./models/event");

const EventsController = require('./controllers/admin/AdminEventsController');

const IMAGE_UPLOAD_DIR = process.env.IMAGE_UPLOAD_DIR;

const {menulocations, stories, pages, courses, users, events, adminUser, contacts} = require('./seeddata')

async function deleteData() {
  console.log("😢 Goodbye Data...");
  await Story.deleteMany();
  await Menulocation.deleteMany();
  await Location.deleteMany();
  await Course.deleteMany();
  await Contact.deleteMany();
  await Page.deleteMany();
  await User.deleteMany();
  await Event.deleteMany();
  console.log("Data Deleted. To load sample data, run\n\n\t npm run seeds\n\n");
  process.exit();
}

async function seedRandomNtoN(arrayOfRecords, relationship, model) {
  arrayOfRecords.map((record, index) => {
    var randomSetter = Math.floor(Math.random(relationship.length) * relationship.length + 1);
    record[model.collection.name] = [];
    for (let i = 0; i < randomSetter; i++) {
      return record[model.collection.name][i] = relationship[randomSetter - 1]._id.toString();
    }
  });
  return arrayOfRecords;
}
const downloadImages = async function (uri, filename, callback) {
  return new Promise(function (resolve, reject) {
    request.head(uri, function (err, res, body) {
      if (err) {
        console.log('error', err);
      }
      request(uri).pipe(fs.createWriteStream(filename)).on('close', () => {
        resolve()
      });
    });
  });
};

const imageUploadDir = IMAGE_UPLOAD_DIR;
async function seedRandomImages(arrayOfRecords, relationship, model) {
  var images = [
    'http://place-hoff.com/400/300',
    'http://place-hoff.com/400/301',
    'http://place-hoff.com/400/302',
    'http://place-hoff.com/400/303',
    'http://place-hoff.com/400/304',
    'http://place-hoff.com/400/305',
  ]
  let index = 0
  var promises = []
  for await (let image of images) {
    index++
    promises.push(downloadImages(image, `${imageUploadDir}/example_image_${index}.jpg`))
  }
  return promises
}
async function loadData() {
  try {
    await Promise.all(await seedRandomImages())
    console.log(`Images saved to ${imageUploadDir}`);

    await EventsController.fetchevents();

    const createdMenulocations = await Menulocation.insertMany(menulocations);
    const createdLocations = await Location.find();
    await Course.insertMany(courses);
    await Story.insertMany(stories);

    await User.create(adminUser)
    console.log(`You can now login as: `)
    console.log(`Email: ${adminUser.email} Password: password`)

    var associatedMenulocations = await seedRandomNtoN(pages, createdMenulocations, Menulocation)
    var associatedLocations = await seedRandomNtoN(contacts, createdLocations, Location)

    await Page.insertMany(associatedMenulocations)
    await Contact.insertMany(associatedLocations)

    console.log("👍 Done!\n\n Successfully loaded sample data");
    process.exit();
  } catch (e) {
    console.log(
      "\n👎 Error! The Error info is below but if you are importing sample data make sure to drop the existing database first with.\n\n\t npm run blowitallaway\n\n\n"
    );
    console.log(e);
    process.exit();
  }
}
if (process.argv.includes("--delete")) {
  deleteData();
} else {
  loadData();
}
