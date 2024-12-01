const express = require("express");
const app = require('./app.js')
const dbConnection = require('./db/index.js')
const { config } = require("dotenv")


config({
    path: './.env'
});

dbConnection()
    .then(() => {
        app.listen(process.env.PORT || 8000, () => {
            console.log(`Server is running on port ${process.env.PORT || 8000}`);
        });
    })
    .catch(err => {
        console.log("Database connection failed!!", err);
    });
