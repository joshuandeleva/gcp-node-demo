# gcp-node-demo
Let’s build a Node.js + Express API from scratch, connect Cloud SQL for MySQL, and deploy it all to Google Cloud using gcloud CLI.

The API will consist of some GET endpoints for retrieving warehouse names and zip codes from an imaginary “Acme” company.

This guide is for developers unfamiliar with Google Cloud Platform (GCP), so you’ll start simple and small, and connect things one at a time as you need them.

Here’s what we’ll do:

Install Node.js and gcloud CLI locally
Create a MySQL DB in Cloud SQL on GCP
Connect to it using a DB client, and seed it with some data
Create a basic API in Node.js and Express, run it locally
Deploy the API to a container on GCP
Add MySQL connectivity to the container
Store MySQL credentials in GCP Secrets Manager
Redeploy, and run the API across the internet
Review all the moving parts in GCP
Make code changes, and redeploy
Kill everything in GCP so you don’t get charged
Table of Contents
Prerequisites
Use Linux For This
Create Google Cloud Platform Account
Setup gcloud CLI
Setup Node.js and Express.js Locally
Create and Seed a Database in Google Cloud
Create MySQL Instance
Connect to the DB with a Client
Create a Table and Seed it With Data
Create an Express API in Node.js
Initialize the API
Add MySQL Connectivity
Add API Routes that Connect to the DB
Add More Data
Deploy to Google Cloud Using gcloud
Setup SQL Connectivity in the Container
Add Cloud SQL Connection in Container
Store DB Credentials in Secrets Manager
Add Secret Manager Accessor Role to the Service Account
Redeploy
How Do I Make Changes and Redeploy?
Where Did Everything Deploy to in Google Cloud?
Cloud Run
Cloud Build
Artifact Registry
Secrets Manager
IAM & Admin
IAM & Admin > Asset Inventory
Clean Up
Prerequisites
Use Linux For This
Windows Users: You’ll need an actual Linux terminal for this. So, run Ubuntu in Windows through WSL.
Linux Users: This guide is written for Ubuntu.
Mac Users: I’m sure you’ll be fine ;)
Create Google Cloud Platform Account
Head over to cloud.google.com and create an account if you don’t already have one.

New accounts come with a free $300 in spending credits.

All of the services used in this article are free tier, except Cloud SQL (MySQL). I used up only 82 cents of that $300 for this article.

Setup gcloud CLI
Fire up the terminal:

Install gcloud
Run gcloud init and follow the prompts to get authorized and configured.
See Google’s guide for additional help.
By the end of this process, you should see something like:

[compute]
region = us-east1
zone = us-east1-b
[core]
account = user@google.com
disable_usage_reporting = False
project = example-project
Setup Node.js and Express.js Locally
 Mac users: You're on your own for this step.
Fire up your Ubuntu terminal and run the following:

# Install NVM (Node Version Manager). Note: v0.38 is the latest version at this time
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash

# Restart terminal:
source ~/.bashrc

# Install node. This is the latest version at the time of this writing
nvm install v16.13.1

# Verify that node works:
node -v
Create and Seed a Database in Google Cloud
In the following steps, we’ll create a MySQL instance, connect to it, and seed it with test data.

Why MySQL? Because it’s the most used.

Create MySQL Instance
Create the MySQL instance:

Click GCP > SQL > Create Instance
Choose MySQL
Enable the Compute API if it asks you
Enter the following:
Instance ID: acme-db
Password: Click “GENERATE”
Database version: 5.7
Region: us-east1
Zone Availability: Single zone
Click “Show Configuration Options”:
Storage > Machine Type: Shared core
Storage > Storage Type: SSD
Storage > Storage Capacity: 10GB
Backups > Automate backups: uncheck
Backups > Enable point-in-time recovert: uncheck
Click “Create Instance”
 Spinning this up and running it for a short time will cost you a few cents of your free credits. We'll be shutting this (and everything else) down by the end of this article.
Wait until the instance is ready. ~10 minutes.

Create a user for your API to use:

Go to GCP > SQL > acme > Users
Click “Add User Account”:
User: test
Password: Generate a secure password. Copy it down for later.
Set it to allow all hosts
Click “Add”
Create a database in the MySQL instance:

Go to GCP > SQL > acme > Databases
Click “Create Database”
Name: acme
Click “Create”
Authorize your localhost to connect to this Cloud DB:

Go to GCP > SQL > acme > Connections
Click “Add Network”
Name: me
Network: Get your IPv4, and append /32 to it. Eg for 12.34.56.78, enter 12.34.56.78/32
Click “Done”
Click “Save”
Connect to the DB with a Client
Connect to the new DB with a MySQL GUI client of your choice:

Host: Get from GCP > SQL > acme > Overview > Public IP Address
User: test
Password: the password you generated a few steps up
Port: 3306
Create a Table and Seed it With Data
Run this in the acme database from your MySQL GUI client:

