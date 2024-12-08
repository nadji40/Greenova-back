const { config } = require("dotenv")
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require('dotenv').config();


config();

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
}));


app.use(express.json({ limit: "20kb" }))
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// routes import
const BusinessRoutes = require('./routes/BusinessRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const adminRoutes = require("./routes/admin")
const bookingRoutes = require("./routes/bookingRoutes")
const machinerySalesRoutes = require('./routes/machinerySalesRoutes');
const sparePartRoutes = require('./routes/sparePartRoutes');
const rawMaterialRoutes = require('./routes/RawMaterialRoutes');
const dynamicFieldRoutes = require('./routes/DynamicFieldRoutes');
const orderRoutes = require('./routes/orderRoutes');

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use('/api/business', BusinessRoutes);
app.use('/api/service', serviceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/booking', bookingRoutes);
app.use("/api/spare-parts", sparePartRoutes);
app.use("/api/raw-material", rawMaterialRoutes);
app.use('/api/machinery', machinerySalesRoutes);
app.use('/api/dynamic-fields', dynamicFieldRoutes);
app.use('/api/order', orderRoutes);


// Error handling middleware
app.use((err, req, res, next) => {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
});

module.exports = app
