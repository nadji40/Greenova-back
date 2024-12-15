const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true,
  },
  profilePicture: {
    type: String,
  },
  age: {
    type: String,
  },
  phoneNumber: String,
  userType: {
    type: String,
    enum: ['user', 'serviceProvider', 'admin'],
    default: 'user'
  },

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
