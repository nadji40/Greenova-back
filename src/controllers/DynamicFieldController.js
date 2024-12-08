const DynamicField = require("../models/DynamicFieldsModel")

exports.getDynamicFields = async (req, res) => {
    try {
        const dynamicFields = await DynamicField.find()
        if (!dynamicFields) {
            return res.status(404).json({
                success: false,
                error: "No Dynamic Field found"
            })
        }
        return res.status(201).json({
            success: true,
            data: dynamicFields
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error
        })
    }
}