CREATE TABLE `warehouses` (
   `id` INT NULL,
   `name` VARCHAR(50) NULL DEFAULT NULL,
   `zip` VARCHAR(10) NULL DEFAULT NULL,
   INDEX `index` (`id`)
)
COLLATE='utf8_general_ci';

INSERT INTO warehouses VALUES
   (1, 'Warehouse #1', '33614'), 
   (2, 'Warehouse #23', '90210'),
   (3, 'Warehouse #103', '03103')
;

SELECT * FROM warehouses;
You should see data:

id	name	zip
1	Warehouse #1	33614
2	Warehouse #23	90210
3	Warehouse #103	03103
Create an Express API in Node.js
Initialize the API
Create some project directory:

mkdir my-node-api && cd my-node-api
Initialize a project, hit enter through all the questions:

npm init
Add the start script and node engine to the package.json that was generated.

These will be needed by gcloud later on when deploying to Google Cloud.

The full file should look like this:

{
  "name": "my-node-api",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "engines": {
    "node": ">= 12.0.0"
  },
  "author": "",
  "license": "ISC"
}
Pull in the Express framework, and create an entry point:

npm install express --save
touch index.js
Edit index.js and create a basic Express API that responds to / GET:

const express = require('express');
const app = express();

app.get('/', (req, res) => res.send('Hello world.'));

app.listen(8080, () => console.log('App is running at: http://localhost:8080'));
Boot the app:

node index.js
Verify http://localhost:8080 works.

Add MySQL Connectivity
For this step, we’ll connect this API to the MySQL DB running on GCP.

Install these packages:

npm install mysql --save
npm install dotenv --save
npm install body-parser --save
Initialize these files:

touch database.js .env .gitignore
 Make sure git won't let you accidentally commit your MySQL username and password:
echo ".env" > .gitignore
Edit .env and add the DB connection parameters from earlier:

DB_HOST=your.database.ip.address
DB_NAME=acme
DB_USER=test
DB_PASS=your-db-user-password
Edit database.js and copy/paste this into it:

const mysql = require('mysql');

var config = {
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
};

// Later on when running from Google Cloud, env variables will be passed in container cloud connection config
if(process.env.NODE_ENV === 'production') {
  console.log('Running from cloud. Connecting to DB through GCP socket.');
  config.socketPath = `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`;
}

// When running from localhost, get the config from .env
else {
  console.log('Running from localhost. Connecting to DB directly.');
  config.host = process.env.DB_HOST;
}

let connection = mysql.createConnection(config);

connection.connect(function(err) {
  if (err) {
    console.error('Error connecting: ' + err.stack);
    return;
  }
  console.log('Connected as thread id: ' + connection.threadId);
});

module.exports = connection;
Add API Routes that Connect to the DB
With MySQL now connected, let’s rewrite the GET endpoints to retrieve data from the DB.

Edit index.js, nuke everything in there, replace with:

require('dotenv').config()

const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const connection = require('./database');

app.get('/', (req,res) => res.send('Try: /status, /warehouses, or /warehouses/2') );

app.get('/status', (req, res) => res.send('Success.') );

app.get('/warehouses', (req, res) => {
  connection.query(
    "SELECT * FROM `acme`.`warehouses`",
    (error, results, fields) => {
      if(error) throw error;
      res.json(results);
    }
  );
});

app.route('/warehouses/:id')
  .get( (req, res, next) => {
    connection.query(
      "SELECT * FROM `acme`.`warehouses` WHERE id = ?", req.params.id,
      (error, results, fields) => {
        if(error) throw error;
        res.json(results);
      }
    );
  });

// Use port 8080 by default, unless configured differently in Google Cloud
const port = process.env.PORT || 8080;
app.listen(port, () => {
   console.log(`App is running at: http://localhost:${port}`);
});
Restart the local server:

node index.js
Verify these are returning data in a browser:

http://localhost:8080
http://localhost:8080/status
http://localhost:8080/warehouses
http://localhost:8080/warehouses/1
http://localhost:8080/warehouses/2
http://localhost:8080/warehouses/3
Add More Data
Go to this URL in a browser:

http://localhost:8080/warehouses/4
This endpoint gets an empty [] response because there is no warehouse with an ID of 4 in the DB yet.

So add it in the DB through your MySQL GUI client:

INSERT INTO warehouses VALUES (4, 'Warehouse #4', '12345');
Now the endpoint should automatically return that data:

http://localhost:8080/warehouses/4

..because of this dynamic GET routing in index.js:

app.route('/warehouses/:id')
  .get( (req, res, next) => {
Alright, so now the DB is fully working from localhost.

Deploy to Google Cloud Using gcloud
Now for the fun part: running all of this from Google Cloud Platform, and accessing the API from the internet.

From the directory where index.js etc is, run:

gcloud run deploy
