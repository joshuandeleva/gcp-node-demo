const express = require('express')
require('dotenv').config()
const connection = require('./database');
const port  = process.env.PORT || 5000;
const app = express();

//parse json
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get('/', (req, res) => res.send('Try: /status, /warehouses, or /warehouses/2'));

app.get('/status', (req, res) => res.send('Success.'));

app.get('/warehouses', (req, res) => {
    connection.query(
        "SELECT * FROM `acme`.`warehouses`",
        (error, results, fields) => {
            if (error) throw error;
            res.json(results);
        }
    );
});

app.route('/warehouses/:id')
    .get((req, res, next) => {
        connection.query(
            "SELECT * FROM `acme`.`warehouses` WHERE id = ?", req.params.id,
            (error, results, fields) => {
                if (error) throw error;
                res.json(results);
            }
        );
    });

// Use port 8080 by default, unless configured differently in Google Cloud
app.get('/', (req, res) => res.send('Hello World!'))
app.listen(port, () => (console.log('listening on port 8000')))
