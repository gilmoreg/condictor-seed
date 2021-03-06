/* eslint-disable no-underscore-dangle */
/* eslint-disable consistent-return */
/* eslint-disable no-console */
const mongoose = require('mongoose');
const faker = require('faker');
const readline = require('readline');
const fetch = require('node-fetch');
const schemas = require('./schemas');
require('dotenv').config();

mongoose.Promise = global.Promise;

const comments = [
  'I\'m on it!',
  'Checking this out.',
  'Let me handle this one.',
  'Reached out to the consumer for more info.',
  'The next version should solve this issue.',
  'Checked with engineering for a possible fix. Waiting to hear back.',
  'I think I have a fix documented somewhere. I\'ll get back to this asap.'
];

const descriptions = [
  'Consumer lost the product manual.',
  'Consumer has a feature suggestion',
  'Consumer needs replacement parts.',
  'Consumer needs clarification on assembly/install instructions.',
  'Feature x is not functioning properly for this consumer.',
  'Consumer wants a time estimate on next version'
];

function onErr(err) {
  console.error(err);
  process.exit(1);
}

process.on('unhandledRejection', (reason, p) =>
  onErr('Unhandled Rejection at: Promise', p, 'reason:', reason));

function dropDatabase() {
  return mongoose.connection.db.dropDatabase();
}

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateUsers(num) {
  return new Promise((resolve, reject) => {
    const promises = [];
    for (let i = 0; i < num; i += 1) {
      const user = { username: faker.name.firstName(), password: 'test', fullname: faker.name.findName() };
      promises.push(schemas.User.create(user));
    }
    Promise.all(promises)
      .then((users) => {
        const userIDs = users.map(user => user._id);
        resolve(userIDs);
      })
      .catch(err => reject(err));
  });
}

function generateProducts(num) {
  return new Promise((resolve, reject) => {
    const promises = [];
    for (let i = 0; i < num; i += 1) {
      const product = { name: faker.commerce.productName() };
      promises.push(schemas.Product.create(product));
    }
    Promise.all(promises)
      .then((products) => {
        const productIDs = products.map(product => product._id);
        resolve(productIDs);
      })
      .catch(err => reject(err));
  });
}

function generateConsumers(num) {
  return new Promise((resolve, reject) => {
    const promises = [];
    for (let i = 0; i < num; i += 1) {
      const consumer = {
        name: faker.name.findName(),
        products: [],
      };
      promises.push(schemas.Consumer.create(consumer));
    }
    Promise.all(promises)
      .then((consumers) => {
        const consumerIDs = consumers.map(consumer => consumer._id);
        resolve(consumerIDs);
      })
      .catch(err => reject(err));
  });
}

function addProductsToConsumers(pids, cids) {
  return new Promise((resolve, reject) => {
    const promises = [];
    // For simplicity's sake, add every product to every consumer
    // to guarantee there are no consumerless products or productless consumers
    for (let i = 0; i < pids.length; i += 1) {
      for (let j = 0; j < cids.length; j += 1) {
        const promise = schemas
          .Consumer
          .findByIdAndUpdate(cids[j], { $push: { products: pids[i] } });
        promises.push(promise);
      }
    }
    Promise.all(promises).then(results => resolve(results))
      .catch(err => reject(err));
  });
}

function generateTicket(owner, consumer, product) {
  return new Promise((resolve, reject) => {
    const ticket = {
      description: randomElement(descriptions),
      product,
      consumer,
      owner,
      created: Date.now() - 100000,
      closed: (Math.random() > 0.5) ? Date.now() : null,
      priority: Math.floor(Math.random() * 5) + 1,
      comments: [],
    };
    schemas.Ticket.create(ticket)
      .then(t => resolve(t))
      .catch(err => reject(err));
  });
}

function createTickets(uids, pids, cids, num) {
  return new Promise((resolve, reject) => {
    const promises = [];
    for (let i = 0; i < num; i += 1) {
      const user = randomElement(uids);
      const product = randomElement(pids);
      const consumer = randomElement(cids);
      promises.push(generateTicket(user, consumer, product));
    }
    Promise.all(promises)
      .then((tickets) => {
        const ticketIDs = tickets.map(ticket => ticket._id);
        resolve(ticketIDs);
      })
      .catch(err => reject(err));
  });
}

function createComments(uids, tids, num) {
  return new Promise((resolve, reject) => {
    const promises = [];
    for (let i = 0; i < num; i += 1) {
      const user = randomElement(uids);
      const ticket = randomElement(tids);
      const comment = {
        owner: user,
        created: Date.now(),
        description: randomElement(comments),
      };
      const promise = schemas
        .Comment
        .create(comment)
        .then((c) => {
          schemas.Ticket.findByIdAndUpdate(ticket, { $push: { comments: c._id } })
            .then(() => resolve(c))
            .catch(err => reject(err));
        });
      promises.push(promise);
    }
    Promise.all(promises)
      .then(results => resolve(results))
      .catch(err => reject(err));
  });
}

function seed() {
  mongoose.connect(process.env.MONGODB_URL, (err) => {
    if (err) return onErr(err);
    dropDatabase().then(() => {
      console.log('db dropped');
      generateUsers(3).then((uids) => {
        console.log('users created');
        generateProducts(5).then((pids) => {
          console.log('products created');
          generateConsumers(3).then((cids) => {
            console.log('consumers created');
            addProductsToConsumers(pids, cids).then(() => {
              console.log('products added to consumers');
              createTickets(uids, pids, cids, 5).then((tids) => {
                console.log('tickets created');
                createComments(uids, tids, 10).then(() => {
                  console.log('New data seeded in database.');
                  mongoose.disconnect();
                  // Create demo account
                  fetch(`${process.env.API_URL}/signup`, {
                    headers: {
                      Accept: 'application/json',
                      'Content-Type': 'application/json',
                    },
                    method: 'post',
                    body: JSON.stringify({ username: 'test', password: 'test' }), 
                  })
                  .then(() => console.log('Demo user created. All done.'))
                  .catch(err => console.log('Error creating demo user.', err));
                });
              });
            });
          });
        });
      });
    })
    .catch((error) => {
      console.log(error);
      mongoose.disconnect();
      process.exit(1);
    });
  });
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
rl.question('Running this script will DESTROY existing data. Type "yes" to continue.\n', (answer) => {
  rl.close();
  if (answer === 'yes') seed();
  else {
    console.log('Aborting.');
    process.exit(0);
  }
});
