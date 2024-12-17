const Order = require('../models/OrderModel');
const MachinerySale = require('../models/MachinerySaleModel'); // Assuming you have these models
const SparePart = require('../models/SparePartsModel');
// const RawMaterial = require('../models/');

// Place Order Controller
const placeOrder = async (req, res) => {
    try {
        // Destructure the body to get the order details
        const { items, salesTax, shippingFee, shippingOptions, totalAmount, shippingAddress, paymentMethod } = req.body;

        // // Ensure that the required fields are present
        // if (!items || !salesTax || !shippingFee || !totalAmount || !shippingAddress) {
        //     return res.status(400).json({ message: 'Missing required fields' });
        // }

        // Validate the items and calculate the total item cost
        let itemTotal = 0;

        for (let item of items) {
            const { itemType, itemId, quantity, price, currency, itemName, itemImg } = item;

            // Validate each item
            if (!itemType || !itemId || !quantity || !price || !currency || !itemName || !itemImg) {
                return res.status(400).json({ message: 'Invalid item data' });
            }

            // Fetch the item by its ID (depending on the item type)
            let itemRecord;
            if (itemType === 'MachinerySale') {
                itemRecord = await MachinerySale.findById(itemId);
            }
            else if (itemType === 'sparePart') {
                itemRecord = await SparePart.findById(itemId);
            }
            else if (itemType === 'rawMaterial') {
                itemRecord = await RawMaterial.findById(itemId);
            }

            if (!itemRecord) {
                return res.status(404).json({ message: `${itemType} not found` });
            }

            if (price !== itemRecord.price) {
                return res.status(400).json({ message: 'Item price mismatch' });
            }

            // Calculate the item cost (quantity * price)
            itemTotal += quantity * price;
        }

        // Validate the total amount sent from frontend
        // if (itemTotal + shippingFee + salesTax !== totalAmount) {
        //     return res.status(400).json({ message: 'Total amount does not match the sum of items, shipping, and tax' });
        // }

        // Create the order
        const newOrder = new Order({
            userId: req.user.userId,
            items,
            shippingAddress,
            shippingFee,
            shippingOptions,
            salesTax,
            totalAmount,
            paymentMethod,
            orderDate: new Date(),
        });

        // Save the order to the database
        const savedOrder = await newOrder.save();

        // Return the response with the created order details
        res.status(201).json({
            message: 'Order placed successfully',
            order: savedOrder,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const getOrders = async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.user.userId })
        if (!orders) {
            return res.status(404).json({
                success: false,
                error: "No Orders found"
            })
        }
        return res.status(201).json({
            success: true,
            message: "order fetched successfully",
            data: orders
        })
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            error: "Error fetching orders"
        })
    }
}

module.exports = { placeOrder, getOrders };
