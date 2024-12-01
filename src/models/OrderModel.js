const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [
        {
            itemType: { type: String, enum: ['MachinerySale', 'sparePart', 'rawMaterial'], required: true },
            itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
            quantity: { type: Number, required: true },
            currency: { type: String, required: true },
            itemName: { type: String, required: true },
            itemImg: { type: String, required: true },
            price: { type: Number, required: true }
        }
    ],
    shippingFee: { type: Number, required: true },
    shippingOptions: { type: String, enum: ["standard", "express" , "priority"], required: true },
    salesTax: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    shippingAddress: {
        houseNo: {
            type: String
        },
        address: {
            type: String
        },
        state: {
            type: String
        },
        city: {
            type: String
        },
        postalCode: {
            type: String
        },
    },
    paymentMehod: { type: String, enum: ["cod", "card"], default: "cod" },
    status: { type: String, enum: ["pending", "shipped", "completed",], default: 'pending' },
    orderDate: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
