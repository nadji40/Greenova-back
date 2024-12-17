const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const uploadOnCloudinary = require('../utils/cloudinary');
const Business = require("../models/BusinessModel")

exports.register = async (req, res) => {
  try {
    const { fullName, age, email, password, phoneNumber, userType } = req.body;

    if (!fullName || !age || !email || !password || !phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User already exist'
      });
    }

    // Validate age
    if (parseInt(age) <= 19) {
      return res.status(400).json({
        success: false,
        error: 'Must be older than 19 years'
      });
    }

    // Handle profile picture upload if provided
    let profilePictureUrl = null;
    if (req.file) {
      const uploadResult = await uploadOnCloudinary(req.file.buffer);
      profilePictureUrl = uploadResult.url;
      console.log("File uploaded to Cloudinary:", profilePictureUrl);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user in the database
    const user = new User({
      fullName,
      profilePicture: profilePictureUrl,
      age,
      email,
      password: hashedPassword,
      phoneNumber,
      userType
    });
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      'jwtsecret',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          age: user.age,
          profilePicture: user.profilePicture,
          email: user.email,
          phoneNumber: user.phoneNumber,
          userType: user.userType
        },
        token
      },
      message: "User Registered Successfully"
    });
  } catch (error) {
    console.error("Registration Error:", error);
    res.status(500).json({
      success: false,
      error: error
    });
  }
}

exports.login = async (req, res) => {
  try {
    const { email, password, userType } = req.body;
    let isBusinessFound = true;
    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password'
      });
    }

    // Find user - explicitly include password field
    const user = await User.findOne({ email })

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User doesnot exists'
      });
    }

    if (user.userType != userType) {
      return res.status(401).json({
        success: false,
        error: 'Invalid User Type'
      });
    }


    const passwordCheck = await bcrypt.compare(password, user.password)
    if (!passwordCheck) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect Password'
      });
    }

    // Generate JWT tokenz
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      "jwtsecret",
      { expiresIn: '24h' }
    );

    const business = await Business.findOne({ user: user._id })
    if (business) {
      isBusinessFound = true
    } else {
      isBusinessFound = false
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          profilePicture: user.profilePicture,
          age: user.age,
          email: user.email,
          phoneNumber: user.phoneNumber,
          userType: user.userType
        },
        token,
        isBusinessFound
      },
      message: "User loggedIn Successfully"
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Error logging in'
    });
  }
};

exports.logout = async (req, res) => {
  res.status(200).json({
    success: true,
    message: "Logged out successfully"
  });
};

exports.editProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { fullName, age, phoneNumber } = req.body;

    let profilePictureUrl;

    // Check if a file was uploaded
    if (req.file && req.file.path) {
      try {
        const profilePicture = await uploadOnCloudinary(req.file.path);
        if (!profilePicture || !profilePicture.url) {
          return res.status(400).json({
            success: false,
            error: "Image Upload Failed",
          });
        }
        profilePictureUrl = profilePicture.url;
      } catch (error) {
        console.error('Error uploading to Cloudinary:', error);
        return res.status(400).json({
          success: false,
          error: "Image Upload Failed",
        });
      }
    }

    // Validate age
    if (age && age <= 19) {
      return res.status(400).json({
        success: false,
        error: "Must be older than 19 years",
      });
    }



    // Prepare updated user data
    const updatedData = {
      ...(fullName !== undefined && { fullName }),
      ...(age !== undefined && { age }),
      ...(phoneNumber !== undefined && { phoneNumber }),
      ...(profilePictureUrl !== undefined && { profilePicture: profilePictureUrl }),
    };


    // Update user
    const updatedUser = await User.findByIdAndUpdate(userId, updatedData, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile Updated Successfully",
      data: {
        user: updatedUser
      },
    });
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({
      success: false,
      error: "Server Error, please try again later",
    });
  }
};


exports.getUser = async (req, res) => {
  try {
    const userId = req.user.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "user Id not provided"
      })
    }
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      })
    }

    return res.status(201).json({
      success: true,
      data: user,
      message: "user fetched successfully"
    })
  } catch (error) {
    console.log(error);
    res.status(500).json({
      successs: false,
      error: error.message
    })

  }
}