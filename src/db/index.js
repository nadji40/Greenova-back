const mongoose = require('mongoose');

const dbConnection = async () => {
    try {
        const connection = await mongoose.connect(`${process.env.MONGODB_URI}`)
        console.log(`database connected !! host ${connection.connection.host}`);
    } catch (error) {
        console.log(`db connection error : ${error}`);
    }
}
//cooment

module.exports = dbConnection
